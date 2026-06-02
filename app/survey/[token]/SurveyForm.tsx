'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'

interface SurveyQuestion {
  id: string
  stageId: number
  stageName: string
  text: string
  type: 'open' | 'scale' | 'multiple_choice'
}

interface SurveyLinkData {
  token: string
  segmentName: string
  audience: string
  questions: SurveyQuestion[]
}

interface Props {
  link: SurveyLinkData
}

const COMPANY_SIZES = [
  '1-10 employees',
  '11-50 employees',
  '51-200 employees',
  '201-500 employees',
  '501-1,000 employees',
  '1,001-5,000 employees',
  '5,000+ employees',
]

const DECISION_ROLES = [
  'Final Decision Maker',
  'Strong Influence',
  'Evaluator / Analyst',
  'Champion (internal advocate)',
  'Gatekeeper / Procurement',
  'End User',
  'Observer / No direct role',
]

function groupByStage(questions: SurveyQuestion[]): Map<number, { stageName: string; questions: SurveyQuestion[] }> {
  const map = new Map<number, { stageName: string; questions: SurveyQuestion[] }>()
  for (const q of questions) {
    const existing = map.get(q.stageId)
    if (existing) {
      existing.questions.push(q)
    } else {
      map.set(q.stageId, { stageName: q.stageName, questions: [q] })
    }
  }
  return map
}

export default function SurveyForm({ link }: Props) {
  const [respondentName,    setRespondentName]    = useState('')
  const [respondentTitle,   setRespondentTitle]   = useState('')
  const [respondentCompany, setRespondentCompany] = useState('')
  const [respondentSize,    setRespondentSize]    = useState('')
  const [decisionRole,      setDecisionRole]      = useState('')
  const [answers,           setAnswers]           = useState<Record<string, string>>({})
  const [scaleValues,        setScaleValues]         = useState<Record<string, number>>({})
  const [submitting,         setSubmitting]          = useState(false)
  const [submitted,          setSubmitted]           = useState(false)
  const [error,              setError]               = useState<string | null>(null)

  const stageMap = groupByStage(link.questions)
  const stageIds = Array.from(stageMap.keys()).sort((a, b) => a - b)

  function setAnswer(questionId: string, value: string) {
    setAnswers(prev => ({ ...prev, [questionId]: value }))
  }

  function setScale(questionId: string, value: number) {
    setScaleValues(prev => ({ ...prev, [questionId]: value }))
    setAnswer(questionId, String(value))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/survey/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: link.token,
          respondentName,
          respondentTitle,
          respondentCompany,
          respondentSize,
          decisionRole,
          answers,
        }),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Submission failed')
      }

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: '#0A1628',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div style={{
          backgroundColor: '#0F2140', borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)', padding: '48px 40px',
          maxWidth: '520px', width: '100%', textAlign: 'center',
        }}>
          <CheckCircle2 size={48} style={{ color: '#16A34A', marginBottom: '20px' }} />
          <h2 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: 700, margin: '0 0 12px' }}>
            Thank You!
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '16px', lineHeight: '1.6', margin: 0 }}>
            Your response has been recorded. We appreciate your time and insights.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1628', paddingBottom: '80px' }}>

      {/* Header */}
      <div style={{
        backgroundColor: '#0F2140', borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '20px 24px',
      }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            backgroundColor: '#E8520A', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '14px', color: '#FFFFFF', letterSpacing: '-0.5px',
          }}>
            A
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>Assembly AI</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>Decision Clarity Survey</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '40px 24px' }}>

        {/* Intro */}
        <div style={{ marginBottom: '36px' }}>
          <h1 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: 700, margin: '0 0 12px' }}>
            Decision Clarity Survey
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', lineHeight: '1.7', margin: 0 }}>
            This short survey helps us better understand your buying experience. Your honest answers are invaluable.
            It takes approximately 5–10 minutes to complete.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>

          {/* Respondent profile */}
          <div style={{
            backgroundColor: '#0F2140', borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.1)', padding: '28px', marginBottom: '24px',
          }}>
            <h2 style={{ color: '#FFFFFF', fontSize: '17px', fontWeight: 700, margin: '0 0 20px' }}>
              About You
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={respondentName}
                  onChange={e => setRespondentName(e.target.value)}
                  placeholder="Jane Smith"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Job Title
                </label>
                <input
                  type="text"
                  value={respondentTitle}
                  onChange={e => setRespondentTitle(e.target.value)}
                  placeholder="VP of Marketing"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Your Role in This Decision
                </label>
                <select
                  value={decisionRole}
                  onChange={e => setDecisionRole(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    backgroundColor: '#0F2140', border: '1px solid rgba(255,255,255,0.12)',
                    color: decisionRole ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                    fontSize: '14px', boxSizing: 'border-box', outline: 'none',
                    appearance: 'none',
                  }}
                >
                  <option value="">Select your role</option>
                  {DECISION_ROLES.map(r => (
                    <option key={r} value={r} style={{ backgroundColor: '#0F2140', color: '#FFFFFF' }}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Company Name
                </label>
                <input
                  type="text"
                  value={respondentCompany}
                  onChange={e => setRespondentCompany(e.target.value)}
                  placeholder="Acme Corp"
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
                    color: '#FFFFFF', fontSize: '14px', boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Company Size
                </label>
                <select
                  value={respondentSize}
                  onChange={e => setRespondentSize(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: '8px',
                    backgroundColor: '#0F2140', border: '1px solid rgba(255,255,255,0.12)',
                    color: respondentSize ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                    fontSize: '14px', boxSizing: 'border-box', outline: 'none',
                    appearance: 'none',
                  }}
                >
                  <option value="">Select size…</option>
                  {COMPANY_SIZES.map(s => (
                    <option key={s} value={s} style={{ backgroundColor: '#0F2140', color: '#FFFFFF' }}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Questions by stage */}
          {stageIds.map(stageId => {
            const stage = stageMap.get(stageId)!
            return (
              <div key={stageId} style={{
                backgroundColor: '#0F2140', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.1)', padding: '28px', marginBottom: '24px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '6px', backgroundColor: 'rgba(14,165,233,0.15)',
                    border: '1px solid rgba(14,165,233,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: '#0EA5E9', flexShrink: 0,
                  }}>
                    {stageId}
                  </div>
                  <h2 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                    Stage {stageId}: {stage.stageName}
                  </h2>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {stage.questions.map((q, qi) => (
                    <div key={q.id}>
                      <label style={{
                        display: 'block', fontSize: '14px', fontWeight: 600,
                        color: '#FFFFFF', marginBottom: '10px', lineHeight: '1.5',
                      }}>
                        {qi + 1}. {q.text}
                      </label>

                      {q.type === 'scale' ? (
                        <div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => setScale(q.id, n)}
                                style={{
                                  width: '44px', height: '44px', borderRadius: '8px',
                                  backgroundColor: scaleValues[q.id] === n ? '#0EA5E9' : 'rgba(255,255,255,0.06)',
                                  color: scaleValues[q.id] === n ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                                  border: scaleValues[q.id] === n ? '1px solid #0EA5E9' : '1px solid rgba(255,255,255,0.1)',
                                  fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Not at all</span>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Extremely</span>
                          </div>
                        </div>
                      ) : (
                        <textarea
                          value={answers[q.id] ?? ''}
                          onChange={e => setAnswer(q.id, e.target.value)}
                          placeholder="Share your thoughts…"
                          rows={3}
                          style={{
                            width: '100%', padding: '10px 12px', borderRadius: '8px',
                            border: '1px solid rgba(255,255,255,0.12)',
                            color: '#0D0D0D', backgroundColor: '#FFFFFF',
                            fontSize: '14px', lineHeight: '1.6', resize: 'vertical',
                            boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Error */}
          {error && (
            <div style={{
              padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
              backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
            }}>
              <p style={{ color: '#EF4444', fontSize: '14px', margin: 0 }}>{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              width: '100%', minHeight: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              backgroundColor: submitting ? 'rgba(232,82,10,0.6)' : '#E8520A',
              color: '#FFFFFF', border: 'none', borderRadius: '10px',
              cursor: submitting ? 'not-allowed' : 'pointer',
              fontSize: '16px', fontWeight: 700, transition: 'background-color 0.15s',
            }}
          >
            {submitting ? (
              <><Loader2 size={18} className="animate-spin" /> Submitting…</>
            ) : (
              'Submit Response'
            )}
          </button>

          <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
            Powered by Assembly AI · Your response is confidential
          </p>
        </form>
      </div>
    </div>
  )
}
