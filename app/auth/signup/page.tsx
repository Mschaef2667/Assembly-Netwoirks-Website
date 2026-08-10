'use client'

export default function SignupClosedPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A1628', padding: '24px' }}>
      <div style={{
        width: '100%', maxWidth: '420px', backgroundColor: '#0F2140', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '14px', padding: '32px', boxSizing: 'border-box', textAlign: 'center',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 8px' }}>Invitation required</h1>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: '0 0 20px' }}>
          Accounts are created through an invitation link from your organization. If you have a link, open it to get started.
        </p>
        <a href="/auth/login" style={{ color: '#0EA5E9', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>
          Already have an account? Sign in
        </a>
      </div>
    </div>
  )
}
