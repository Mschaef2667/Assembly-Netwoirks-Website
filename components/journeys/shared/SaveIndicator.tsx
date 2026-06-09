'use client'

import { Loader2 } from 'lucide-react'
import type { SaveState, SaveStatus } from '@/lib/journeys/stepHelpers'

export function SaveIndicator({ state }: { state: SaveState | SaveStatus }) {
  if (state === 'idle') return null
  if (state === 'editing') return (
    <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>Editing...</span>
  )
  if (state === 'saving') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
      <Loader2 size={12} className="animate-spin" /> Saving…
    </span>
  )
  if (state === 'saved') return (
    <span style={{ fontSize: '12px', color: '#34D399' }}>✓ Saved</span>
  )
  return <span style={{ fontSize: '12px', color: '#F87171' }}>Save failed</span>
}
