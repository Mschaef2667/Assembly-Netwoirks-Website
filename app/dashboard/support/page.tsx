'use client'

import { useEffect, useRef, useState } from 'react'
import {
  MessageCircle,
  BookOpen,
  Lightbulb,
  Mail,
  PlayCircle,
  Sparkles,
  Send,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const cardStyle: React.CSSProperties = {
  backgroundColor: '#0F2140',
  border: '1px solid rgba(255,255,255,0.1)',
  borderLeft: '3px solid #0EA5E9',
  borderRadius: '10px',
  padding: '24px',
}

function ComingSoonBadge() {
  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      backgroundColor: 'rgba(107,114,128,0.25)',
      color: '#6B7280',
      padding: '2px 8px',
      borderRadius: '20px',
      border: '1px solid rgba(107,114,128,0.35)',
    }}>
      Coming Soon
    </span>
  )
}

function LiveBadge() {
  return (
    <span style={{
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      backgroundColor: 'rgba(232,82,10,0.15)',
      color: '#E8520A',
      padding: '2px 8px',
      borderRadius: '20px',
      border: '1px solid rgba(232,82,10,0.35)',
    }}>
      Live
    </span>
  )
}

function CardHeader({ icon: Icon, title, badge }: {
  icon: React.ElementType
  title: string
  badge: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <div style={{
        width: '36px', height: '36px', borderRadius: '8px',
        backgroundColor: 'rgba(14,165,233,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color="#0EA5E9" strokeWidth={1.8} />
      </div>
      <span style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, flex: 1 }}>{title}</span>
      {badge}
    </div>
  )
}

// ── 1. AI Copilot Assistant ──────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

function AICopilotCard() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    async function loadWs() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: userRow } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single()
        if (!userRow) return
        setWorkspaceId((userRow as Record<string, unknown>)['org_id'] as string)
      } catch { /* non-fatal */ }
    }
    void loadWs()
  }, [])

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  async function handleSend() {
    const question = input.trim()
    if (!question || loading || !workspaceId) return
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId: 'support-assistant',
          workspaceId,
          stepTitle: 'Support Assistant',
          stepDescription: '',
          currentContent: '',
          extraContext: question,
        }),
      })

      if (!res.ok || !res.body) {
        setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }

      if (accumulated.includes('__STREAM_ERROR__')) {
        setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }])
        return
      }

      const stripped = accumulated
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()
      let answer = stripped
      try {
        const parsed = JSON.parse(stripped) as Record<string, unknown>
        if (typeof parsed['draft'] === 'string') answer = parsed['draft'] as string
      } catch { /* keep stripped raw */ }

      setMessages(prev => [...prev, { role: 'assistant', text: answer }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  const canSend = !loading && !!input.trim() && !!workspaceId

  return (
    <div style={cardStyle}>
      <style>{`@keyframes support-typing-bounce { 0%, 80%, 100% { transform: scale(0.5); opacity: 0.4 } 40% { transform: scale(1); opacity: 1 } }`}</style>
      <CardHeader icon={MessageCircle} title="AI Copilot Assistant" badge={<LiveBadge />} />
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>
        Ask anything about Assembly AI and the C3 Method. Get instant answers powered by AI.
      </p>

      <div
        ref={threadRef}
        style={{
          height: '240px',
          overflowY: 'auto',
          backgroundColor: 'rgba(10,22,40,0.5)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {messages.length === 0 && !loading && (
          <p style={{ color: '#6B7280', fontSize: '12px', margin: 0, textAlign: 'center', paddingTop: '40px' }}>
            Try asking: &quot;What is the DCP?&quot; or &quot;How do I write a strong CVP?&quot;
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              backgroundColor: m.role === 'user' ? '#E8520A' : '#0A1628',
              color: '#FFFFFF',
              padding: '8px 12px',
              borderRadius: '12px',
              fontSize: '13px',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
              border: m.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div style={{
            alignSelf: 'flex-start',
            backgroundColor: '#0A1628',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '10px 14px',
            borderRadius: '12px',
            display: 'flex',
            gap: '4px',
            alignItems: 'center',
          }}>
            {[0, 0.16, 0.32].map((delay, i) => (
              <span
                key={i}
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#6B7280',
                  display: 'inline-block',
                  animation: `support-typing-bounce 1.4s infinite ease-in-out both`,
                  animationDelay: `${delay}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void handleSend()
            }
          }}
          disabled={loading || !workspaceId}
          placeholder={workspaceId ? 'Ask a question…' : 'Loading…'}
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#0D0D0D',
            fontSize: '13px',
            outline: 'none',
            minHeight: '44px',
          }}
        />
        <button
          onClick={() => void handleSend()}
          disabled={!canSend}
          style={{
            width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0,
            backgroundColor: '#E8520A',
            border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: canSend ? 'pointer' : 'default',
            opacity: canSend ? 1 : 0.4,
          }}
        >
          <Send size={16} color="#FFFFFF" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}

// ── 2. Tips and Tricks Library ───────────────────────────────────────────────
interface Tip { title: string; body: string }
interface TipCategory { name: string; tips: Tip[] }

const tipCategories: TipCategory[] = [
  {
    name: 'Getting Started',
    tips: [
      {
        title: 'Complete Phase 1 before anything else',
        body: 'Steps 1–3.5 (Company Profile, Target Markets, Decision Makers, Buying Center) feed every downstream Copilot prompt. The richer your Phase 1 inputs, the better every Phase 2 output will be.',
      },
      {
        title: 'Treat Intelligence as the foundation, not a side task',
        body: 'The Decision Clarity Profile is the buyer-research backbone for the entire methodology. Steps 4–9 (Endemic Problems) are populated directly from DCP stage data.',
      },
      {
        title: 'Approve Gate 1 to unlock ICP Development and Journeys',
        body: 'Without Gate 1 approval on the DCP Map, Target Markets & Offers and Phase 2 steps stay locked. Submit the DCP Map for approval once the stage summaries feel solid.',
      },
    ],
  },
  {
    name: 'Survey Best Practices',
    tips: [
      {
        title: 'Keep the stage prefixes on every question',
        body: 'Exported CSVs prefix each question with [Stage X — Stage Name]. Leave these intact so response imports auto-map answers back to the correct DCP stage.',
      },
      {
        title: 'Aim for at least 3 substantive responses per stage',
        body: 'Stages with thin coverage produce weak DCP summaries and unreliable Step 4–9 drafts. If a stage has fewer than 3 responses, push for more before generating the DCP Map.',
      },
      {
        title: 'Mix customer types when sampling respondents',
        body: 'Won deals, lost deals, churned customers, and existing customers each surface different stages of the decision journey. A balanced sample produces a richer DCP Map.',
      },
    ],
  },
  {
    name: 'Strategic Messages (Steps 27–30)',
    tips: [
      {
        title: 'The Set-Up (Step 27) opens in buyer language',
        body: 'Pulls from Steps 4, 5, 6. Format: "Does your company experience [Effect] because of [Cause]?" Use the exact words buyers used in DCP responses, not internal jargon.',
      },
      {
        title: 'The Jab (Step 28) is your value claim',
        body: 'Format: "Our solution will [CVP] because of our commitment to [Core Competency]." If the Step 11 CVPs feel generic, fix them before tightening Step 28.',
      },
      {
        title: 'Knock-Out and Clean-Up are where you win',
        body: 'Step 29 (Knock-Out) hinges on Step 18 (Differentiators). Step 30 (Clean-Up) hinges on Steps 6 (Effect) and 19 (Competitive Advantages). Weak upstream content cascades — edit upstream first.',
      },
    ],
  },
  {
    name: 'Action Plan (Steps 31–38)',
    tips: [
      {
        title: 'Use the Strategic Plan PDF as your client deliverable',
        body: 'Generate the Strategic Plan PDF from the Journeys page. It compiles every approved step into one branded document ready for stakeholder review.',
      },
      {
        title: 'Revisit Steps 13–14 if the Action Plan feels thin',
        body: 'Steps 31–38 build on Critical Success Formulas (Step 13) and Core Competencies (Step 14). If those are weak, the Action Plan will feel generic no matter how it is written.',
      },
    ],
  },
]

function TipsCard() {
  const [openKey, setOpenKey] = useState<string | null>(null)

  return (
    <div style={cardStyle}>
      <CardHeader icon={BookOpen} title="Tips and Tricks Library" badge={<LiveBadge />} />
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>
        Practical guidance to help you get the most out of Assembly AI.
      </p>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        maxHeight: '320px',
        overflowY: 'auto',
        paddingRight: '4px',
      }}>
        {tipCategories.map(cat => (
          <div key={cat.name}>
            <h3 style={{
              color: '#0EA5E9',
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              margin: '0 0 8px',
            }}>
              {cat.name}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {cat.tips.map((tip, i) => {
                const key = `${cat.name}-${i}`
                const open = openKey === key
                return (
                  <button
                    key={key}
                    onClick={() => setOpenKey(open ? null : key)}
                    style={{
                      textAlign: 'left',
                      backgroundColor: open ? 'rgba(14,165,233,0.08)' : 'rgba(255,255,255,0.05)',
                      border: open ? '1px solid rgba(14,165,233,0.3)' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      cursor: 'pointer',
                      color: '#FFFFFF',
                      width: '100%',
                      font: 'inherit',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '8px',
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.4 }}>
                        {tip.title}
                      </span>
                      <span style={{ color: '#6B7280', fontSize: '16px', flexShrink: 0, lineHeight: 1 }}>
                        {open ? '−' : '+'}
                      </span>
                    </div>
                    {open && (
                      <p style={{
                        color: 'rgba(255,255,255,0.75)',
                        fontSize: '12px',
                        margin: '8px 0 0',
                        lineHeight: 1.6,
                      }}>
                        {tip.body}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 3. Suggest a Feature ─────────────────────────────────────────────────────
function SuggestFeatureCard() {
  const [suggestion, setSuggestion] = useState('')

  function handleSubmit() {
    if (!suggestion.trim()) return
    const subject = encodeURIComponent('Assembly AI Feature Suggestion')
    const body = encodeURIComponent(suggestion.trim())
    window.location.href = `mailto:info@assemblynetworks.net?subject=${subject}&body=${body}`
  }

  return (
    <div style={cardStyle}>
      <CardHeader icon={Lightbulb} title="Suggest a Feature" badge={<LiveBadge />} />
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, marginBottom: '16px' }}>
        Have an idea that would make Assembly AI better? We&apos;d love to hear it.
      </p>
      <textarea
        value={suggestion}
        onChange={e => setSuggestion(e.target.value)}
        placeholder="Describe your feature idea…"
        rows={4}
        style={{
          width: '100%',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '8px',
          padding: '10px 14px',
          color: '#0D0D0D',
          fontSize: '13px',
          outline: 'none',
          resize: 'vertical',
          marginBottom: '12px',
          boxSizing: 'border-box',
        } as React.CSSProperties}
      />
      <button
        onClick={handleSubmit}
        style={{
          backgroundColor: '#E8520A',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: '44px',
          minWidth: '44px',
        }}
      >
        Send Suggestion
      </button>
    </div>
  )
}

// ── 4. Contact Us ────────────────────────────────────────────────────────────
function ContactUsCard() {
  return (
    <div style={cardStyle}>
      <CardHeader icon={Mail} title="Contact Us" badge={<LiveBadge />} />
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
        Have a question or need help? We respond within 24 hours.
      </p>
      <a
        href="mailto:info@assemblynetworks.net"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: '#E8520A',
          color: '#FFFFFF',
          textDecoration: 'none',
          borderRadius: '8px',
          padding: '10px 20px',
          fontSize: '13px',
          fontWeight: 600,
          minHeight: '44px',
        }}
      >
        <Mail size={15} strokeWidth={2} />
        Email Us
      </a>
    </div>
  )
}

// ── 5. Video Tutorials ───────────────────────────────────────────────────────
function VideoTutorialsCard() {
  const videos = ['Getting Started with the C3 Method', 'Intelligence & DCP Walkthrough', 'Completing Your 38-Step Journey']
  return (
    <div style={cardStyle}>
      <CardHeader icon={PlayCircle} title="Video Tutorials" badge={<ComingSoonBadge />} />
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
        Step-by-step video walkthroughs for every section of the C3 Method.
      </p>
      <div style={{ display: 'flex', gap: '10px', opacity: 0.35, pointerEvents: 'none' }}>
        {videos.map((title, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              aspectRatio: '16/9',
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '8px',
            }}>
              <PlayCircle size={24} color="#6B7280" strokeWidth={1.5} />
            </div>
            <p style={{
              color: '#6B7280', fontSize: '11px', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{title}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 6. What's New ────────────────────────────────────────────────────────────
const changelog = [
  { date: 'May 2026', text: 'Strategic Plan PDF export launched' },
  { date: 'May 2026', text: 'Copilot added to all Company Formula steps' },
  { date: 'May 2026', text: 'Decision Clarity Profile map and Gate 1 approval flow complete' },
]

function WhatsNewCard() {
  return (
    <div style={cardStyle}>
      <CardHeader icon={Sparkles} title="What's New" badge={<LiveBadge />} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {changelog.map((entry, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{
              flexShrink: 0,
              fontSize: '10px',
              fontWeight: 700,
              backgroundColor: 'rgba(232,82,10,0.15)',
              color: '#E8520A',
              padding: '3px 8px',
              borderRadius: '20px',
              border: '1px solid rgba(232,82,10,0.3)',
              whiteSpace: 'nowrap',
              marginTop: '1px',
            }}>
              {entry.date}
            </span>
            <p style={{ color: '#FFFFFF', fontSize: '13px', margin: 0, lineHeight: 1.5 }}>
              {entry.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function SupportPage() {
  return (
    <main style={{ backgroundColor: '#0A1628', minHeight: '100vh', padding: '40px 48px' }}>
      {/* Header */}
      <div style={{ marginBottom: '36px' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: 700, margin: '0 0 6px' }}>
          Support
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', margin: 0 }}>
          Everything you need to get the most out of Assembly AI.
        </p>
      </div>

      {/* 2-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '20px',
      }}>
        <AICopilotCard />
        <TipsCard />
        <SuggestFeatureCard />
        <ContactUsCard />
        <VideoTutorialsCard />
        <WhatsNewCard />
      </div>

      {/* Legal */}
      <div style={{
        marginTop: '40px',
        paddingTop: '24px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
      }}>
        <h2 style={{
          color: '#6B7280',
          fontSize: '10px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          margin: '0 0 12px',
        }}>
          Legal
        </h2>
        <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
          <a
            href="/tos"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0EA5E9', textDecoration: 'none', fontWeight: 500 }}
          >
            Terms of Service
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#0EA5E9', textDecoration: 'none', fontWeight: 500 }}
          >
            Privacy Policy
          </a>
        </div>
      </div>
    </main>
  )
}
