'use client'

export function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 71 ? '#16A34A' : score >= 41 ? '#D97706' : '#DC2626'
  const bg = score >= 71 ? '#DCFCE7' : score >= 41 ? '#FEF3C7' : '#FEE2E2'
  const label = score >= 71 ? 'High' : score >= 41 ? 'Medium' : 'Low'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '999px',
        backgroundColor: bg,
        color,
        fontSize: '12px',
        fontWeight: 700,
      }}
    >
      {label} confidence — {score}/100
    </span>
  )
}
