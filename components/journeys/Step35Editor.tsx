'use client'

import { SaveIndicator } from './shared/SaveIndicator'
import {
  FIELD_INPUT, LABEL_STYLE, PANEL_CARD, SEG_KEYS, makeBCEntry,
  type BuyingCenterEntry, type SaveStatus,
} from '@/lib/journeys/stepHelpers'

interface Step35EditorProps {
  segmentNames: string[]
  buyingCenter: Record<string, BuyingCenterEntry>
  activeTab: number
  saveStatus: SaveStatus
  onTabChange: (tab: number) => void
  onChange: (segKey: string, field: keyof BuyingCenterEntry, value: string) => void
  onBlur: () => void
}

export function Step35Editor({ segmentNames, buyingCenter, activeTab, saveStatus, onTabChange, onChange, onBlur }: Step35EditorProps) {
  const activeKey = SEG_KEYS[activeTab]
  const activeEntry = buyingCenter[activeKey] ?? makeBCEntry()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <label style={LABEL_STYLE}>The Yes Criteria</label>
        <SaveIndicator state={saveStatus} />
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {SEG_KEYS.map((key, i) => (
          <button
            key={key}
            onClick={() => onTabChange(i)}
            style={{
              padding: '6px 16px', minHeight: '36px',
              backgroundColor: activeTab === i ? '#E8520A' : 'rgba(255,255,255,0.06)',
              color: activeTab === i ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${activeTab === i ? '#E8520A' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '6px',
              fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {segmentNames[i] || `Segment ${i + 1}`}
          </button>
        ))}
      </div>

      <div style={PANEL_CARD}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', margin: '0 0 20px' }}>
          Who is the ultimate decision maker and what will make them say yes?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ ...LABEL_STYLE, display: 'block' }}>Ultimate Decision Maker</label>
            <input
              type="text"
              value={activeEntry.decision_maker}
              onChange={e => onChange(activeKey, 'decision_maker', e.target.value)}
              onBlur={onBlur}
              placeholder="e.g. CEO / Board of Directors"
              style={FIELD_INPUT}
            />
          </div>
          <div>
            <label style={{ ...LABEL_STYLE, display: 'block' }}>What Makes Them Say Yes</label>
            <textarea
              value={activeEntry.say_yes}
              onChange={e => onChange(activeKey, 'say_yes', e.target.value)}
              onBlur={onBlur}
              placeholder="e.g. Clear ROI within 90 days, peer validation from similar companies, low implementation risk"
              rows={4}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #9CA3AF',
                borderRadius: '8px',
                fontSize: '14px',
                lineHeight: '1.65',
                color: '#0D0D0D',
                backgroundColor: '#FFFFFF',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
