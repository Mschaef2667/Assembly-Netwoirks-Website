'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Loader2, Download, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DcpQuestion {
  id: string
  stage_number: number
  stage_name: string
  question_text: string
  sub_bullets: string[]
  is_starter: boolean
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ── Stage meta ────────────────────────────────────────────────────────────────

const STAGE_DESCRIPTIONS: Record<number, string> = {
  1: 'Uncovers what pain or gap first prompted buyers to seek a solution.',
  2: 'Identifies the specific event or mandate that forced action.',
  3: 'Reveals how buyers searched and which channels influenced them.',
  4: 'Maps the evaluation criteria and process used to compare vendors.',
  5: 'Determines what made vendors qualify for serious consideration.',
  6: 'Pinpoints who decided, what evidence tipped the choice, and why.',
  7: 'Uncovers post-purchase signals of success, doubt, or friction.',
}

// ── Styles ────────────────────────────────────────────────────────────────────

const LABEL: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: '#6B7280',
  textTransform: 'uppercase', letterSpacing: '0.07em',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByStage(questions: DcpQuestion[]): Map<number, DcpQuestion[]> {
  const map = new Map<number, DcpQuestion[]>()
  for (const q of questions) {
    const arr = map.get(q.stage_number) ?? []
    arr.push(q)
    map.set(q.stage_number, arr)
  }
  return map
}

function buildCSV(questions: DcpQuestion[], selectedIds: Set<string>, customized: Map<string, string>): string {
  const rows: string[] = ['Stage,Stage Name,Question,Sub-bullet']
  for (const q of questions) {
    if (!selectedIds.has(q.id)) continue
    const text = customized.get(q.id) ?? q.question_text
    const escapedText = `"${text.replace(/"/g, '""')}"`
    if (q.sub_bullets.length === 0) {
      rows.push(`${q.stage_number},"${q.stage_name}",${escapedText},`)
    } else {
      q.sub_bullets.forEach((b, i) => {
        const escapedBullet = `"${b.replace(/"/g, '""')}"`
        if (i === 0) rows.push(`${q.stage_number},"${q.stage_name}",${escapedText},${escapedBullet}`)
        else rows.push(`,,, ${escapedBullet}`)
      })
    }
  }
  return rows.join('\n')
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SurveyBuilderPage() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [surveyId, setSurveyId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<DcpQuestion[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [customized, setCustomized] = useState<Map<string, string>>(new Map())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [openStages, setOpenStages] = useState<Set<number>>(new Set([1]))
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  // ── Load data ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: userRow } = await supabase
          .from('users').select('org_id').eq('id', user.id).single()
        if (!userRow) return
        const oid = (userRow as Record<string, unknown>)['org_id'] as string
        setOrgId(oid)

        const [qRes, surveyRes] = await Promise.all([
          supabase.from('dcp_questions').select('*').order('stage_number').order('created_at'),
          supabase.from('workspace_survey').select('*').eq('org_id', oid).maybeSingle(),
        ])

        const rawQuestions = (qRes.data ?? []) as Array<Record<string, unknown>>
        const parsed: DcpQuestion[] = rawQuestions.map(r => ({
          id: String(r['id'] ?? ''),
          stage_number: Number(r['stage_number'] ?? 0),
          stage_name: String(r['stage_name'] ?? ''),
          question_text: String(r['question_text'] ?? ''),
          sub_bullets: Array.isArray(r['sub_bullets']) ? (r['sub_bullets'] as string[]) : [],
          is_starter: Boolean(r['is_starter']),
        }))
        setQuestions(parsed)

        const surveyRow = surveyRes.data as Record<string, unknown> | null
        if (surveyRow) {
          setSurveyId(String(surveyRow['id'] ?? ''))
          const ids = Array.isArray(surveyRow['selected_question_ids'])
            ? (surveyRow['selected_question_ids'] as string[])
            : []
          setSelectedIds(new Set(ids))

          const custom = Array.isArray(surveyRow['customized_questions'])
            ? (surveyRow['customized_questions'] as Array<Record<string, string>>)
            : []
          const map = new Map<string, string>()
          for (const c of custom) {
            if (c['id'] && c['text']) map.set(c['id'], c['text'])
          }
          setCustomized(map)
        } else {
          // Pre-check starter questions
          const starterIds = parsed.filter(q => q.is_starter).map(q => q.id)
          setSelectedIds(new Set(starterIds))
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  // ── Toggle selection ────────────────────────────────────────────────────────

  function toggleQuestion(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Toggle accordion ────────────────────────────────────────────────────────

  function toggleStage(stage: number) {
    setOpenStages(prev => {
      const next = new Set(prev)
      if (next.has(stage)) next.delete(stage)
      else next.add(stage)
      return next
    })
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (!orgId) return
    setSaveState('saving')
    const selectedArr = Array.from(selectedIds)
    const customArr = Array.from(customized.entries()).map(([id, text]) => ({ id, text }))
    try {
      if (surveyId) {
        const { error } = await supabase
          .from('workspace_survey')
          .update({ selected_question_ids: selectedArr, customized_questions: customArr, updated_at: new Date().toISOString() })
          .eq('id', surveyId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('workspace_survey')
          .insert({ org_id: orgId, selected_question_ids: selectedArr, customized_questions: customArr })
          .select('id').single()
        if (error) throw error
        if (data) setSurveyId((data as Record<string, unknown>)['id'] as string)
      }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
  }, [orgId, surveyId, selectedIds, customized])

  // ── CSV export ──────────────────────────────────────────────────────────────

  function exportCSV() {
    const csv = buildCSV(questions, selectedIds, customized)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'dcp-survey.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: '#6B7280' }} />
      </div>
    )
  }

  const grouped = groupByStage(questions)
  const totalSelected = selectedIds.size

  return (
    <div style={{ backgroundColor: '#F8F6F1', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Survey Builder</h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
          Select and customize DCP questions for your buyer survey.
        </p>
      </header>

      <div style={{ padding: '24px 32px 120px', maxWidth: '840px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3, 4, 5, 6, 7].map(stageNum => {
            const stageQuestions = grouped.get(stageNum) ?? []
            if (stageQuestions.length === 0) return null
            const stageName = stageQuestions[0].stage_name
            const selected = stageQuestions.filter(q => selectedIds.has(q.id)).length
            const isOpen = openStages.has(stageNum)

            return (
              <div key={stageNum} style={{ backgroundColor: '#FFFFFF', borderRadius: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
                {/* Accordion header */}
                <button
                  onClick={() => toggleStage(stageNum)}
                  style={{
                    width: '100%', minHeight: '56px', padding: '0 20px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {isOpen
                    ? <ChevronDown size={18} style={{ color: '#6B7280', flexShrink: 0 }} />
                    : <ChevronRight size={18} style={{ color: '#6B7280', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>
                      Stage {stageNum}: {stageName}
                    </span>
                    <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '10px' }}>
                      {STAGE_DESCRIPTIONS[stageNum]}
                    </span>
                  </div>
                  <span style={{
                    padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700,
                    backgroundColor: selected > 0 ? 'rgba(232,82,10,0.1)' : '#F3F4F6',
                    color: selected > 0 ? '#E8520A' : '#6B7280', flexShrink: 0,
                  }}>
                    {selected}/{stageQuestions.length}
                  </span>
                </button>

                {/* Accordion body */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #F3F4F6', padding: '4px 0 12px' }}>
                    {stageQuestions.map(q => {
                      const isSelected = selectedIds.has(q.id)
                      const isEditing = editingId === q.id
                      const customText = customized.get(q.id)

                      return (
                        <div key={q.id} style={{ padding: '12px 20px 10px', borderBottom: '1px solid #F9FAFB' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleQuestion(q.id)}
                              style={{ marginTop: '3px', accentColor: '#E8520A', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer' }}
                            />
                            <div style={{ flex: 1 }}>
                              {isEditing ? (
                                <textarea
                                  defaultValue={customText ?? q.question_text}
                                  onBlur={e => {
                                    const val = e.target.value.trim()
                                    if (val && val !== q.question_text) {
                                      setCustomized(prev => new Map(prev).set(q.id, val))
                                    } else if (!val || val === q.question_text) {
                                      setCustomized(prev => { const n = new Map(prev); n.delete(q.id); return n })
                                    }
                                    setEditingId(null)
                                  }}
                                  autoFocus
                                  style={{
                                    width: '100%', padding: '8px', fontSize: '14px',
                                    border: '1px solid #E8520A', borderRadius: '6px',
                                    resize: 'vertical', minHeight: '70px', fontFamily: 'inherit',
                                    outline: 'none', boxSizing: 'border-box',
                                  }}
                                />
                              ) : (
                                <p style={{ fontSize: '14px', color: '#0D0D0D', margin: '0 0 4px', lineHeight: '1.5' }}>
                                  {customText ?? q.question_text}
                                  {customText && (
                                    <span style={{ marginLeft: '6px', fontSize: '11px', color: '#E8520A', fontWeight: 600 }}>
                                      (customized)
                                    </span>
                                  )}
                                </p>
                              )}

                              {q.sub_bullets.length > 0 && !isEditing && (
                                <ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
                                  {q.sub_bullets.map((b, i) => (
                                    <li key={i} style={{ fontSize: '12px', color: '#6B7280', marginBottom: '2px' }}>{b}</li>
                                  ))}
                                </ul>
                              )}
                            </div>

                            {!isEditing && (
                              <button
                                onClick={() => setEditingId(q.id)}
                                style={{
                                  minHeight: '32px', padding: '0 10px', fontSize: '12px', fontWeight: 600,
                                  border: '1px solid #E5E7EB', borderRadius: '6px', cursor: 'pointer',
                                  backgroundColor: '#FFFFFF', color: '#6B7280', flexShrink: 0,
                                }}
                              >
                                Customize
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        position: 'fixed', bottom: 0, left: '256px', right: 0,
        backgroundColor: '#FFFFFF', borderTop: '1px solid #E5E7EB',
        padding: '14px 32px', display: 'flex', alignItems: 'center', gap: '16px',
      }}>
        <p style={{ fontSize: '14px', color: '#0D0D0D', margin: 0, fontWeight: 500 }}>
          {totalSelected} question{totalSelected !== 1 ? 's' : ''} selected
        </p>
        <div style={{ flex: 1 }} />
        {saveState === 'saving' && <span style={{ fontSize: '12px', color: '#6B7280' }}>Saving…</span>}
        {saveState === 'saved' && <span style={{ fontSize: '12px', color: '#16A34A' }}>Saved</span>}
        {saveState === 'error' && <span style={{ fontSize: '12px', color: '#EF4444' }}>Save failed</span>}
        <button
          onClick={exportCSV}
          disabled={totalSelected === 0}
          style={{
            minHeight: '44px', padding: '0 20px', display: 'flex', alignItems: 'center', gap: '8px',
            border: '1px solid #E5E7EB', borderRadius: '8px', cursor: totalSelected === 0 ? 'not-allowed' : 'pointer',
            backgroundColor: totalSelected === 0 ? '#F3F4F6' : '#FFFFFF',
            color: totalSelected === 0 ? '#9CA3AF' : '#0D0D0D', fontSize: '14px', fontWeight: 600,
          }}
        >
          <Download size={16} />
          Export as CSV
        </button>
        <button
          onClick={() => void save()}
          disabled={saveState === 'saving'}
          style={{
            minHeight: '44px', padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: saveState === 'saving' ? '#E5E7EB' : '#E8520A',
            color: saveState === 'saving' ? '#9CA3AF' : '#FFFFFF',
            border: 'none', borderRadius: '8px', cursor: saveState === 'saving' ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: 600,
          }}
        >
          <Save size={16} />
          Save Survey
        </button>
      </div>
    </div>
  )
}
