'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { MessageSquare, X } from 'lucide-react'

type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'issue' | 'idea'

interface Option {
  type: FeedbackType
  emoji: string
  label: string
}

const OPTIONS: Option[] = [
  { type: 'thumbs_up',   emoji: '👍', label: 'This works great' },
  { type: 'thumbs_down', emoji: '👎', label: 'Something is wrong' },
  { type: 'issue',       emoji: '🐛', label: 'Report an issue' },
  { type: 'idea',        emoji: '💡', label: 'Share an idea' },
]

// Extract step_id from a /dashboard/journeys/step/<id> path. Returns null otherwise.
function extractStepId(pathname: string): string | null {
  const match = pathname.match(/\/journeys\/step\/([^\/?#]+)/)
  return match ? match[1] : null
}

export default function BetaFeedbackWidget() {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function reset() {
    setSelectedType(null)
    setMessage('')
    setSubmitting(false)
    setSubmitted(false)
    setErrorMsg(null)
  }

  function close() {
    setOpen(false)
    reset()
  }

  async function handleSubmit() {
    if (!selectedType || submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const pageUrl = typeof window !== 'undefined' ? window.location.href : pathname
      const stepId = extractStepId(pathname)
      const res = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          message: message.trim() || null,
          page_url: pageUrl,
          step_id: stepId,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Submit failed (${res.status})`)
      }
      setSubmitted(true)
      setTimeout(() => { close() }, 2000)
    } catch (err) {
      setSubmitting(false)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit feedback')
    }
  }

  return (
    <>
      {/* Floating launcher */}
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          zIndex: 9998,
        }}
      >
        <span
          style={{
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: '#FFFFFF',
            backgroundColor: '#0A1628',
            padding: '2px 8px',
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
        >
          Beta
        </span>
        <button
          type="button"
          aria-label="Share feedback"
          onClick={() => setOpen(true)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '999px',
            backgroundColor: '#E8520A',
            color: '#FFFFFF',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
            transition: 'transform 120ms ease, background-color 120ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#D14808' }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#E8520A' }}
        >
          <MessageSquare size={24} />
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share feedback"
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: '#0F2140',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '24px',
              color: '#FFFFFF',
              boxShadow: '0 20px 50px rgba(0,0,0,0.45)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>Share Feedback</h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.65)' }}>
                  Help us improve Assembly AI
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.65)',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {submitted ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  fontSize: '15px',
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(232,82,10,0.12)',
                  border: '1px solid rgba(232,82,10,0.4)',
                  borderRadius: '10px',
                }}
              >
                Thank you for your feedback!
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '10px',
                    marginBottom: '16px',
                  }}
                >
                  {OPTIONS.map((opt) => {
                    const isActive = selectedType === opt.type
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => setSelectedType(opt.type)}
                        style={{
                          minHeight: '64px',
                          padding: '12px',
                          borderRadius: '10px',
                          border: isActive ? '1px solid #E8520A' : '1px solid rgba(255,255,255,0.15)',
                          backgroundColor: isActive ? 'rgba(232,82,10,0.18)' : 'rgba(255,255,255,0.04)',
                          color: '#FFFFFF',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: '4px',
                          textAlign: 'left',
                          transition: 'background-color 120ms ease, border-color 120ms ease',
                        }}
                      >
                        <span style={{ fontSize: '22px', lineHeight: 1 }}>{opt.emoji}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{opt.label}</span>
                      </button>
                    )
                  })}
                </div>

                <label
                  htmlFor="beta-feedback-message"
                  style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '6px' }}
                >
                  Tell us more (optional)
                </label>
                <textarea
                  id="beta-feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Share any extra detail that would help..."
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    backgroundColor: '#FFFFFF',
                    color: '#0D0D0D',
                    fontSize: '14px',
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />

                {errorMsg && (
                  <div
                    style={{
                      marginTop: '12px',
                      fontSize: '13px',
                      color: '#FFB4A0',
                      backgroundColor: 'rgba(232,82,10,0.1)',
                      border: '1px solid rgba(232,82,10,0.35)',
                      borderRadius: '8px',
                      padding: '8px 10px',
                    }}
                  >
                    {errorMsg}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                  <button
                    type="button"
                    onClick={close}
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.2)',
                      backgroundColor: 'transparent',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      cursor: 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!selectedType || submitting}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: !selectedType || submitting ? 'rgba(232,82,10,0.4)' : '#E8520A',
                      color: '#FFFFFF',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: !selectedType || submitting ? 'not-allowed' : 'pointer',
                      minHeight: '44px',
                    }}
                  >
                    {submitting ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
