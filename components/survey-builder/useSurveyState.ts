'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Question, SurveyState, CopilotStatus, Audience, QuestionType } from './types'
import {
  STAGES, AUDIENCES, TYPE_ORDER, TYPE_LABELS, DEFAULT_SURVEY_QUESTIONS,
  uid, countAll,
} from './constants'

export function useSurveyState() {
  const [survey, setSurvey]                   = useState<SurveyState>({})
  const [openStages, setOpenStages]           = useState<Set<number>>(new Set([1, 2, 3, 4, 5, 6, 7]))
  const [editingId, setEditingId]             = useState<string | null>(null)
  const [editText, setEditText]               = useState('')
  const [copilotStatus, setCopilotStatus]     = useState<CopilotStatus>('idle')
  const [stageCounts, setStageCounts]         = useState<Record<number, number> | null>(null)
  const [copilotError, setCopilotError]       = useState<string | null>(null)
  const [orgId, setOrgId]                     = useState<string | null>(null)
  const [preferredModel, setPreferredModel]   = useState('claude-sonnet-4-5')
  const [saveState, setSaveState]             = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [copyDone, setCopyDone]               = useState(false)
  const [loading, setLoading]                 = useState(true)
  const [selectedAudience, setSelectedAudience] = useState<Audience>('current')
  const [hoveringQId, setHoveringQId]         = useState<string | null>(null)
  const [isApproved, setIsApproved]           = useState(false)
  const [markingComplete, setMarkingComplete] = useState(false)

  const orgIdRef          = useRef<string | null>(null)
  const outputIdRef       = useRef<string | null>(null)
  const surveyRef         = useRef<SurveyState>({})
  const saveTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audienceStepIdRef = useRef<string>('survey-builder-current')

  useEffect(() => {
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
          .from('organizations').select('preferred_model').eq('id', oid).single()
        if (orgRow) {
          setPreferredModel(String((orgRow as Record<string, unknown>)['preferred_model'] ?? 'claude-sonnet-4-5'))
        }

        const { data: outputRow } = await supabase
          .from('step_output')
          .select('id, content, status')
          .eq('workspace_id', oid)
          .eq('step_id', 'survey-builder-current')
          .order('version', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (outputRow) {
          const row = outputRow as Record<string, unknown>
          outputIdRef.current = String(row['id'] ?? '')
          if (row['status'] === 'approved') setIsApproved(true)
          const content = row['content'] as Record<string, unknown> | null
          if (content?.['questions']) {
            const raw = content['questions'] as Record<string, unknown[]>
            const parsed: SurveyState = {}
            for (const [k, v] of Object.entries(raw)) {
              parsed[parseInt(k, 10)] = v as Question[]
            }
            surveyRef.current = parsed
            setSurvey(parsed)
          }
        }
      } catch { /* non-fatal */ }
      finally { setLoading(false) }
    }
    void load()
  }, [])

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

  async function handleAudienceSwitch(audience: Audience) {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    const aud = AUDIENCES.find(a => a.id === audience)!
    audienceStepIdRef.current = aud.stepId
    setSelectedAudience(audience)
    outputIdRef.current = null
    surveyRef.current = {}
    setSurvey({})
    setCopilotStatus('idle')
    setCopilotError(null)
    setStageCounts(null)
    setIsApproved(false)

    const oid = orgIdRef.current
    if (!oid) return
    try {
      const { data: outputRow } = await supabase
        .from('step_output')
        .select('id, content')
        .eq('workspace_id', oid)
        .eq('step_id', aud.stepId)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (outputRow) {
        const row = outputRow as Record<string, unknown>
        outputIdRef.current = String(row['id'] ?? '')
        if (row['status'] === 'approved') setIsApproved(true)
        const content = row['content'] as Record<string, unknown> | null
        if (content?.['questions']) {
          const raw = content['questions'] as Record<string, unknown[]>
          const parsed: SurveyState = {}
          for (const [k, v] of Object.entries(raw)) {
            parsed[parseInt(k, 10)] = v as Question[]
          }
          surveyRef.current = parsed
          setSurvey(parsed)
        }
      }
    } catch { /* non-fatal */ }
  }

  function toggleStage(id: number) {
    setOpenStages(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function addQuestion(stageId: number) {
    if (countAll(survey) >= 20) return
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
      [stageId]: (survey[stageId] ?? []).map(q => q.id === qId ? { ...q, text: val } : q),
    }
    updateSurvey(updated)
    setEditingId(null)
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
    for (const [stageKey, questions] of Object.entries(DEFAULT_SURVEY_QUESTIONS)) {
      const stageId = parseInt(stageKey, 10)
      newSurvey[stageId] = questions.map(q => ({
        id: uid(),
        text: q.text,
        type: q.type,
        stageId,
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
          extraContext: `Audience: ${audienceLabel}`,
        }),
      })

      if (!res.ok || !res.body) {
        setCopilotStatus('error')
        setCopilotError(`Request failed (${res.status}). Please try again.`)
        return
      }

      const reader = res.body.getReader()
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

      const newSurvey: SurveyState = {}
      const counts: Record<number, number> = {}
      const validTypes = new Set<string>(['open', 'scale', 'multiple_choice'])

      for (let i = 1; i <= 7; i++) {
        const qs = parsed.survey[`stage_${i}`] ?? []
        newSurvey[i] = qs.map(q => ({
          id: uid(),
          text: String(q.text ?? ''),
          type: validTypes.has(q.type) ? (q.type as QuestionType) : 'open',
          stageId: i,
        }))
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

  function handleDownloadCSV() {
    const audienceLabel = AUDIENCES.find(a => a.id === selectedAudience)!.label
    const blob = new Blob([buildCSV()], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dcp-survey-${selectedAudience}.csv`
    a.title = `DCP Survey — ${audienceLabel}`
    a.click()
    URL.revokeObjectURL(url)
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
    saveState,
    copyDone,
    loading,
    selectedAudience,
    hoveringQId,
    isApproved,
    markingComplete,
    setEditingId,
    setEditText,
    setHoveringQId,
    handleAudienceSwitch,
    toggleStage,
    addQuestion,
    deleteQuestion,
    commitEdit,
    cycleType,
    handleMarkComplete,
    handleLoadRecommended,
    handleGenerate,
    handleCopy,
    handleDownloadCSV,
  }
}
