'use client'

import { useState, useEffect, useRef } from 'react'
import {
  ChevronDown, ChevronRight, Loader2, Pencil, Plus, X,
  Copy, Download, Wand2, CheckCircle2,
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'
import TipsPanel from '@/components/ui/TipsPanel'
import { STEP_TIPS } from '@/lib/tips'

// ── Types ─────────────────────────────────────────────────────────────────────

type QuestionType = 'open' | 'scale' | 'multiple_choice'

interface Question {
  id: string
  text: string
  type: QuestionType
  stageId: number
}

type SurveyState = Record<number, Question[]>

type CopilotStatus = 'idle' | 'generating' | 'done' | 'error'

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGES = [
  { id: 1, name: 'Need Recognition',          description: 'What most often triggers the search for outside GTM help?' },
  { id: 2, name: 'Motivation to Act',         description: 'What business outcome is expected and what is the cost of inaction?' },
  { id: 3, name: 'Information Search',        description: 'Who initiates the search and where do they look first?' },
  { id: 4, name: 'Evaluation of Alternatives', description: 'Which partner types are considered and what proof is required?' },
  { id: 5, name: 'Narrowing Down Process',    description: 'How many make the shortlist and what eliminates a partner?' },
  { id: 6, name: 'Purchase Decision',         description: 'Who controls budget and what is the typical investment range?' },
  { id: 7, name: 'Confirmation',              description: 'Who has final approval and what determines success within 90 days?' },
]

const DEFAULT_SURVEY_QUESTIONS: Record<number, Array<{ text: string; type: QuestionType }>> = {
  1: [
    { text: 'What most often triggers your organization to consider outside GTM strategy help?', type: 'multiple_choice' },
    { text: 'How urgent is the need once it is recognized?', type: 'multiple_choice' },
  ],
  2: [
    { text: 'What is the primary business outcome you expect from a GTM strategy partner?', type: 'multiple_choice' },
    { text: 'What happens if you do nothing for the next 90 days?', type: 'scale' },
  ],
  3: [
    { text: 'Who typically initiates the search for an outside GTM strategy partner?', type: 'multiple_choice' },
    { text: 'Where do you look first to find or validate potential partners?', type: 'multiple_choice' },
  ],
  4: [
    { text: 'Which partner type are you most likely to hire for GTM strategy?', type: 'multiple_choice' },
    { text: 'Rank the top 5 criteria you use to evaluate potential partners.', type: 'multiple_choice' },
    { text: 'What proof do you require before moving a partner to the shortlist?', type: 'multiple_choice' },
  ],
  5: [
    { text: 'How many partners typically make your shortlist?', type: 'multiple_choice' },
    { text: 'What most often eliminates a partner during shortlisting?', type: 'multiple_choice' },
  ],
  6: [
    { text: 'Who controls the budget for hiring the GTM strategy partner?', type: 'multiple_choice' },
    { text: 'What is your typical budget range for GTM strategy support (initial engagement)?', type: 'multiple_choice' },
  ],
  7: [
    { text: 'Who has final approval or veto on selecting the GTM strategy partner?', type: 'multiple_choice' },
    { text: 'Within 90 days, what most determines whether you would rehire or refer the partner?', type: 'multiple_choice' },
  ],
}

const TYPE_ORDER: QuestionType[] = ['open', 'scale', 'multiple_choice']

const TYPE_LABELS: Record<QuestionType, string> = {
  open: 'Open-ended',
  scale: 'Scale 1-10',
  multiple_choice: 'Multiple choice',
}

const TYPE_COLORS: Record<QuestionType, { bg: string; color: string }> = {
  open:            { bg: 'rgba(14,165,233,0.15)',  color: '#0EA5E9' },
  scale:           { bg: 'rgba(139,92,246,0.15)',  color: '#A78BFA' },
  multiple_choice: { bg: 'rgba(232,82,10,0.15)',   color: '#E8520A' },
}

// ── Audiences ─────────────────────────────────────────────────────────────────

type Audience = 'internal' | 'current' | 'lost' | 'potential'

interface AudienceOption {
  id: Audience
  label: string
  stepId: string
}

const AUDIENCES: AudienceOption[] = [
  { id: 'internal',  label: 'Internal Stakeholders', stepId: 'survey-builder-internal' },
  { id: 'current',   label: 'Current Customers',     stepId: 'survey-builder-current' },
  { id: 'lost',      label: 'Lost Customers',        stepId: 'survey-builder-lost' },
  { id: 'potential', label: 'Potential Customers',   stepId: 'survey-builder-potential' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function countAll(s: SurveyState): number {
  return Object.values(s).reduce((n, qs) => n + qs.length, 0)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SurveyBuilderPage() {
  const [survey, setSurvey]                   = useState<SurveyState>({})
  const [openStages, setOpenStages]           = useState<Set<number>>(new Set([1,2,3,4,5,6,7]))
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
  const [hoveringQId, setHoveringQId]             = useState<string | null>(null)
  const [isApproved, setIsApproved]           = useState(false)
  const [markingComplete, setMarkingComplete] = useState(false)

  // Refs to avoid stale closures in async save callbacks
  const orgIdRef          = useRef<string | null>(null)
  const outputIdRef       = useRef<string | null>(null)
  const surveyRef         = useRef<SurveyState>({})
  const saveTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audienceStepIdRef = useRef<string>('survey-builder-current')

  // ── Load ──────────────────────────────────────────────────────────────────

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

  // ── Debounced save ────────────────────────────────────────────────────────

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

  // ── Stage / question mutations ─────────────────────────────────────────────

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

  // ── Mark complete ─────────────────────────────────────────────────────────

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

  // ── Load recommended questions ────────────────────────────────────────────

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

  // ── Copilot generate ──────────────────────────────────────────────────────

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

  // ── Export ────────────────────────────────────────────────────────────────

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

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  const total         = countAll(survey)
  const atLimit       = total >= 20
  const aboveRecommended = total > 15
  const counterColor  = aboveRecommended ? '#EAB308' : total > 12 ? '#E8520A' : 'rgba(255,255,255,0.7)'
  const progressPct   = Math.min((total / 20) * 100, 100)
  const progressColor = aboveRecommended ? '#EAB308' : total > 12 ? '#E8520A' : '#0EA5E9'

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>

      {/* Header */}
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>
              Decision Clarity Process Survey Builder
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
              Generate buyer research questions across all 7 buying stages. Keep it under 15 questions for best completion rates.
            </p>
          </div>
          <span style={{
            fontSize: '13px', paddingTop: '4px', flexShrink: 0,
            color: saveState === 'saved' ? '#16A34A' : saveState === 'error' ? '#EF4444' : 'rgba(255,255,255,0.35)',
          }}>
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && 'Saved'}
            {saveState === 'error' && 'Save failed'}
          </span>
        </div>
      </header>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: '24px', padding: '28px 32px', alignItems: 'flex-start' }}>

        {/* ── LEFT: Survey editor (60%) ── */}
        <div style={{ flex: '0 0 60%', minWidth: 0 }}>

          {/* Audience selector */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {AUDIENCES.map(aud => {
              const active = aud.id === selectedAudience
              return (
                <button
                  key={aud.id}
                  onClick={() => void handleAudienceSwitch(aud.id)}
                  style={{
                    padding: '7px 14px', minHeight: '36px', borderRadius: '6px',
                    fontSize: '13px', fontWeight: active ? 700 : 500,
                    backgroundColor: active ? '#E8520A' : 'rgba(255,255,255,0.06)',
                    color: active ? '#FFFFFF' : 'rgba(255,255,255,0.55)',
                    border: active ? '1px solid #E8520A' : '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {aud.label}
                </button>
              )
            })}
          </div>

        {/* Question counter */}
          <div style={{
            backgroundColor: '#0F2140', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px', marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: counterColor }}>
                {aboveRecommended ? `${total} questions (above recommended)` : `${total} of 15 recommended`}
              </span>
              {!aboveRecommended && (
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                  {Math.max(0, 15 - total)} remaining
                </span>
              )}
            </div>
            <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                backgroundColor: progressColor, borderRadius: '3px', transition: 'width 0.3s ease',
              }} />
            </div>
            {total >= 15 && (
              <div style={{
                marginTop: '10px', padding: '8px 10px', borderRadius: '6px',
                backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)',
              }}>
                <p style={{ fontSize: '12px', color: '#EAB308', margin: 0, lineHeight: '1.5' }}>
                  You have reached the recommended maximum of 15 questions. Additional questions may reduce completion rates.
                </p>
              </div>
            )}
          </div>

          {/* Stage sections */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {STAGES.map(stage => {
              const qs     = survey[stage.id] ?? []
              const isOpen = openStages.has(stage.id)

              return (
                <div
                  key={stage.id}
                  style={{
                    backgroundColor: '#0F2140', borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden',
                  }}
                >
                  {/* Stage header */}
                  <button
                    onClick={() => toggleStage(stage.id)}
                    style={{
                      width: '100%', minHeight: '56px', padding: '0 20px',
                      display: 'flex', alignItems: 'center', gap: '12px',
                      backgroundColor: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {isOpen
                      ? <ChevronDown size={16} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                      : <ChevronRight size={16} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                    }
                    <span style={{
                      width: '26px', height: '26px', borderRadius: '6px',
                      backgroundColor: '#E8520A', color: '#FFFFFF',
                      fontSize: '11px', fontWeight: 700, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {stage.id}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                        {stage.name}
                      </span>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginLeft: '10px' }}>
                        {stage.description}
                      </span>
                    </div>
                    <span style={{
                      padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, flexShrink: 0,
                      backgroundColor: qs.length > 0 ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.07)',
                      color: qs.length > 0 ? '#0EA5E9' : 'rgba(255,255,255,0.35)',
                    }}>
                      {qs.length}
                    </span>
                  </button>

                  {/* Stage body */}
                  {isOpen && (
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      {qs.length === 0 && (
                        <p style={{ padding: '14px 20px', fontSize: '13px', color: 'rgba(255,255,255,0.3)', margin: 0, fontStyle: 'italic' }}>
                          No questions yet — use Copilot to generate or add manually below.
                        </p>
                      )}

                      {qs.map(q => (
                        <div
                          key={q.id}
                          onMouseEnter={() => setHoveringQId(q.id)}
                          onMouseLeave={() => setHoveringQId(null)}
                          style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {editingId === q.id ? (
                                <textarea
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  onBlur={() => commitEdit(stage.id, q.id)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEdit(stage.id, q.id) }
                                    if (e.key === 'Escape') setEditingId(null)
                                  }}
                                  autoFocus
                                  style={{
                                    width: '100%', padding: '8px 10px', fontSize: '14px',
                                    color: '#0D0D0D', backgroundColor: '#FFFFFF',
                                    border: '1px solid #0EA5E9', borderRadius: '6px',
                                    resize: 'vertical', minHeight: '72px', fontFamily: 'inherit',
                                    outline: 'none', boxSizing: 'border-box', display: 'block',
                                  }}
                                />
                              ) : (
                                <div
                                  style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '0 0 8px' }}
                                >
                                  <p
                                    onClick={() => { setEditingId(q.id); setEditText(q.text) }}
                                    style={{
                                      fontSize: '14px', lineHeight: '1.5', margin: 0, cursor: 'text', flex: 1,
                                      color: q.text ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                                      fontStyle: q.text ? 'normal' : 'italic',
                                    }}
                                  >
                                    {q.text || 'Click to add question text…'}
                                  </p>
                                  {hoveringQId === q.id && (
                                    <Pencil
                                      size={12}
                                      style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginTop: '3px' }}
                                    />
                                  )}
                                </div>
                              )}

                              {/* Type badge — click to cycle */}
                              <button
                                onClick={() => cycleType(stage.id, q.id)}
                                title="Click to change type"
                                style={{
                                  padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                                  backgroundColor: TYPE_COLORS[q.type].bg, color: TYPE_COLORS[q.type].color,
                                  border: 'none', cursor: 'pointer',
                                }}
                              >
                                {TYPE_LABELS[q.type]}
                              </button>
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => deleteQuestion(stage.id, q.id)}
                              title="Delete question"
                              style={{
                                minWidth: '32px', minHeight: '32px', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                                color: 'rgba(255,255,255,0.3)', borderRadius: '6px',
                              }}
                            >
                              <X size={15} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {/* Add question */}
                      <div style={{ padding: '10px 20px' }}>
                        <button
                          onClick={() => addQuestion(stage.id)}
                          disabled={atLimit}
                          title={atLimit ? 'Maximum 20 questions reached' : undefined}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '6px 14px', minHeight: '36px',
                            backgroundColor: atLimit ? 'rgba(255,255,255,0.03)' : 'rgba(14,165,233,0.07)',
                            color: atLimit ? 'rgba(255,255,255,0.2)' : '#0EA5E9',
                            border: `1px solid ${atLimit ? 'rgba(255,255,255,0.06)' : 'rgba(14,165,233,0.2)'}`,
                            borderRadius: '6px', cursor: atLimit ? 'not-allowed' : 'pointer',
                            fontSize: '13px', fontWeight: 600,
                          }}
                        >
                          <Plus size={14} />
                          Add question
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Mark as Complete — bottom of left column */}
          {isApproved ? (
            <div style={{
              marginTop: '20px', backgroundColor: 'rgba(22,163,74,0.08)',
              borderRadius: '12px', padding: '20px 24px',
              border: '1px solid rgba(22,163,74,0.25)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={20} style={{ color: '#16A34A' }} />
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#16A34A' }}>
                  Survey marked as complete
                </span>
              </div>
              <Link
                href="/dashboard/intelligence"
                style={{ fontSize: '13px', color: '#0EA5E9', textDecoration: 'underline', fontWeight: 600 }}
              >
                Return to Intelligence
              </Link>
            </div>
          ) : total > 0 ? (
            <button
              onClick={() => void handleMarkComplete()}
              disabled={markingComplete}
              style={{
                marginTop: '20px', width: '100%', minHeight: '52px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                backgroundColor: markingComplete ? 'rgba(22,163,74,0.55)' : '#16A34A',
                color: '#FFFFFF', border: 'none', borderRadius: '10px',
                cursor: markingComplete ? 'not-allowed' : 'pointer',
                fontSize: '15px', fontWeight: 700, transition: 'background-color 0.15s',
              }}
            >
              {markingComplete
                ? <><Loader2 size={18} className="animate-spin" /> Saving…</>
                : <><CheckCircle2 size={18} /> Mark Survey as Complete</>
              }
            </button>
          ) : null}
        </div>

        {/* ── RIGHT: Copilot panel (40%) ── */}
        <div style={{ flex: '0 0 40%', minWidth: 0, position: 'sticky', top: '24px' }}>

          {/* Generate card */}
          <div style={{
            backgroundColor: '#0F2140', borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)', padding: '24px', marginBottom: '16px',
          }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '0 0 8px' }}>
              Generate Survey with Copilot
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 6px' }}>
              Copilot will analyze your company profile, target segments, and decision makers to generate tailored DCP questions for each buying stage.
            </p>
            <p style={{ color: '#0EA5E9', fontSize: '13px', fontWeight: 600, margin: '0 0 20px' }}>
              Generating survey for: {AUDIENCES.find(a => a.id === selectedAudience)!.label}
            </p>

            {selectedAudience === 'current' && total === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={handleLoadRecommended}
                  style={{
                    width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    backgroundColor: '#E8520A', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                    cursor: 'pointer', fontSize: '15px', fontWeight: 700, transition: 'background-color 0.15s',
                  }}
                >
                  <CheckCircle2 size={18} /> Load Recommended Questions
                </button>
                <button
                  onClick={() => void handleGenerate()}
                  disabled={copilotStatus === 'generating' || !orgId}
                  style={{
                    width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    backgroundColor: copilotStatus === 'generating' ? 'rgba(255,255,255,0.08)' : '#1E3A5F',
                    color: copilotStatus === 'generating' ? 'rgba(255,255,255,0.4)' : '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px',
                    cursor: copilotStatus === 'generating' ? 'not-allowed' : 'pointer',
                    fontSize: '15px', fontWeight: 700, transition: 'background-color 0.15s',
                  }}
                >
                  {copilotStatus === 'generating'
                    ? <><Loader2 size={18} className="animate-spin" /> Generating…</>
                    : <><Wand2 size={18} /> Generate with Copilot</>
                  }
                </button>
              </div>
            ) : (
              <button
                onClick={() => void handleGenerate()}
                disabled={copilotStatus === 'generating' || !orgId}
                style={{
                  width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  backgroundColor: copilotStatus === 'generating' ? 'rgba(232,82,10,0.55)' : '#E8520A',
                  color: '#FFFFFF', border: 'none', borderRadius: '8px',
                  cursor: copilotStatus === 'generating' ? 'not-allowed' : 'pointer',
                  fontSize: '15px', fontWeight: 700, transition: 'background-color 0.15s',
                }}
              >
                {copilotStatus === 'generating'
                  ? <><Loader2 size={18} className="animate-spin" /> Generating…</>
                  : <><Wand2 size={18} /> Generate with Copilot</>
                }
              </button>
            )}

            {/* Success state */}
            {copilotStatus === 'done' && stageCounts && (
              <div style={{
                marginTop: '16px', backgroundColor: 'rgba(22,163,74,0.08)',
                borderRadius: '8px', padding: '14px 16px', border: '1px solid rgba(22,163,74,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>Survey Generated</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {STAGES.map(stage => (
                    <div key={stage.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)' }}>
                        Stage {stage.id}: {stage.name}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#16A34A' }}>
                        {stageCounts[stage.id] ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error state */}
            {copilotStatus === 'error' && copilotError && (
              <div style={{
                marginTop: '12px', backgroundColor: 'rgba(239,68,68,0.08)',
                borderRadius: '8px', padding: '10px 14px', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <p style={{ fontSize: '13px', color: '#EF4444', margin: 0 }}>{copilotError}</p>
              </div>
            )}
          </div>

          {/* Export card */}
          <div style={{
            backgroundColor: '#0F2140', borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)', padding: '24px',
          }}>
            <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>
              Export Survey
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: '0 0 16px' }}>
              Copy for Google Forms or download as CSV.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => void handleCopy()}
                disabled={total === 0}
                style={{
                  flex: 1, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  backgroundColor: total === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
                  color: total === 0 ? 'rgba(255,255,255,0.2)' : '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                  cursor: total === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600,
                }}
              >
                {copyDone
                  ? <><CheckCircle2 size={14} style={{ color: '#16A34A' }} /> Copied!</>
                  : <><Copy size={14} /> Copy Questions</>
                }
              </button>
              <button
                onClick={handleDownloadCSV}
                disabled={total === 0}
                style={{
                  flex: 1, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  backgroundColor: total === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
                  color: total === 0 ? 'rgba(255,255,255,0.2)' : '#FFFFFF',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                  cursor: total === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600,
                }}
              >
                <Download size={14} /> Download CSV
              </button>
            </div>
          </div>

          {/* Tips panel */}
          <TipsPanel tips={STEP_TIPS['survey-builder']} />

        </div>
      </div>
    </div>
  )
}
