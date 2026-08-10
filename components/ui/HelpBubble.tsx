'use client'

import { useEffect, useRef, useState } from 'react'
import { HelpCircle, X, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
}

// Floating "ask me anything" help bubble. Sits to the left of the beta
// feedback bubble and is available on every dashboard screen. Reuses the same
// AI backend as the Support page's assistant (/api/copilot/draft).
export default function HelpBubble() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user || cancelled) return
        const { data: userRow } = await supabase.from('users').select('org_id').eq('id', user.id).single()
        if (!userRow || cancelled) return
        setWorkspaceId((userRow as Record<string, unknown>)['org_id'] as string)
      } catch { /* non-fatal */ }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const el = threadRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading, open])

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
    <>
      <style>{`@keyframes help-typing-bounce { 0%, 80%, 100% { transform: scale(0.5); opacity: 0.4 } 40% { transform: scale(1); opacity: 1 } }`}</style>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '24px',
            width: '360px',
            maxWidth: 'calc(100vw - 32px)',
            height: '480px',
            maxHeight: 'calc(100vh - 140px)',
            backgroundColor: '#0F2140',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '14px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <HelpCircle size={18} color="#0EA5E9" strokeWidth={1.8} />
              <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600 }}>Ask Assembly AI</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close help"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex' }}
            >
              <X size={18} />
            </button>
          </div>

          <div
            ref={threadRef}
            style={{
              flex: 1, overflowY: 'auto', padding: '12px',
              display: 'flex', flexDirection: 'column', gap: '8px',
            }}
          >
            {messages.length === 0 && !loading && (
              <p style={{ color: '#6B7280', fontSize: '12px', margin: 0, textAlign: 'center', paddingTop: '32px', lineHeight: 1.6 }}>
                Ask me anything, on any screen. Define a term, get instructions, or a tip.
                <br /><br />
                Try: &quot;What is the DCP?&quot; or &quot;How do I write a strong CVP?&quot;
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
                alignSelf: 'flex-start', backgroundColor: '#0A1628', border: '1px solid rgba(255,255,255,0.1)',
                padding: '10px 14px', borderRadius: '12px', display: 'flex', gap: '4px', alignItems: 'center',
              }}>
                {[0, 0.16, 0.32].map((delay, i) => (
                  <span key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6B7280',
                    display: 'inline-block', animation: 'help-typing-bounce 1.4s infinite ease-in-out both',
                    animationDelay: `${delay}s`,
                  }} />
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', padding: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
              disabled={loading || !workspaceId}
              placeholder={workspaceId ? 'Ask a question…' : 'Loading…'}
              style={{
                flex: 1, backgroundColor: '#FFFFFF', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px', padding: '10px 14px', color: '#0D0D0D', fontSize: '13px',
                outline: 'none', minHeight: '44px',
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label="Send"
              style={{
                width: '44px', height: '44px', borderRadius: '8px', flexShrink: 0, backgroundColor: '#E8520A',
                border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: canSend ? 'pointer' : 'default', opacity: canSend ? 1 : 0.4,
              }}
            >
              <Send size={16} color="#FFFFFF" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      )}

      {/* Floating button — sits to the left of the beta feedback bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Help"
        title="Help — ask a question"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '96px',
          width: '56px',
          height: '56px',
          borderRadius: '999px',
          backgroundColor: '#0EA5E9',
          border: 'none',
          boxShadow: '0 6px 20px rgba(14,165,233,0.45)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
        }}
      >
        {open ? <X size={24} color="#FFFFFF" /> : <HelpCircle size={26} color="#FFFFFF" strokeWidth={2} />}
      </button>
    </>
  )
}
