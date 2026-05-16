'use client'

export interface ConfidenceBarProps {
  score: number | null
  dark?: boolean
}

export default function ConfidenceBar({ score, dark = false }: ConfidenceBarProps) {
  const barColor =
    score === null ? '#6B7280'
    : score >= 70 ? '#22C55E'
    : score >= 40 ? '#F59E0B'
    : '#EF4444'

  const trackColor = dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'
  const labelColor = dark ? 'rgba(255,255,255,0.45)' : '#6B7280'

  const scoreText =
    score === null ? '—'
    : score >= 70 ? `${score} · High`
    : score >= 40 ? `${score} · Medium`
    : `${score} · Low`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
      <span style={{
        fontSize: '11px',
        fontWeight: 700,
        color: labelColor,
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        Confidence
      </span>

      <div style={{
        flex: 1,
        height: '4px',
        backgroundColor: trackColor,
        borderRadius: '999px',
        overflow: 'hidden',
        minWidth: '60px',
      }}>
        <div style={{
          height: '100%',
          width: score !== null ? `${score}%` : '0%',
          backgroundColor: barColor,
          borderRadius: '999px',
          transition: 'width 0.4s ease',
        }} />
      </div>

      <span style={{
        fontSize: '12px',
        fontWeight: 700,
        color: barColor,
        whiteSpace: 'nowrap',
        minWidth: '80px',
        textAlign: 'right',
        flexShrink: 0,
      }}>
        {scoreText}
      </span>
    </div>
  )
}
