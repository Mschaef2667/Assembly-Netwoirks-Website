'use client'

import { useState } from 'react'
import { SaveIndicator } from './shared/SaveIndicator'
import {
  CONCERN_OPTIONS, FIELD_INPUT, INFLUENCE_LEVELS, LABEL_STYLE, PANEL_CARD,
  PRIMARY_CONCERN_MAP, ROLE_CATEGORIES, SEG_KEYS, makeDMs,
  type DecisionMaker, type RoleCategory, type SaveStatus,
} from '@/lib/journeys/stepHelpers'

interface Step3EditorProps {
  segmentNames: string[]
  dms: Record<string, DecisionMaker[]>
  activeTab: number
  saveStatus: SaveStatus
  onTabChange: (tab: number) => void
  onChange: (segKey: string, dmIdx: number, field: Exclude<keyof DecisionMaker, 'primary_concerns'>, value: string) => void
  onConcernToggle: (segKey: string, dmIdx: number, concern: string) => void
  onAddCustomConcern: (segKey: string, dmIdx: number, customText: string) => void
  onBlur: () => void
}

export function Step3Editor({ segmentNames, dms, activeTab, saveStatus, onTabChange, onChange, onConcernToggle, onAddCustomConcern, onBlur }: Step3EditorProps) {
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({})
  const activeKey = SEG_KEYS[activeTab]
  const activeDMs = dms[activeKey] ?? makeDMs()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <label style={LABEL_STYLE}>Key Decision Makers</label>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeDMs.map((dm, dmIdx) => (
          <div key={dmIdx} style={PANEL_CARD}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '14px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'rgba(232,82,10,0.2)',
                color: '#E8520A',
                fontSize: '12px',
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {dmIdx + 1}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                Decision Maker {dmIdx + 1}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ ...LABEL_STYLE, display: 'block' }}>Role / Title</label>
                <select
                  value={dm.role_category}
                  onChange={e => onChange(activeKey, dmIdx, 'role_category', e.target.value)}
                  onBlur={onBlur}
                  style={{ ...FIELD_INPUT, cursor: 'pointer' }}
                >
                  {ROLE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} style={{ backgroundColor: '#0F2140' }}>
                      {cat === '' ? 'Select a title' : cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...LABEL_STYLE, display: 'block' }}>Specific Title</label>
                <input
                  type="text"
                  value={dm.specific_title}
                  onChange={e => onChange(activeKey, dmIdx, 'specific_title', e.target.value)}
                  onBlur={onBlur}
                  placeholder="e.g. VP of Sales"
                  style={{ ...FIELD_INPUT, color: '#0D0D0D', backgroundColor: '#FFFFFF' }}
                />
              </div>
              <div>
                <label style={{ ...LABEL_STYLE, display: 'block' }}>Influence Level</label>
                <select
                  value={dm.influence}
                  onChange={e => onChange(activeKey, dmIdx, 'influence', e.target.value)}
                  onBlur={onBlur}
                  style={{ ...FIELD_INPUT, cursor: 'pointer' }}
                >
                  {INFLUENCE_LEVELS.map(lvl => (
                    <option key={lvl} value={lvl} style={{ backgroundColor: '#0F2140' }}>
                      {lvl === '' ? 'Select influence level' : lvl}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ ...LABEL_STYLE, display: 'block' }}>Primary Concerns</label>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                  {dm.primary_concerns.length} of 3 selected
                </span>
              </div>

              {dm.primary_concerns.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {dm.primary_concerns.map(concern => (
                    <button
                      key={concern}
                      type="button"
                      onClick={() => { onConcernToggle(activeKey, dmIdx, concern); onBlur() }}
                      title="Click to deselect"
                      style={{
                        padding: '4px 10px',
                        minHeight: '28px',
                        borderRadius: '14px',
                        border: '1px solid #E8520A',
                        backgroundColor: '#E8520A',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {concern}
                      <span style={{ fontSize: '10px', opacity: 0.75 }}>✕</span>
                    </button>
                  ))}
                </div>
              )}

              {(() => {
                const roleConcerns = PRIMARY_CONCERN_MAP[dm.role_category as RoleCategory] ?? []
                const layer2Concerns = CONCERN_OPTIONS.filter(c =>
                  !dm.primary_concerns.includes(c) &&
                  (dm.role_category === '' || !roleConcerns.includes(c))
                )
                const layer2Label = dm.role_category !== ''
                  ? `Suggested for ${dm.role_category}`
                  : 'All concerns'
                return (
                  <>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }}>
                      {layer2Label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {layer2Concerns.map(concern => {
                        const atLimit = dm.primary_concerns.length >= 3
                        return (
                          <button
                            key={concern}
                            type="button"
                            onClick={() => { if (!atLimit) { onConcernToggle(activeKey, dmIdx, concern); onBlur() } }}
                            disabled={atLimit}
                            style={{
                              padding: '4px 10px',
                              minHeight: '28px',
                              borderRadius: '14px',
                              border: '1px solid rgba(255,255,255,0.2)',
                              backgroundColor: '#0A1628',
                              color: 'rgba(255,255,255,0.65)',
                              fontSize: '12px',
                              fontWeight: 400,
                              cursor: atLimit ? 'not-allowed' : 'pointer',
                              opacity: atLimit ? 0.4 : 1,
                              transition: 'background-color 0.15s, border-color 0.15s',
                            }}
                          >
                            {concern}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="text"
                  value={customInputs[dmIdx] ?? ''}
                  onChange={e => setCustomInputs(prev => ({ ...prev, [dmIdx]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (customInputs[dmIdx] ?? '').trim()
                      if (val && dm.primary_concerns.length < 3 && !dm.primary_concerns.includes(val)) {
                        onAddCustomConcern(activeKey, dmIdx, val)
                        setCustomInputs(prev => ({ ...prev, [dmIdx]: '' }))
                        onBlur()
                      }
                    }
                  }}
                  placeholder="Add your own concern..."
                  style={{ ...FIELD_INPUT, color: '#0D0D0D', backgroundColor: '#FFFFFF', flex: 1, fontSize: '12px', padding: '4px 10px', minHeight: '32px' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = (customInputs[dmIdx] ?? '').trim()
                    if (val && dm.primary_concerns.length < 3 && !dm.primary_concerns.includes(val)) {
                      onAddCustomConcern(activeKey, dmIdx, val)
                      setCustomInputs(prev => ({ ...prev, [dmIdx]: '' }))
                      onBlur()
                    }
                  }}
                  disabled={dm.primary_concerns.length >= 3 || !(customInputs[dmIdx] ?? '').trim()}
                  style={{
                    padding: '4px 14px',
                    minHeight: '32px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    backgroundColor: (dm.primary_concerns.length >= 3 || !(customInputs[dmIdx] ?? '').trim()) ? '#0A1628' : 'rgba(232,82,10,0.15)',
                    color: (dm.primary_concerns.length >= 3 || !(customInputs[dmIdx] ?? '').trim()) ? 'rgba(255,255,255,0.3)' : '#E8520A',
                    fontSize: '18px',
                    fontWeight: 700,
                    cursor: (dm.primary_concerns.length >= 3 || !(customInputs[dmIdx] ?? '').trim()) ? 'not-allowed' : 'pointer',
                    lineHeight: 1,
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
