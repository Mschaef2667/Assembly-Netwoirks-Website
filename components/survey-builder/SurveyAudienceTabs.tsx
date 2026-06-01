'use client'

import type { Audience, Segment } from './types'
import { AUDIENCES } from './constants'

interface Props {
  selectedAudience: Audience
  onSwitch: (audience: Audience) => void
  segments: Segment[]
  selectedSegment: Segment | null
  onSegmentChange: (segment: Segment | null) => void
}

export default function SurveyAudienceTabs({
  selectedAudience,
  onSwitch,
  segments,
  selectedSegment,
  onSegmentChange,
}: Props) {
  const displaySegments = segments.slice(0, 3)
  const hasSegments     = displaySegments.length > 0

  return (
    <div style={{ marginBottom: '16px' }}>

      {/* Segment row */}
      <div style={{ marginBottom: '8px' }}>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
          Segment
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {hasSegments ? (
            displaySegments.map(seg => {
              const active = selectedSegment?.id === seg.id
              return (
                <button
                  key={seg.id}
                  onClick={() => onSegmentChange(seg)}
                  style={{
                    padding: '5px 12px', minHeight: '32px', borderRadius: '6px',
                    fontSize: '12px', fontWeight: active ? 700 : 500,
                    backgroundColor: active ? 'rgba(14,165,233,0.18)' : 'rgba(255,255,255,0.05)',
                    color: active ? '#0EA5E9' : 'rgba(255,255,255,0.45)',
                    border: active ? '1px solid #0EA5E9' : '1px solid rgba(255,255,255,0.08)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {seg.name}
                </button>
              )
            })
          ) : (
            <button
              disabled
              style={{
                padding: '5px 12px', minHeight: '32px', borderRadius: '6px',
                fontSize: '12px', fontWeight: 700,
                backgroundColor: 'rgba(14,165,233,0.18)',
                color: '#0EA5E9',
                border: '1px solid #0EA5E9',
                cursor: 'default',
              }}
            >
              All Segments
            </button>
          )}
        </div>
      </div>

      {/* Audience row */}
      <div>
        <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
          Audience
        </p>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {AUDIENCES.map(aud => {
            const active = aud.id === selectedAudience
            return (
              <button
                key={aud.id}
                onClick={() => onSwitch(aud.id)}
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
      </div>
    </div>
  )
}
