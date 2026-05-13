'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  Target,
  BookOpen,
  Route,
  Layers,
  Zap,
  BarChart2,
  Plug
} from 'lucide-react'

const navItems = [
  { label: 'Workspace',     href: '/dashboard',            icon: Building2  },
  { label: 'ICP & Offers',  href: '/dashboard/icp-offers', icon: Target     },
  { label: 'Playbooks',     href: '/dashboard/playbooks',  icon: BookOpen   },
  { label: 'Journeys',      href: '/dashboard/journeys',   icon: Route      },
  { label: 'Assets Studio', href: '/dashboard/assets',     icon: Layers     },
  { label: 'Activation',    href: '/dashboard/activation', icon: Zap        },
  { label: 'Performance',   href: '/dashboard/performance',icon: BarChart2  },
  { label: 'Integrations',  href: '/dashboard/integrations',icon: Plug      },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      style={{ backgroundColor: '#0A1628' }}
      className="fixed left-0 top-0 h-screen w-64 flex flex-col z-50"
    >
      {/* Logo */}
      <div className="px-6 py-8 border-b border-white/10">
        <span className="text-white font-serif text-xl font-semibold tracking-tight">
          Assembly AI
        </span>
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
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-xs" style={{ color: '#6B7280' }}>
          C3 Method OS
        </p>
      </div>
    </aside>
  )
}