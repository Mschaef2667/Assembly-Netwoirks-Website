'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Question, SurveyState, CopilotStatus, Audience, QuestionType, Segment } from './types'
import {
  STAGES, AUDIENCES, TYPE_ORDER, TYPE_LABELS, DEFAULT_SURVEY_QUESTIONS, LOCKED_QUESTIONS,
  uid,
} from './constants'

function parseSegmentsFromStep2(content: Record<string, unknown>): Segment[] {
  if (Array.isArray(content['segments'])) {
    return (content['segments'] as Array<Record<string, unknown>>)
      .filter(s => typeof s['name'] === 'string' && (s['name'] as string).trim())
      .slice(0, 3)
      .map(s => {
        const name = (s['name'] as string).trim()
        return { id: name, name, slug: name.toLowerCase().replace(/\s+/g, '-') }
      })
  }
  // Try individual field format: segment_1_name, segment_2_name, etc.
  const segs: Segment[] = []
  for (let i = 1; i <= 3; i++) {
    const raw = content[`segment_${i}_name`] ?? content[`segment_name_${i}`]
    if (typeof raw === 'string' && raw.trim()) {
      const name = raw.trim()
      segs.push({ id: name, name, slug: name.toLowerCase().replace(/\s+/g, '-') })
    }
  }
  return segs
}

function computeStepId(audience: Audience, segment: Segment | null): string {
  const slug = segment?.slug ?? 'all-segments'
  return `survey-builder-${audience}-${slug}`
}

// Hydrate questions loaded from the DB so stale `modified` flags don't
// surface "Modified / Restore" badges on slots the user hasn't edited
// in this session. `originalText` is backfilled from the current text
// when missing, so future in-session edits compute `modified` correctly.
function hydrateLoadedQuestions(raw: Record<string, unknown[]>): SurveyState {
  const parsed: SurveyState = {}
  for (const [k, v] of Object.entries(raw)) {
    parsed[parseInt(k, 10)] = (v as Question[]).map(q => {
      if (!q.locked) return q
      return { ...q, modified: false, originalText: q.originalText ?? q.text }
    })
  }
  return parsed
}

export function useSurveyState() {
  const [survey, setSurvey]                         = useState<SurveyState>({})
  const [openStages, setOpenStages]                 = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7]))
  const [editingId, setEditingId]                   = useState<string | null>(null)
  const [editText, setEditText]                     = useState('')
  const [copilotStatus, setCopilotStatus]           = useState<CopilotStatus>('idle')
  const [stageCounts, setStageCounts]               = useState<Record<number, number> | null>(null)
  const [copilotError, setCopilotError]             = useState<string | null>(null)
  const [orgId, setOrgId]                           = useState<string | null>(null)
  const [orgName, setOrgName]                       = useState<string>('')
  const [preferredModel, setPreferredModel]         = useState('claude-sonnet-4-5')
  const [saveState, setSaveState]                   = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [copyDone, setCopyDone]                     = useState(false)
  const [loading, setLoading]                       = useState(true)
  const [selectedAudience, setSelectedAudience]     = useState<Audience>('current')
  const [hoveringQId, setHoveringQId]               = useState<string | null>(null)
  const [isApproved, setIsApproved]                 = useState(false)
  const [markingComplete, setMarkingComplete]       = useState(false)
  const [segments, setSegments]                     = useState<Segment[]>([])
  const [selectedSegment, setSelectedSegment]       = useState<Segment | null>(null)
  const [autoWordingStatus, setAutoWordingStatus]   = useState<'idle' | 'loading' | 'done'>('idle')
  const [autoWordingLabel, setAutoWordingLabel]     = useState('')
  const [probes, setProbes]                         = useState<Map<string, string[]>>(new Map())

  const orgIdRef             = useRef<string | null>(null)
  const outputIdRef          = useRef<string | null>(null)
  const surveyRef            = useRef<SurveyState>({})
  const saveTimerRef         = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audienceStepIdRef    = useRef<string>('survey-builder-current-all-segments')
  const preferredModelRef    = useRef('claude-sonnet-4-5')
  const selectedAudienceRef  = useRef<Audience>('current')
  const selectedSegmentRef   = useRef<Segment | null>(null)
  const autoProbesGenerated  = useRef(false)

  useEffect(() => {
    void load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: userRow } = await supabase
        .from('users').select('org_id').eq('id', user.id).single()
      if (!userRow) return

      const oid = (userRow as Record<string, unknown>)['org_id'] as string
      orgIdRef.current = oid
      setOrgId(oid)

      const { data: orgRow } = await supabase
        .from('organizations').select('preferred_model, name').eq('id', oid).single()
      if (orgRow) {
        const model = String((orgRow as Record<string, unknown>)['preferred_model'] ?? 'claude-sonnet-4-5')
        preferredModelRef.current = model
        setPreferredModel(model)
        const name = String((orgRow as Record<string, unknown>)['name'] ?? '')
        setOrgName(name)
      }

      // Load segments from Step 2
      const { data: step2Row } = await supabase
        .from('step_output')
        .select('content')
        .eq('workspace_id', oid)
        .eq('step_id', '2')
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      let loadedSegments: Segment[] = []
      if (step2Row) {
        const content = (step2Row as Record<string, unknown>)['content'] as Record<string, unknown> | null
        if (content) loadedSegments = parseSegmentsFromStep2(content)
      }
      setSegments(loadedSegments)

      const initialSegment = loadedSegments.length > 0 ? loadedSegments[0] : null
      setSelectedSegment(initialSegment)
      selectedSegmentRef.current = initialSegment

      const stepId = computeStepId('current', initialSegment)
      audienceStepIdRef.current = stepId

      const { data: outputRow } = await supabase
        .from('step_output')
        .select('id, content, status')
        .eq('workspace_id', oid)
        .eq('step_id', stepId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (outputRow) {
        const row = outputRow as Record<string, unknown>
        outputIdRef.current = String(row['id'] ?? '')
        if (row['status'] === 'approved') setIsApproved(true)
        const content = row['content'] as Record<string, unknown> | null
        if (content?.['questions']) {
          const parsed = hydrateLoadedQuestions(content['questions'] as Record<string, unknown[]>)
          surveyRef.current = parsed
          setSurvey(parsed)
          return
        }
      }

      // No saved questions — trigger auto-wording silently
      void triggerAutoWording(oid, 'current', initialSegment)
    } catch { /* non-fatal */ }
    finally { setLoading(false) }
  }

  async function triggerAutoWording(oid: string, audience: Audience, segment: Segment | null) {
    const audienceLabel = AUDIENCES.find(a => a.id === audience)!.label
    const segmentLabel  = segment?.name ?? 'All Segments'
    setAutoWordingStatus('loading')
    setAutoWordingLabel(`${segmentLabel} — ${audienceLabel}`)

    try {
      const lockedQTexts = Object.entries(LOCKED_QUESTIONS).flatMap(([stageKey, qs]) =>
        qs.map(q => ({ stage: parseInt(stageKey, 10), text: q.text }))
      )

      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: 'survey-builder-autowording',
          workspaceId: oid,
          stepTitle: 'Survey Auto-Wording',
          stepDescription: 'Reword core survey questions for segment and audience',
          currentContent: '',
          preferredModel: preferredModelRef.current,
          extraContext: JSON.stringify({ segment: segmentLabel, audience: audienceLabel, questions: lockedQTexts }),
        }),
      })

      if (!res.ok || !res.body) {
        loadDefaultLockedQuestions()
        setAutoWordingStatus('idle')
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }

      if (accumulated.includes('__STREAM_ERROR__')) {
        loadDefaultLockedQuestions()
        setAutoWordingStatus('idle')
        return
      }

      const firstBrace = accumulated.indexOf('{')
      const lastBrace  = accumulated.lastIndexOf('}')
      const jsonStr    = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
        ? accumulated.slice(firstBrace, lastBrace + 1)
        : accumulated.trim()

      const parsed = JSON.parse(jsonStr) as { questions?: Array<{ stage: number; text: string }> }

      if (!parsed.questions || parsed.questions.length < 15) {
        loadDefaultLockedQuestions()
        setAutoWordingStatus('idle')
        return
      }

      // Build survey with auto-worded locked questions
      const newSurvey: SurveyState = {}
      let qIndex = 0
      for (const [stageKey, lockedQs] of Object.entries(LOCKED_QUESTIONS)) {
        const stageId = parseInt(stageKey, 10)
        newSurvey[stageId] = lockedQs.map(lockedQ => {
          const rewording = parsed.questions![qIndex++]
          return {
            id: uid(),
            text: rewording?.text ?? lockedQ.text,
            type: lockedQ.type,
            stageId,
            locked: true,
            modified: false,
            originalText: lockedQ.text,
          }
        })
      }

      surveyRef.current = newSurvey
      setSurvey(newSurvey)
      scheduleSave(newSurvey)
      setAutoWordingStatus('done')
    } catch {
      loadDefaultLockedQuestions()
      setAutoWordingStatus('idle')
    }
  }

  function loadDefaultLockedQuestions() {
    const newSurvey: SurveyState = {}
    for (const [stageKey, lockedQs] of Object.entries(LOCKED_QUESTIONS)) {
      const stageId = parseInt(stageKey, 10)
      newSurvey[stageId] = lockedQs.map(q => ({
        id: uid(),
        text: q.text,
        type: q.type,
        stageId,
        locked: true,
        modified: false,
        originalText: q.text,
      }))
    }
    surveyRef.current = newSurvey
    setSurvey(newSurvey)
    scheduleSave(newSurvey)
  }

  function scheduleSave(updated: SurveyState) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const oid = orgIdRef.current
      if (!oid) return
      setSaveState('saving')
      try {
        if (outputIdRef.current) {
          const { error } = await supabase
            .from('step_output')
            .update({ content: { questions: updated }, last_saved_at: new Date().toISOString() })
            .eq('id', outputIdRef.current)
          if (error) throw error
        } else {
          const { data, error } = await supabase
            .from('step_output')
            .insert({ workspace_id: oid, step_id: audienceStepIdRef.current, content: { questions: updated }, status: 'draft', version: 1 })
            .select('id').single()
          if (error) throw error
          if (data) outputIdRef.current = (data as Record<string, unknown>)['id'] as string
        }
        setSaveState('saved')
        setTimeout(() => setSaveState('idle'), 2500)
      } catch { setSaveState('error') }
    }, 2000)
  }

  function updateSurvey(updated: SurveyState) {
    surveyRef.current = updated
    setSurvey(updated)
    scheduleSave(updated)
  }

  async function loadSurveyForCombo(oid: string, audience: Audience, segment: Segment | null) {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    const stepId = computeStepId(audience, segment)
    audienceStepIdRef.current = stepId
    outputIdRef.current = null
    surveyRef.current = {}
    setSurvey({})
    setCopilotStatus('idle')
    setCopilotError(null)
    setStageCounts(null)
    setIsApproved(false)
    setAutoWordingStatus('idle')

    try {
      const { data: outputRow } = await supabase
        .from('step_output')
        .select('id, content, status')
        .eq('workspace_id', oid)
        .eq('step_id', stepId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (outputRow) {
        const row = outputRow as Record<string, unknown>
        outputIdRef.current = String(row['id'] ?? '')
        if (row['status'] === 'approved') setIsApproved(true)
        const content = row['content'] as Record<string, unknown> | null
        if (content?.['questions']) {
          const parsed = hydrateLoadedQuestions(content['questions'] as Record<string, unknown[]>)
          surveyRef.current = parsed
          setSurvey(parsed)
          return
        }
      }
      // No saved questions — trigger auto-wording
      void triggerAutoWording(oid, audience, segment)
    } catch { /* non-fatal */ }
  }

  async function handleAudienceSwitch(audience: Audience) {
    const oid = orgIdRef.current
    if (!oid) return
    setSelectedAudience(audience)
    selectedAudienceRef.current = audience
    await loadSurveyForCombo(oid, audience, selectedSegmentRef.current)
  }

  async function handleSegmentSwitch(segment: Segment | null) {
    const oid = orgIdRef.current
    if (!oid) return
    setSelectedSegment(segment)
    selectedSegmentRef.current = segment
    await loadSurveyForCombo(oid, selectedAudienceRef.current, segment)
  }

  function toggleStage(id: number) {
    setOpenStages(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function addQuestion(stageId: number) {
    const q: Question = { id: uid(), text: '', type: 'open', stageId }
    const updated = { ...survey, [stageId]: [...(survey[stageId] ?? []), q] }
    updateSurvey(updated)
    setEditingId(q.id)
    setEditText('')
  }

  function deleteQuestion(stageId: number, qId: string) {
    const updated = { ...survey, [stageId]: (survey[stageId] ?? []).filter(q => q.id !== qId) }
    updateSurvey(updated)
    if (editingId === qId) setEditingId(null)
  }

  function commitEdit(stageId: number, qId: string) {
    const val = editText.trim()
    const updated = {
      ...survey,
      [stageId]: (survey[stageId] ?? []).map(q => {
        if (q.id !== qId) return q
        if (q.locked) {
          const isModified = val !== (q.originalText ?? '')
          return { ...q, text: val, modified: isModified }
        }
        return { ...q, text: val }
      }),
    }
    updateSurvey(updated)
    setEditingId(null)
  }

  function restoreQuestion(stageId: number, qId: string) {
    const updated = {
      ...survey,
      [stageId]: (survey[stageId] ?? []).map(q => {
        if (q.id !== qId || !q.locked) return q
        return { ...q, text: q.originalText ?? q.text, modified: false }
      }),
    }
    updateSurvey(updated)
  }

  function addMissingLockedQuestions() {
    const newSurvey = { ...survey }
    for (const [stageKey, lockedQs] of Object.entries(LOCKED_QUESTIONS)) {
      const stageId = parseInt(stageKey, 10)
      const existingQs  = newSurvey[stageId] ?? []
      const lockedCount = existingQs.filter(q => q.locked).length
      if (lockedCount < lockedQs.length) {
        const toAdd = lockedQs.slice(lockedCount).map(q => ({
          id: uid(),
          text: q.text,
          type: q.type,
          stageId,
          locked: true,
          modified: false,
          originalText: q.text,
        }))
        newSurvey[stageId] = [...existingQs, ...toAdd]
      }
    }
    updateSurvey(newSurvey)
  }

  function cycleType(stageId: number, qId: string) {
    const updated = {
      ...survey,
      [stageId]: (survey[stageId] ?? []).map(q => {
        if (q.id !== qId) return q
        const next = TYPE_ORDER[(TYPE_ORDER.indexOf(q.type) + 1) % TYPE_ORDER.length]
        return { ...q, type: next }
      }),
    }
    updateSurvey(updated)
  }

  async function handleMarkComplete() {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    const oid = orgIdRef.current
    if (!oid) return
    setMarkingComplete(true)
    try {
      if (outputIdRef.current) {
        const { error } = await supabase
          .from('step_output')
          .update({ status: 'approved', content: { questions: surveyRef.current }, last_saved_at: new Date().toISOString() })
          .eq('id', outputIdRef.current)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('step_output')
          .insert({ workspace_id: oid, step_id: audienceStepIdRef.current, content: { questions: surveyRef.current }, status: 'approved', version: 1 })
          .select('id').single()
        if (error) throw error
        if (data) outputIdRef.current = (data as Record<string, unknown>)['id'] as string
      }
      setIsApproved(true)
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch { /* non-fatal */ }
    finally { setMarkingComplete(false) }
  }

  function handleLoadRecommended() {
    const newSurvey: SurveyState = {}
    for (const [stageKey, questions] of Object.entries(LOCKED_QUESTIONS)) {
      const stageId = parseInt(stageKey, 10)
      newSurvey[stageId] = questions.map(q => ({
        id: uid(),
        text: q.text,
        type: q.type,
        stageId,
        locked: true,
        modified: false,
        originalText: q.text,
      }))
    }
    updateSurvey(newSurvey)
    const counts: Record<number, number> = {}
    for (const [k, v] of Object.entries(newSurvey)) counts[parseInt(k, 10)] = v.length
    setStageCounts(counts)
    setCopilotStatus('done')
  }

  async function handleGenerate() {
    const oid = orgIdRef.current
    if (!oid || copilotStatus === 'generating') return
    setCopilotStatus('generating')
    setCopilotError(null)
    setStageCounts(null)

    try {
      const audienceLabel = AUDIENCES.find(a => a.id === selectedAudience)!.label
      const segmentLabel  = selectedSegment?.name ?? 'All Segments'
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: 'survey-builder',
          workspaceId: oid,
          stepTitle: 'DCP Survey Builder',
          stepDescription: 'Generate buyer research questions across all 7 buying stages',
          currentContent: '',
          preferredModel,
          extraContext: `Audience: ${audienceLabel}\nSegment: ${segmentLabel}`,
        }),
      })

      if (!res.ok || !res.body) {
        setCopilotStatus('error')
        setCopilotError(`Request failed (${res.status}). Please try again.`)
        return
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }

      if (accumulated.includes('__STREAM_ERROR__')) {
        setCopilotStatus('error')
        setCopilotError('Copilot encountered an error. Please try again.')
        return
      }

      const firstBrace = accumulated.indexOf('{')
      const lastBrace  = accumulated.lastIndexOf('}')
      const jsonStr    = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
        ? accumulated.slice(firstBrace, lastBrace + 1)
        : accumulated.trim()
      const parsed = JSON.parse(jsonStr) as {
        draft?: string
        survey?: Record<string, Array<{ text: string; type: string }>>
      }

      if (!parsed.survey) {
        setCopilotStatus('error')
        setCopilotError('Unexpected response format. Please try again.')
        return
      }

      // Keep existing locked questions, replace unlocked with generated ones
      const existingLocked: SurveyState = {}
      for (const stage of STAGES) {
        existingLocked[stage.id] = (surveyRef.current[stage.id] ?? []).filter(q => q.locked)
      }

      const newSurvey: SurveyState = {}
      const counts: Record<number, number> = {}
      const validTypes = new Set<string>(['open', 'scale', 'multiple_choice'])

      for (let i = 1; i <= 7; i++) {
        const qs = parsed.survey[`stage_${i}`] ?? []
        const generatedUnlocked = qs.map(q => ({
          id: uid(),
          text: String(q.text ?? ''),
          type: validTypes.has(q.type) ? (q.type as QuestionType) : 'open',
          stageId: i,
        }))
        newSurvey[i] = [...(existingLocked[i] ?? []), ...generatedUnlocked]
        counts[i] = newSurvey[i].length
      }

      updateSurvey(newSurvey)
      setStageCounts(counts)
      setCopilotStatus('done')
    } catch (err) {
      setCopilotStatus('error')
      setCopilotError(err instanceof Error ? err.message : 'Unexpected error. Please try again.')
    }
  }

  function buildPlainText(): string {
    const audienceLabel = AUDIENCES.find(a => a.id === selectedAudience)!.label
    const lines: string[] = [`DCP Survey — ${audienceLabel}`, '']
    for (const stage of STAGES) {
      const qs = survey[stage.id] ?? []
      if (qs.length === 0) continue
      lines.push(`Stage ${stage.id}: ${stage.name}`, '')
      qs.forEach((q, i) => lines.push(`${i + 1}. ${q.text} (${TYPE_LABELS[q.type]})`))
      lines.push('')
    }
    return lines.join('\n')
  }

  function buildCSV(): string {
    const audienceLabel = AUDIENCES.find(a => a.id === selectedAudience)!.label
    const rows = [`"DCP Survey — ${audienceLabel}"`, 'Stage,Stage Name,Question,Type']
    for (const stage of STAGES) {
      for (const q of (survey[stage.id] ?? [])) {
        const esc = `"${q.text.replace(/"/g, '""')}"`
        rows.push(`${stage.id},"${stage.name}",${esc},"${TYPE_LABELS[q.type]}"`)
      }
    }
    return rows.join('\n')
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildPlainText())
      setCopyDone(true)
      setTimeout(() => setCopyDone(false), 2000)
    } catch { /* non-fatal */ }
  }

  async function generateInterviewProbes() {
    if (autoProbesGenerated.current) return
    autoProbesGenerated.current = true

    const oid = orgIdRef.current
    if (!oid) return

    const allQuestions: Array<{ question_id: string; text: string; stage: number }> = []
    for (const [stageKey, qs] of Object.entries(surveyRef.current)) {
      for (const q of qs) {
        allQuestions.push({ question_id: q.id, text: q.text, stage: parseInt(stageKey, 10) })
      }
    }
    if (allQuestions.length === 0) return

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: 'survey-builder-interview-probes',
          workspaceId: oid,
          stepTitle: 'Interview Probes',
          stepDescription: 'Generate probing sub-questions for interview guide',
          currentContent: '',
          preferredModel: preferredModelRef.current,
          extraContext: JSON.stringify({ questions: allQuestions }),
        }),
      })

      if (!res.ok || !res.body) return

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }

      if (accumulated.includes('__STREAM_ERROR__')) return

      const firstBrace = accumulated.indexOf('{')
      const lastBrace  = accumulated.lastIndexOf('}')
      const jsonStr    = firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
        ? accumulated.slice(firstBrace, lastBrace + 1)
        : accumulated.trim()

      const parsed = JSON.parse(jsonStr) as { probes?: Array<{ question_id: string; subs: string[] }> }
      if (!parsed.probes) return

      const newProbes = new Map<string, string[]>()
      for (const probe of parsed.probes) {
        newProbes.set(probe.question_id, probe.subs)
      }
      setProbes(newProbes)
    } catch { /* non-fatal */ }
  }

  function handleDownloadCSV() {
    const audienceLabel = AUDIENCES.find(a => a.id === selectedAudience)!.label
    const blob = new Blob([buildCSV()], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `dcp-survey-${selectedAudience}.csv`
    a.title    = `DCP Survey — ${audienceLabel}`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleAutoWord() {
    if (!orgId) return
    void triggerAutoWording(orgId, selectedAudience, selectedSegment)
  }

  return {
    survey,
    openStages,
    editingId,
    editText,
    copilotStatus,
    stageCounts,
    copilotError,
    orgId,
    orgName,
    saveState,
    copyDone,
    loading,
    selectedAudience,
    hoveringQId,
    isApproved,
    markingComplete,
    segments,
    selectedSegment,
    autoWordingStatus,
    autoWordingLabel,
    probes,
    setEditingId,
    setEditText,
    setHoveringQId,
    handleAudienceSwitch,
    handleSegmentSwitch,
    toggleStage,
    addQuestion,
    deleteQuestion,
    commitEdit,
    restoreQuestion,
    addMissingLockedQuestions,
    cycleType,
    handleMarkComplete,
    handleLoadRecommended,
    handleGenerate,
    handleCopy,
    handleDownloadCSV,
    generateInterviewProbes,
    handleAutoWord,
  }
}
