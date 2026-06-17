// Shared types, constants, styles, and pure helpers for the Journey step page.

import type React from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CopilotAction = 'draft' | 'verify' | 'improve' | 'explain'

export interface StepDef {
  id: string
  title: string
  description: string
  section: string
}

export interface CopilotOutput {
  draft: string
  confidence: number
  sources: string[]
  assumptions: string[]
  open_questions: string[]
  verification_checks: string[]
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'
export type SaveStatus = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

export interface PainPoint {
  index: number
  title: string
  description: string
}

export interface Step4Content {
  pain_points: PainPoint[]
  active_count: number
}

export interface DcpStageSummary {
  stage_number: number
  stage_name: string
  summary: string
  confidence_score: number
}

export interface Step9State {
  gateApproved: boolean
  stageNumber: number
  stage: DcpStageSummary | null
  updatedAt: string
}

// Maps each Endemic-Problem step to the DCP stage that grounds its transparency panel.
export const DCP_STAGE_FOR_STEP: Record<string, number> = {
  '4': 1, // The Problem      → Stage 1 (Need)
  '7': 2, // The Realization  → Stage 2 (Motivation)
  '8': 4, // The Solution     → Stage 4 (Evaluation)
  '9': 3, // The Search       → Stage 3 (Search)
}

export interface AllStep {
  id: string
  phase: number
}

export interface Segment {
  name: string
  industry: string
  company_size: string
  geography: string
}

export type RoleCategory =
  | ''
  | 'CEO / Founder'
  | 'CEO / President'
  | 'Chief Revenue Officer / VP Sales'
  | 'Chief Marketing Officer / VP Marketing'
  | 'Managing Partner'
  | 'Operating Partner (PE Firm)'
  | 'VP Business Development'
  | 'Revenue Operations Manager'
  | 'Head of Technology'
  | 'Chief Customer Officer / VP Customer Success'
  | 'Chief Product Officer / VP Product'
  | 'Product Marketing Manager'
  | 'Practice Lead'
  | 'Marketing Director'
  | 'CMO / Head of Marketing'
  | 'CRO / VP Sales'
  | 'Other'

export type InfluenceLevel =
  | ''
  | 'Final Approver'
  | 'Economic Buyer'
  | 'Primary Buyer'
  | 'Champion'
  | 'Evaluator'
  | 'Influencer'
  | 'Gatekeeper / Blocker'

export interface DecisionMaker {
  role_category: RoleCategory
  specific_title: string
  influence: InfluenceLevel
  primary_concerns: string[]
}

export interface BuyingCenterEntry {
  decision_maker: string
  say_yes: string
}

export interface PrereqInfo { status: string; hasContent: boolean }

// ── Defaults and reference data ───────────────────────────────────────────────

export const DEFAULT_SEGMENT: Segment = { name: '', industry: '', company_size: '', geography: '' }

export const ROLE_CATEGORIES: RoleCategory[] = [
  '',
  'CEO / Founder',
  'CEO / President',
  'Chief Revenue Officer / VP Sales',
  'Chief Marketing Officer / VP Marketing',
  'Managing Partner',
  'Operating Partner (PE Firm)',
  'VP Business Development',
  'Revenue Operations Manager',
  'Head of Technology',
  'Chief Customer Officer / VP Customer Success',
  'Chief Product Officer / VP Product',
  'Product Marketing Manager',
  'Practice Lead',
  'Marketing Director',
  'CMO / Head of Marketing',
  'CRO / VP Sales',
  'Other',
]

export const INFLUENCE_LEVELS: InfluenceLevel[] = [
  '',
  'Final Approver',
  'Economic Buyer',
  'Primary Buyer',
  'Champion',
  'Evaluator',
  'Influencer',
  'Gatekeeper / Blocker',
]

export const CONCERN_OPTIONS: string[] = [
  'Pipeline predictability and quota attainment',
  'Revenue growth and competitive positioning',
  'Lead quality and marketing-attributed revenue',
  'Messaging consistency across sales and marketing',
  'Tool consolidation and data accuracy',
  'New market entry and partnership revenue',
  'ROI justification and contract terms',
  'Implementation complexity and adoption',
  'Data privacy and vendor risk management',
  'Board and investor reporting',
  'Budget approval and procurement',
  'Competitive differentiation',
  'Customer acquisition and retention',
  'System integration and technical architecture',
  'Data security and compliance requirements',
  'Team adoption and change management',
  'Total cost of ownership',
  'Vendor reliability and support quality',
  'GTM strategy and execution ownership',
  'Brand positioning and market differentiation',
  'Omni-channel campaign execution',
  'Customer retention and expansion revenue',
  'Product-market fit validation',
  'Competitive win/loss analysis',
]

export const PRIMARY_CONCERN_MAP: Partial<Record<RoleCategory, string[]>> = {
  'CEO / Founder': ['Revenue growth and competitive positioning', 'Competitive differentiation'],
  'CEO / President': ['Revenue growth and competitive positioning', 'Board and investor reporting'],
  'Chief Revenue Officer / VP Sales': ['Pipeline predictability and quota attainment', 'Messaging consistency across sales and marketing'],
  'Chief Marketing Officer / VP Marketing': ['Lead quality and marketing-attributed revenue', 'Messaging consistency across sales and marketing'],
  'Managing Partner': ['Revenue growth and competitive positioning', 'Customer acquisition and retention'],
  'Operating Partner (PE Firm)': ['ROI justification and contract terms', 'Board and investor reporting'],
  'VP Business Development': ['New market entry and partnership revenue', 'Customer acquisition and retention'],
  'Revenue Operations Manager': ['Tool consolidation and data accuracy', 'Implementation complexity and adoption'],
  'Head of Technology': ['System integration and technical architecture', 'Data security and compliance requirements'],
  'Chief Customer Officer / VP Customer Success': ['Customer retention and expansion revenue', 'Customer acquisition and retention'],
  'Chief Product Officer / VP Product': ['Product-market fit validation', 'Competitive win/loss analysis'],
  'Product Marketing Manager': ['Brand positioning and market differentiation', 'GTM strategy and execution ownership'],
  'Practice Lead': ['Competitive differentiation', 'Customer acquisition and retention'],
  'Marketing Director': ['Lead quality and marketing-attributed revenue', 'Messaging consistency across sales and marketing'],
  'CMO / Head of Marketing': ['Lead quality and marketing-attributed revenue', 'Competitive differentiation'],
  'CRO / VP Sales': ['Pipeline predictability and quota attainment', 'Revenue growth and competitive positioning'],
}

export const DEFAULT_DM: DecisionMaker = { role_category: '', specific_title: '', influence: '', primary_concerns: [] }

export function makeDMs(): DecisionMaker[] {
  return [{ ...DEFAULT_DM }, { ...DEFAULT_DM }, { ...DEFAULT_DM }, { ...DEFAULT_DM }]
}

export function makeBCEntry(): BuyingCenterEntry {
  return { decision_maker: '', say_yes: '' }
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const AUTOSAVE_DELAY_MS = 1200
export const STEP4_AUTOSAVE_DELAY_MS = 800

export const PAIN_POINT_STEPS = new Set(['5', '6', '7', '8', '9', '10', '11', '12', '15', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30'])
export const ASSESSMENT_STEPS = new Set(['13', '14'])
export const BLEND_STEPS = new Set(['27', '28', '29', '30'])
export const ACTION_PLAN_STEPS = new Set(['31', '32', '33', '34', '35', '36', '37'])
// Steps where Copilot draft is grounded in DCP buyer research, so auto-apply without
// the Proposed Draft review panel.
export const AUTO_APPLY_STEPS = new Set(['4', '5', '6', '7', '8', '9', '10', '11', '12', '15', '18', '19', '20', '21', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38'])

export const SEG_KEYS = ['segment_1', 'segment_2', 'segment_3'] as const

export const DEFAULT_PAIN_POINTS: PainPoint[] = [
  { index: 1, title: '', description: '' },
  { index: 2, title: '', description: '' },
  { index: 3, title: '', description: '' },
  { index: 4, title: '', description: '' },
]

// ── Styles ────────────────────────────────────────────────────────────────────

export const PANEL_CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '20px',
}

export const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '6px',
}

export const FIELD_INPUT: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1px solid #9CA3AF',
  borderRadius: '8px',
  fontSize: '14px',
  color: '#0D0D0D',
  backgroundColor: '#FFFFFF',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
}

export const DROPDOWN_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  fontSize: '13px',
  color: '#FFFFFF',
  backgroundColor: '#0F2140',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
}

// ── Content quality scoring ───────────────────────────────────────────────────

export function scoreSingleContent(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const len = trimmed.length
  if (len < 50) return 10
  if (len < 150) return 30
  const hasNumbers = /\d/.test(trimmed)
  const hasPercentage = /%/.test(trimmed)
  const hasNamedEntities = /\b[A-Z]{2,}\b/.test(trimmed) || /[A-Z][a-z]+ [A-Z][a-z]+/.test(trimmed)
  const criteria = [hasNumbers, hasPercentage, hasNamedEntities].filter(Boolean).length
  if (len <= 300) return criteria > 0 ? 65 : 50
  if (criteria === 0) return 75
  if (criteria === 1) return 85
  if (criteria === 2) return 90
  return 95
}

export function calculateContentQuality(sid: string, text: string, pts: PainPoint[], activeCnt: number): number {
  if (sid === '4') {
    const active = pts.slice(0, activeCnt)
    if (active.length === 0) return 0
    const scores = active.map(pp => scoreSingleContent(`${pp.title} ${pp.description}`.trim()))
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }
  return scoreSingleContent(text)
}

// ── Copilot error message helper ──────────────────────────────────────────────

export function copilotErrorMessage(code: number | string): string {
  const n = typeof code === 'string' ? parseInt(code, 10) : code
  if (n === 500 || n === 502 || n === 503)
    return "Anthropic's AI service is temporarily unavailable. Please wait a moment and try again. If it persists, check status.anthropic.com"
  if (n === 429) return "You've hit the rate limit. Please wait a minute before trying again."
  if (n === 408) return "The request took too long to complete. Try again or shorten your content."
  if (n > 0) return `Copilot encountered an unexpected error (code: ${n}). Please try again.`
  return 'Copilot encountered an unexpected error. Please try again.'
}

// ── Content extractors ───────────────────────────────────────────────────────

export function extractReadableContent(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (typeof content === 'object' && content !== null) {
    return Object.values(content as Record<string, unknown>)
      .filter(v => typeof v === 'string' && (v as string).trim() !== '')
      .join('\n\n')
  }
  return ''
}

export function extractSegments(content: unknown): string {
  if (typeof content !== 'object' || content === null) return ''
  const c = content as Record<string, unknown>
  if (!Array.isArray(c['segments'])) return ''
  return (c['segments'] as Array<Record<string, unknown>>)
    .filter(s => typeof s['name'] === 'string' && (s['name'] as string).trim())
    .map((s, i) => {
      const name = String(s['name'] ?? '')
      const desc = String(s['description'] ?? '')
      return desc.trim() ? `Segment ${i + 1}: ${name}\n${desc}` : `Segment ${i + 1}: ${name}`
    })
    .join('\n\n')
}

export function extractDecisionMakers(content: unknown): string {
  if (typeof content !== 'object' || content === null) return ''
  const c = content as Record<string, unknown>
  const segs = Array.isArray(c['segments'])
    ? (c['segments'] as Array<Record<string, unknown>>)
    : Array.isArray(c['roles'])
      ? [{ name: '', roles: c['roles'] }]
      : []
  return segs
    .map(s => {
      const segName = String(s['name'] ?? '')
      const roles = Array.isArray(s['roles']) ? (s['roles'] as Array<Record<string, unknown>>) : []
      const roleLines = roles
        .filter(r => typeof r['title'] === 'string' && (r['title'] as string).trim())
        .map(r => {
          const title = String(r['title'] ?? '')
          const influence = String(r['influence'] ?? r['primaryConcern'] !== undefined ? r['influence'] ?? '' : '')
          const concern = String(r['concern'] ?? r['primaryConcern'] ?? '')
          return influence ? `- ${title} — ${influence} influence — ${concern}` : `- ${title} — ${concern}`
        })
        .join('\n')
      return segName ? `${segName}\n${roleLines}` : roleLines
    })
    .filter(s => s.trim())
    .join('\n\n')
}

export function extractBuyingCenter(content: unknown): string {
  if (typeof content !== 'object' || content === null) return ''
  const c = content as Record<string, unknown>
  const bc = (typeof c['buying_center'] === 'object' && c['buying_center'] !== null)
    ? (c['buying_center'] as Record<string, unknown>)
    : c
  const lines: string[] = []
  ;(['segment_1', 'segment_2', 'segment_3'] as const).forEach((key, i) => {
    const seg = bc[key] as Record<string, unknown> | undefined
    if (seg && (seg['decision_maker'] || seg['say_yes'])) {
      lines.push(`Segment ${i + 1}:`)
      if (seg['decision_maker']) lines.push(`  Decision Maker: ${String(seg['decision_maker'])}`)
      if (seg['say_yes']) lines.push(`  What Makes Them Say Yes: ${String(seg['say_yes'])}`)
    }
  })
  return lines.join('\n')
}

export function extractStepContent(sid: string, content: unknown): string {
  if (sid === '2') return extractSegments(content)
  if (sid === '3') return extractDecisionMakers(content)
  if (sid === '3.5') return extractBuyingCenter(content)
  return extractReadableContent(content)
}

export function extractDraft(raw: string): string {
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  try {
    const obj = JSON.parse(stripped) as Record<string, unknown>
    if (typeof obj['draft'] === 'string') return obj['draft']
  } catch { /* not JSON — use as-is */ }
  return stripped
}

// ── Content / prerequisite helpers ────────────────────────────────────────────

export function valuesLongerThan(obj: unknown, minChars: number): boolean {
  if (typeof obj === 'string') return obj.trim().length > minChars
  if (Array.isArray(obj)) return obj.some(v => valuesLongerThan(v, minChars))
  if (obj && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).some(v => valuesLongerThan(v, minChars))
  }
  return false
}

export function prereqIdsForStep(stepId: string): string[] {
  if (['5', '6', '7', '8', '9'].includes(stepId)) return ['4']
  if (stepId === '10') return ['4', '6', '8']
  if (stepId === '11') return ['4', '6']
  if (stepId === '12') return ['11']
  if (stepId === '13') return ['12']
  if (stepId === '14') return ['13']
  if (stepId === '15') return ['11', '13', '14']
  if (stepId === '16') return ['3', '11', '13', '14']
  if (stepId === '18') return ['4', '13', '17']
  if (stepId === '19') return ['17', '18']
  if (stepId === '20') return ['17', '19']
  if (stepId === '21') return ['3', '14', '17', '20']
  if (stepId === '22') return ['3', '17']
  if (stepId === '23') return ['2', '3']
  if (stepId === '24') return ['17', '18', '20']
  if (stepId === '25') return ['8', '17']
  if (stepId === '26') return ['14', '20', '24']
  if (stepId === '27') return ['4', '5', '6']
  if (stepId === '28') return ['11', '14']
  if (stepId === '29') return ['18']
  if (stepId === '30') return ['6', '19']
  if (['31', '32', '33', '34', '35', '36', '37', '38'].includes(stepId)) return ['27', '28', '29', '30']
  return []
}

export function buildWarningMessage(
  stepId: string,
  prereqs: Record<string, PrereqInfo>,
): string | null {
  const hasPrereq = (id: string) => {
    const p = prereqs[id]
    return !!p && (p.status === 'approved' || p.status === 'draft') && p.hasContent
  }
  if (['5', '6', '7', '8', '9'].includes(stepId)) {
    const s4 = prereqs['4']
    const hasS4 = s4 && (s4.status === 'approved' || s4.status === 'draft') && s4.hasContent
    if (!hasS4) {
      return 'This step builds on Step 4 — The Problem. Complete Step 4 first to define your pain points, then return here.'
    }
    return null
  }
  if (stepId === '10') {
    if (!hasPrereq('4') || !hasPrereq('6') || !hasPrereq('8')) {
      return 'The Formula requires: Step 4 (The Problem), Step 6 (The Effect), and Step 8 (The Solution Criteria). Formula: If you do [Solution] it will solve [Problem] thereby reducing [Effect].'
    }
    return null
  }
  if (stepId === '11') {
    if (!hasPrereq('4') || !hasPrereq('6')) {
      return 'CVPs require: Step 4 (The Problem) and Step 6 (The Effect). Formula: If you use [Product], it will solve [Problem], thereby reducing [Effect]. WARNING: If your product does not address the problems in Step 4, this is a critical point of failure.'
    }
    return null
  }
  if (stepId === '12') {
    if (!hasPrereq('11')) {
      return 'Critical Success Factors require completed CVPs from Step 11. Each CSF answers: What must we do to fulfill this CVP promise?'
    }
    return null
  }
  if (stepId === '13') {
    if (!hasPrereq('12')) {
      return 'Critical Success Formulas require completed Critical Success Factors from Step 12. Each formula is a repeatable, documented process that fulfills one CSF.'
    }
    return null
  }
  if (stepId === '14') {
    if (!hasPrereq('13')) {
      return 'Core Competencies require completed Critical Success Formulas from Step 13. Each competency is the internal capability needed to execute a formula.'
    }
    return null
  }
  if (stepId === '15') {
    if (!hasPrereq('11') || !hasPrereq('13') || !hasPrereq('14')) {
      return 'Key Selling Points require: Step 11 (CVPs), Step 13 (Critical Success Formulas), and Step 14 (Core Competencies). Formula: We will deliver [CVP] by implementing [Formula] because of our [Competency].'
    }
    return null
  }
  if (stepId === '16') {
    if (!hasPrereq('3') || !hasPrereq('11') || !hasPrereq('13') || !hasPrereq('14')) {
      return 'The Acid Test requires: Step 3 (Decision Makers), Step 11 (CVPs), Step 13 (Formulas), and Step 14 (Competencies). It tests whether your buyers would actually believe you can deliver your promises.'
    }
    return null
  }
  if (stepId === '18') {
    if (!hasPrereq('4') || !hasPrereq('13') || !hasPrereq('17')) {
      return 'Competitive Differentiators require: Step 4 (Pain Points), Step 13 (Critical Success Formulas), and Step 17 (Target Competition). For each pain point, explain how your formulas solve it differently than your Select Set competitors.'
    }
    return null
  }
  if (stepId === '19') {
    if (!hasPrereq('17') || !hasPrereq('18')) {
      return 'Competitive Advantages require: Step 17 (Target Competition) and Step 18 (Differentiators). For each Select Set competitor, explain specifically why your differentiators make you the better choice.'
    }
    return null
  }
  if (stepId === '20') {
    if (!hasPrereq('17') || !hasPrereq('19')) {
      return 'Competitive Threats require: Step 17 (Target Competition) and Step 19 (Competitive Advantages). For each competitor, identify what they do BETTER than you in specific situations.'
    }
    return null
  }
  if (stepId === '21') {
    if (!hasPrereq('3') || !hasPrereq('14') || !hasPrereq('17') || !hasPrereq('20')) {
      return 'Competitive Acid Test requires: Step 3 (Decision Makers), Step 14 (Core Competencies), Step 17 (Target Competition), Step 20 (Competitive Threats).'
    }
    return null
  }
  if (stepId === '22') {
    if (!hasPrereq('3') || !hasPrereq('17')) {
      return 'Competitive Evaluation requires: Step 3 (Decision Makers) and Step 17 (Target Competition). Pull from your DCP Map Stages 4-6 for the most accurate evaluation playbook.'
    }
    return null
  }
  if (stepId === '23') {
    if (!hasPrereq('2') || !hasPrereq('3')) {
      return 'Decision Process requires: Step 2 (Target Segments) and Step 3 (Decision Makers).'
    }
    return null
  }
  if (stepId === '24') {
    if (!hasPrereq('17') || !hasPrereq('18') || !hasPrereq('20')) {
      return 'Competitive Retaliation requires: Step 17 (Target Competition), Step 18 (Differentiators), and Step 20 (Competitive Threats). For each competitor, identify specific actions to neutralize their threats.'
    }
    return null
  }
  if (stepId === '25') {
    if (!hasPrereq('8') || !hasPrereq('17')) {
      return 'Competitive Opportunities require: Step 8 (Solution Criteria) and Step 17 (Target Competition). For each pain point, identify what buyers want that neither this company nor competitors deliver well.'
    }
    return null
  }
  if (stepId === '26') {
    if (!hasPrereq('14') || !hasPrereq('20') || !hasPrereq('24')) {
      return 'Competitive Strengths and Weaknesses require: Step 14 (Core Competencies), Step 20 (Competitive Threats), and Step 24 (Competitive Retaliation). For each competitor, assess whether the company has the competencies to execute the retaliation plan.'
    }
    return null
  }
  if (stepId === '27') {
    const missing4 = !hasPrereq('4')
    const missing5 = !hasPrereq('5')
    const missing6 = !hasPrereq('6')
    if (missing4 || missing5 || missing6) {
      return 'To complete The Set-Up, you need: Step 4 (The Problem / Pain Points), Step 5 (The Cause), and Step 6 (The Effect). The Set-Up formula is: Does your company experience [Effect] because of [Cause]?'
    }
    return null
  }
  if (stepId === '28') {
    if (!hasPrereq('11') || !hasPrereq('14')) {
      return 'The Jab formula: Our solution will [CVP - Step 11] because of our commitment to [Core Competency - Step 14]. Complete Steps 11 and 14 first.'
    }
    return null
  }
  if (stepId === '29') {
    if (!hasPrereq('18')) {
      return 'The Knock-Out formula: We are unique because of [Competitive Differentiator - Step 18]. Complete Step 18 first.'
    }
    return null
  }
  if (stepId === '30') {
    if (!hasPrereq('6') || !hasPrereq('19')) {
      return 'The Clean-Up formula: [Competitive Advantage - Step 19] will solve [Effect - Step 6] because... Complete Steps 6 and 19 first.'
    }
    return null
  }
  if (['31', '32', '33', '34', '35', '36', '37', '38'].includes(stepId)) {
    const anyApproved = ['27', '28', '29', '30'].some(id => prereqs[id]?.status === 'approved')
    if (!anyApproved) {
      return 'Complete your Strategic Messages (Steps 27-30) before building your Action Plan.'
    }
    return null
  }
  return null
}

// ── hasContent — gates the Next button per the step's editor shape ────────────

export interface HasContentInputs {
  stepId: string
  content: string
  painPoints: PainPoint[]
  activeCount: number
  outputId: string | null
  rawContent: Record<string, unknown> | null
  rawContentUpdated: boolean
}

export function hasContentForStep({
  stepId, content, painPoints, activeCount, outputId, rawContent, rawContentUpdated,
}: HasContentInputs): boolean {
  if (stepId === '4') {
    return painPoints.slice(0, activeCount).some(pp => (pp.description ?? '').trim().length > 50)
  }
  if (stepId === '2' || stepId === '3' || stepId === '3.5') {
    return outputId !== null
  }
  if (stepId === '16') {
    const r = rawContent?.['ratings']
    const savedHasContent = r !== null && typeof r === 'object' && Object.keys(r as Record<string, unknown>).length > 0
    return savedHasContent || rawContentUpdated
  }
  if (stepId === '17') {
    // CompetitorStepEditor saves either an array of competitors or { competitors: [...] }
    const raw: unknown = rawContent
    const competitors: unknown = Array.isArray(raw)
      ? raw
      : (raw && typeof raw === 'object' ? (raw as Record<string, unknown>)['competitors'] : null)
    if (!Array.isArray(competitors)) return false
    return competitors.some(c =>
      c !== null && typeof c === 'object' &&
      typeof (c as Record<string, unknown>)['name'] === 'string' &&
      ((c as Record<string, unknown>)['name'] as string).trim().length > 2,
    )
  }
  if (stepId === '22') {
    // CompetitiveEvaluationEditor saves { sections: { introduction, evaluation, … } }
    const secs = rawContent?.['sections']
    const savedHasContent = !!secs && typeof secs === 'object' && Object.values(secs as Record<string, unknown>).some(
      v => typeof v === 'string' && (v as string).trim().length > 20,
    )
    return savedHasContent || rawContentUpdated
  }
  if (stepId === '23') {
    // DecisionProcessEditor saves { segments: { segment_1: { ranking, pattern }, … } }
    const segs = rawContent?.['segments']
    const savedHasContent = !!segs && typeof segs === 'object' && Object.values(segs as Record<string, unknown>).some(entry => {
      if (!entry || typeof entry !== 'object') return false
      const pattern = (entry as Record<string, unknown>)['pattern']
      return typeof pattern === 'string' && pattern.trim().length > 20
    })
    return savedHasContent || rawContentUpdated
  }
  if (PAIN_POINT_STEPS.has(stepId)) {
    // Pain point editor saves { by_pain_point: [{ index, content }, …] }
    const bpp = rawContent?.['by_pain_point']
    const savedHasContent = Array.isArray(bpp)
      && (bpp as Array<Record<string, unknown>>).some(p =>
        typeof p['content'] === 'string' && (p['content'] as string).trim().length > 50,
      )
    return savedHasContent || rawContentUpdated
  }
  if (ASSESSMENT_STEPS.has(stepId)) {
    // AssessmentStepEditor saves { items: [{ label, description, currentState, ... }, …] }
    const it = rawContent?.['items']
    return Array.isArray(it)
      && (it as Array<Record<string, unknown>>).some(item =>
        (typeof item['label'] === 'string' && (item['label'] as string).trim().length > 0) ||
        (typeof item['description'] === 'string' && (item['description'] as string).trim().length > 0),
      )
  }
  if (stepId === '38' || ACTION_PLAN_STEPS.has(stepId)) {
    return valuesLongerThan(rawContent, 50)
  }
  return content.trim().length > 50
}
