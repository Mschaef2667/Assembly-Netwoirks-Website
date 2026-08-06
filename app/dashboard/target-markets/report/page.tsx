'use client'

// On-screen HTML presentation of the ICP Calibration Report, styled to match the
// Intelligence Insights report. Renders from /api/icp/report?format=json and
// offers PDF and Word downloads from the same data.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Loader2, Download, FileText, ArrowLeft, Target, MessageSquare } from 'lucide-react'
import { CUSTOMER_CATEGORIES } from '@/lib/icp/customer-categories'

// ── Types (mirror the report route's ReportData) ──────────────────────────────

interface Objection { objection: string; overcomes: string }
interface IcpRecord {
  segment_index: number
  segment_name: string
  buyer_type: 'economic_buyer' | 'champion'
  is_primary: boolean
  job_titles: string[]
  company_size_range: string
  industry_verticals: string[]
  decision_making_power: string
  budget_range: string
  buying_motion: string
  buying_urgency_trigger: string
  primary_challenges: string[]
  barriers_to_success: string[]
  the_big_win: string
  success_metrics: string[]
  buying_triggers: string[]
  information_sources: string[]
  preferred_communication: string
  purchase_criteria: string[]
  buyer_values: string
  common_objections: Objection[]
  risk_sensitivities: string
  tech_stack: string
}
interface BaselineRecord {
  category: string
  profile_type: 'current' | 'ideal'
  customer_name: string
  contact_name: string
  contact_title: string
  segment_name: string
  industry: string
  company_size: string
  why_fits: string
  additional_context: string
}
interface TaggedResponse { respondent_name: string; respondent_title: string; respondent_company: string; customer_category: string }
interface MessagingBlock { messages: string[]; actions: string[] }
interface ReportData {
  orgName: string
  orgIndustry: string
  icps: IcpRecord[]
  baselines: BaselineRecord[]
  tagged: TaggedResponse[]
  totalResponses: number
  gate1Approved: boolean
  primary: IcpRecord | null
  messaging: Record<string, MessagingBlock>
}

// ── Style tokens ──────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: '#0F2140', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '22px',
}
const LABEL: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px',
}

function buyerLabel(bt: string): string { return bt === 'champion' ? 'Champion' : 'Economic Buyer' }
function icpKey(i: { segment_index: number; buyer_type: string }): string { return `${i.segment_index}-${i.buyer_type}` }

// ── Small render helpers ──────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value?: string }) {
  if (!value || !value.trim()) return null
  return (
    <div>
      <p style={LABEL}>{label}</p>
      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', margin: 0, lineHeight: 1.6 }}>{value}</p>
    </div>
  )
}

function BulletList({ label, items, color = '#E8520A' }: { label: string; items: string[]; color?: string }) {
  const clean = items.filter(Boolean)
  if (clean.length === 0) return null
  return (
    <div>
      <p style={LABEL}>{label}</p>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {clean.map((it, i) => (
          <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.55 }}>
            <span style={{ color, flexShrink: 0, marginTop: '6px', width: '5px', height: '5px', borderRadius: '50%', backgroundColor: color, display: 'inline-block' }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Chips({ label, items }: { label: string; items: string[] }) {
  const clean = items.filter(Boolean)
  if (clean.length === 0) return null
  return (
    <div>
      <p style={LABEL}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {clean.map((it, i) => (
          <span key={i} style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 500, backgroundColor: 'rgba(14,165,233,0.15)', color: '#0EA5E9' }}>{it}</span>
        ))}
      </div>
    </div>
  )
}

function IcpCard({ icp, mblock }: { icp: IcpRecord; mblock?: MessagingBlock }) {
  return (
    <div style={{ ...CARD, borderLeft: icp.is_primary ? '3px solid #E8520A' : '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#FFFFFF' }}>
          {icp.segment_name} · {buyerLabel(icp.buyer_type)}
        </h3>
        {icp.is_primary && (
          <span style={{ flexShrink: 0, padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700, backgroundColor: '#E8520A', color: '#FFFFFF', letterSpacing: '0.04em' }}>PRIMARY</span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Chips label="Job titles" items={icp.job_titles} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <Field label="Company size" value={icp.company_size_range} />
          <Field label="Budget range" value={icp.budget_range} />
        </div>
        <Chips label="Industry verticals" items={icp.industry_verticals} />
        <Field label="The big win" value={icp.the_big_win} />
        <BulletList label="Primary challenges" items={icp.primary_challenges} />
        <BulletList label="Buying triggers" items={icp.buying_triggers} />
        <Field label="Decision-making power" value={icp.decision_making_power} />
        <Field label="Buying motion" value={icp.buying_motion} />
        <Field label="Urgency trigger" value={icp.buying_urgency_trigger} />
        <BulletList label="Barriers to success" items={icp.barriers_to_success} />
        <BulletList label="Success metrics" items={icp.success_metrics} />
        <BulletList label="Purchase criteria" items={icp.purchase_criteria} />
        <BulletList label="Information sources" items={icp.information_sources} />
        <Field label="Preferred communication" value={icp.preferred_communication} />
        <Field label="Values" value={icp.buyer_values} />
        <Field label="Risk sensitivities" value={icp.risk_sensitivities} />
        <Field label="Tech stack & integrations" value={icp.tech_stack} />

        {icp.common_objections.filter(o => o.objection || o.overcomes).length > 0 && (
          <div>
            <p style={LABEL}>Common objections & how to overcome them</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {icp.common_objections.filter(o => o.objection || o.overcomes).map((o, i) => (
                <div key={i}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>{o.objection ? `“${o.objection}”` : ''}</p>
                  {o.overcomes && (
                    <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>
                      <span style={{ color: '#16A34A', fontWeight: 700 }}>How to overcome: </span>{o.overcomes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {mblock && (mblock.messages.length > 0 || mblock.actions.length > 0) && (
          <div style={{ marginTop: '2px', padding: '16px', borderRadius: '10px', backgroundColor: 'rgba(232,82,10,0.08)', border: '1px solid rgba(232,82,10,0.25)' }}>
            <p style={{ ...LABEL, color: '#E8520A' }}>Messaging & action plan</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <BulletList label="How to message them" items={mblock.messages} color="#0EA5E9" />
              <BulletList label="Recommended actions" items={mblock.actions} color="#E8520A" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IcpReportViewPage() {
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<null | 'pdf' | 'docx'>(null)
  const [dlError, setDlError] = useState<string | null>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void (async () => {
      try {
        const res = await fetch('/api/icp/report?format=json', { method: 'GET' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? 'Could not generate the report.')
        }
        setData(await res.json() as ReportData)
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to generate the report.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function download(format: 'pdf' | 'docx') {
    if (downloading) return
    setDownloading(format)
    setDlError(null)
    try {
      const res = await fetch(format === 'docx' ? '/api/icp/report?format=docx' : '/api/icp/report', { method: 'GET' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? 'Could not generate the file.')
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const cd = res.headers.get('Content-Disposition') ?? ''
      const match = /filename="([^"]+)"/.exec(cd)
      const a = document.createElement('a')
      a.href = url
      a.download = match ? match[1] : `ICP-Calibration-Report.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setDlError(err instanceof Error ? err.message : 'Download failed.')
    } finally {
      setDownloading(null)
    }
  }

  const primaryBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '40px', padding: '0 18px',
    borderRadius: '8px', border: 'none', backgroundColor: '#0EA5E9', color: '#FFFFFF',
    fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
  }
  const secondaryBtn: React.CSSProperties = {
    ...primaryBtn, backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.15)',
  }

  const otherIcps = data ? data.icps.filter(i => !(data.primary && i.is_primary)) : []

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with actions */}
      <header style={{ padding: '24px 32px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
        <div>
          <Link href="/dashboard/target-markets" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', marginBottom: '10px' }}>
            <ArrowLeft size={14} /> Back to ICP Calibrator
          </Link>
          <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>ICP Calibration Report</h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: '6px 0 0', maxWidth: '640px', lineHeight: 1.55 }}>
            Your calibrated ideal customer profiles, the baseline beliefs and buyer evidence behind them, and an AI-tailored
            messaging and action-plan summary for each ICP. Reflects your latest data.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => void download('pdf')} disabled={downloading !== null || loading}
            style={{ ...primaryBtn, cursor: downloading || loading ? 'not-allowed' : 'pointer', backgroundColor: downloading === 'pdf' ? 'rgba(14,165,233,0.5)' : '#0EA5E9' }}>
            {downloading === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download PDF
          </button>
          <button onClick={() => void download('docx')} disabled={downloading !== null || loading}
            style={{ ...secondaryBtn, cursor: downloading || loading ? 'not-allowed' : 'pointer' }}>
            {downloading === 'docx' ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Download Word
          </button>
          {dlError && <span style={{ fontSize: '12px', color: '#FCA5A5', maxWidth: '220px' }}>{dlError}</span>}
        </div>
      </header>

      <div style={{ flex: 1, padding: '0 32px 40px', maxWidth: '1000px', width: '100%' }}>
        {loading ? (
          <div style={{ ...CARD, display: 'flex', alignItems: 'center', gap: '12px', color: 'rgba(255,255,255,0.7)' }}>
            <Loader2 size={18} className="animate-spin" style={{ color: '#0EA5E9' }} /> Generating your report…
          </div>
        ) : loadError ? (
          <div style={{ ...CARD, borderColor: 'rgba(239,68,68,0.3)' }}>
            <p style={{ margin: 0, color: '#FCA5A5', fontSize: '14px' }}>{loadError}</p>
          </div>
        ) : data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Snapshot */}
            <div style={CARD}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '16px' }}>
                {([
                  { big: String(data.icps.length), small: data.icps.length === 1 ? 'Calibrated ICP' : 'Calibrated ICPs' },
                  { big: String(data.baselines.length), small: 'Baseline profiles' },
                  { big: `${data.tagged.length} / ${data.totalResponses}`, small: 'Tagged responses' },
                  { big: data.gate1Approved ? 'Approved' : 'Pending', small: 'Gate 1' },
                ]).map((s, i) => (
                  <div key={i} style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '14px 16px' }}>
                    <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>{s.big}</p>
                    <p style={{ ...LABEL, margin: '4px 0 0' }}>{s.small}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding: '14px 16px', borderRadius: '10px', backgroundColor: 'rgba(232,82,10,0.1)', border: '1px solid rgba(232,82,10,0.3)' }}>
                <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: '#E8520A', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Primary ICP — start here</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>
                  {data.primary ? `${data.primary.segment_name} · ${buyerLabel(data.primary.buyer_type)}` : 'Not selected yet'}
                </p>
                {data.primary?.the_big_win && (
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>They want: {data.primary.the_big_win}</p>
                )}
              </div>
            </div>

            {/* Primary ICP */}
            {data.primary && (
              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '4px 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={17} style={{ color: '#E8520A' }} /> Primary ICP — who we sell to first
                </h2>
                <IcpCard icp={data.primary} mblock={data.messaging[icpKey(data.primary)]} />
              </section>
            )}

            {/* Other calibrated ICPs */}
            <section>
              <h2 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '4px 0 12px' }}>
                {data.primary ? 'Other calibrated ICPs' : 'Calibrated ICPs'}
              </h2>
              {data.icps.length === 0 ? (
                <div style={CARD}><p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>No ICPs built yet. Complete Step 3 of the ICP Calibrator to populate this.</p></div>
              ) : otherIcps.length === 0 ? (
                <div style={CARD}><p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>Your primary ICP, above, is currently your only calibrated profile.</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {otherIcps.map((icp, i) => <IcpCard key={i} icp={icp} mblock={data.messaging[icpKey(icp)]} />)}
                </div>
              )}
            </section>

            {/* Baseline profiles */}
            <section>
              <h2 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '4px 0 4px' }}>Baseline Profiles — day-one beliefs</h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 12px' }}>What the team believed before buyer research — the baseline the calibration measures against.</p>
              {data.baselines.length === 0 ? (
                <div style={CARD}><p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>No baseline profiles captured yet.</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {CUSTOMER_CATEGORIES.map(cat => {
                    const rows = data.baselines.filter(b => b.category === cat.value)
                    if (rows.length === 0) return null
                    return (
                      <div key={cat.value} style={CARD}>
                        <p style={{ margin: '0 0 2px', fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>{cat.label} <span style={{ fontSize: '12px', fontWeight: 400, color: 'rgba(255,255,255,0.45)' }}>· {cat.hint}</span></p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                          {rows.map((b, i) => (
                            <div key={i} style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none', paddingTop: i > 0 ? '12px' : 0 }}>
                              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>
                                {b.customer_name || '(unnamed)'}
                                <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.04em', color: b.profile_type === 'ideal' ? '#0EA5E9' : '#16A34A' }}>
                                  {b.profile_type === 'ideal' ? 'CUSTOMER WE WANT' : 'CUSTOMER WE HAVE'}
                                </span>
                              </p>
                              {(b.contact_name || b.segment_name || b.industry || b.company_size) && (
                                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
                                  {[b.contact_name && `${b.contact_name}${b.contact_title ? `, ${b.contact_title}` : ''}`, b.segment_name, b.industry, b.company_size].filter(Boolean).join('  ·  ')}
                                </p>
                              )}
                              {b.why_fits && <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.55 }}>{b.why_fits}</p>}
                              {b.additional_context && <p style={{ margin: '4px 0 0', fontSize: '12px', fontStyle: 'italic', color: 'rgba(255,255,255,0.5)' }}>{b.additional_context}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Buyer evidence */}
            <section>
              <h2 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: '4px 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={16} style={{ color: '#0EA5E9' }} /> Buyer Evidence — what buyers said
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: '0 0 12px' }}>Current-customer responses tagged by best-customer category.</p>
              {data.tagged.length === 0 ? (
                <div style={CARD}>
                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>No responses tagged yet</p>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{data.totalResponses} response{data.totalResponses === 1 ? '' : 's'} collected. Tag current customers by category in the Response Manager to fill this in.</p>
                </div>
              ) : (
                <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {CUSTOMER_CATEGORIES.map(cat => {
                    const rows = data.tagged.filter(t => t.customer_category === cat.value)
                    if (rows.length === 0) return null
                    return (
                      <div key={cat.value}>
                        <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF' }}>{cat.label} <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 400 }}>({rows.length})</span></p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {rows.map((r, i) => (
                            <li key={i} style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                              {[r.respondent_name, r.respondent_title, r.respondent_company].filter(Boolean).join(' · ') || 'Unnamed respondent'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

          </div>
        ) : null}
      </div>
    </div>
  )
}
