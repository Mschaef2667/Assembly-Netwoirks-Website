'use client'

import Link from 'next/link'

export function StepNavBar({ stepId, total, prevId, nextId, hasContent }: {
  stepId: string
  total: number
  prevId: string | null
  nextId: string | null
  hasContent: boolean
}) {
  if (total === 0) return null
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      backgroundColor: '#0F2140',
      height: '64px',
      flexShrink: 0,
    }}>
      <div style={{ minWidth: '140px' }}>
        {prevId ? (
          <Link
            href={`/dashboard/journeys/step/${prevId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '44px',
              padding: '0 16px',
              backgroundColor: 'transparent',
              color: '#0EA5E9',
              border: '1px solid #0EA5E9',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ← Previous
          </Link>
        ) : <span />}
      </div>
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
        {stepId ? `Step ${stepId} of ${total}` : `${total} steps`}
      </span>
      <div style={{ minWidth: '140px', display: 'flex', justifyContent: 'flex-end' }}>
        {nextId ? (
          hasContent ? (
            <Link
              href={`/dashboard/journeys/step/${nextId}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '44px',
                padding: '0 16px',
                backgroundColor: '#E8520A',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Next →
            </Link>
          ) : (
            <button
              disabled
              title="Complete this step before continuing"
              aria-label="Complete this step before continuing"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '44px',
                padding: '0 16px',
                backgroundColor: '#6B7280',
                color: 'rgba(255,255,255,0.6)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Next →
            </button>
          )
        ) : <span />}
      </div>
    </div>
  )
}
