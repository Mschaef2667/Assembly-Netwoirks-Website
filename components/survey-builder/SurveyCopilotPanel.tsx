'use client'

import { useState } from 'react'
import { Loader2, Wand2, CheckCircle2, Copy, Download, AlertTriangle } from 'lucide-react'
import TipsPanel from '@/components/ui/TipsPanel'
import { STEP_TIPS } from '@/lib/tips'
import type { CopilotStatus, Audience, SurveyState } from './types'
import { STAGES, AUDIENCES, LOCKED_QUESTIONS } from './constants'

interface MissingQuestion {
  stage: number
  text: string
}

interface Props {
  copilotStatus: CopilotStatus
  stageCounts: Record<number, number> | null
  copilotError: string | null
  orgId: string | null
  selectedAudience: Audience
  survey: SurveyState
  total: number
  copyDone: boolean
  isApproved: boolean
  markingComplete: boolean
  onGenerate: () => Promise<void>
  onLoadRecommended: () => void
  onCopy: () => Promise<void>
  onDownloadCSV: () => void
  onMarkComplete: () => void
  onAddMissingLockedQuestions: () => void
}

function computeMissingLocked(survey: SurveyState): MissingQuestion[] {
  const missing: MissingQuestion[] = []
  for (const [stageKey, lockedQs] of Object.entries(LOCKED_QUESTIONS)) {
    const stageId    = parseInt(stageKey, 10)
    const surveyQs   = survey[stageId] ?? []
    const lockedCount = surveyQs.filter(q => q.locked).length
    for (let i = lockedCount; i < lockedQs.length; i++) {
      missing.push({ stage: stageId, text: lockedQs[i].text })
    }
  }
  return missing
}

export default function SurveyCopilotPanel({
  copilotStatus,
  stageCounts,
  copilotError,
  orgId,
  selectedAudience,
  survey,
  total,
  copyDone,
  isApproved,
  markingComplete,
  onGenerate,
  onLoadRecommended,
  onCopy,
  onDownloadCSV,
  onMarkComplete,
  onAddMissingLockedQuestions,
}: Props) {
  const [showWarning, setShowWarning] = useState(false)
  const [missingQs, setMissingQs]     = useState<MissingQuestion[]>([])

  function handleMarkCompleteClick() {
    const missing = computeMissingLocked(survey)
    if (missing.length > 0) {
      setMissingQs(missing)
      setShowWarning(true)
    } else {
      onMarkComplete()
    }
  }

  function handleAddMissing() {
    onAddMissingLockedQuestions()
    setShowWarning(false)
  }

  function handleProceedAnyway() {
    setShowWarning(false)
    onMarkComplete()
  }

  return (
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
              onClick={onLoadRecommended}
              style={{
                width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                backgroundColor: '#E8520A', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                cursor: 'pointer', fontSize: '15px', fontWeight: 700, transition: 'background-color 0.15s',
              }}
            >
              <CheckCircle2 size={18} /> Load Recommended Questions
            </button>
            <button
              onClick={() => void onGenerate()}
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
            onClick={() => void onGenerate()}
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
        border: '1px solid rgba(255,255,255,0.1)', padding: '24px', marginBottom: '16px',
      }}>
        <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>
          Export Survey
        </h3>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: '0 0 16px' }}>
          Copy for Google Forms or download as CSV.
        </p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => void onCopy()}
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
            onClick={onDownloadCSV}
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

      {/* Mark Complete card */}
      <div style={{
        backgroundColor: '#0F2140', borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.1)', padding: '24px', marginBottom: '16px',
      }}>
        {isApproved ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={18} style={{ color: '#16A34A' }} />
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#16A34A' }}>
              Survey marked as complete
            </span>
          </div>
        ) : (
          <>
            <h3 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '0 0 6px' }}>
              Complete Survey
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: '0 0 16px' }}>
              Mark this survey as complete once all questions are ready to send.
            </p>
            <button
              onClick={handleMarkCompleteClick}
              disabled={markingComplete || total === 0}
              style={{
                width: '100%', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                backgroundColor: markingComplete || total === 0 ? 'rgba(22,163,74,0.3)' : '#16A34A',
                color: '#FFFFFF', border: 'none', borderRadius: '8px',
                cursor: markingComplete || total === 0 ? 'not-allowed' : 'pointer',
                fontSize: '15px', fontWeight: 700, transition: 'background-color 0.15s',
              }}
            >
              {markingComplete
                ? <><Loader2 size={18} className="animate-spin" /> Saving…</>
                : <><CheckCircle2 size={18} /> Mark Survey as Complete</>
              }
            </button>
          </>
        )}
      </div>

      <TipsPanel tips={STEP_TIPS['survey-builder']} />

      {/* Missing questions warning modal */}
      {showWarning && (
        <div
          onClick={() => setShowWarning(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '24px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#0F2140', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.15)', padding: '28px',
              maxWidth: '480px', width: '100%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <AlertTriangle size={20} style={{ color: '#EAB308', flexShrink: 0 }} />
              <h3 style={{ color: '#FFFFFF', fontSize: '17px', fontWeight: 700, margin: 0 }}>
                Missing Recommended Questions
              </h3>
            </div>

            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px' }}>
              Your survey is missing <strong style={{ color: '#EAB308' }}>{missingQs.length}</strong> question{missingQs.length !== 1 ? 's' : ''} that are critical for building an accurate DCP map:
            </p>

            <ul style={{ margin: '0 0 20px', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {missingQs.map((q, i) => (
                <li key={i} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: '1.5' }}>
                  <span style={{ color: 'rgba(255,255,255,0.3)', marginRight: '4px' }}>Stage {q.stage}:</span>
                  {q.text}
                </li>
              ))}
            </ul>

            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: '0 0 20px' }}>
              You can proceed, but your DCP map may have gaps.
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleAddMissing}
                style={{
                  flex: 1, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: '#E8520A', color: '#FFFFFF', border: 'none', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 700,
                }}
              >
                Add Missing Questions
              </button>
              <button
                onClick={handleProceedAnyway}
                style={{
                  flex: 1, minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px',
                  cursor: 'pointer', fontSize: '14px', fontWeight: 600,
                }}
              >
                Proceed Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
