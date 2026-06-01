'use client'

import { Pencil, X, Lock } from 'lucide-react'
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
  onRestore: (stageId: number, qId: string) => void
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
  onRestore,
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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', margin: '0 0 8px', flexWrap: 'wrap' }}>
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
              {!q.locked && hoveringQId === q.id && (
                <Pencil size={12} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginTop: '3px' }} />
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

            {q.locked && q.modified && (
              <>
                <span style={{
                  padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                  backgroundColor: 'rgba(232,82,10,0.15)', color: '#E8520A',
                  border: '1px solid rgba(232,82,10,0.25)',
                }}>
                  Modified
                </span>
                <button
                  onClick={() => onRestore(stageId, q.id)}
                  style={{
                    fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.45)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0',
                    textDecoration: 'underline',
                  }}
                >
                  Restore
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right action: lock icon for locked questions, delete X for unlocked */}
        {q.locked ? (
          <div
            title="This is a core DCP question — it can be edited but not removed"
            style={{
              minWidth: '32px', minHeight: '32px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.25)',
            }}
          >
            <Lock size={12} />
          </div>
        ) : (
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
        )}
      </div>
    </div>
  )
}
