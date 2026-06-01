'use client'

import { ChevronDown, ChevronRight, Plus, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import type { SurveyState } from './types'
import { STAGES } from './constants'
import SurveyQuestionCard from './SurveyQuestionCard'

interface Props {
  survey: SurveyState
  openStages: Set<number>
  editingId: string | null
  editText: string
  hoveringQId: string | null
  isApproved: boolean
  total: number
  mode: 'survey' | 'interview'
  probes: Map<string, string[]>
  onToggleStage: (id: number) => void
  onAddQuestion: (stageId: number) => void
  onDeleteQuestion: (stageId: number, qId: string) => void
  onRestoreQuestion: (stageId: number, qId: string) => void
  onCommitEdit: (stageId: number, qId: string) => void
  onCycleType: (stageId: number, qId: string) => void
  onSetEditingId: (id: string | null) => void
  onSetEditText: (text: string) => void
  onSetHoveringQId: (id: string | null) => void
}

export default function SurveyStageList({
  survey,
  openStages,
  editingId,
  editText,
  hoveringQId,
  isApproved,
  total,
  mode,
  probes,
  onToggleStage,
  onAddQuestion,
  onDeleteQuestion,
  onRestoreQuestion,
  onCommitEdit,
  onCycleType,
  onSetEditingId,
  onSetEditText,
  onSetHoveringQId,
}: Props) {
  const atLimit = total >= 20

  return (
    <>
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
              <button
                onClick={() => onToggleStage(stage.id)}
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

              {isOpen && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                  {qs.length === 0 && (
                    <p style={{ padding: '14px 20px', fontSize: '13px', color: 'rgba(255,255,255,0.3)', margin: 0, fontStyle: 'italic' }}>
                      No questions yet — use Copilot to generate or add manually below.
                    </p>
                  )}

                  {mode === 'interview' ? (
                    qs.map((q, qi) => {
                      const subs = probes.get(q.id)
                      const subLabels = ['a', 'b', 'c']
                      return (
                        <div
                          key={q.id}
                          style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                        >
                          <p style={{
                            fontSize: '14px', fontWeight: 700, color: '#FFFFFF',
                            lineHeight: '1.5', margin: '0 0 8px',
                          }}>
                            {qi + 1}. {q.text || '(no question text)'}
                          </p>
                          {subs ? (
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {subs.slice(0, 3).map((sub, si) => (
                                <li key={si} style={{
                                  paddingLeft: '16px', fontSize: '13px',
                                  color: 'rgba(255,255,255,0.5)', lineHeight: '1.4',
                                }}>
                                  {subLabels[si]}. {sub}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p style={{
                              paddingLeft: '16px', fontSize: '13px',
                              color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', margin: 0,
                            }}>
                              Generating probes…
                            </p>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    qs.map(q => (
                      <SurveyQuestionCard
                        key={q.id}
                        question={q}
                        stageId={stage.id}
                        editingId={editingId}
                        editText={editText}
                        hoveringQId={hoveringQId}
                        onSetEditingId={onSetEditingId}
                        onSetEditText={onSetEditText}
                        onSetHoveringQId={onSetHoveringQId}
                        onCommitEdit={onCommitEdit}
                        onCycleType={onCycleType}
                        onDelete={onDeleteQuestion}
                        onRestore={onRestoreQuestion}
                      />
                    ))
                  )}

                  {mode === 'survey' && (
                    <div style={{ padding: '10px 20px' }}>
                      <button
                        onClick={() => onAddQuestion(stage.id)}
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
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {isApproved && (
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
      )}
    </>
  )
}
