'use client'

import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { formatRole } from '@/components/layout/sidebar'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface OrgSummary {
  id: string
  name: string
  logo_url: string | null
}

interface ProfileState {
  id: string
  email: string
  role: string
  createdAt: string | null
  firstName: string
  lastName: string
  org: OrgSummary | null
  isOrgAdmin: boolean
}

const INPUT: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#0D0D0D',
  backgroundColor: '#FFFFFF',
  width: '100%',
  minHeight: '44px',
  boxSizing: 'border-box',
  outline: 'none',
}

const READONLY_INPUT: CSSProperties = {
  ...INPUT,
  backgroundColor: '#1A3050',
  color: 'rgba(255,255,255,0.75)',
  border: '1px solid rgba(255,255,255,0.1)',
  cursor: 'not-allowed',
}

const LABEL: CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.6)',
  marginBottom: '6px',
}

const SECTION_HEADING: CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#FFFFFF',
  marginBottom: '16px',
  paddingBottom: '10px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
}

const CARD: CSSProperties = {
  backgroundColor: '#0F2140',
  border: '1px solid rgba(255,255,255,0.1)',
  borderLeft: '3px solid #0EA5E9',
  borderRadius: '10px',
  padding: '24px',
}

const HINT: CSSProperties = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.45)',
  margin: '6px 0 0',
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'saving') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>
      <Loader2 size={12} className="animate-spin" /> Saving…
    </span>
  )
  if (state === 'saved') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#4ADE80' }}>
      <span style={{ width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', backgroundColor: '#4ADE80' }} />
      Saved
    </span>
  )
  return <span style={{ fontSize: '12px', color: '#FCA5A5' }}>Save failed</span>
}

function OrangeButton({ onClick, loading, disabled, children }: {
  onClick: () => void
  loading: boolean
  disabled?: boolean
  children: React.ReactNode
}) {
  const inactive = loading || disabled
  return (
    <button
      onClick={onClick}
      disabled={inactive}
      style={{
        minHeight: '44px',
        padding: '0 24px',
        backgroundColor: inactive ? 'rgba(255,255,255,0.1)' : '#E8520A',
        color: inactive ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: inactive ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

function formatMemberSince(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return '—'
  }
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profile, setProfile] = useState<ProfileState | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoadError('Not signed in.')
          return
        }

        const { data: row, error: rowError } = await supabase
          .from('users')
          .select('id, first_name, last_name, email, role, org_id, created_at')
          .eq('id', user.id)
          .single()

        if (rowError || !row) {
          setLoadError('Unable to load your profile.')
          return
        }

        const r = row as Record<string, unknown>
        const orgId = String(r['org_id'] ?? '')
        const role = String(r['role'] ?? '')

        let org: OrgSummary | null = null
        if (orgId) {
          const { data: orgRow } = await supabase
            .from('organizations')
            .select('id, name, logo_url')
            .eq('id', orgId)
            .single()
          if (orgRow) {
            const o = orgRow as Record<string, unknown>
            org = {
              id: String(o['id'] ?? ''),
              name: String(o['name'] ?? ''),
              logo_url: typeof o['logo_url'] === 'string' && o['logo_url'] ? String(o['logo_url']) : null,
            }
          }
        }

        const first = String(r['first_name'] ?? '')
        const last = String(r['last_name'] ?? '')

        setProfile({
          id: String(r['id'] ?? ''),
          email: String(r['email'] ?? user.email ?? ''),
          role,
          createdAt: (r['created_at'] as string | null) ?? null,
          firstName: first,
          lastName: last,
          org,
          isOrgAdmin: role === 'org_admin' || role === 'super_admin',
        })
        setFirstName(first)
        setLastName(last)
      } catch {
        setLoadError('Unable to load your profile.')
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [])

  const dirty = profile !== null && (
    firstName.trim() !== (profile.firstName ?? '').trim() ||
    lastName.trim() !== (profile.lastName ?? '').trim()
  )

  async function handleSave() {
    if (!profile || saveState === 'saving' || !dirty) return
    setSaveState('saving')
    setSaveErrorMsg(null)
    try {
      const trimmedFirst = firstName.trim()
      const trimmedLast = lastName.trim()

      const { error } = await supabase
        .from('users')
        .update({
          first_name: trimmedFirst || null,
          last_name: trimmedLast || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      if (error) {
        console.error('[profile] save error =>', error)
        setSaveErrorMsg(error.message)
        setSaveState('error')
        return
      }

      setProfile({ ...profile, firstName: trimmedFirst, lastName: trimmedLast })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 3000)
    } catch (err) {
      console.error('[profile] save caught =>', err)
      setSaveErrorMsg(err instanceof Error ? err.message : 'Save failed')
      setSaveState('error')
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Profile</h1>
        </header>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
        </div>
      </div>
    )
  }

  if (loadError || !profile) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>
        <header style={{ backgroundColor: '#0A1628', padding: '24px 32px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Profile</h1>
        </header>
        <div style={{ padding: '32px', maxWidth: '720px' }}>
          <div style={{ ...CARD, borderLeft: '3px solid #FCA5A5' }}>
            <p style={{ color: '#FCA5A5', fontSize: '14px', margin: 0 }}>
              {loadError ?? 'Unable to load your profile.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const memberSince = formatMemberSince(profile.createdAt)

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Profile</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '6px 0 0' }}>
          Update your personal details. Your role and organization are managed by your admin.
        </p>
      </header>

      <div style={{ padding: '32px', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Personal details — editable */}
        <section>
          <h2 style={SECTION_HEADING}>Personal Details</h2>
          <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label htmlFor="first-name" style={LABEL}>First name</label>
                <input
                  id="first-name"
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  placeholder="First name"
                  style={INPUT}
                />
              </div>
              <div>
                <label htmlFor="last-name" style={LABEL}>Last name</label>
                <input
                  id="last-name"
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                  placeholder="Last name"
                  style={INPUT}
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" style={LABEL}>Email</label>
              <input
                id="email"
                type="email"
                value={profile.email}
                readOnly
                disabled
                style={READONLY_INPUT}
              />
              <p style={HINT}>Contact support to change your email.</p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <OrangeButton
                onClick={handleSave}
                loading={saveState === 'saving'}
                disabled={!dirty}
              >
                Save changes
              </OrangeButton>
              <SaveIndicator state={saveState} />
            </div>
            {saveState === 'error' && saveErrorMsg && (
              <p style={{ fontSize: '13px', color: '#FCA5A5', margin: 0 }}>{saveErrorMsg}</p>
            )}
          </div>
        </section>

        {/* Account — read-only */}
        <section>
          <h2 style={SECTION_HEADING}>Account</h2>
          <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={LABEL}>Role</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    backgroundColor: 'rgba(14,165,233,0.12)',
                    color: '#0EA5E9',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: '1px solid rgba(14,165,233,0.35)',
                  }}
                >
                  {profile.role ? formatRole(profile.role) : '—'}
                </span>
              </div>
              <p style={HINT}>Contact your admin to change your role.</p>
            </div>

            <div>
              <label style={LABEL}>Organization</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {profile.org?.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.org.logo_url}
                    alt={profile.org.name || 'Organization logo'}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      objectFit: 'contain',
                      backgroundColor: '#FFFFFF',
                      padding: '4px',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(14,165,233,0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0EA5E9',
                      fontWeight: 700,
                      fontSize: '15px',
                    }}
                  >
                    {(profile.org?.name?.[0] ?? '?').toUpperCase()}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600 }}>
                    {profile.org?.name || '—'}
                  </span>
                  {profile.isOrgAdmin && (
                    <Link
                      href="/dashboard/administration"
                      style={{
                        color: '#0EA5E9',
                        fontSize: '12px',
                        fontWeight: 600,
                        textDecoration: 'none',
                        marginTop: '2px',
                      }}
                    >
                      Manage in Administration →
                    </Link>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label style={LABEL}>Member since</label>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px' }}>{memberSince}</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
