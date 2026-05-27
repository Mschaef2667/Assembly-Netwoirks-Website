import { Lightbulb } from 'lucide-react'

export interface Tip {
  headline: string
  body: string
}

interface TipsPanelProps {
  tips: Tip[]
}

export default function TipsPanel({ tips }: TipsPanelProps) {
  if (!tips || tips.length === 0) return null

  return (
    <div
      style={{
        backgroundColor: '#0F2140',
        border: '1px solid rgba(255,255,255,0.1)',
        borderLeft: '3px solid #E8520A',
        borderRadius: '10px',
        padding: '20px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <Lightbulb size={15} style={{ color: '#E8520A', flexShrink: 0 }} />
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}
        >
          Tips &amp; Best Practices
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: '14px' }} />

      {/* Tips list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
        {tips.map((tip, i) => (
          <div key={i}>
            <div style={{ paddingBottom: i < tips.length - 1 ? '12px' : '0' }}>
              <p
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  margin: '0 0 4px',
                  lineHeight: '1.4',
                }}
              >
                {tip.headline}
              </p>
              <p
                style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.55)',
                  margin: 0,
                  lineHeight: '1.6',
                }}
              >
                {tip.body}
              </p>
            </div>
            {i < tips.length - 1 && (
              <div
                style={{
                  height: '1px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  margin: '12px 0',
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
