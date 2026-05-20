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

function blendByPainPoint(pp1: string, pp2: string, pp3: string): { mode: string; per_pain_point: ByPainPoint[] } {
  return {
    mode: 'per_pain_point',
    per_pain_point: [
      { index: 1, content: pp1 },
      { index: 2, content: pp2 },
      { index: 3, content: pp3 },
    ],
  }
}

interface ActionPlanEntry {
  index: number
  content: string
}

function actionPlan(
  pp1: string,
  pp2: string,
  pp3: string,
  summary: string,
): { by_pain_point: ActionPlanEntry[]; summary: string } {
  return {
    by_pain_point: [
      { index: 1, content: pp1 },
      { index: 2, content: pp2 },
      { index: 3, content: pp3 },
    ],
    summary,
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
        'Apex Solutions is a Revenue Intelligence platform that helps B2B sales and marketing teams identify in-market buyers before they ever fill out a form. Using AI and behavioral signal tracking, we reveal which companies are actively researching solutions like yours, where they are in the buying journey, and which contacts to engage first.',
      primaryUseCase:
        'Shorter sales cycles and higher win rates by helping revenue teams focus on accounts that are actually ready to buy — eliminating wasted outreach to unqualified lists.',
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

  // ── Step 19 — Competitive Advantages ─────────────────────────────────────
  {
    step_id: '19',
    content: byPainPoint(
      'Deploys in 48 hours vs 3-6 months for 6sense. No dedicated RevOps team required. Plain language alerts instead of complex dashboards. Transparent pricing starting at $1,500 per month vs $60K-$200K enterprise contracts.',
      'Dynamic daily action list vs static contact databases. Captures intent from 40,000 plus external B2B content sites vs website visitors only. Re-ranks automatically as signals change. Average reply rate improvement from 1.8% to 9.4% in first 60 days.',
      'Built for both sales and marketing from the ground up vs marketing-first platforms with sales as afterthought. Shared account dashboard eliminates data exports and manual reconciliation. Role-specific views for each team.',
    ),
  },

  // ── Step 20 — Competitive Threats ────────────────────────────────────────
  {
    step_id: '20',
    content: byPainPoint(
      '6sense investing heavily in mid-market with simplified onboarding. Clari-Salesloft merger creates a combined forecasting and engagement platform that could expand into intent data. Enterprise vendors reducing minimum contract sizes.',
      'Warmly growing rapidly with $10K entry point and person-level identification. Apollo adding intent signals to their 210M contact database. ZoomInfo acquiring intent data capabilities through partnerships.',
      'HubSpot and Salesforce building native intent signal features into their CRM platforms. If CRMs solve alignment natively the need for a standalone tool diminishes. Free tiers from competitors lowering switching costs.',
    ),
  },

  // ── Step 22 — Competitive Evaluation ─────────────────────────────────────
  {
    step_id: '22',
    content: byPainPoint(
      '6sense scores high on data depth but low on usability and time-to-value. Requires 3-6 month implementation and dedicated RevOps. Demandbase strong on advertising integration but weak on sales activation. Bombora data quality inconsistent without activation layer.',
      'ZoomInfo dominates on contact database size but intent signals are basic and action guidance is absent. Warmly strongest on website visitor identification but limited to first-party signals only. Neither provides a daily prioritized action list for SDRs.',
      'Clari-Salesloft merger creates forecasting plus engagement but no shared account intelligence layer. HubSpot and Salesforce building native features but years behind on intent data sophistication. Apollo strong on outbound sequencing but weak on alignment use case.',
    ),
  },

  // ── Step 23 — Decision Process ────────────────────────────────────────────
  {
    step_id: '23',
    content: byPainPoint(
      'VP Sales initiates evaluation after missed forecast. RevOps scopes vendors and builds comparison matrix. CRO approves shortlist. Pilot required with target account list before contract. Legal reviews data privacy. Finance approves annual contract.',
      'SDR Manager flags reply rate problem to VP Sales. Sales Ops researches intent data solutions. VP Sales and VP Marketing must align on shared platform — this is the critical gate. Joint demo required. 30-day pilot with both teams before decision.',
      'CMO and VP Sales present joint business case to CRO. Both teams must agree on shared account definition before purchase. IT reviews integration requirements with HubSpot. Legal reviews data sharing agreements. Board approval required over $50K.',
    ),
  },

  // ── Step 24 — Competitive Retaliation ────────────────────────────────────
  {
    step_id: '24',
    content: byPainPoint(
      '6sense likely to offer aggressive discounting and extended pilot to protect enterprise accounts migrating to mid-market. Expect FUD around data quality and predictive model accuracy. May offer free implementation support to reduce switching friction.',
      'Warmly will compete aggressively on price — $10K entry point vs our $18K minimum. ZoomInfo will bundle intent signals into existing contracts at low incremental cost. Apollo will offer free intent tier to existing customers.',
      'Demandbase will emphasize marketing use case and advertising ROI to retain marketing budget. HubSpot will accelerate native intent feature development and offer it free to existing customers. Salesforce Einstein will be positioned as sufficient for alignment use case.',
    ),
  },

  // ── Step 25 — Competitive Opportunities ──────────────────────────────────
  {
    step_id: '25',
    content: byPainPoint(
      '6sense enterprise complexity creates a mid-market gap we own. Every company that evaluated 6sense and walked away due to price or implementation burden is a warm prospect. Target RevOps communities and G2 reviewers who rated 6sense below 4 stars.',
      'ZoomInfo contract renewals are a prime opportunity — customers frustrated with basic intent signals and no action guidance. Target accounts 60-90 days before ZoomInfo renewal. Apollo customers scaling beyond outbound into full-cycle sales are natural expansion targets.',
      'Clari-Salesloft merger disruption creates uncertainty — customers worried about product direction and pricing changes are evaluating alternatives. HubSpot customers who have outgrown native reporting but cannot justify Salesforce are ideal targets for the alignment use case.',
    ),
  },

  // ── Step 26 — Competitive Strengths / Weaknesses ─────────────────────────
  {
    step_id: '26',
    content: byPainPoint(
      'Strength: 48-hour deployment vs 3-6 months. No RevOps hire required. Plain language alerts. Transparent pricing. Weakness: Smaller intent data network than 6sense. Less brand recognition. No advertising integration. Predictive models less mature than enterprise incumbents.',
      'Strength: Dynamic daily action list unique in market. External intent signals beyond website visitors. Re-ranks automatically. Proven reply rate improvement. Weakness: Contact database smaller than ZoomInfo. No built-in email sequencing. Requires behavior change from reps used to static lists.',
      'Strength: Only platform built equally for sales and marketing from day one. Shared dashboard eliminates exports. Role-specific views. Alignment score metric unique. Weakness: Newer brand in crowded market. Marketing automation integration less deep than Demandbase. No native advertising capability.',
    ),
  },

  // ── Step 27 — The Set-Up ──────────────────────────────────────────────────
  {
    step_id: '27',
    content: blendByPainPoint(
      'You already know your pipeline has blind spots. Deals that look healthy go dark. Competitors engage while you\'re waiting for a callback. The question isn\'t whether pipeline risk is real — it\'s whether you find out in time to do something about it.',
      'Your reps are working hard. The problem isn\'t effort — it\'s direction. When 70% of outreach goes to accounts that won\'t buy for 18 months, effort doesn\'t move the number. Intent does.',
      'Sales blames marketing for bad leads. Marketing blames sales for not working them. Both are right. And both are wrong. The real problem is they\'re looking at different data and calling it the same thing.',
    ),
  },

  // ── Step 28 — The Jab ─────────────────────────────────────────────────────
  {
    step_id: '28',
    content: blendByPainPoint(
      'What if you knew the moment a deal started going sideways — not after the loss review, but in time to re-engage? Apex Solutions monitors behavioral signals across your entire pipeline in real time. When an account goes quiet or starts researching competitors, you know before they ghost you.',
      'What if your SDRs started every day with a ranked list of accounts that are actively looking right now? Not a territory list. Not a static sequence. A live, re-ranking feed of in-market accounts — updated every morning based on what buyers did yesterday.',
      'What if sales and marketing looked at the same account list every Monday morning? Not a marketing list and a sales list — one list, built from behavioral signals both teams agree represent real buying intent.',
    ),
  },

  // ── Step 29 — Knock-Out ───────────────────────────────────────────────────
  {
    step_id: '29',
    content: blendByPainPoint(
      'Apex Solutions customers report a 34% improvement in forecast accuracy within 90 days. Not because they got better at guessing — because they stopped guessing. Real-time deal health scoring means your forecast reflects what buyers are actually doing, not what reps think is happening.',
      'Beta SDRs working the Apex priority list exclusively booked 2.3 times more first meetings than the control group — while making 40% fewer total touches. Less activity. More pipeline. That is what happens when intent replaces instinct.',
      'After implementing Apex, one customer\'s sales and marketing team agreed on 87% of the target account list — up from 34% using their previous process. The MQL debate ended. Budget stopped being wasted. Pipeline started being built together.',
    ),
  },

  // ── Step 30 — Clean-Up ───────────────────────────────────────────────────
  {
    step_id: '30',
    content: blendByPainPoint(
      'The risk is not that you buy an intent data tool and it does not work. The risk is that you keep losing winnable deals to competitors who knew the account was in play before you did. Every quarter you wait is another forecast conversation you could have avoided.',
      'The risk is not adopting intent data. The risk is continuing to measure your team on activity metrics while your competitors measure theirs on outcomes. Dials and emails are inputs. Pipeline is the output. Apex connects them.',
      'The risk is not solving the alignment problem. The risk is watching your best marketing campaigns generate leads that sales ignores — and your best sales reps pursue accounts that marketing already warmed up and nobody told them. Apex ends that.',
    ),
  },

  // ── Step 31 — Create Opportunities ───────────────────────────────────────
  {
    step_id: '31',
    content: actionPlan(
      'Identify all accounts in current pipeline with no intent signal activity in last 14 days. Flag as at-risk. Launch re-engagement sequence referencing specific competitor keywords the account has been researching. Target: reduce at-risk pipeline by 30% in 60 days.',
      'Export current prospect list and run against Apex intent data. Identify top 20% showing active buying signals. Rebuild SDR sequences around those accounts first. Pause outreach to bottom 40% until intent signals emerge. Target: 2x meeting booking rate in 30 days.',
      'Schedule joint sales and marketing account planning session using Apex shared dashboard. Build agreed target account list for next quarter. Define shared definition of sales-ready account based on intent score threshold. Target: 80% account list agreement by end of session.',
      'Apex Solutions go-to-market launch focuses on three parallel workstreams: pipeline risk reduction for current deals, intent-based SDR prioritization for new pipeline creation, and sales-marketing alignment for coordinated account pursuit. All three workstreams launch simultaneously in Week 1.',
    ),
  },

  // ── Step 32 — Get Into Position ───────────────────────────────────────────
  {
    step_id: '32',
    content: actionPlan(
      'Connect Apex to HubSpot within 48 hours of contract. Map deal stages to intent signal thresholds. Configure alerts for competitor keyword surges on active opportunities. Train AEs on deal health dashboard in Week 1. First forecast review using Apex data in Week 3.',
      'Upload ICP and target account list to Apex on Day 1. Configure daily priority feed for each SDR. Run 2-hour training session on intent-based outreach in Week 1. Replace existing sequences with intent-triggered versions by Week 2. Review reply rates weekly.',
      'Invite VP Marketing and VP Sales to shared Apex dashboard on Day 1. Schedule weekly alignment meeting anchored to shared account list. Configure joint KPIs — pipeline sourced from shared accounts, MQL acceptance rate, account list agreement percentage. First joint review in Week 2.',
      'Implementation is structured as a 30-day sprint. Weeks 1-2 focus on technical setup and team onboarding. Weeks 3-4 focus on first results review and process refinement. By Day 30 all three teams should be operating from Apex data as their primary account intelligence source.',
    ),
  },

  // ── Step 33 — Grow Support ────────────────────────────────────────────────
  {
    step_id: '33',
    content: actionPlan(
      'Share first deal health report with CRO in Week 3. Highlight specific deals where Apex flagged risk and rep re-engaged successfully. Build internal case study from first saved deal. Present to broader sales team in Week 4 all-hands.',
      'Track reply rate improvement weekly and share with VP Sales every Friday. By Week 4 pull first cohort analysis showing intent-sourced meetings vs non-intent meetings. Present conversion difference to leadership. Use data to justify expanding Apex to full SDR team.',
      'After first joint account planning session share alignment score with both team leads. Document time saved by eliminating manual list reconciliation. Track MQL acceptance rate improvement week over week. Present joint wins — deals where both teams worked the same account — in Week 6 QBR.',
      'Internal advocacy is built through early wins shared with leadership. Each workstream has a designated champion responsible for documenting results and presenting to broader team. By Week 6 Apex should have internal executive sponsors in both sales and marketing.',
    ),
  },

  // ── Step 34 — Close The Sale ──────────────────────────────────────────────
  {
    step_id: '34',
    content: actionPlan(
      'Use Apex deal health data in every forecast call. When a deal shows competitor research activity brief the AE with specific re-engagement talking points. Track win rate on Apex-monitored deals vs non-monitored deals. Target: 8 point win rate improvement by end of Quarter 1.',
      'For every SDR-sourced meeting track whether the account was on the Apex priority list at time of outreach. Build attribution model showing intent-sourced pipeline conversion vs cold outreach pipeline. Use data in next budget conversation to justify expanding seats.',
      'Track every deal where both sales and marketing touched the same account. Measure velocity and win rate vs single-team-touch deals. The data will show coordinated pursuit outperforms uncoordinated pursuit. Use this in next QBR to cement Apex as the alignment system of record.',
      'Sales process integration is complete when Apex data influences every forecast conversation, every SDR prioritization decision, and every account planning meeting. The goal is not to add another tool — it is to replace the instinct-based decisions that currently drive these conversations with signal-based decisions.',
    ),
  },

  // ── Step 35 — Pat Them On The Back ───────────────────────────────────────
  {
    step_id: '35',
    content: actionPlan(
      'At 90-day mark pull full deal health report. Identify deals saved through early risk detection. Calculate revenue protected. Share with CRO and board as proof of concept. Recognize AEs who adopted the platform earliest and showed the strongest win rate improvement.',
      'At 90-day mark calculate total meetings booked from intent-prioritized outreach vs baseline. Calculate pipeline value generated. Share with VP Sales and use in next budget cycle to secure expanded Apex investment. Recognize top SDRs who embraced the new workflow.',
      'At 90-day mark present joint sales and marketing scorecard. Show account list agreement improvement, MQL acceptance rate improvement, and pipeline sourced from coordinated account pursuit. Celebrate the end of the MQL debate. Use results to build case for expanding Apex across additional segments.',
      '90-day business review is the critical milestone. By this point Apex should have generated enough data to demonstrate clear ROI across all three workstreams. This review becomes the foundation for the renewal conversation and the expansion proposal.',
    ),
  },

  // ── Step 36 — Retrench ───────────────────────────────────────────────────
  {
    step_id: '36',
    content: actionPlan(
      'If deal health scores are not correlating with actual deal outcomes recalibrate the intent signal weights with Apex customer success team. Review which competitor keywords are most predictive for your specific deals. Adjust alert thresholds to reduce false positives. Re-train AEs on updated signals.',
      'If reply rates have not improved by Week 6 audit the sequences being used on intent-flagged accounts. The problem is usually messaging not data — the intent signal is right but the outreach is not referencing it. Workshop new templates with the SDR team and relaunch.',
      'If sales and marketing alignment score is not improving after 30 days escalate to CRO. The technology is working — the issue is organizational. May require a formal SLA between sales and marketing defining response times for shared accounts and consequences for non-compliance.',
      'Retrench protocol activates when any workstream is underperforming at the 30-day checkpoint. Each workstream has a specific diagnostic and remediation plan. The goal is to identify whether the issue is data quality, process adoption, or messaging — and fix the right thing.',
    ),
  },

  // ── Step 37 — Resources and Tools ────────────────────────────────────────
  {
    step_id: '37',
    content: actionPlan(
      'Apex Solutions platform — primary deal intelligence tool. HubSpot CRM — deal tracking and alert delivery. Slack — real-time deal health notifications. Gong — call recording correlated with intent signals. Weekly deal health report template. Competitor keyword tracking playbook.',
      'Apex Solutions platform — daily SDR priority feed. HubSpot Sequences — intent-triggered outreach templates. LinkedIn Sales Navigator — stakeholder identification on priority accounts. Reply rate tracking dashboard. Intent-based outreach message library. 30-60-90 day SDR ramp guide.',
      'Apex Solutions platform — shared account intelligence layer. HubSpot — shared account list sync. Slack — joint sales and marketing channel for account updates. Weekly alignment meeting agenda template. Shared account definition SLA document. Joint QBR presentation template.',
      'Full technology stack for Apex Solutions GTM execution: Apex Solutions for intelligence and prioritization, HubSpot for CRM and automation, Gong for conversation intelligence, LinkedIn Sales Navigator for prospecting, and Slack for real-time collaboration. Total stack investment approximately $4,200 per month for a 10-person revenue team.',
    ),
  },

  // ── Step 38 — Deal Scorecard ──────────────────────────────────────────────
  {
    step_id: '38',
    content: {
      scores: { opportunity: 4, resources: 4, compete: 3, win: 4, worth_it: 5 },
      notes: {
        opportunity: 'Strong ICP fit, clear pain point alignment, account showing active evaluation signals across multiple touchpoints',
        resources: 'Full revenue team in place, HubSpot already implemented, budget approved for Q3 investment',
        compete: '6sense is entrenched in enterprise but vulnerable on price and complexity at mid-market. Warmly is the real threat at low end.',
        win: 'Champion identified in RevOps, executive sponsor engaged, differentiation is clear and defensible',
        worth_it: 'ACV of $36K with strong expansion potential to marketing team. Reference customer potential. Logo value high.',
      },
      copilot_recommendation: 'Strong Go. This opportunity scores 20 out of 25. The account shows strong ICP fit, active buying signals, and an identified champion. The competitive risk from Warmly at the low end is real but manageable given the alignment use case differentiation. Recommend fast-tracking to pilot proposal this week.',
      recommendation_label: 'Strong Go',
    },
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

  // ── dcp_analysis upsert ───────────────────────────────────────────────────
  const { error: dcpError } = await supabase
    .from('dcp_analysis')
    .upsert(
      {
        org_id: workspaceId,
        status: 'approved',
        overall_confidence: 78,
        approved_at: now,
        stage_summaries: [
          {
            stage_number: 1,
            stage_name: 'Need Recognition',
            summary:
              'Buyers recognize the need for revenue intelligence when they experience a pattern of lost deals they did not see coming, declining SDR productivity despite increased activity, and growing tension between sales and marketing over lead quality. The trigger is typically a missed quarterly forecast that forces leadership to examine why deals are stalling. Organizations in the 50-500 employee range hit this inflection point when their manual processes — spreadsheets, intuition-based prioritization, and ad-hoc qualification — break down under volume and competitive pressure.',
            confidence_score: 82,
          },
          {
            stage_number: 2,
            stage_name: 'Information Search',
            summary:
              'Buyers research revenue intelligence solutions primarily through peer communities — RevOps Slack groups, Pavilion forums, and G2 reviews are the top three sources. They search terms like intent data platform, account-based marketing software, and sales intelligence tools. The buying team typically includes VP Sales, VP Marketing, and a RevOps lead. Research phases last 4-8 weeks before a shortlist is formed. LinkedIn is used heavily for social proof — buyers look for peers at similar companies who have implemented solutions and post about results.',
            confidence_score: 76,
          },
          {
            stage_number: 3,
            stage_name: 'Evaluation of Alternatives',
            summary:
              'The evaluation process centers on three criteria: time to first value, integration with existing CRM stack, and total cost of ownership. Enterprise platforms like 6sense and Demandbase are evaluated and rejected by mid-market buyers due to implementation complexity and pricing. The shortlist typically narrows to 2-3 vendors who offer a self-serve pilot with the buyer\'s own target account list. Reference calls with similar-sized companies are required before a decision. The RevOps lead owns the technical evaluation while VP Sales owns the business case.',
            confidence_score: 74,
          },
          {
            stage_number: 4,
            stage_name: 'Purchase Decision',
            summary:
              'Purchase decisions require alignment between VP Sales and VP Marketing — both must agree on the platform before the CRO approves budget. The decision timeline from shortlist to signature averages 45 days. Key purchase criteria in order: HubSpot or Salesforce integration, transparent pricing with no hidden overages, proof-of-concept with real account data, and dedicated onboarding support. Legal review of data privacy practices is required at all companies over 100 employees. Multi-year contracts are resisted — buyers strongly prefer annual with renewal options.',
            confidence_score: 81,
          },
          {
            stage_number: 5,
            stage_name: 'Purchase',
            summary:
              'Successful purchases follow a consistent pattern: a 2-week pilot using the buyer\'s actual ICP and target account list, a joint readout with sales and marketing leadership showing first intent signals, and a clear 30-day onboarding plan before contract signature. Deals stall when the pilot is generic rather than account-specific, when only one team participates in the evaluation, or when pricing requires a multi-year commitment before value is proven. The fastest deals close when the RevOps champion has executive sponsorship from the CRO before the pilot begins.',
            confidence_score: 79,
          },
          {
            stage_number: 6,
            stage_name: 'Post-Purchase Evaluation',
            summary:
              'Success is measured at 30, 60, and 90 days. Leading indicators at 30 days: SDR reply rate improvement and number of intent-flagged accounts added to active sequences. At 60 days: first meetings booked from intent-sourced accounts and sales-marketing account list agreement percentage. At 90 days: pipeline sourced from intent data and win rate on monitored deals vs unmonitored deals. Customers who achieve strong 90-day results renew and expand. Customers who struggle typically failed to get sales and marketing operating from the same account list in the first 30 days.',
            confidence_score: 77,
          },
          {
            stage_number: 7,
            stage_name: 'Repeat Purchase and Loyalty',
            summary:
              'Loyal customers exhibit three behaviors: they expand seat count to include the full BDR and AE team, they become internal advocates by presenting results at QBRs and referring peer companies, and they use the platform for competitive intelligence beyond prospecting. The strongest retention indicator is whether the platform becomes the system of record for the weekly sales-marketing alignment meeting. When both teams open Apex at the start of every Monday meeting, churn risk drops to near zero. NPS is highest among customers who implemented within the first 48 hours of contract.',
            confidence_score: 80,
          },
        ],
      },
      { onConflict: 'org_id' },
    )

  if (dcpError) {
    console.error(`  ✗ DCP analysis: ${dcpError.message}`)
  } else {
    console.log('  ✓ DCP analysis — 7 stages, approved, confidence 78')
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\nDone. ${stepOk} steps seeded, ${stepFail} failed.\n`)
  if (stepFail > 0) process.exit(1)
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
