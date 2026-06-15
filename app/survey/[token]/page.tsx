import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import SurveyForm from './SurveyForm'

interface SurveyQuestion {
  id: string
  stageId: number
  stageName: string
  text: string
  type: 'open' | 'scale' | 'multiple_choice'
}

interface SurveyLinkRow {
  token: string
  org_id: string
  segment_name: string
  audience: string
  questions: SurveyQuestion[] | null
  is_active: boolean
}

interface OrgBrandRow {
  name: string | null
  logo_url: string | null
}

export const dynamic = 'force-dynamic'

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const serviceRole = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await serviceRole
    .from('survey_links')
    .select('token, org_id, segment_name, audience, questions, is_active')
    .eq('token', token)
    .single()

  if (error || !data) return notFound()

  const link = data as SurveyLinkRow

  const { data: orgData } = await serviceRole
    .from('organizations')
    .select('name, logo_url')
    .eq('id', link.org_id)
    .single()

  const org = (orgData ?? null) as OrgBrandRow | null
  const orgBrand = {
    name: org?.name ?? null,
    logoUrl: org?.logo_url ?? null,
  }

  if (!link.is_active) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: '#0A1628',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px',
      }}>
        <div style={{
          backgroundColor: '#0F2140', borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.1)', padding: '48px 40px',
          maxWidth: '480px', width: '100%', textAlign: 'center',
        }}>
          <h2 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: '0 0 12px' }}>
            Survey Closed
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '15px', lineHeight: '1.6', margin: 0 }}>
            This survey link is no longer active. Please contact the sender for more information.
          </p>
        </div>
      </div>
    )
  }

  const questions: SurveyQuestion[] = Array.isArray(link.questions) ? link.questions : []

  return (
    <SurveyForm
      link={{
        token: link.token,
        segmentName: link.segment_name,
        audience: link.audience,
        questions,
      }}
      orgBrand={orgBrand}
    />
  )
}
