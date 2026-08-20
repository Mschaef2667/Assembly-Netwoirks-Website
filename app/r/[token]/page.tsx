'use client'

import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { GtmAssessmentReport, GtmRating } from '@/lib/prompts/gtmAssessment'

interface Payload { company: string | null; industry: string | null; report: GtmAssessmentReport }

const NAVY = '#0A1628'
const INK = '#1F2937'
const MUT = '#6B7280'
const CYAN = '#0EA5E9'

const ratingColor = (r: GtmRating | string): string =>
  r === 'Strong' ? '#15803D' : r === 'Needs work' ? '#B91C1C' : '#B45309'

const wrap: CSSProperties = { maxWidth: '760px', margin: '0 auto', padding: '0 24px' }
const h2: CSSProperties = { fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: CYAN, margin: '38px 0 12px' }
const body: CSSProperties = { fontSize: '16px', lineHeight: 1.65, color: INK, margin: '0 0 12px' }

export default function PublicReportPage() {
  const params = useParams<{ token: string }>()
  const token = params?.token
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!token) return
    fetch(`/api/r/${token}`)
      .then(async (res) => {
        const body = (await res.json()) as Payload & { error?: string }
        if (!active) return
        if (!res.ok || !body.report) throw new Error(body.error ?? 'Report not found')
        setData(body)
      })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : String(e)) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUT, fontFamily: 'system-ui' }}>Loading your report…</div>
  }
  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', fontFamily: 'system-ui' }}>
        <h1 style={{ fontSize: '20px', color: NAVY }}>Report not found</h1>
        <p style={{ color: MUT }}>This link may be invalid or expired.</p>
      </div>
    )
  }

  const r = data.report

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', paddingBottom: '64px' }}>
      {/* Cover band */}
      <div style={{ background: NAVY, padding: '48px 0 40px', borderTop: `6px solid ${CYAN}` }}>
        <div style={wrap}>
          <p style={{ color: CYAN, fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 14px' }}>Assembly Networks · The C3 Method</p>
          <h1 style={{ color: '#fff', fontSize: '34px', fontWeight: 800, margin: '0 0 6px' }}>GTM Gap Report</h1>
          <p style={{ color: '#AEB6C4', fontSize: '16px', margin: 0 }}>
            {data.company ?? 'Your company'}{data.industry ? ` · ${data.industry}` : ''}
          </p>
          {r.headline_verdict && (
            <p style={{ color: '#D1D9E6', fontSize: '17px', lineHeight: 1.55, margin: '20px 0 0', maxWidth: '640px' }}>{r.headline_verdict}</p>
          )}
        </div>
      </div>

      <div style={{ ...wrap, marginTop: '8px' }}>
        <div style={{ display: 'flex', gap: '10px', margin: '22px 0 4px', flexWrap: 'wrap' }}>
          <a href={`/api/r/${token}/pdf`} target="_blank" rel="noopener" style={{ background: NAVY, color: '#fff', textDecoration: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '14px' }}>Download PDF</a>
          <a href="https://calendar.app.google/umNEpz7oxQAZYkzv6" style={{ background: CYAN, color: '#fff', textDecoration: 'none', padding: '10px 18px', borderRadius: '8px', fontWeight: 600, fontSize: '14px' }}>Book your 30-minute review</a>
        </div>

        {r.snapshot && (<><h2 style={h2}>What we heard</h2><p style={body}>{r.snapshot}</p></>)}

        {r.scorecard?.length > 0 && (
          <>
            <h2 style={h2}>Scorecard</h2>
            {r.scorecard.map((s, i) => (
              <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid #EEF1F5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontWeight: 700, color: NAVY, fontSize: '15px' }}>{s.dimension}</span>
                  <span style={{ background: ratingColor(s.rating), color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', whiteSpace: 'nowrap' }}>{(s.rating || '').toUpperCase()}</span>
                </div>
                <p style={{ ...body, fontSize: '14.5px', margin: '6px 0 0', color: '#374151' }}>{s.reason}</p>
              </div>
            ))}
          </>
        )}

        {r.gaps?.length > 0 && (
          <>
            <h2 style={h2}>Where the gaps likely are</h2>
            {r.gaps.map((g, i) => (
              <div key={i} style={{ margin: '0 0 20px' }}>
                <p style={{ fontWeight: 700, color: NAVY, fontSize: '16px', margin: '0 0 6px' }}>{i + 1}. {g.gap}</p>
                {g.why_it_costs && <p style={{ ...body, margin: '0 0 8px' }}>{g.why_it_costs}</p>}
                {g.probing_question && (
                  <p style={{ margin: 0, padding: '10px 14px', background: '#F1F5F9', borderLeft: `3px solid ${CYAN}`, borderRadius: '4px', fontStyle: 'italic', color: '#334155', fontSize: '15px' }}>{g.probing_question}</p>
                )}
              </div>
            ))}
          </>
        )}

        {r.quick_wins?.length > 0 && (
          <>
            <h2 style={h2}>Quick wins this week</h2>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {r.quick_wins.map((w, i) => <li key={i} style={{ ...body, margin: '0 0 8px' }}>{w}</li>)}
            </ul>
          </>
        )}

        {r.bigger_opportunity && (<><h2 style={h2}>The bigger opportunity</h2><p style={body}>{r.bigger_opportunity}</p></>)}
        {r.why_assembly_ai && (<><h2 style={h2}>Why Assembly AI changes the outcome</h2><p style={body}>{r.why_assembly_ai}</p></>)}

        {r.next_step && (
          <div style={{ background: NAVY, borderRadius: '10px', padding: '22px 24px', margin: '28px 0 0' }}>
            <p style={{ color: CYAN, fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 8px' }}>Your next step</p>
            <p style={{ color: '#fff', fontSize: '16px', lineHeight: 1.6, margin: '0 0 16px' }}>{r.next_step}</p>
            <a href="https://calendar.app.google/umNEpz7oxQAZYkzv6" style={{ background: CYAN, color: '#fff', textDecoration: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', display: 'inline-block' }}>Book your 30-minute review</a>
          </div>
        )}

        <p style={{ fontSize: '12px', color: MUT, lineHeight: 1.6, margin: '32px 0 0', paddingTop: '16px', borderTop: '1px solid #EEF1F5' }}>
          This assessment is based solely on the information you provided about your go-to-market strategy. It reflects our informed interpretation of that input, not independent research into your buyers or market, and is intended as directional guidance rather than a guarantee of results. The real gains come from replacing assumptions with validated buyer research, which is what a C3 Method strategy sprint delivers. © 2026 Assembly Networks, LLC.
        </p>
      </div>
    </div>
  )
}
