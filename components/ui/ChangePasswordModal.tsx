'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

interface ChangePasswordModalProps {
  onClose: () => void
}

export default function ChangePasswordModal({ onClose }: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return

    setErrorMsg(null)
    setSuccessMsg(null)

    if (newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) {
        setErrorMsg(error.message)
        setSubmitting(false)
        return
      }
      setSuccessMsg('Password updated successfully')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => {
        onClose()
      }, 2000)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update password')
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Change Password"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(10,22,40,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#0F2140',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px',
          padding: '32px 28px',
          color: '#FFFFFF',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
          position: 'relative',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.55)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '6px',
          }}
        >
          <X size={20} strokeWidth={1.8} />
        </button>

        <h1
          style={{
            margin: '0 0 20px',
            fontSize: '20px',
            fontWeight: 700,
            color: '#FFFFFF',
          }}
        >
          Change Password
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label
              htmlFor="new-password"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                marginBottom: '6px',
              }}
            >
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: '#FFFFFF',
                color: '#0D0D0D',
                fontSize: '14px',
                minHeight: '44px',
              }}
            />
          </div>

          <div style={{ marginBottom: '18px' }}>
            <label
              htmlFor="confirm-password"
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                marginBottom: '6px',
              }}
            >
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: '#FFFFFF',
                color: '#0D0D0D',
                fontSize: '14px',
                minHeight: '44px',
              }}
            />
          </div>

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

          {successMsg && (
            <div
              style={{
                marginBottom: '14px',
                fontSize: '13px',
                color: '#86EFAC',
                backgroundColor: 'rgba(22,163,74,0.15)',
                border: '1px solid rgba(22,163,74,0.4)',
                borderRadius: '8px',
                padding: '10px 12px',
              }}
            >
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !!successMsg}
            style={{
              width: '100%',
              padding: '12px 20px',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: submitting || successMsg ? 'rgba(232,82,10,0.4)' : '#E8520A',
              color: '#FFFFFF',
              fontSize: '15px',
              fontWeight: 600,
              cursor: submitting || successMsg ? 'not-allowed' : 'pointer',
              minHeight: '48px',
              transition: 'background-color 120ms ease',
            }}
            onMouseEnter={(e) => {
              if (!submitting && !successMsg) e.currentTarget.style.backgroundColor = '#D14808'
            }}
            onMouseLeave={(e) => {
              if (!submitting && !successMsg) e.currentTarget.style.backgroundColor = '#E8520A'
            }}
          >
            {submitting ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
