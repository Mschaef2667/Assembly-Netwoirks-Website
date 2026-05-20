/**
 * Seed script — Apex Solutions demo workspace
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/seed-apex-solutions.ts <workspace_id>
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local to bypass RLS.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'

// ─── Supabase client (service role — bypasses RLS) ───────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL in .env.local')
  process.exit(1)
}
if (!serviceKey) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY in .env.local\n' +
    'Find it in your Supabase project: Settings > API > service_role key'
  )
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

// ─── Args ────────────────────────────────────────────────────────────────────

const workspaceId = process.argv[2]
if (!workspaceId || !/^[0-9a-f-]{36}$/.test(workspaceId)) {
  console.error('Usage: npx ts-node --project tsconfig.scripts.json scripts/seed-apex-solutions.ts <workspace_id>')
  process.exit(1)
}

// ─── Pain point index type ───────────────────────────────────────────────────

interface ByPainPoint {
  index: number
  content: string
}

function byPainPoint(pp1: string, pp2: string, pp3: string): { by_pain_point: ByPainPoint[] } {
  return {
    by_pain_point: [
      { index: 1, content: pp1 },
      { index: 2, content: pp2 },
      { index: 3, content: pp3 },
      { index: 4, content: '' },
    ],
  }
}

// ─── Step output records ─────────────────────────────────────────────────────

interface StepRecord {
  step_id: string
  content: Record<string, unknown>
}

const now = new Date().toISOString()

const steps: StepRecord[] = [
  // ── Step 1 — Product / Service Profile ────────────────────────────────────
  {
    step_id: '1',
    content: {
      whatDoYouSell:
        'Apex Solutions is a Revenue Intelligence platform that helps B2B sales and marketing teams identify accounts showing buying intent before they ever fill out a form. Using AI and behavioral signal tracking, Apex reveals which companies are actively researching solutions like yours, where they are in the buying journey, and which contacts to engage first.',
      primaryUseCase:
        'Shorter sales cycles and higher win rates by helping teams focus on accounts that are actually ready to buy instead of cold outreach to unqualified lists.',
      keyIndustries:
        'B2B SaaS, Professional Services, Financial Technology, HR Technology, Marketing Technology',
    },
  },

  // ── Step 2 — Top 3 Target Market Segments ────────────────────────────────
  {
    step_id: '2',
    content: {
      segments: [
        {
          name: 'Mid-Market B2B SaaS',
          description:
            'Software companies with 50-500 employees selling to other businesses with a dedicated sales team of 5-25 reps. They have outgrown basic CRM reporting but cannot justify enterprise ABM platform pricing.',
        },
        {
          name: 'B2B Professional Services',
          description:
            'Consulting, staffing, and managed services firms with 50-300 employees that rely heavily on relationship-based selling but struggle to scale beyond referrals.',
        },
        {
          name: 'Growth-Stage FinTech and HRTech',
          description:
            'Venture-backed or bootstrapped technology companies scaling their GTM motion from founder-led sales to a repeatable revenue process.',
        },
      ],
    },
  },

  // ── Step 3 — Key Decision Makers Per Segment ─────────────────────────────
  {
    step_id: '3',
    content: {
      segments: [
        {
          name: 'Mid-Market B2B SaaS',
          roles: [
            { title: 'VP of Sales', influence: 'high', concern: 'Pipeline coverage and rep productivity' },
            { title: 'VP of Marketing', influence: 'high', concern: 'MQL quality and campaign ROI' },
            { title: 'Revenue Operations Manager', influence: 'medium', concern: 'Tool integration and data accuracy' },
          ],
        },
        {
          name: 'B2B Professional Services',
          roles: [
            { title: 'Chief Revenue Officer', influence: 'high', concern: 'Scaling beyond referral-based pipeline' },
            { title: 'Director of Business Development', influence: 'high', concern: 'Finding net-new opportunities' },
          ],
        },
        {
          name: 'Growth-Stage FinTech and HRTech',
          roles: [
            { title: 'VP of Sales', influence: 'high', concern: 'Building a repeatable outbound motion' },
            { title: 'Head of Growth', influence: 'high', concern: 'Efficient customer acquisition' },
          ],
        },
      ],
    },
  },

  // ── Step 4 — Pain Points ──────────────────────────────────────────────────
  {
    step_id: '4',
    content: {
      pain_points: [
        {
          index: 1,
          title: 'Invisible Pipeline Risk',
          description:
            'Sales teams have no visibility into which deals are stalling or which accounts are quietly evaluating competitors. By the time they find out a deal is at risk it is too late to course-correct.',
        },
        {
          index: 2,
          title: 'Wasted Rep Time on Low-Intent Accounts',
          description:
            'SDRs and AEs spend 60-70% of their time on accounts that have no active buying intent. Cold outreach to unqualified lists produces low reply rates, rep burnout, and inflated CAC.',
        },
        {
          index: 3,
          title: 'Sales and Marketing Misalignment',
          description:
            'Marketing generates MQLs based on form fills and ad clicks while sales ignores them because they are low quality. The two teams measure success differently and waste budget on uncoordinated campaigns.',
        },
        { index: 4, title: '', description: '' },
      ],
      active_count: 3,
    },
  },

  // ── Step 5 — Problem Triggers ─────────────────────────────────────────────
  {
    step_id: '5',
    content: byPainPoint(
      'Sales reps rely on CRM activity logs and gut instinct to assess deal health. There is no behavioral signal layer showing whether a prospect is still actively engaged, evaluating competitors, or has gone quiet.',
      'Without intent data, account prioritization defaults to firmographic fit — company size, industry, and title. A company that fits the ICP perfectly but is not actively evaluating solutions will not buy regardless of how many touches a rep makes.',
      'Marketing optimizes for MQL volume using form fills and ad engagement as proxies for intent. Sales optimizes for pipeline quality using close rate and deal size. Neither team has visibility into the same account-level behavioral data.',
    ),
  },

  // ── Step 6 — Consequences ─────────────────────────────────────────────────
  {
    step_id: '6',
    content: byPainPoint(
      'Deals that appear healthy in the CRM are lost to competitors who engaged more recently and more relevantly. Win rates decline quarter over quarter. Forecast accuracy drops creating board-level confidence problems.',
      'SDRs burn out making 80-100 dials per day to accounts that will not buy for 12-18 months. Reply rates drop below 2%. Cost per opportunity balloons. Top reps start questioning the quality of their territory and either disengage or leave.',
      'Marketing budget is wasted on campaigns targeting accounts that are not in-market. Sales ignores marketing-sourced leads because historical quality is low. The two teams develop an adversarial dynamic that slows revenue growth.',
    ),
  },

  // ── Step 7 — Tipping Point ────────────────────────────────────────────────
  {
    step_id: '7',
    content: byPainPoint(
      'The moment of realization comes when a deal forecast to close gets marked lost and a quick LinkedIn search reveals the prospect just announced a competitor partnership. The team understands they need behavioral signals not just CRM activity.',
      'Realization hits during a pipeline review when the CRO asks what percentage of outreach converts to a first meeting. The answer is 1.2%. Analysis shows the deals that converted all came from accounts that had visited the pricing page or downloaded a competitive comparison guide.',
      'The realization happens in a quarterly business review when the CMO presents 400 MQLs and the VP of Sales responds that they worked 40 of them. Nobody can explain the gap because there is no shared account-level data.',
    ),
  },

  // ── Step 8 — Ideal Solution ───────────────────────────────────────────────
  {
    step_id: '8',
    content: byPainPoint(
      'Real-time behavioral intent signals that alert reps when an account in their pipeline is actively researching competitors, visiting comparison pages, or surging on relevant keywords. Combined with AI-powered deal health scoring that gives reps a clear signal when to accelerate or re-engage.',
      'An AI-powered daily prioritization list that ranks accounts by in-market intent signals not just firmographic fit. Reps open the platform each morning and work the list in order. Every account has demonstrated behavioral evidence of active evaluation.',
      'A shared account intelligence layer that gives both sales and marketing visibility into the same behavioral signals. Marketing builds campaigns targeting in-market accounts. Sales works the same list with coordinated outreach. MQL debates are replaced by account-based plays built on shared data.',
    ),
  },

  // ── Step 10 — Positioning Statement ──────────────────────────────────────
  {
    step_id: '10',
    content: byPainPoint(
      'Apex Solutions gives your revenue team real-time visibility into every account buying behavior so you always know which deals need attention before it is too late to save them.',
      'Apex Solutions eliminates the guesswork from prospecting by showing your reps exactly which accounts are actively in-market today so every outreach lands with purpose and every hour is spent on an account that is ready to buy.',
      'Apex Solutions gives sales and marketing a single shared view of account intent so both teams always work from the same playbook, coordinate on the same opportunities, and measure success the same way.',
    ),
  },

  // ── Step 11 — Core Value Propositions ────────────────────────────────────
  {
    step_id: '11',
    content: byPainPoint(
      'Apex Solutions monitors behavioral signals across your entire pipeline in real time — surfacing accounts that are surging on competitor keywords, visiting comparison pages, or going dark — so your reps can re-engage at exactly the right moment. Customers report a 34% improvement in forecast accuracy within 90 days.',
      'Apex Solutions replaces cold prospecting lists with an AI-ranked daily action list built entirely from in-market intent signals. Your SDRs start each day knowing exactly which accounts are actively evaluating solutions like yours. Teams see reply rates improve from sub-2% to 8-12% within the first 60 days.',
      'Apex Solutions creates a single source of account truth that both sales and marketing operate from. The result is a 40% reduction in wasted marketing spend and the elimination of the MQL quality debate permanently.',
    ),
  },

  // ── Step 12 — Success Requirements ───────────────────────────────────────
  {
    step_id: '12',
    content: byPainPoint(
      'Success requires reps to check intent alerts daily and update CRM notes within 24 hours of a signal. The platform must integrate with HubSpot or Salesforce so deal health scores surface inside existing workflows.',
      'Success requires SDRs to work the daily priority list in order for the first 30 days. Sequence templates must be updated to reference the specific intent signals that triggered the outreach. Reply rates must be reviewed weekly.',
      'Success requires weekly sales and marketing alignment meetings anchored to the shared account list. Campaign targeting must be updated monthly to reflect current in-market accounts.',
    ),
  },

  // ── Step 13 — Critical Success Formulas ──────────────────────────────────
  {
    step_id: '13',
    content: byPainPoint(
      'Deal Health Score = (Engagement Recency x 0.4) + (Stakeholder Coverage x 0.3) + (Competitor Research Activity x 0.3). Deals scoring below 60 get a mandatory re-engagement play within 48 hours.',
      'Daily Priority Score = (Intent Signal Strength x 0.5) + (ICP Fit Score x 0.3) + (Engagement History x 0.2). Only accounts scoring above 70 make the daily action list.',
      'Alignment Score = (Shared Account Coverage x 0.4) + (Campaign-to-Pipeline Conversion x 0.4) + (MQL-to-SQL Acceptance Rate x 0.2). Teams scoring below 65 trigger a joint account planning session.',
    ),
  },

  // ── Step 15 — Key Selling Points ─────────────────────────────────────────
  {
    step_id: '15',
    content: byPainPoint(
      'Real-time deal health alerts so you know the moment an account goes cold or starts researching competitors. Deploys in 48 hours with no IT involvement. Teams report 34% improvement in forecast accuracy in 90 days. No black-box scoring — every intent signal is explained and traceable.',
      'Daily AI-ranked action list so reps never wonder who to call first. Intent signals from 40,000 plus B2B websites and review platforms. Average reply rate improvement from 1.8% to 9.4% in first 60 days. Pricing starts at $1,500 per month — fraction of enterprise alternatives.',
      'Shared account dashboard — one view for sales and marketing. Automatic campaign targeting updates based on in-market signals. MQL quality score built on behavioral data not form fills. Weekly alignment report sent automatically to both team leads.',
    ),
  },

  // ── Step 16 — Acid Test 1 (Offer Alignment) ──────────────────────────────
  {
    step_id: '16',
    content: byPainPoint(
      'Can Apex detect a competitor evaluation inside an existing customer account before the renewal conversation? In beta testing Apex flagged 3 renewal-risk accounts 45 days before renewal based on competitor keyword research. All 3 were saved with targeted re-engagement plays.',
      'If an SDR works only the Apex daily priority list for 30 days will their meeting booking rate increase? Beta SDRs working the priority list exclusively booked 2.3x more first meetings than the control group while making 40% fewer total touches.',
      'Will sales and marketing agree on which accounts to target next quarter using only Apex data? In the first joint account planning session using Apex intent data the team agreed on 87% of the target account list — up from 34% using the previous process.',
    ),
  },

  // ── Step 17 — Target Competition ─────────────────────────────────────────
  {
    step_id: '17',
    content: byPainPoint(
      '6sense — enterprise incumbent, $60K-$200K per year, 3-6 month implementation. Demandbase — enterprise ABM, strong advertising integration. Bombora — data-only intent provider, no activation layer.',
      'ZoomInfo — broad contact database, basic intent signals, no daily action list. Warmly — emerging competitor, website visitor identification, $10K per year entry point.',
      'Clari plus Salesloft — merged entity, $450M ARR, focused on forecasting and engagement. Apollo — all-in-one outbound platform, 210M plus contacts, strong on sequencing.',
    ),
  },

  // ── Step 18 — Competitive Differentiators ────────────────────────────────
  {
    step_id: '18',
    content: byPainPoint(
      'Unlike 6sense which requires 3-6 months to implement and a dedicated RevOps team, Apex deploys in 48 hours and surfaces deal risk in plain language. Unlike Bombora which only provides data with no activation layer, Apex tells reps exactly what to do when a risk signal fires.',
      'Unlike ZoomInfo which provides a static contact database with basic intent overlays, Apex provides a dynamic daily action list that re-ranks automatically as signals change. Unlike Warmly which focuses on website visitors only, Apex captures intent from 40,000 plus external B2B content sites.',
      'Unlike Demandbase which is built primarily for marketing with sales as an afterthought, Apex is designed from the ground up for both teams to operate from the same interface with role-specific views.',
    ),
  },
]

// ─── ICP seed ─────────────────────────────────────────────────────────────────

interface IcpSeed {
  org_id: string
  segment_name: string
  segment_index: number
  buyer_type: string
  job_titles: string[]
  company_size_range: string
  industry_verticals: string[]
  the_big_win: string
  buying_urgency_trigger: string
  primary_challenges: string[]
}

const icpSeed: IcpSeed = {
  org_id: workspaceId,
  segment_name: 'Mid-Market B2B SaaS',
  segment_index: 1,
  buyer_type: 'economic_buyer',
  job_titles: ['VP of Sales', 'VP of Marketing', 'Revenue Operations Manager'],
  company_size_range: '50-500 employees',
  industry_verticals: ['B2B SaaS', 'Software'],
  the_big_win: 'Shorter sales cycles and higher win rates by focusing reps on in-market accounts',
  buying_urgency_trigger: 'Win rate drops, missed quota, or CRO mandate to improve pipeline quality',
  primary_challenges: [
    'Poor pipeline visibility',
    'Low SDR reply rates',
    'Sales and marketing misalignment',
  ],
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\nSeeding Apex Solutions demo content for workspace: ${workspaceId}\n`)

  // ── step_output upserts ──────────────────────────────────────────────────
  let stepOk = 0
  let stepFail = 0

  for (const step of steps) {
    const { error: delError } = await supabase
      .from('step_output')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('step_id', step.step_id)

    if (delError) {
      console.error(`  ✗ Step ${step.step_id} (delete): ${delError.message}`)
      stepFail++
      continue
    }

    const { error: insError } = await supabase
      .from('step_output')
      .insert({
        workspace_id: workspaceId,
        step_id: step.step_id,
        version: 1,
        status: 'draft',
        content: step.content,
        copilot_assisted: false,
        last_saved_at: now,
        last_updated_at: now,
      })

    if (insError) {
      console.error(`  ✗ Step ${step.step_id}: ${insError.message}`)
      stepFail++
    } else {
      console.log(`  ✓ Step ${step.step_id}`)
      stepOk++
    }
  }

  // ── icp_definition upsert ─────────────────────────────────────────────────
  const { error: icpError } = await supabase
    .from('icp_definition')
    .upsert(icpSeed, { onConflict: 'org_id,segment_index' })

  if (icpError) {
    console.error(`  ✗ ICP: ${icpError.message}`)
  } else {
    console.log('  ✓ ICP — Mid-Market B2B SaaS')
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\nDone. ${stepOk} steps seeded, ${stepFail} failed.\n`)
  if (stepFail > 0) process.exit(1)
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
