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
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLES: AdminRole[] = ['org_admin', 'contributor', 'approver']

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
  border: '1px solid #9CA3AF',
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

const LABEL: CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#0D0D0D',
  marginBottom: '6px',
}

const SECTION_HEADING: CSSProperties = {
  fontSize: '16px',
  fontWeight: 700,
  color: '#0A1628',
  marginBottom: '16px',
  paddingBottom: '10px',
  borderBottom: '1px solid #E5E7EB',
}

// ── Save indicator ────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'saving') return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
      <Loader2 size={12} className="animate-spin" /> Saving…
    </span>
  )
  if (state === 'saved') return (
    <span className="flex items-center gap-1.5 text-xs" style={{ color: '#16A34A' }}>
      <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#16A34A' }} />
      Saved
    </span>
  )
  return <span className="text-xs" style={{ color: '#EF4444' }}>Save failed</span>
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
        backgroundColor: loading ? '#E5E7EB' : '#E8520A',
        color: loading ? '#9CA3AF' : '#FFFFFF',
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
  const [users, setUsers] = useState<WorkspaceUser[]>([])
  const [settings, setSettings] = useState<WorkspaceSettings>({ name: '', website: '' })
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
          .select('name, website')
          .eq('id', me.org_id)
          .single()
        if (wsError) console.error('[admin] init organizations fetch =>', JSON.stringify(wsError, null, 2))

        if (ws) {
          const wsRow = ws as Record<string, unknown>
          setSettings({
            name: String(wsRow['name'] ?? ''),
            website: String(wsRow['website'] ?? ''),
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
        .update({ name: settings.name, website: settings.website })
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
      <div style={{ backgroundColor: '#F8F6F1' }} className="min-h-screen">
        <header style={{ backgroundColor: '#0A1628' }} className="px-8 py-6">
          <h1 className="text-white text-2xl font-semibold">Administration</h1>
        </header>
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin" style={{ color: '#6B7280' }} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#F8F6F1' }} className="min-h-screen">
      <header style={{ backgroundColor: '#0A1628' }} className="px-8 py-6">
        <h1 className="text-white text-2xl font-semibold">Administration</h1>
        <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
          Manage users, roles, and workspace settings.
        </p>
      </header>

      <div className="px-8 py-8 space-y-10" style={{ maxWidth: '960px' }}>

        {/* ── User Administration ──────────────────────────────────────────── */}
        <section>
          <h2 style={SECTION_HEADING}>User Administration</h2>
          {users.length === 0 ? (
            <p className="text-sm" style={{ color: '#6B7280' }}>No users found in this workspace.</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#FFFFFF' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                    {['Name', 'Email', 'Role', 'Section Assignments'].map(col => (
                      <th
                        key={col}
                        style={{
                          padding: '12px 16px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#6B7280',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
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
                      style={{ borderBottom: i < users.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                    >
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#0D0D0D', fontWeight: 500 }}>
                        {u.name || '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '14px', color: '#6B7280' }}>
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
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {SECTIONS.map(section => (
                            <label
                              key={section}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                color: '#0D0D0D',
                                cursor: 'pointer',
                                minHeight: '24px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={u.section_assignments.includes(section)}
                                onChange={() => toggleSection(u.id, section)}
                                style={{ accentColor: '#E8520A', width: '14px', height: '14px' }}
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
          <div className="flex items-center gap-4 mt-4">
            <OrangeButton onClick={saveUsers} loading={userSave === 'saving'}>
              Save changes
            </OrangeButton>
            <SaveIndicator state={userSave} />
          </div>
        </section>

        {/* ── Company Settings ─────────────────────────────────────────────── */}
        <section>
          <h2 style={SECTION_HEADING}>Company Settings</h2>
          <div
            className="rounded-xl p-6 space-y-4"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
          >
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
          <div className="flex items-center gap-4 mt-4">
            <OrangeButton onClick={saveSettings} loading={settingsSave === 'saving'}>
              Save changes
            </OrangeButton>
            <SaveIndicator state={settingsSave} />
          </div>
        </section>

        {/* ── Company Profile ──────────────────────────────────────────────── */}
        <section>
          <h2 style={SECTION_HEADING}>Company Profile</h2>
          <div
            className="rounded-xl p-6"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}
          >
            <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
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
