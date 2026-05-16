'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Building2,
  Brain,
  Route,
  Zap,
  Layers,
  BarChart2,
  Plug,
  Settings,
  LifeBuoy,
  LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'

const navItems = [
  { label: 'Workspace',      href: '/dashboard',                   icon: Building2 },
  { label: 'Intelligence',   href: '/dashboard/intelligence',      icon: Brain     },
  { label: 'Journeys',       href: '/dashboard/journeys',          icon: Route     },
  { label: 'Activation',     href: '/dashboard/activation',        icon: Zap       },
  { label: 'Assets Studio',  href: '/dashboard/assets',            icon: Layers    },
  { label: 'Performance',    href: '/dashboard/performance',       icon: BarChart2 },
  { label: 'Integrations',   href: '/dashboard/integrations',      icon: Plug      },
  { label: 'Administration', href: '/dashboard/administration',    icon: Settings  },
  { label: 'Support',        href: 'mailto:support@assemblyai.com', icon: LifeBuoy },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [logoError, setLogoError] = useState(false)

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
      <div className="px-6 py-8 border-b border-white/10">
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
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              style={{
                minHeight: '44px',
                color: isActive ? '#E8520A' : '#6B7280',
                backgroundColor: isActive ? 'rgba(232,82,10,0.1)' : 'transparent',
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
        <p className="px-3 text-xs mb-2" style={{ color: '#6B7280' }}>C3 Method OS</p>
        <button
          onClick={handleLogout}
          style={{
            minHeight: '44px',
            minWidth: '44px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '0 12px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '6px',
            color: '#6B7280',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <LogOut size={16} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </aside>
  )
}