'use client'

import { SaveIndicator } from './shared/SaveIndicator'
import {
  DROPDOWN_STYLE, FIELD_INPUT, LABEL_STYLE, PANEL_CARD,
  type SaveStatus, type Segment,
} from '@/lib/journeys/stepHelpers'

interface Step2EditorProps {
  segments: Segment[]
  saveStatus: SaveStatus
  onChange: (idx: number, field: keyof Segment, value: string) => void
  onBlur: () => void
}

export function Step2Editor({ segments, saveStatus, onChange, onBlur }: Step2EditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <label style={LABEL_STYLE}>Target Market Segments</label>
        <SaveIndicator state={saveStatus} />
      </div>
      {segments.map((seg, i) => (
        <div key={i} style={PANEL_CARD}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#E8520A',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {i + 1}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>Segment {i + 1}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ ...LABEL_STYLE, display: 'block' }}>Segment Name</label>
              <input
                type="text"
                value={seg.name}
                onChange={e => onChange(i, 'name', e.target.value)}
                onBlur={onBlur}
                placeholder="e.g. Mid-Market SaaS Companies"
                style={FIELD_INPUT}
              />
            </div>
            <div>
              <label style={{ ...LABEL_STYLE, display: 'block' }}>Industry</label>
              <select
                value={seg.industry}
                onChange={e => onChange(i, 'industry', e.target.value)}
                onBlur={onBlur}
                style={DROPDOWN_STYLE}
              >
                <option value="">Select an industry</option>
                <option value="Enterprise Technology & SaaS">Enterprise Technology &amp; SaaS</option>
                <option value="Healthcare & Life Sciences">Healthcare &amp; Life Sciences</option>
                <option value="Professional Services">Professional Services</option>
                <option value="Financial Services & Fintech">Financial Services &amp; Fintech</option>
                <option value="Non-Profit & Fundraising">Non-Profit &amp; Fundraising</option>
                <option value="Manufacturing & Industrial">Manufacturing &amp; Industrial</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ ...LABEL_STYLE, display: 'block' }}>Company Size</label>
              <select
                value={seg.company_size}
                onChange={e => onChange(i, 'company_size', e.target.value)}
                onBlur={onBlur}
                style={DROPDOWN_STYLE}
              >
                <option value="">Select company size</option>
                <option value="1-10 employees">1-10 employees</option>
                <option value="11-50 employees">11-50 employees</option>
                <option value="51-200 employees">51-200 employees</option>
                <option value="201-500 employees">201-500 employees</option>
                <option value="501-1,000 employees">501-1,000 employees</option>
                <option value="1,000+ employees">1,000+ employees</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ ...LABEL_STYLE, display: 'block' }}>Geography</label>
              <select
                value={seg.geography}
                onChange={e => onChange(i, 'geography', e.target.value)}
                onBlur={onBlur}
                style={DROPDOWN_STYLE}
              >
                <option value="">Select geography</option>
                <option value="Local (single city/region)">Local (single city/region)</option>
                <option value="Regional (multi-state)">Regional (multi-state)</option>
                <option value="National (US)">National (US)</option>
                <option value="North America">North America</option>
                <option value="Global">Global</option>
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
