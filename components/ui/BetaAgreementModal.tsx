'use client'

import { useState } from 'react'
import Image from 'next/image'

interface BetaAgreementModalProps {
  userId: string
  orgId: string
  onAgreed: () => void
}

const AGREEMENT_VERSION = 'beta-v1'

export default function BetaAgreementModal({ userId, orgId, onAgreed }: BetaAgreementModalProps) {
  const [checked, setChecked] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleAccept() {
    if (!checked || submitting) return
    setSubmitting(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/beta/agree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          org_id: orgId,
          agreement_version: AGREEMENT_VERSION,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error || `Failed to record agreement (${res.status})`)
      }
      onAgreed()
    } catch (err) {
      setSubmitting(false)
      setErrorMsg(err instanceof Error ? err.message : 'Failed to record agreement')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Beta Agreement"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0A1628',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 10000,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          backgroundColor: '#0F2140',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px',
          padding: '40px 36px',
          color: '#FFFFFF',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: 'calc(100vh - 40px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Image
            src="/images/logo.png"
            alt="Assembly AI"
            width={180}
            height={44}
            style={{ maxHeight: '44px', width: 'auto' }}
            priority
          />
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: '24px',
            fontWeight: 700,
            color: '#FFFFFF',
            textAlign: 'center',
            lineHeight: 1.3,
          }}
        >
          Welcome to Assembly AI Beta
        </h1>
        <p
          style={{
            margin: '8px 0 24px',
            fontSize: '14px',
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'center',
          }}
        >
          Please review and accept our Beta Agreement before continuing
        </p>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px 22px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '10px',
            marginBottom: '20px',
            minHeight: '200px',
          }}
        >
          <section style={{ marginBottom: '18px' }}>
            <h2
              style={{
                margin: '0 0 6px',
                fontSize: '15px',
                fontWeight: 700,
                color: '#E8520A',
              }}
            >
              1. Beta Program Terms
            </h2>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
              This is a beta version of Assembly AI. Features may change, and there is no SLA during the
              beta period. Your feedback helps us improve.
            </p>
          </section>

          <section style={{ marginBottom: '18px' }}>
            <h2
              style={{
                margin: '0 0 6px',
                fontSize: '15px',
                fontWeight: 700,
                color: '#E8520A',
              }}
            >
              2. Confidentiality
            </h2>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
              You agree to keep confidential any non-public information about the Assembly AI platform,
              including features, roadmap, and pricing, that you learn during the beta program.
            </p>
          </section>

          <section style={{ marginBottom: '18px' }}>
            <h2
              style={{
                margin: '0 0 6px',
                fontSize: '15px',
                fontWeight: 700,
                color: '#E8520A',
              }}
            >
              3. Data Handling
            </h2>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
              Your use of the platform is governed by our{' '}
              <a
                href="/tos"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0EA5E9', textDecoration: 'underline' }}
              >
                Terms of Service
              </a>{' '}
              and{' '}
              <a
                href="/privacy"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#0EA5E9', textDecoration: 'underline' }}
              >
                Privacy Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2
              style={{
                margin: '0 0 6px',
                fontSize: '15px',
                fontWeight: 700,
                color: '#E8520A',
              }}
            >
              4. AI Outputs
            </h2>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.9)' }}>
              AI-generated content requires human review and does not constitute professional advice.
            </p>
          </section>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '12px 14px',
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: checked ? '1px solid #E8520A' : '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            cursor: 'pointer',
            marginBottom: '16px',
            transition: 'border-color 120ms ease',
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            style={{
              marginTop: '3px',
              width: '18px',
              height: '18px',
              accentColor: '#E8520A',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '14px', lineHeight: 1.5, color: '#FFFFFF' }}>
            I have read and agree to the Beta Agreement, Terms of Service, and Privacy Policy
          </span>
        </label>

        {errorMsg && (
          <div
            style={{
              marginBottom: '14px',
              fontSize: '13px',
              color: '#FFB4A0',
              backgroundColor: 'rgba(232,82,10,0.12)',
              border: '1px solid rgba(232,82,10,0.4)',
              borderRadius: '8px',
              padding: '10px 12px',
            }}
          >
            {errorMsg}
          </div>
        )}

        <button
          type="button"
          onClick={handleAccept}
          disabled={!checked || submitting}
          style={{
            width: '100%',
            padding: '14px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: !checked || submitting ? 'rgba(232,82,10,0.4)' : '#E8520A',
            color: '#FFFFFF',
            fontSize: '15px',
            fontWeight: 600,
            cursor: !checked || submitting ? 'not-allowed' : 'pointer',
            minHeight: '52px',
            transition: 'background-color 120ms ease',
          }}
          onMouseEnter={(e) => {
            if (checked && !submitting) e.currentTarget.style.backgroundColor = '#D14808'
          }}
          onMouseLeave={(e) => {
            if (checked && !submitting) e.currentTarget.style.backgroundColor = '#E8520A'
          }}
        >
          {submitting ? 'Recording agreement…' : 'Accept and Continue'}
        </button>
      </div>
    </div>
  )
}
