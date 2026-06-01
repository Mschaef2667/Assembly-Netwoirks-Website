'use client'

import { Loader2, Wand2, CheckCircle2, Copy, Download } from 'lucide-react'
import TipsPanel from '@/components/ui/TipsPanel'
import { STEP_TIPS } from '@/lib/tips'
import type { CopilotStatus, Audience } from './types'
import { STAGES, AUDIENCES } from './constants'

interface Props {
  copilotStatus: CopilotStatus
  stageCounts: Record<number, number> | null
  copilotError: string | null
  orgId: string | null
  selectedAudience: Audience
  total: number
  copyDone: boolean
  onGenerate: () => Promise<void>
  onLoadRecommended: () => void
  onCopy: () => Promise<void>
  onDownloadCSV: () => void
}

export default function SurveyCopilotPanel({
  copilotStatus,
  stageCounts,
  copilotError,
  orgId,
  selectedAudience,
  total,
  copyDone,
  onGenerate,
  onLoadRecommended,
  onCopy,
  onDownloadCSV,
}: Props) {
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

      <TipsPanel tips={STEP_TIPS['survey-builder']} />
    </div>
  )
}
