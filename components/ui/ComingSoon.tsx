interface ComingSoonProps {
  title: string
}

export default function ComingSoon({ title }: ComingSoonProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#0A1628',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '16px',
        textAlign: 'center',
        padding: '40px',
      }}
    >
      <h1 style={{ color: '#FFFFFF', fontSize: '36px', fontWeight: 700, margin: 0 }}>
        {title}
      </h1>
      <span
        style={{
          backgroundColor: '#E8520A',
          color: '#FFFFFF',
          fontSize: '12px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '4px 14px',
          borderRadius: '9999px',
        }}
      >
        Coming Soon
      </span>
      <p style={{ color: '#6B7280', fontSize: '15px', margin: 0, maxWidth: '380px' }}>
        This feature is currently in development. Check back soon.
      </p>
    </div>
  )
}
