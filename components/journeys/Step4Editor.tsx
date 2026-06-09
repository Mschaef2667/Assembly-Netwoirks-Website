'use client'

import { Plus, X } from 'lucide-react'
import { SaveIndicator } from './shared/SaveIndicator'
import { LABEL_STYLE, type PainPoint, type SaveState } from '@/lib/journeys/stepHelpers'

interface Step4EditorProps {
  painPoints: PainPoint[]
  activeCount: number
  activeTab: number
  saveState: SaveState
  contentQuality: number
  onTabChange: (tab: number) => void
  onTitleChange: (tab: number, title: string) => void
  onDescriptionChange: (tab: number, description: string) => void
  onAddPainPoint: () => void
  onRemovePainPoint: () => void
  onBlur: () => void
}

export function Step4Editor({
  painPoints, activeCount, activeTab, saveState, contentQuality,
  onTabChange, onTitleChange, onDescriptionChange,
  onAddPainPoint, onRemovePainPoint, onBlur,
}: Step4EditorProps) {
  const activePP = painPoints.find(pp => pp.index === activeTab) ?? painPoints[0]
  const visibleTabs = painPoints.slice(0, activeCount)
  const cqLabel = contentQuality >= 85 ? 'High' : contentQuality >= 65 ? 'Good' : contentQuality >= 30 ? 'Medium' : 'Low'
  const cqColor = contentQuality >= 85 ? '#16A34A' : contentQuality >= 65 ? '#0EA5E9' : contentQuality >= 30 ? '#D97706' : '#DC2626'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={LABEL_STYLE}>Pain Points</label>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 700 }}>·</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: cqColor }}>Quality: {contentQuality} · {cqLabel}</span>
          <div style={{ width: '40px', height: '3px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${contentQuality}%`, height: '100%', backgroundColor: cqColor, borderRadius: '2px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <SaveIndicator state={saveState} />
          {activeCount < 4 && (
            <button
              onClick={onAddPainPoint}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 12px', minHeight: '32px',
                backgroundColor: '#0EA5E9', color: '#FFFFFF',
                border: 'none', borderRadius: '6px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Add Pain Point
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {visibleTabs.map(pp => (
          <button
            key={pp.index}
            onClick={() => onTabChange(pp.index)}
            style={{
              padding: '6px 16px', minHeight: '36px',
              backgroundColor: activeTab === pp.index ? '#E8520A' : 'rgba(255,255,255,0.06)',
              color: activeTab === pp.index ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${activeTab === pp.index ? '#E8520A' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '6px',
              fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            Pain Point {pp.index}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={{ ...LABEL_STYLE, display: 'block' }}>Title</label>
        <input
          type="text"
          value={activePP?.title ?? ''}
          onChange={e => onTitleChange(activeTab, e.target.value)}
          onBlur={onBlur}
          placeholder="e.g. Poor pipeline visibility"
          style={{
            width: '100%',
            padding: '10px 14px',
            border: '1px solid #9CA3AF',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#0D0D0D',
            backgroundColor: '#FFFFFF',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={{ ...LABEL_STYLE, display: 'block' }}>Description</label>
        <textarea
          value={activePP?.description ?? ''}
          onChange={e => onDescriptionChange(activeTab, e.target.value)}
          onBlur={onBlur}
          placeholder="Describe the pain point in 2–4 sentences. What does the buyer experience? What are the consequences?"
          rows={5}
          style={{
            width: '100%',
            padding: '12px 14px',
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

      {activeCount > 1 && activeTab === activeCount && (
        <button
          onClick={onRemovePainPoint}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 12px', minHeight: '32px',
            backgroundColor: 'transparent', color: '#DC2626',
            border: '1px solid #FCA5A5', borderRadius: '6px',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <X size={12} />
          Remove Pain Point {activeTab}
        </button>
      )}
    </div>
  )
}
