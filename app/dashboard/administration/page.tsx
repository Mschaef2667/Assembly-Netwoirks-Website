'use client'

import type { CSSProperties } from 'react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import type { AssemblyUser } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminRole = 'org_admin' | 'contributor' | 'approver'
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface WorkspaceUser {
  id: string
  name: string
  email: string
  role: AdminRole
  section_assignments: string[]
}

interface WorkspaceSettings {
  name: string
  website: string
  preferred_model: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES: AdminRole[] = ['org_admin', 'contributor', 'approver']

const MODEL_OPTIONS = [
  { label: 'Claude Sonnet 4 (Recommended)', value: 'claude-sonnet-4-5' },
  { label: 'Claude Opus 4 (Highest Quality)', value: 'claude-opus-4-5' },
] as const

const SECTIONS = [
  'Workspace',
  'ICP & Offers',
  'Playbooks',
  'Journeys',
  'Assets Studio',
  'Activation',
  'Performance',
  'Integrations',
]

// ── Styles ────────────────────────────────────────────────────────────────────

const INPUT: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '8px',
  padding: '10px 12px',
  fontSize: '14px',
  color: '#FFFFFF',
  backgroundColor: '#1A3050',
  width: '100%',
  minHeight: '44px',
  boxSizing: 'border-box',
  outline: 'none',
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

// ── Save indicator ────────────────────────────────────────────────────────────

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

// ── Orange button ─────────────────────────────────────────────────────────────

function OrangeButton({ onClick, loading, children }: {
  onClick: () => void
  loading: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        minHeight: '44px',
        padding: '0 24px',
        backgroundColor: loading ? 'rgba(255,255,255,0.1)' : '#E8520A',
        color: loading ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
        border: 'none',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: loading ? 'not-allowed' : 'pointer',
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdministrationPage() {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [settings, setSettings] = useState<WorkspaceSettings>({
    name: '', website: '', preferred_model: 'claude-sonnet-4-5',
  })
  const [userSave, setUserSave] = useState<SaveState>('idle')
  const [settingsSave, setSettingsSave] = useState<SaveState>('idle')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        const rawRow = userRow as Record<string, unknown>
        setCurrentUserRole(String(rawRow['role'] ?? ''))

        const me = userRow as AssemblyUser | null
        if (!me) return

        setWorkspaceId(me.org_id)

        const { data: rawUsers } = await supabase
          .from('users')
          .select('*')
          .eq('org_id', me.org_id)

        if (rawUsers) {
          setUsers((rawUsers as Array<Record<string, unknown>>).map(u => ({
            id: String(u['id'] ?? ''),
            name: String(u['name'] ?? u['full_name'] ?? ''),
            email: String(u['email'] ?? ''),
            role: (u['role'] as AdminRole | undefined) ?? 'contributor',
            section_assignments: Array.isArray(u['section_assignments'])
              ? (u['section_assignments'] as string[])
              : [],
          })))
        }

        const { data: ws, error: wsError } = await supabase
          .from('organizations')
          .select('name, website, preferred_model')
          .eq('id', me.org_id)
          .single()
        if (wsError) console.error('[admin] init organizations fetch =>', JSON.stringify(wsError, null, 2))

        if (ws) {
          const wsRow = ws as Record<string, unknown>
          setSettings({
            name: String(wsRow['name'] ?? ''),
            website: String(wsRow['website'] ?? ''),
            preferred_model: String(wsRow['preferred_model'] ?? 'claude-sonnet-4-5'),
          })
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void init()
  }, [])

  function patchUser(id: string, patch: Partial<WorkspaceUser>) {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...patch } : u))
  }

  function toggleSection(userId: string, section: string) {
    setUsers(prev => prev.map(u => {
      if (u.id !== userId) return u
      const has = u.section_assignments.includes(section)
      return {
        ...u,
        section_assignments: has
          ? u.section_assignments.filter(s => s !== section)
          : [...u.section_assignments, section],
      }
    }))
  }

  async function saveUsers() {
    if (!workspaceId) return
    setUserSave('saving')
    try {
      for (const u of users) {
        const { error } = await supabase
          .from('users')
          .update({ role: u.role, section_assignments: u.section_assignments })
          .eq('id', u.id)
        if (error) throw error
      }
      setUserSave('saved')
      setTimeout(() => setUserSave('idle'), 3000)
    } catch {
      setUserSave('error')
    }
  }

  async function saveSettings() {
    if (!workspaceId) return
    setSettingsSave('saving')
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ name: settings.name, website: settings.website, preferred_model: settings.preferred_model })
        .eq('id', workspaceId)
      if (error) {
        console.error('[admin] saveSettings error =>', JSON.stringify(error, null, 2))
        throw error
      }
      setSettingsSave('saved')
      setTimeout(() => setSettingsSave('idle'), 3000)
    } catch (err) {
      console.error('[admin] saveSettings caught =>', err)
      setSettingsSave('error')
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Administration</h1>
        </header>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>Administration</h1>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: '6px 0 0' }}>
          Manage users, roles, and workspace settings.
        </p>
      </header>

      <div style={{ padding: '32px', maxWidth: '960px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* ── User Administration ──────────────────────────────────────────── */}
        <section>
          <h2 style={SECTION_HEADING}>User Administration</h2>
          {users.length === 0 ? (
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>No users found in this workspace.</p>
          ) : (
            <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#0F2140' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    {['Name', 'Email', 'Role', 'Section Assignments'].map(col => (
                      <th
                        key={col}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'rgba(255,255,255,0.4)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          backgroundColor: '#0F2140',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr
                      key={u.id}
                      style={{ borderBottom: i < users.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#FFFFFF', fontWeight: 500 }}>
                        {u.name || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: 'rgba(255,255,255,0.55)' }}>
                        {u.email}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <select
                          value={u.role}
                          onChange={e => patchUser(u.id, { role: e.target.value as AdminRole })}
                          style={{ ...INPUT, width: 'auto', minWidth: '140px' }}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                          {SECTIONS.map(section => (
                            <label
                              key={section}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                color: 'rgba(255,255,255,0.75)',
                                cursor: 'pointer',
                                minHeight: '24px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={u.section_assignments.includes(section)}
                                onChange={() => toggleSection(u.id, section)}
                                style={{ accentColor: '#0EA5E9', width: '14px', height: '14px' }}
                              />
                              {section}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
            <OrangeButton onClick={saveUsers} loading={userSave === 'saving'}>
              Save changes
            </OrangeButton>
            <SaveIndicator state={userSave} />
          </div>
        </section>

        {/* ── Company Settings ─────────────────────────────────────────────── */}
        <section>
          <h2 style={SECTION_HEADING}>Company Settings</h2>
          <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={LABEL}>Company Name</label>
              <input
                type="text"
                value={settings.name}
                onChange={e => setSettings(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Acme Corp"
                style={INPUT}
              />
            </div>
            <div>
              <label style={LABEL}>Website</label>
              <input
                type="url"
                value={settings.website}
                onChange={e => setSettings(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://acme.com"
                style={INPUT}
              />
            </div>
          </div>

          {currentUserRole === 'org_admin' && (
            <>
              <h2 style={{ ...SECTION_HEADING, marginTop: '28px' }}>AI Model Settings</h2>
              <div style={{ ...CARD, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={LABEL}>Copilot Model</label>
                  <select
                    value={settings.preferred_model}
                    onChange={e => setSettings(prev => ({ ...prev, preferred_model: e.target.value }))}
                    style={INPUT}
                  >
                    {MODEL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
                  Sonnet is faster and cost-efficient. Opus produces higher quality drafts but uses more of your monthly token budget.
                </p>
              </div>
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
            <OrangeButton onClick={saveSettings} loading={settingsSave === 'saving'}>
              Save changes
            </OrangeButton>
            <SaveIndicator state={settingsSave} />
          </div>
        </section>

        {/* ── Company Profile ──────────────────────────────────────────────── */}
        <section>
          <h2 style={SECTION_HEADING}>Company Profile</h2>
          <div style={CARD}>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.55)', marginBottom: '16px', marginTop: 0 }}>
              Review and edit your C3 Method company profile inputs (Steps 1–3.5).
            </p>
            <Link
              href="/dashboard/company-profile"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '44px',
                padding: '0 24px',
                backgroundColor: '#E8520A',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Review / Edit Company Profile
            </Link>
          </div>
        </section>

      </div>
    </div>
  )
}
