'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import BetaAgreementModal from './BetaAgreementModal'

type AgreementStatus = 'loading' | 'agreed' | 'needs_agreement' | 'no_user'

export default function BetaAgreementGate() {
  const [status, setStatus] = useState<AgreementStatus>('loading')
  const [userId, setUserId] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          if (!cancelled) setStatus('no_user')
          return
        }

        const { data: userRow } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .maybeSingle()

        const userOrgId = (userRow as { org_id: string } | null)?.org_id ?? null

        const { data: agreement } = await supabase
          .from('beta_agreements')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        setUserId(user.id)
        setOrgId(userOrgId)
        setStatus(agreement ? 'agreed' : 'needs_agreement')
      } catch (err) {
        console.error('[BetaAgreementGate] check failed:', err)
        if (!cancelled) setStatus('agreed')
      }
    }

    check()

    return () => { cancelled = true }
  }, [])

  if (status !== 'needs_agreement' || !userId || !orgId) {
    return null
  }

  return (
    <BetaAgreementModal
      userId={userId}
      orgId={orgId}
      onAgreed={() => setStatus('agreed')}
    />
  )
}
