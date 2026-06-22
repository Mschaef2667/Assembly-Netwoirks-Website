// Temporary preview route for DecisionJourneyVisual.
// Will be removed once the component is wired into its real home (onboarding/dashboard).
import DecisionJourneyVisual from '@/components/c3/DecisionJourneyVisual'

export default function PreviewDecisionJourneyPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0A1628', padding: '48px 32px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <p style={{
          fontSize: '12px',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.45)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          margin: '0 0 20px',
        }}>
          Preview — DecisionJourneyVisual
        </p>
        <DecisionJourneyVisual />
        <p style={{
          fontSize: '12px',
          color: 'rgba(255,255,255,0.35)',
          margin: '32px 0 0',
          lineHeight: 1.55,
        }}>
          This page is a temporary preview surface and will be removed once the component is wired into onboarding/dashboard.
        </p>
      </div>
    </div>
  )
}
