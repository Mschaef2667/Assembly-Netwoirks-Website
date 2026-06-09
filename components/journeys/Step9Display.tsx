'use client'

import { AlertTriangle } from 'lucide-react'
import { PANEL_CARD, type Step9State } from '@/lib/journeys/stepHelpers'

export function Step9Display({ gateApproved, stage, updatedAt }: Step9State) {
  if (!gateApproved) {
    return (
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#FEF3C7',
        border: '1px solid #FCD34D',
        borderRadius: '10px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}>
        <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#92400E', margin: '0 0 2px' }}>
            Gate 1 has not been approved yet
          </p>
          <p style={{ fontSize: '12px', color: '#78350F', margin: 0 }}>
            Complete the Intelligence section first to unlock this step.
          </p>
        </div>
      </div>
    )
  }

  if (!stage) {
    return (
      <div style={{
        ...PANEL_CARD,
        color: 'rgba(255,255,255,0.5)',
        fontSize: '14px',
      }}>
        No Stage 3 data found in your DCP analysis.
      </div>
    )
  }

  const score = stage.confidence_score
  const badgeColor = score >= 70 ? '#15803D' : score >= 40 ? '#92400E' : '#991B1B'
  const badgeBg   = score >= 70 ? '#DCFCE7' : score >= 40 ? '#FEF3C7' : '#FEE2E2'
  const badgeLabel = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low'

  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px' }}>
      <div style={PANEL_CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
            Stage {stage.stage_number} — {stage.stage_name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '3px 10px', borderRadius: '999px',
              backgroundColor: badgeBg, color: badgeColor,
              fontSize: '12px', fontWeight: 700,
            }}>
              {badgeLabel} confidence — {score}/100
            </span>
            {formattedDate && (
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                Updated {formattedDate}
              </span>
            )}
          </div>
        </div>

        <p style={{
          fontSize: '14px',
          lineHeight: '1.7',
          color: 'rgba(255,255,255,0.8)',
          margin: 0,
          whiteSpace: 'pre-wrap',
        }}>
          {stage.summary}
        </p>
      </div>

      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
        This data is pulled from your approved DCP analysis. To update it, re-run the analysis in the Intelligence section.
      </p>
    </div>
  )
}
