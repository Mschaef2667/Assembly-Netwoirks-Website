'use client'

import { Pencil, X } from 'lucide-react'
import type { Question } from './types'
import { TYPE_LABELS, TYPE_COLORS } from './constants'

interface Props {
  question: Question
  stageId: number
  editingId: string | null
  editText: string
  hoveringQId: string | null
  onSetEditingId: (id: string | null) => void
  onSetEditText: (text: string) => void
  onSetHoveringQId: (id: string | null) => void
  onCommitEdit: (stageId: number, qId: string) => void
  onCycleType: (stageId: number, qId: string) => void
  onDelete: (stageId: number, qId: string) => void
}

export default function SurveyQuestionCard({
  question: q,
  stageId,
  editingId,
  editText,
  hoveringQId,
  onSetEditingId,
  onSetEditText,
  onSetHoveringQId,
  onCommitEdit,
  onCycleType,
  onDelete,
}: Props) {
  return (
    <div
      onMouseEnter={() => onSetHoveringQId(q.id)}
      onMouseLeave={() => onSetHoveringQId(null)}
      style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingId === q.id ? (
            <textarea
              value={editText}
              onChange={e => onSetEditText(e.target.value)}
              onBlur={() => onCommitEdit(stageId, q.id)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onCommitEdit(stageId, q.id) }
                if (e.key === 'Escape') onSetEditingId(null)
              }}
              autoFocus
              style={{
                width: '100%', padding: '8px 10px', fontSize: '14px',
                color: '#0D0D0D', backgroundColor: '#FFFFFF',
                border: '1px solid #0EA5E9', borderRadius: '6px',
                resize: 'vertical', minHeight: '72px', fontFamily: 'inherit',
                outline: 'none', boxSizing: 'border-box', display: 'block',
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '0 0 8px' }}>
              <p
                onClick={() => { onSetEditingId(q.id); onSetEditText(q.text) }}
                style={{
                  fontSize: '14px', lineHeight: '1.5', margin: 0, cursor: 'text', flex: 1,
                  color: q.text ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.3)',
                  fontStyle: q.text ? 'normal' : 'italic',
                }}
              >
                {q.text || 'Click to add question text…'}
              </p>
              {hoveringQId === q.id && (
                <Pencil size={12} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginTop: '3px' }} />
              )}
            </div>
          )}

          <button
            onClick={() => onCycleType(stageId, q.id)}
            title="Click to change type"
            style={{
              padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
              backgroundColor: TYPE_COLORS[q.type].bg, color: TYPE_COLORS[q.type].color,
              border: 'none', cursor: 'pointer',
            }}
          >
            {TYPE_LABELS[q.type]}
          </button>
        </div>

        <button
          onClick={() => onDelete(stageId, q.id)}
          title="Delete question"
          style={{
            minWidth: '32px', minHeight: '32px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.3)', borderRadius: '6px',
          }}
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
