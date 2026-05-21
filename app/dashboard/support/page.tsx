'use client'

import { useState } from 'react'
import {
  MessageCircle,
  BookOpen,
  Lightbulb,
  Mail,
  PlayCircle,
  Sparkles,
  Send,
} from 'lucide-react'

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
function AICopilotCard() {
  return (
    <div style={cardStyle}>
      <CardHeader icon={MessageCircle} title="AI Copilot Assistant" badge={<ComingSoonBadge />} />
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
        Ask anything about Assembly AI and the C3 Method. Get instant answers powered by AI.
      </p>
      <div style={{ display: 'flex', gap: '8px', opacity: 0.35, pointerEvents: 'none' }}>
        <input
          disabled
          placeholder="Ask a question…"
          style={{
            flex: 1,
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#6B7280',
            fontSize: '13px',
            outline: 'none',
          }}
        />
        <button
          disabled
          style={{
            width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0,
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'default',
          }}
        >
          <Send size={16} color="#6B7280" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}

// ── 2. Tips and Tricks Library ───────────────────────────────────────────────
function TipsCard() {
  const placeholders = [
    'Complete your Company Profile first to unlock…',
    'Use stage labels on your survey to automatically…',
    'Approve Gate 1 to unlock the full Journeys…',
  ]
  return (
    <div style={cardStyle}>
      <CardHeader icon={BookOpen} title="Tips and Tricks Library" badge={<ComingSoonBadge />} />
      <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', lineHeight: 1.6, marginBottom: '20px' }}>
        Community-sourced tips to help you get the most out of Assembly AI.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', opacity: 0.35, pointerEvents: 'none' }}>
        {placeholders.map((text, i) => (
          <div key={i} style={{
            backgroundColor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            padding: '12px 14px',
          }}>
            <div style={{ height: '10px', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: '4px', marginBottom: '6px', width: '60%' }} />
            <p style={{ color: '#6B7280', fontSize: '12px', margin: 0 }}>{text}</p>
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
    </main>
  )
}
