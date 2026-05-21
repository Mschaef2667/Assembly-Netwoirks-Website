'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  Building2,
  Brain,
  Target,
  Route,
  Search,
  Layers,
  BarChart2,
  Plug,
  Settings,
  LifeBuoy,
  LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const navItems = [
  { label: 'Workspace',       href: '/dashboard',                    icon: Building2 },
  { label: 'Intelligence',    href: '/dashboard/intelligence',       icon: Brain,    id: 'nav-intelligence' },
  { label: 'Target Markets',  href: '/dashboard/target-markets',     icon: Target,   id: 'nav-markets' },
  { label: 'Journeys',        href: '/dashboard/journeys',           icon: Route,    id: 'nav-report' },
  { label: 'Lead Generation', href: '/dashboard/lead-generation',    icon: Search    },
  { label: 'Assets Studio',   href: '/dashboard/assets',             icon: Layers    },
  { label: 'Integrations',    href: '/dashboard/integrations',       icon: Plug      },
  { label: 'Performance',     href: '/dashboard/performance',        icon: BarChart2 },
  { label: 'Administration',  href: '/dashboard/administration',     icon: Settings  },
  { label: 'Support',         href: 'mailto:support@assemblyai.com', icon: LifeBuoy  },
]

function formatRole(role: string): string {
  return role.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [logoError, setLogoError] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userInitial, setUserInitial] = useState<string>('')
  const [orgName, setOrgName] = useState<string | null>(null)

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase
          .from('users')
          .select('first_name, last_name, role, org_id')
          .eq('id', user.id)
          .single()
        if (data) {
          const row = data as Record<string, unknown>
          const first = String(row['first_name'] ?? '')
          const last = String(row['last_name'] ?? '')
          const full = [first, last].filter(Boolean).join(' ')
          setUserName(full || null)
          setUserInitial(first ? first[0].toUpperCase() : (user.email?.[0]?.toUpperCase() ?? '?'))
          setUserRole(String(row['role'] ?? ''))

          const orgId = String(row['org_id'] ?? '')
          if (orgId) {
            const { data: orgData } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', orgId)
              .single()
            if (orgData) {
              const orgRow = orgData as Record<string, unknown>
              setOrgName(String(orgRow['name'] ?? ''))
            }
          }
        } else if (user.email) {
          setUserInitial(user.email[0].toUpperCase())
        }
      } catch { /* non-fatal */ }
    }
    void loadUser()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside
      style={{ backgroundColor: '#0A1628' }}
      className="fixed left-0 top-0 h-screen w-64 flex flex-col z-50"
    >
      {/* Logo */}
      <div className="px-6 py-8" style={{ borderBottom: '2px solid #0EA5E9' }}>
        <Link href="/dashboard">
          {logoError ? (
            <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '16px' }}>Assembly AI</span>
          ) : (
            <Image
              src="/images/logo.png"
              alt="Assembly AI"
              width={160}
              height={40}
              style={{ maxHeight: '40px', width: 'auto' }}
              onError={() => setLogoError(true)}
            />
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {navItems.map(({ label, href, icon: Icon, id }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              id={id}
              href={href}
              style={{
                minHeight: '44px',
                color: isActive ? '#0EA5E9' : 'rgba(255,255,255,0.55)',
                backgroundColor: isActive ? 'rgba(14,165,233,0.1)' : 'transparent',
                borderLeft: `3px solid ${isActive ? '#0EA5E9' : 'transparent'}`,
              }}
              className="flex items-center gap-3 px-3 rounded-md text-sm font-medium transition-colors hover:bg-white/5 hover:text-white"
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        {/* User avatar */}
        {userInitial && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 12px', marginBottom: '4px',
          }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              backgroundColor: '#0EA5E9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: 700 }}>{userInitial}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {userName && (
                <p style={{
                  color: '#FFFFFF', fontSize: '13px', fontWeight: 600, margin: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {userName}
                </p>
              )}
              {userRole && (
                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', margin: 0 }}>
                  {formatRole(userRole)}
                </p>
              )}
            </div>
          </div>
        )}

        <p className="px-3 text-xs" style={{ color: '#6B7280' }}>{orgName ?? 'C3 Method OS'}</p>
        <button
          onClick={handleLogout}
          style={{
            minHeight: '44px', minWidth: '44px', width: '100%',
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '0 12px',
            backgroundColor: 'transparent', border: 'none', borderRadius: '6px',
            color: 'rgba(255,255,255,0.45)', fontSize: '14px', fontWeight: 500,
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <LogOut size={16} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
