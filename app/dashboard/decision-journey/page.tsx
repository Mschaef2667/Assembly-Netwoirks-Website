import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import DecisionJourneyVisual from '@/components/c3/DecisionJourneyVisual'

export default function DecisionJourneyPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1628' }}>
      <header style={{
        backgroundColor: '#0A1628',
        padding: '24px 32px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <Link
          href="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '13px',
            color: 'rgba(255,255,255,0.55)',
            textDecoration: 'none',
            marginBottom: '10px',
          }}
        >
          <ChevronLeft size={14} />
          Back to Dashboard
        </Link>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>
          The 7 Stages of Buyer Decision Making
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
          The framework behind the C3 Method — how buyers actually move from problem to purchase.
        </p>
      </header>

      <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
        <DecisionJourneyVisual />
      </div>
    </div>
  )
}
