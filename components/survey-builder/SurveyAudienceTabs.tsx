'use client'

import type { Audience } from './types'
import { AUDIENCES } from './constants'

interface Props {
  selectedAudience: Audience
  onSwitch: (audience: Audience) => void
}

export default function SurveyAudienceTabs({ selectedAudience, onSwitch }: Props) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
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
  )
}
