'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2, Wand2, ShieldCheck, Sparkles, HelpCircle, AlertTriangle, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { calculateDecayedConfidence } from '@/lib/context/confidenceDecay'
import TipsPanel from '@/components/ui/TipsPanel'
import { STEP_TIPS } from '@/lib/tips'

import PainPointStepEditor from '@/components/journeys/PainPointStepEditor'
import Step14Editor from '@/components/journeys/Step14Editor'
import BlendEditor from '@/components/journeys/BlendEditor'
import ActionPlanEditor from '@/components/journeys/ActionPlanEditor'
import DealScorecard from '@/components/journeys/DealScorecard'

// ── Types ─────────────────────────────────────────────────────────────────────

type CopilotAction = 'draft' | 'verify' | 'improve' | 'explain'

interface StepDef {
  id: string
  title: string
  description: string
  section: string
}

interface CopilotOutput {
  draft: string
  confidence: number
  sources: string[]
  assumptions: string[]
  open_questions: string[]
  verification_checks: string[]
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type SaveStatus = 'idle' | 'editing' | 'saving' | 'saved' | 'error'

// Step 4 types
interface PainPoint {
  index: number
  title: string
  description: string
}

interface Step4Content {
  pain_points: PainPoint[]
  active_count: number
}

// Step 9 types
interface DcpStageSummary {
  stage_number: number
  stage_name: string
  summary: string
  confidence_score: number
}

interface Step9State {
  gateApproved: boolean
  stage: DcpStageSummary | null
  updatedAt: string
}

interface AllStep {
  id: string
  phase: number
}

// ── Step 2 types ──────────────────────────────────────────────────────────────

interface Segment {
  name: string
  industry: string
  company_size: string
  geography: string
}

const DEFAULT_SEGMENT: Segment = { name: '', industry: '', company_size: '', geography: '' }

// ── Step 3 types ──────────────────────────────────────────────────────────────

type RoleCategory =
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

type InfluenceLevel =
  | ''
  | 'Final Approver'
  | 'Economic Buyer'
  | 'Primary Buyer'
  | 'Champion'
  | 'Evaluator'
  | 'Influencer'
  | 'Gatekeeper / Blocker'

interface DecisionMaker {
  role_category: RoleCategory
  specific_title: string
  influence: InfluenceLevel
  primary_concerns: string[]
}

const ROLE_CATEGORIES: RoleCategory[] = [
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

const INFLUENCE_LEVELS: InfluenceLevel[] = [
  '',
  'Final Approver',
  'Economic Buyer',
  'Primary Buyer',
  'Champion',
  'Evaluator',
  'Influencer',
  'Gatekeeper / Blocker',
]

const CONCERN_OPTIONS: string[] = [
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

const PRIMARY_CONCERN_MAP: Partial<Record<RoleCategory, string[]>> = {
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

const DEFAULT_DM: DecisionMaker = { role_category: '', specific_title: '', influence: '', primary_concerns: [] }

function makeDMs(): DecisionMaker[] {
  return [{ ...DEFAULT_DM }, { ...DEFAULT_DM }, { ...DEFAULT_DM }, { ...DEFAULT_DM }]
}

// ── Step 3.5 types ────────────────────────────────────────────────────────────

interface BuyingCenterEntry {
  decision_maker: string
  say_yes: string
}

function makeBCEntry(): BuyingCenterEntry {
  return { decision_maker: '', say_yes: '' }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_DELAY_MS = 1200
const STEP4_AUTOSAVE_DELAY_MS = 800

const PAIN_POINT_STEPS = new Set(['5', '6', '7', '8', '9', '10', '11', '12', '13', '15', '16', '17', '18', '19', '20', '22', '23', '24', '25', '26', '27', '28', '29', '30'])
const BLEND_STEPS = new Set(['27', '28', '29', '30'])
const ACTION_PLAN_STEPS = new Set(['31', '32', '33', '34', '35', '36', '37'])
// Steps where Copilot draft is grounded in DCP buyer research, so auto-apply without
// the Proposed Draft review panel.
const AUTO_APPLY_STEPS = new Set(['4', '5', '6', '7', '8', '9', '11', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38'])

const SEG_KEYS = ['segment_1', 'segment_2', 'segment_3'] as const

const DEFAULT_PAIN_POINTS: PainPoint[] = [
  { index: 1, title: '', description: '' },
  { index: 2, title: '', description: '' },
  { index: 3, title: '', description: '' },
  { index: 4, title: '', description: '' },
]

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL_CARD: React.CSSProperties = {
  backgroundColor: '#0F2140',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  padding: '20px',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  color: 'rgba(255,255,255,0.5)',
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: '6px',
}

const FIELD_INPUT: React.CSSProperties = {
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

// ── Content quality scoring ───────────────────────────────────────────────────

function scoreSingleContent(text: string): number {
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

function calculateContentQuality(sid: string, text: string, pts: PainPoint[], activeCnt: number): number {
  if (sid === '4') {
    const active = pts.slice(0, activeCnt)
    if (active.length === 0) return 0
    const scores = active.map(pp => scoreSingleContent(`${pp.title} ${pp.description}`.trim()))
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  }
  return scoreSingleContent(text)
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number }) {
  const color = score >= 71 ? '#16A34A' : score >= 41 ? '#D97706' : '#DC2626'
  const bg = score >= 71 ? '#DCFCE7' : score >= 41 ? '#FEF3C7' : '#FEE2E2'
  const label = score >= 71 ? 'High' : score >= 41 ? 'Medium' : 'Low'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '999px',
        backgroundColor: bg,
        color,
        fontSize: '12px',
        fontWeight: 700,
      }}
    >
      {label} confidence — {score}/100
    </span>
  )
}

// ── Action button ─────────────────────────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  dark = false,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  disabled: boolean
  active: boolean
  dark?: boolean
}) {
  if (dark) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '0 14px', minHeight: '44px',
          backgroundColor: active ? 'rgba(232,82,10,0.18)' : disabled ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.06)',
          color: disabled ? 'rgba(255,255,255,0.3)' : '#FFFFFF',
          border: 'none',
          borderLeft: `3px solid ${active ? '#E8520A' : 'transparent'}`,
          borderRadius: '8px',
          fontSize: '14px', fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          width: '100%',
        }}
      >
        <Icon size={16} />
        {label}
      </button>
    )
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '0 16px',
        minHeight: '44px',
        backgroundColor: active ? '#E8520A' : disabled ? '#F3F4F6' : '#FFFFFF',
        color: active ? '#FFFFFF' : disabled ? '#9CA3AF' : '#0D0D0D',
        border: `1px solid ${active ? '#E8520A' : '#E5E7EB'}`,
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        width: '100%',
        transition: 'background-color 0.15s, color 0.15s',
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

// ── Copilot error message helper ──────────────────────────────────────────────

function copilotErrorMessage(code: number | string): string {
  const n = typeof code === 'string' ? parseInt(code, 10) : code
  if (n === 500 || n === 502 || n === 503)
    return "Anthropic's AI service is temporarily unavailable. Please wait a moment and try again. If it persists, check status.anthropic.com"
  if (n === 429) return "You've hit the rate limit. Please wait a minute before trying again."
  if (n === 408) return "The request took too long to complete. Try again or shorten your content."
  if (n > 0) return `Copilot encountered an unexpected error (code: ${n}). Please try again.`
  return 'Copilot encountered an unexpected error. Please try again.'
}

function extractReadableContent(content: unknown): string {
  if (typeof content === 'string') return content.trim()
  if (typeof content === 'object' && content !== null) {
    return Object.values(content as Record<string, unknown>)
      .filter(v => typeof v === 'string' && (v as string).trim() !== '')
      .join('\n\n')
  }
  return ''
}

function extractSegments(content: unknown): string {
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

function extractDecisionMakers(content: unknown): string {
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

function extractBuyingCenter(content: unknown): string {
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

function extractStepContent(sid: string, content: unknown): string {
  if (sid === '2') return extractSegments(content)
  if (sid === '3') return extractDecisionMakers(content)
  if (sid === '3.5') return extractBuyingCenter(content)
  return extractReadableContent(content)
}

function extractDraft(raw: string): string {
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

// ── Save indicator ────────────────────────────────────────────────────────────

function SaveIndicator({ state }: { state: SaveState | SaveStatus }) {
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

// ── Step 4 Editor ─────────────────────────────────────────────────────────────

interface Step4EditorProps {
  painPoints: PainPoint[]
  activeCount: number
  activeTab: number
  saveState: SaveState
  contentQuality: number
  onTabChange: (tab: number) => void
  onTitleChange: (tab: number, title: string) => void
  onDescriptionChange: (tab: number, description: string) => void
  onAddPainPoint: () => void
  onRemovePainPoint: () => void
  onBlur: () => void
}

function Step4Editor({
  painPoints, activeCount, activeTab, saveState, contentQuality,
  onTabChange, onTitleChange, onDescriptionChange,
  onAddPainPoint, onRemovePainPoint, onBlur,
}: Step4EditorProps) {
  const activePP = painPoints.find(pp => pp.index === activeTab) ?? painPoints[0]
  const visibleTabs = painPoints.slice(0, activeCount)
  const cqLabel = contentQuality >= 85 ? 'High' : contentQuality >= 65 ? 'Good' : contentQuality >= 30 ? 'Medium' : 'Low'
  const cqColor = contentQuality >= 85 ? '#16A34A' : contentQuality >= 65 ? '#0EA5E9' : contentQuality >= 30 ? '#D97706' : '#DC2626'

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={LABEL_STYLE}>Pain Points</label>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 700 }}>·</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: cqColor }}>Quality: {contentQuality} · {cqLabel}</span>
          <div style={{ width: '40px', height: '3px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${contentQuality}%`, height: '100%', backgroundColor: cqColor, borderRadius: '2px' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <SaveIndicator state={saveState} />
          {activeCount < 4 && (
            <button
              onClick={onAddPainPoint}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 12px', minHeight: '32px',
                backgroundColor: '#0EA5E9', color: '#FFFFFF',
                border: 'none', borderRadius: '6px',
                fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              Add Pain Point
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {visibleTabs.map(pp => (
          <button
            key={pp.index}
            onClick={() => onTabChange(pp.index)}
            style={{
              padding: '6px 16px', minHeight: '36px',
              backgroundColor: activeTab === pp.index ? '#E8520A' : 'rgba(255,255,255,0.06)',
              color: activeTab === pp.index ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${activeTab === pp.index ? '#E8520A' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '6px',
              fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            Pain Point {pp.index}
          </button>
        ))}
      </div>

      {/* Title input */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ ...LABEL_STYLE, display: 'block' }}>Title</label>
        <input
          type="text"
          value={activePP?.title ?? ''}
          onChange={e => onTitleChange(activeTab, e.target.value)}
          onBlur={onBlur}
          placeholder="e.g. Poor pipeline visibility"
          style={{
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
          }}
        />
      </div>

      {/* Description textarea */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ ...LABEL_STYLE, display: 'block' }}>Description</label>
        <textarea
          value={activePP?.description ?? ''}
          onChange={e => onDescriptionChange(activeTab, e.target.value)}
          onBlur={onBlur}
          placeholder="Describe the pain point in 2–4 sentences. What does the buyer experience? What are the consequences?"
          rows={5}
          style={{
            width: '100%',
            padding: '12px 14px',
            border: '1px solid #9CA3AF',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.65',
            color: '#0D0D0D',
            backgroundColor: '#FFFFFF',
            resize: 'vertical',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
      </div>

      {/* Remove button — only shown on the highest tab when more than 1 pain point */}
      {activeCount > 1 && activeTab === activeCount && (
        <button
          onClick={onRemovePainPoint}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '4px 12px', minHeight: '32px',
            backgroundColor: 'transparent', color: '#DC2626',
            border: '1px solid #FCA5A5', borderRadius: '6px',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          <X size={12} />
          Remove Pain Point {activeTab}
        </button>
      )}
    </div>
  )
}

// ── Step 9 display ────────────────────────────────────────────────────────────

function Step9Display({ gateApproved, stage, updatedAt }: Step9State) {
  if (!gateApproved) {
    return (
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#FEF3C7',
        border: '1px solid #FCD34D',
        borderRadius: '10px',
        display: 'flex',
        gap: '12px',
        alignItems: 'flex-start',
      }}>
        <AlertTriangle size={18} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#92400E', margin: '0 0 2px' }}>
            Gate 1 has not been approved yet
          </p>
          <p style={{ fontSize: '12px', color: '#78350F', margin: 0 }}>
            Complete the Intelligence section first to unlock this step.
          </p>
        </div>
      </div>
    )
  }

  if (!stage) {
    return (
      <div style={{
        ...PANEL_CARD,
        color: 'rgba(255,255,255,0.5)',
        fontSize: '14px',
      }}>
        No Stage 3 data found in your DCP analysis.
      </div>
    )
  }

  const score = stage.confidence_score
  const badgeColor = score >= 70 ? '#15803D' : score >= 40 ? '#92400E' : '#991B1B'
  const badgeBg   = score >= 70 ? '#DCFCE7' : score >= 40 ? '#FEF3C7' : '#FEE2E2'
  const badgeLabel = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low'

  const formattedDate = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px' }}>
      {/* Stage header card */}
      <div style={PANEL_CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#FFFFFF', margin: 0 }}>
            Stage {stage.stage_number} — {stage.stage_name}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '3px 10px', borderRadius: '999px',
              backgroundColor: badgeBg, color: badgeColor,
              fontSize: '12px', fontWeight: 700,
            }}>
              {badgeLabel} confidence — {score}/100
            </span>
            {formattedDate && (
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                Updated {formattedDate}
              </span>
            )}
          </div>
        </div>

        <p style={{
          fontSize: '14px',
          lineHeight: '1.7',
          color: 'rgba(255,255,255,0.8)',
          margin: 0,
          whiteSpace: 'pre-wrap',
        }}>
          {stage.summary}
        </p>
      </div>

      {/* Read-only notice */}
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
        This data is pulled from your approved DCP analysis. To update it, re-run the analysis in the Intelligence section.
      </p>
    </div>
  )
}

// ── Step nav bar ──────────────────────────────────────────────────────────────

function StepNavBar({ stepId, total, prevId, nextId, hasContent }: {
  stepId: string
  total: number
  prevId: string | null
  nextId: string | null
  hasContent: boolean
}) {
  if (total === 0) return null
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      backgroundColor: '#0F2140',
      height: '64px',
      flexShrink: 0,
    }}>
      <div style={{ minWidth: '140px' }}>
        {prevId ? (
          <Link
            href={`/dashboard/journeys/step/${prevId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '44px',
              padding: '0 16px',
              backgroundColor: 'transparent',
              color: '#0EA5E9',
              border: '1px solid #0EA5E9',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ← Previous
          </Link>
        ) : <span />}
      </div>
      <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
        {stepId ? `Step ${stepId} of ${total}` : `${total} steps`}
      </span>
      <div style={{ minWidth: '140px', display: 'flex', justifyContent: 'flex-end' }}>
        {nextId ? (
          hasContent ? (
            <Link
              href={`/dashboard/journeys/step/${nextId}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '44px',
                padding: '0 16px',
                backgroundColor: '#E8520A',
                color: '#FFFFFF',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Next →
            </Link>
          ) : (
            <button
              disabled
              title="Complete this step before continuing"
              aria-label="Complete this step before continuing"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '44px',
                padding: '0 16px',
                backgroundColor: '#6B7280',
                color: 'rgba(255,255,255,0.6)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'not-allowed',
                fontFamily: 'inherit',
              }}
            >
              Next →
            </button>
          )
        ) : <span />}
      </div>
    </div>
  )
}

// ── Content / prerequisite helpers ────────────────────────────────────────────

function valuesLongerThan(obj: unknown, minChars: number): boolean {
  if (typeof obj === 'string') return obj.trim().length > minChars
  if (Array.isArray(obj)) return obj.some(v => valuesLongerThan(v, minChars))
  if (obj && typeof obj === 'object') {
    return Object.values(obj as Record<string, unknown>).some(v => valuesLongerThan(v, minChars))
  }
  return false
}

interface PrereqInfo { status: string; hasContent: boolean }

function prereqIdsForStep(stepId: string): string[] {
  if (['5', '6', '7', '8', '9'].includes(stepId)) return ['4']
  if (stepId === '10') return ['4', '6', '8']
  if (stepId === '11') return ['4', '6']
  if (stepId === '27') return ['4', '5', '6']
  if (stepId === '28') return ['11', '14']
  if (stepId === '29') return ['18']
  if (stepId === '30') return ['6', '19']
  if (['31', '32', '33', '34', '35', '36', '37', '38'].includes(stepId)) return ['27', '28', '29', '30']
  return []
}

function buildWarningMessage(
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

// ── Step 2 Editor — Target Market Segments ────────────────────────────────────

interface Step2EditorProps {
  segments: Segment[]
  saveStatus: SaveStatus
  onChange: (idx: number, field: keyof Segment, value: string) => void
  onBlur: () => void
}

const DROPDOWN_STYLE: React.CSSProperties = {
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

function Step2Editor({ segments, saveStatus, onChange, onBlur }: Step2EditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <label style={LABEL_STYLE}>Target Market Segments</label>
        <SaveIndicator state={saveStatus} />
      </div>
      {segments.map((seg, i) => (
        <div key={i} style={PANEL_CARD}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: '#E8520A',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {i + 1}
            </span>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>Segment {i + 1}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ ...LABEL_STYLE, display: 'block' }}>Segment Name</label>
              <input
                type="text"
                value={seg.name}
                onChange={e => onChange(i, 'name', e.target.value)}
                onBlur={onBlur}
                placeholder="e.g. Mid-Market SaaS Companies"
                style={FIELD_INPUT}
              />
            </div>
            <div>
              <label style={{ ...LABEL_STYLE, display: 'block' }}>Industry</label>
              <select
                value={seg.industry}
                onChange={e => onChange(i, 'industry', e.target.value)}
                onBlur={onBlur}
                style={DROPDOWN_STYLE}
              >
                <option value="">Select an industry</option>
                <option value="Enterprise Technology & SaaS">Enterprise Technology &amp; SaaS</option>
                <option value="Healthcare & Life Sciences">Healthcare &amp; Life Sciences</option>
                <option value="Professional Services">Professional Services</option>
                <option value="Financial Services & Fintech">Financial Services &amp; Fintech</option>
                <option value="Non-Profit & Fundraising">Non-Profit &amp; Fundraising</option>
                <option value="Manufacturing & Industrial">Manufacturing &amp; Industrial</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label style={{ ...LABEL_STYLE, display: 'block' }}>Company Size</label>
              <select
                value={seg.company_size}
                onChange={e => onChange(i, 'company_size', e.target.value)}
                onBlur={onBlur}
                style={DROPDOWN_STYLE}
              >
                <option value="">Select company size</option>
                <option value="1-10 employees">1-10 employees</option>
                <option value="11-50 employees">11-50 employees</option>
                <option value="51-200 employees">51-200 employees</option>
                <option value="201-500 employees">201-500 employees</option>
                <option value="501-1,000 employees">501-1,000 employees</option>
                <option value="1,000+ employees">1,000+ employees</option>
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ ...LABEL_STYLE, display: 'block' }}>Geography</label>
              <select
                value={seg.geography}
                onChange={e => onChange(i, 'geography', e.target.value)}
                onBlur={onBlur}
                style={DROPDOWN_STYLE}
              >
                <option value="">Select geography</option>
                <option value="Local (single city/region)">Local (single city/region)</option>
                <option value="Regional (multi-state)">Regional (multi-state)</option>
                <option value="National (US)">National (US)</option>
                <option value="North America">North America</option>
                <option value="Global">Global</option>
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Step 3 Editor — Key Decision Makers Per Segment ───────────────────────────

interface Step3EditorProps {
  segmentNames: string[]
  dms: Record<string, DecisionMaker[]>
  activeTab: number
  saveStatus: SaveStatus
  onTabChange: (tab: number) => void
  onChange: (segKey: string, dmIdx: number, field: Exclude<keyof DecisionMaker, 'primary_concerns'>, value: string) => void
  onConcernToggle: (segKey: string, dmIdx: number, concern: string) => void
  onAddCustomConcern: (segKey: string, dmIdx: number, customText: string) => void
  onBlur: () => void
}

function Step3Editor({ segmentNames, dms, activeTab, saveStatus, onTabChange, onChange, onConcernToggle, onAddCustomConcern, onBlur }: Step3EditorProps) {
  const [customInputs, setCustomInputs] = useState<Record<number, string>>({})
  const activeKey = SEG_KEYS[activeTab]
  const activeDMs = dms[activeKey] ?? makeDMs()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <label style={LABEL_STYLE}>Key Decision Makers</label>
        <SaveIndicator state={saveStatus} />
      </div>

      {/* Segment tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {SEG_KEYS.map((key, i) => (
          <button
            key={key}
            onClick={() => onTabChange(i)}
            style={{
              padding: '6px 16px', minHeight: '36px',
              backgroundColor: activeTab === i ? '#E8520A' : 'rgba(255,255,255,0.06)',
              color: activeTab === i ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${activeTab === i ? '#E8520A' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '6px',
              fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {segmentNames[i] || `Segment ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Decision maker rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {activeDMs.map((dm, dmIdx) => (
          <div key={dmIdx} style={PANEL_CARD}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '14px',
              paddingBottom: '10px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'rgba(232,82,10,0.2)',
                color: '#E8520A',
                fontSize: '12px',
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {dmIdx + 1}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
                Decision Maker {dmIdx + 1}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ ...LABEL_STYLE, display: 'block' }}>Role / Title</label>
                <select
                  value={dm.role_category}
                  onChange={e => onChange(activeKey, dmIdx, 'role_category', e.target.value)}
                  onBlur={onBlur}
                  style={{ ...FIELD_INPUT, cursor: 'pointer' }}
                >
                  {ROLE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat} style={{ backgroundColor: '#0F2140' }}>
                      {cat === '' ? 'Select a title' : cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ ...LABEL_STYLE, display: 'block' }}>Specific Title</label>
                <input
                  type="text"
                  value={dm.specific_title}
                  onChange={e => onChange(activeKey, dmIdx, 'specific_title', e.target.value)}
                  onBlur={onBlur}
                  placeholder="e.g. VP of Sales"
                  style={{ ...FIELD_INPUT, color: '#0D0D0D', backgroundColor: '#FFFFFF' }}
                />
              </div>
              <div>
                <label style={{ ...LABEL_STYLE, display: 'block' }}>Influence Level</label>
                <select
                  value={dm.influence}
                  onChange={e => onChange(activeKey, dmIdx, 'influence', e.target.value)}
                  onBlur={onBlur}
                  style={{ ...FIELD_INPUT, cursor: 'pointer' }}
                >
                  {INFLUENCE_LEVELS.map(lvl => (
                    <option key={lvl} value={lvl} style={{ backgroundColor: '#0F2140' }}>
                      {lvl === '' ? 'Select influence level' : lvl}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ ...LABEL_STYLE, display: 'block' }}>Primary Concerns</label>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                  {dm.primary_concerns.length} of 3 selected
                </span>
              </div>

              {/* Layer 1: Selected pills (orange) — click to deselect */}
              {dm.primary_concerns.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {dm.primary_concerns.map(concern => (
                    <button
                      key={concern}
                      type="button"
                      onClick={() => { onConcernToggle(activeKey, dmIdx, concern); onBlur() }}
                      title="Click to deselect"
                      style={{
                        padding: '4px 10px',
                        minHeight: '28px',
                        borderRadius: '14px',
                        border: '1px solid #E8520A',
                        backgroundColor: '#E8520A',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'opacity 0.15s',
                      }}
                    >
                      {concern}
                      <span style={{ fontSize: '10px', opacity: 0.75 }}>✕</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Layer 2: Additional concern pills (grey) — filtered by role */}
              {(() => {
                const roleConcerns = PRIMARY_CONCERN_MAP[dm.role_category as RoleCategory] ?? []
                const layer2Concerns = CONCERN_OPTIONS.filter(c =>
                  !dm.primary_concerns.includes(c) &&
                  (dm.role_category === '' || !roleConcerns.includes(c))
                )
                const layer2Label = dm.role_category !== ''
                  ? `Suggested for ${dm.role_category}`
                  : 'All concerns'
                return (
                  <>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }}>
                      {layer2Label}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                      {layer2Concerns.map(concern => {
                        const atLimit = dm.primary_concerns.length >= 3
                        return (
                          <button
                            key={concern}
                            type="button"
                            onClick={() => { if (!atLimit) { onConcernToggle(activeKey, dmIdx, concern); onBlur() } }}
                            disabled={atLimit}
                            style={{
                              padding: '4px 10px',
                              minHeight: '28px',
                              borderRadius: '14px',
                              border: '1px solid rgba(255,255,255,0.2)',
                              backgroundColor: '#0A1628',
                              color: 'rgba(255,255,255,0.65)',
                              fontSize: '12px',
                              fontWeight: 400,
                              cursor: atLimit ? 'not-allowed' : 'pointer',
                              opacity: atLimit ? 0.4 : 1,
                              transition: 'background-color 0.15s, border-color 0.15s',
                            }}
                          >
                            {concern}
                          </button>
                        )
                      })}
                    </div>
                  </>
                )
              })()}

              {/* Layer 3: Custom concern input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="text"
                  value={customInputs[dmIdx] ?? ''}
                  onChange={e => setCustomInputs(prev => ({ ...prev, [dmIdx]: e.target.value }))}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const val = (customInputs[dmIdx] ?? '').trim()
                      if (val && dm.primary_concerns.length < 3 && !dm.primary_concerns.includes(val)) {
                        onAddCustomConcern(activeKey, dmIdx, val)
                        setCustomInputs(prev => ({ ...prev, [dmIdx]: '' }))
                        onBlur()
                      }
                    }
                  }}
                  placeholder="Add your own concern..."
                  style={{ ...FIELD_INPUT, color: '#0D0D0D', backgroundColor: '#FFFFFF', flex: 1, fontSize: '12px', padding: '4px 10px', minHeight: '32px' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const val = (customInputs[dmIdx] ?? '').trim()
                    if (val && dm.primary_concerns.length < 3 && !dm.primary_concerns.includes(val)) {
                      onAddCustomConcern(activeKey, dmIdx, val)
                      setCustomInputs(prev => ({ ...prev, [dmIdx]: '' }))
                      onBlur()
                    }
                  }}
                  disabled={dm.primary_concerns.length >= 3 || !(customInputs[dmIdx] ?? '').trim()}
                  style={{
                    padding: '4px 14px',
                    minHeight: '32px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    backgroundColor: (dm.primary_concerns.length >= 3 || !(customInputs[dmIdx] ?? '').trim()) ? '#0A1628' : 'rgba(232,82,10,0.15)',
                    color: (dm.primary_concerns.length >= 3 || !(customInputs[dmIdx] ?? '').trim()) ? 'rgba(255,255,255,0.3)' : '#E8520A',
                    fontSize: '18px',
                    fontWeight: 700,
                    cursor: (dm.primary_concerns.length >= 3 || !(customInputs[dmIdx] ?? '').trim()) ? 'not-allowed' : 'pointer',
                    lineHeight: 1,
                    transition: 'background-color 0.15s, color 0.15s',
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 3.5 Editor — The Yes Criteria ────────────────────────────────────────

interface Step35EditorProps {
  segmentNames: string[]
  buyingCenter: Record<string, BuyingCenterEntry>
  activeTab: number
  saveStatus: SaveStatus
  onTabChange: (tab: number) => void
  onChange: (segKey: string, field: keyof BuyingCenterEntry, value: string) => void
  onBlur: () => void
}

function Step35Editor({ segmentNames, buyingCenter, activeTab, saveStatus, onTabChange, onChange, onBlur }: Step35EditorProps) {
  const activeKey = SEG_KEYS[activeTab]
  const activeEntry = buyingCenter[activeKey] ?? makeBCEntry()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <label style={LABEL_STYLE}>The Yes Criteria</label>
        <SaveIndicator state={saveStatus} />
      </div>

      {/* Segment tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {SEG_KEYS.map((key, i) => (
          <button
            key={key}
            onClick={() => onTabChange(i)}
            style={{
              padding: '6px 16px', minHeight: '36px',
              backgroundColor: activeTab === i ? '#E8520A' : 'rgba(255,255,255,0.06)',
              color: activeTab === i ? '#FFFFFF' : 'rgba(255,255,255,0.7)',
              border: `1px solid ${activeTab === i ? '#E8520A' : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '6px',
              fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {segmentNames[i] || `Segment ${i + 1}`}
          </button>
        ))}
      </div>

      {/* Single question card */}
      <div style={PANEL_CARD}>
        <p style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF', margin: '0 0 20px' }}>
          Who is the ultimate decision maker and what will make them say yes?
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ ...LABEL_STYLE, display: 'block' }}>Ultimate Decision Maker</label>
            <input
              type="text"
              value={activeEntry.decision_maker}
              onChange={e => onChange(activeKey, 'decision_maker', e.target.value)}
              onBlur={onBlur}
              placeholder="e.g. CEO / Board of Directors"
              style={FIELD_INPUT}
            />
          </div>
          <div>
            <label style={{ ...LABEL_STYLE, display: 'block' }}>What Makes Them Say Yes</label>
            <textarea
              value={activeEntry.say_yes}
              onChange={e => onChange(activeKey, 'say_yes', e.target.value)}
              onBlur={onBlur}
              placeholder="e.g. Clear ROI within 90 days, peer validation from similar companies, low implementation risk"
              rows={4}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #9CA3AF',
                borderRadius: '8px',
                fontSize: '14px',
                lineHeight: '1.65',
                color: '#0D0D0D',
                backgroundColor: '#FFFFFF',
                resize: 'vertical',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StepPage() {
  const { stepId } = useParams<{ stepId: string }>()

  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [preferredModel, setPreferredModel] = useState('claude-sonnet-4-5')
  const [stepDef, setStepDef] = useState<StepDef | null>(null)
  const [content, setContent] = useState('')
  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [loading, setLoading] = useState(true)

  // Step 9 state
  const [step9Data, setStep9Data] = useState<Step9State | null>(null)

  // Steps 4-9: DCP research availability banner
  const [hasDcpAnalysis, setHasDcpAnalysis] = useState(false)

  // Raw loaded content (used for hasContent checks on pain-point and other steps)
  const [rawContent, setRawContent] = useState<Record<string, unknown> | null>(null)

  // Prerequisite step statuses for soft dependency warnings
  const [prereqContent, setPrereqContent] = useState<Record<string, PrereqInfo>>({})

  // Per-step dismissed warning banner state (localStorage backed)
  const [warningDismissed, setWarningDismissed] = useState(false)

  const [allSteps, setAllSteps] = useState<AllStep[]>([])
  const [decayedConfidence, setDecayedConfidence] = useState<number | null>(null)

  // Step 4 state
  const [painPoints, setPainPoints] = useState<PainPoint[]>(DEFAULT_PAIN_POINTS)
  const [activeCount, setActiveCount] = useState(3)
  const [activeTab, setActiveTab] = useState(1)
  const [draftApplied, setDraftApplied] = useState(false)
  const [showAppliedFlash, setShowAppliedFlash] = useState(false)

  // Step 2 state
  const [step2Segments, setStep2Segments] = useState<Segment[]>([
    { ...DEFAULT_SEGMENT },
    { ...DEFAULT_SEGMENT },
    { ...DEFAULT_SEGMENT },
  ])

  // Step 3 state
  const [step3DMs, setStep3DMs] = useState<Record<string, DecisionMaker[]>>({
    segment_1: makeDMs(),
    segment_2: makeDMs(),
    segment_3: makeDMs(),
  })
  const [step3ActiveTab, setStep3ActiveTab] = useState(0)

  // Step 3.5 state
  const [step35BC, setStep35BC] = useState<Record<string, BuyingCenterEntry>>({
    segment_1: makeBCEntry(),
    segment_2: makeBCEntry(),
    segment_3: makeBCEntry(),
  })
  const [step35ActiveTab, setStep35ActiveTab] = useState(0)

  // Segment names loaded from Step 2 content for display in Steps 3 and 3.5
  const [segmentNames, setSegmentNames] = useState<string[]>(['Segment 1', 'Segment 2', 'Segment 3'])

  // Multi-segment pill — shown on all steps when workspace has >1 segment
  const [primarySegmentName, setPrimarySegmentName] = useState<string | null>(null)
  const [hasMultipleSegments, setHasMultipleSegments] = useState(false)

  const [copilotStreaming, setCopilotStreaming] = useState(false)
  const [activeAction, setActiveAction] = useState<CopilotAction | null>(null)
  const [streamBuffer, setStreamBuffer] = useState('')
  const [copilotOutput, setCopilotOutput] = useState<CopilotOutput | null>(null)
  const [copilotError, setCopilotError] = useState<string | null>(null)
  const [isProvisional, setIsProvisional] = useState(false)
  const [missingPrereqs, setMissingPrereqs] = useState<string[]>([])

  // saveRef always closes over latest state so the debounced save is current
  const saveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const step4SaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const step4SaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const step2SaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const step2SaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const step3SaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const step3SaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const step35SaveRef = useRef<() => Promise<void>>(() => Promise.resolve())
  const step35SaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const preApplyContentRef = useRef<string>('')
  const preApplyPainPointsRef = useRef<PainPoint[]>([])
  const originalContentRef = useRef<string>('')

  // ── Data load ───────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userRow } = await supabase
          .from('users')
          .select('org_id')
          .eq('id', user.id)
          .single()
        if (!userRow) return

        const wsId = (userRow as Record<string, unknown>)['org_id'] as string
        setWorkspaceId(wsId)

        // Load workspace preferred model
        const { data: org } = await supabase
          .from('organizations')
          .select('preferred_model')
          .eq('id', wsId)
          .single()
        if (org) {
          const orgRow = org as Record<string, unknown>
          setPreferredModel(String(orgRow['preferred_model'] ?? 'claude-sonnet-4-5'))
        }

        // Load step definition — may not exist yet
        const { data: stepRow } = await supabase
          .from('step_definition')
          .select('id, title, description, section')
          .eq('id', stepId)
          .single()
        if (stepRow) {
          const r = stepRow as Record<string, unknown>
          setStepDef({
            id: String(r['id'] ?? stepId),
            title: String(r['title'] ?? `Step ${stepId}`),
            description: String(r['description'] ?? ''),
            section: String(r['section'] ?? ''),
          })
        }

        // Load latest step_output for this step + workspace
        const { data: outputRows } = await supabase
          .from('step_output')
          .select('id, content, version, status, original_confidence, last_reviewed_at, created_at')
          .eq('workspace_id', wsId)
          .eq('step_id', stepId)
          .order('version', { ascending: false })
          .limit(1)

        if (outputRows && outputRows.length > 0) {
          const row = outputRows[0] as Record<string, unknown>
          setOutputId(String(row['id'] ?? ''))
          setOutputVersion(Number(row['version'] ?? 1))
          const c = row['content'] as Record<string, unknown> | null
          setRawContent(c ?? null)

          if (stepId === '4') {
            // Parse Step 4 pain point content
            const pts = c?.['pain_points']
            if (Array.isArray(pts)) {
              const parsed: PainPoint[] = (pts as Array<Record<string, unknown>>).map(pp => ({
                index: Number(pp['index'] ?? 0),
                title: String(pp['title'] ?? ''),
                description: String(pp['description'] ?? ''),
              }))
              const merged: PainPoint[] = DEFAULT_PAIN_POINTS.map(def => {
                const saved = parsed.find(p => p.index === def.index)
                return saved ?? def
              })
              setPainPoints(merged)
              setActiveCount(Math.max(1, Math.min(4, Number(c?.['active_count'] ?? parsed.length))))
            }
          } else if (stepId === '2') {
            const segs = c?.['segments']
            if (Array.isArray(segs)) {
              const parsed = (segs as Array<Record<string, unknown>>).map(s => ({
                name: String(s['name'] ?? ''),
                industry: String(s['industry'] ?? ''),
                company_size: String(s['company_size'] ?? ''),
                geography: String(s['geography'] ?? ''),
              }))
              setStep2Segments([0, 1, 2].map(i => parsed[i] ?? { ...DEFAULT_SEGMENT }))
            }
            setSaveStatus('saved')
          } else if (stepId === '3') {
            const dmsRaw = c?.['decision_makers'] as Record<string, unknown> | undefined
            if (dmsRaw) {
              const loaded: Record<string, DecisionMaker[]> = {
                segment_1: makeDMs(), segment_2: makeDMs(), segment_3: makeDMs(),
              }
              ;(['segment_1', 'segment_2', 'segment_3'] as const).forEach(key => {
                const arr = dmsRaw[key]
                if (Array.isArray(arr)) {
                  const parsed = (arr as Array<Record<string, unknown>>).map(dm => ({
                    role_category: (dm['role_category'] ?? '') as RoleCategory,
                    specific_title: String(dm['specific_title'] ?? dm['title'] ?? ''),
                    influence: (dm['influence'] ?? '') as InfluenceLevel,
                    primary_concerns: Array.isArray(dm['primary_concerns'])
                      ? (dm['primary_concerns'] as string[])
                      : dm['primary_concern']
                        ? [String(dm['primary_concern'])]
                        : [],
                  }))
                  loaded[key] = [0, 1, 2, 3].map(i => parsed[i] ?? { ...DEFAULT_DM })
                }
              })
              setStep3DMs(loaded)
            }
            setSaveStatus('saved')
          } else if (stepId === '3.5') {
            const bcRaw = c?.['buying_center'] as Record<string, unknown> | undefined
            if (bcRaw) {
              const loaded: Record<string, BuyingCenterEntry> = {
                segment_1: makeBCEntry(), segment_2: makeBCEntry(), segment_3: makeBCEntry(),
              }
              ;(['segment_1', 'segment_2', 'segment_3'] as const).forEach(key => {
                const seg = bcRaw[key] as Record<string, unknown> | undefined
                if (seg) {
                  loaded[key] = {
                    decision_maker: String(seg['decision_maker'] ?? ''),
                    say_yes: String(seg['say_yes'] ?? ''),
                  }
                }
              })
              setStep35BC(loaded)
            }
            setSaveStatus('saved')
          } else if (stepId === '1') {
            setContent(extractStepContent(stepId, c))
          } else {
            setContent(typeof c?.['text'] === 'string' ? c['text'] : JSON.stringify(c ?? '', null, 2))
          }

          // Compute confidence decay
          const decayInput = {
            status: String(row['status'] ?? 'draft'),
            original_confidence: typeof row['original_confidence'] === 'number' ? row['original_confidence'] : null,
            last_reviewed_at: typeof row['last_reviewed_at'] === 'string' ? row['last_reviewed_at'] : null,
            created_at: String(row['created_at'] ?? new Date().toISOString()),
          }
          const decayed = calculateDecayedConfidence(decayInput)
          setDecayedConfidence(decayed)

          // Log to confidence_decay_log only when decay was applied
          if (decayed !== null && decayed !== decayInput.original_confidence) {
            const refDate = decayInput.last_reviewed_at ?? decayInput.created_at
            const decayDays = Math.max(0, Math.floor(
              (Date.now() - Date.parse(refDate)) / (1000 * 60 * 60 * 24),
            ))
            try {
              await supabase.from('confidence_decay_log').insert({
                workspace_id: wsId,
                step_id: stepId,
                original_confidence: decayInput.original_confidence,
                decayed_confidence: decayed,
                decay_days: decayDays,
                logged_at: new Date().toISOString(),
              })
            } catch { /* non-fatal — logging must never break the UI */ }
          }
        }

        // Load Step 2 segment names — always needed for multi-segment pill; also for Steps 3/3.5 editor tabs
        {
          const { data: s2Rows } = await supabase
            .from('step_output')
            .select('content')
            .eq('workspace_id', wsId)
            .eq('step_id', '2')
            .order('version', { ascending: false })
            .limit(1)
          if (s2Rows && s2Rows.length > 0) {
            const s2c = (s2Rows[0] as Record<string, unknown>)['content'] as Record<string, unknown>
            if (Array.isArray(s2c?.['segments'])) {
              const allNames = (s2c['segments'] as Array<Record<string, unknown>>)
                .slice(0, 3)
                .map((s, i) => String(s['name'] ?? '').trim() || `Segment ${i + 1}`)
              if (stepId === '3' || stepId === '3.5') {
                setSegmentNames(allNames)
              }
              const namedCount = (s2c['segments'] as Array<Record<string, unknown>>)
                .filter(s => typeof s['name'] === 'string' && (s['name'] as string).trim())
                .length
              if (namedCount > 1) {
                setHasMultipleSegments(true)
                setPrimarySegmentName(allNames[0] || null)
              }
            }
          }
        }

        // Steps 4-9 — check whether any DCP analysis row exists for the workspace
        if (['4', '5', '6', '7', '8', '9'].includes(stepId)) {
          const { data: dcpExistsRow } = await supabase
            .from('dcp_analysis')
            .select('id')
            .eq('org_id', wsId)
            .maybeSingle()
          setHasDcpAnalysis(Boolean(dcpExistsRow))
        }

        // Step 9 — load approved DCP analysis, Stage 3
        if (stepId === '9') {
          const { data: dcpRow } = await supabase
            .from('dcp_analysis')
            .select('stage_summaries, updated_at')
            .eq('org_id', wsId)
            .eq('status', 'approved')
            .maybeSingle()

          if (!dcpRow) {
            setStep9Data({ gateApproved: false, stage: null, updatedAt: '' })
          } else {
            const r = dcpRow as Record<string, unknown>
            const summaries = r['stage_summaries']
            let stage: DcpStageSummary | null = null
            if (Array.isArray(summaries)) {
              const raw = (summaries as Array<Record<string, unknown>>).find(
                s => Number(s['stage_number']) === 3,
              )
              if (raw) {
                stage = {
                  stage_number: 3,
                  stage_name: String(raw['stage_name'] ?? ''),
                  summary: String(raw['summary'] ?? ''),
                  confidence_score: Number(raw['confidence_score'] ?? 0),
                }
              }
            }
            setStep9Data({ gateApproved: true, stage, updatedAt: String(r['updated_at'] ?? '') })
          }
        }

        // Load prerequisite step statuses for soft dependency warnings
        const prereqIds = prereqIdsForStep(stepId)
        if (prereqIds.length > 0) {
          const { data: prereqRows } = await supabase
            .from('step_output')
            .select('step_id, status, content, version')
            .eq('workspace_id', wsId)
            .in('step_id', prereqIds)
            .order('version', { ascending: false })

          const prereqMap: Record<string, PrereqInfo> = {}
          if (prereqRows) {
            for (const r of prereqRows as Array<Record<string, unknown>>) {
              const sid = String(r['step_id'] ?? '')
              if (!sid || prereqMap[sid]) continue
              prereqMap[sid] = {
                status: String(r['status'] ?? 'draft'),
                hasContent: valuesLongerThan(r['content'], 0),
              }
            }
          }
          setPrereqContent(prereqMap)
        }

        // Load all steps for prev/next navigation
        const { data: allStepRows } = await supabase
          .from('step_definition')
          .select('id, phase')
          .order('phase', { ascending: true })
        if (allStepRows) {
          const steps = (allStepRows as Array<Record<string, unknown>>).map(r => ({
            id: String(r['id'] ?? ''),
            phase: Number(r['phase'] ?? 0),
          }))
          steps.sort((a, b) => a.phase - b.phase || parseFloat(a.id) - parseFloat(b.id))
          setAllSteps(steps)
        }
      } catch {
        // non-fatal
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [stepId])

  useEffect(() => {
    if (!workspaceId) return
    setDraftApplied(localStorage.getItem(`copilot_applied_${workspaceId}_${stepId}`) === '1')
  }, [workspaceId, stepId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setWarningDismissed(localStorage.getItem(`step_warning_dismissed_${stepId}`) === '1')
  }, [stepId])

  const dismissWarning = useCallback(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(`step_warning_dismissed_${stepId}`, '1')
    setWarningDismissed(true)
  }, [stepId])

  useEffect(() => {
    if (workspaceId) {
      localStorage.removeItem(`copilot_applied_${workspaceId}_${stepId}`)
    }
    setDraftApplied(false)
  }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save (generic steps) ───────────────────────────────────────────────

  const persistContent = useCallback(async (text: string, wsId: string) => {
    setSaveState('saving')
    try {
      const contentPayload = { text }
      const now = new Date().toISOString()

      if (outputId) {
        const { error } = await supabase
          .from('step_output')
          .update({ content: contentPayload, last_saved_at: now, last_updated_at: now })
          .eq('id', outputId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('step_output')
          .insert({
            workspace_id: wsId,
            step_id: stepId,
            version: outputVersion,
            status: 'draft',
            content: contentPayload,
            copilot_assisted: false,
            last_saved_at: now,
            last_updated_at: now,
          })
          .select('id')
          .single()
        if (error) throw error
        if (data) setOutputId((data as Record<string, unknown>)['id'] as string)
      }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
  }, [outputId, outputVersion, stepId])

  // Keep saveRef current each render
  saveRef.current = async () => {
    if (workspaceId) await persistContent(content, workspaceId)
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { void saveRef.current() }, AUTOSAVE_DELAY_MS)
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value)
    scheduleSave()
  }

  function handleBlur() {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    void saveRef.current()
  }

  // ── Auto-save (Step 4) ──────────────────────────────────────────────────────

  const persistStep4Content = useCallback(async (points: PainPoint[], count: number, wsId: string) => {
    setSaveState('saving')
    try {
      const contentPayload: Step4Content = { pain_points: points, active_count: count }
      const now = new Date().toISOString()

      if (outputId) {
        const { error } = await supabase
          .from('step_output')
          .update({ content: contentPayload, last_saved_at: now, last_updated_at: now })
          .eq('id', outputId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('step_output')
          .insert({
            workspace_id: wsId,
            step_id: stepId,
            version: outputVersion,
            status: 'draft',
            content: contentPayload,
            copilot_assisted: false,
            last_saved_at: now,
            last_updated_at: now,
          })
          .select('id')
          .single()
        if (error) throw error
        if (data) setOutputId((data as Record<string, unknown>)['id'] as string)
      }
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
  }, [outputId, outputVersion, stepId])

  // ── Auto-save (Step 2) ──────────────────────────────────────────────────────

  const persistStep2Content = useCallback(async (segs: Segment[], wsId: string) => {
    setSaveStatus('saving')
    try {
      const contentPayload = { segments: segs }
      const now = new Date().toISOString()
      if (outputId) {
        const { error } = await supabase
          .from('step_output')
          .update({ content: contentPayload, last_saved_at: now, last_updated_at: now })
          .eq('id', outputId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('step_output')
          .insert({
            workspace_id: wsId,
            step_id: stepId,
            version: outputVersion,
            status: 'draft',
            content: contentPayload,
            copilot_assisted: false,
            last_saved_at: now,
            last_updated_at: now,
          })
          .select('id')
          .single()
        if (error) throw error
        if (data) setOutputId((data as Record<string, unknown>)['id'] as string)
      }
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }, [outputId, outputVersion, stepId])

  // ── Auto-save (Step 3) ──────────────────────────────────────────────────────

  const persistStep3Content = useCallback(async (dms: Record<string, DecisionMaker[]>, wsId: string) => {
    setSaveStatus('saving')
    try {
      const contentPayload = { decision_makers: dms }
      const now = new Date().toISOString()
      if (outputId) {
        const { error } = await supabase
          .from('step_output')
          .update({ content: contentPayload, last_saved_at: now, last_updated_at: now })
          .eq('id', outputId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('step_output')
          .insert({
            workspace_id: wsId,
            step_id: stepId,
            version: outputVersion,
            status: 'draft',
            content: contentPayload,
            copilot_assisted: false,
            last_saved_at: now,
            last_updated_at: now,
          })
          .select('id')
          .single()
        if (error) throw error
        if (data) setOutputId((data as Record<string, unknown>)['id'] as string)
      }
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }, [outputId, outputVersion, stepId])

  // ── Auto-save (Step 3.5) ────────────────────────────────────────────────────

  const persistStep35Content = useCallback(async (bc: Record<string, BuyingCenterEntry>, wsId: string) => {
    setSaveStatus('saving')
    try {
      const contentPayload = { buying_center: bc }
      const now = new Date().toISOString()
      if (outputId) {
        const { error } = await supabase
          .from('step_output')
          .update({ content: contentPayload, last_saved_at: now, last_updated_at: now })
          .eq('id', outputId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('step_output')
          .insert({
            workspace_id: wsId,
            step_id: stepId,
            version: outputVersion,
            status: 'draft',
            content: contentPayload,
            copilot_assisted: false,
            last_saved_at: now,
            last_updated_at: now,
          })
          .select('id')
          .single()
        if (error) throw error
        if (data) setOutputId((data as Record<string, unknown>)['id'] as string)
      }
      setSaveStatus('saved')
    } catch {
      setSaveStatus('error')
    }
  }, [outputId, outputVersion, stepId])

  // Keep step4SaveRef current each render
  step4SaveRef.current = async () => {
    if (workspaceId) await persistStep4Content(painPoints, activeCount, workspaceId)
  }

  step2SaveRef.current = async () => {
    if (workspaceId) await persistStep2Content(step2Segments, workspaceId)
  }

  step3SaveRef.current = async () => {
    if (workspaceId) await persistStep3Content(step3DMs, workspaceId)
  }

  step35SaveRef.current = async () => {
    if (workspaceId) await persistStep35Content(step35BC, workspaceId)
  }

  function scheduleStep4Save() {
    if (step4SaveTimer.current) clearTimeout(step4SaveTimer.current)
    step4SaveTimer.current = setTimeout(() => { void step4SaveRef.current() }, STEP4_AUTOSAVE_DELAY_MS)
  }

  function scheduleStep2Save() {
    if (step2SaveTimer.current) clearTimeout(step2SaveTimer.current)
    step2SaveTimer.current = setTimeout(() => { void step2SaveRef.current() }, AUTOSAVE_DELAY_MS)
  }

  function scheduleStep3Save() {
    if (step3SaveTimer.current) clearTimeout(step3SaveTimer.current)
    step3SaveTimer.current = setTimeout(() => { void step3SaveRef.current() }, AUTOSAVE_DELAY_MS)
  }

  function scheduleStep35Save() {
    if (step35SaveTimer.current) clearTimeout(step35SaveTimer.current)
    step35SaveTimer.current = setTimeout(() => { void step35SaveRef.current() }, AUTOSAVE_DELAY_MS)
  }

  function handleStep4TitleChange(tab: number, title: string) {
    setPainPoints(prev => prev.map(pp => pp.index === tab ? { ...pp, title } : pp))
    scheduleStep4Save()
  }

  function handleStep4DescriptionChange(tab: number, description: string) {
    setPainPoints(prev => prev.map(pp => pp.index === tab ? { ...pp, description } : pp))
    scheduleStep4Save()
  }

  function handleAddPainPoint() {
    const newCount = Math.min(activeCount + 1, 4)
    setActiveCount(newCount)
    setActiveTab(newCount)
    scheduleStep4Save()
  }

  function handleRemovePainPoint() {
    if (activeCount <= 1) return
    const newCount = activeCount - 1
    setPainPoints(prev => prev.map(pp => pp.index === activeCount ? { ...pp, title: '', description: '' } : pp))
    setActiveCount(newCount)
    setActiveTab(newCount)
    scheduleStep4Save()
  }

  function handleStep4Blur() {
    if (step4SaveTimer.current) clearTimeout(step4SaveTimer.current)
    void step4SaveRef.current()
  }

  function handleStep2Change(idx: number, field: keyof Segment, value: string) {
    setSaveStatus('editing')
    setStep2Segments(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
    scheduleStep2Save()
  }

  function handleStep2Blur() {
    if (step2SaveTimer.current) clearTimeout(step2SaveTimer.current)
    void step2SaveRef.current()
  }

  function handleStep3Change(segKey: string, dmIdx: number, field: Exclude<keyof DecisionMaker, 'primary_concerns'>, value: string) {
    setSaveStatus('editing')
    setStep3DMs(prev => ({
      ...prev,
      [segKey]: (prev[segKey] ?? makeDMs()).map((dm, i) => {
        if (i !== dmIdx) return dm
        const updated = { ...dm, [field]: value }
        if (field === 'role_category' && value !== '') {
          updated.primary_concerns = PRIMARY_CONCERN_MAP[value as RoleCategory] ?? dm.primary_concerns
        }
        return updated
      }),
    }))
    scheduleStep3Save()
  }

  function handleStep3ConcernToggle(segKey: string, dmIdx: number, concern: string) {
    setSaveStatus('editing')
    setStep3DMs(prev => ({
      ...prev,
      [segKey]: (prev[segKey] ?? makeDMs()).map((dm, i) => {
        if (i !== dmIdx) return dm
        const current = dm.primary_concerns
        const alreadySelected = current.includes(concern)
        let next: string[]
        if (alreadySelected) {
          next = current.filter(c => c !== concern)
        } else if (current.length < 3) {
          next = [...current, concern]
        } else {
          next = current
        }
        return { ...dm, primary_concerns: next }
      }),
    }))
    scheduleStep3Save()
  }

  function handleAddCustomConcern(segKey: string, dmIdx: number, customText: string) {
    setSaveStatus('editing')
    setStep3DMs(prev => ({
      ...prev,
      [segKey]: (prev[segKey] ?? makeDMs()).map((dm, i) => {
        if (i !== dmIdx) return dm
        const trimmed = customText.trim()
        if (!trimmed || dm.primary_concerns.length >= 3 || dm.primary_concerns.includes(trimmed)) return dm
        return { ...dm, primary_concerns: [...dm.primary_concerns, trimmed] }
      }),
    }))
    scheduleStep3Save()
  }

  function handleStep3Blur() {
    if (step3SaveTimer.current) clearTimeout(step3SaveTimer.current)
    void step3SaveRef.current()
  }

  function handleStep35Change(segKey: string, field: keyof BuyingCenterEntry, value: string) {
    setSaveStatus('editing')
    setStep35BC(prev => ({
      ...prev,
      [segKey]: { ...(prev[segKey] ?? makeBCEntry()), [field]: value },
    }))
    scheduleStep35Save()
  }

  function handleStep35Blur() {
    if (step35SaveTimer.current) clearTimeout(step35SaveTimer.current)
    void step35SaveRef.current()
  }

  // ── Copilot action ──────────────────────────────────────────────────────────

  async function runCopilot(action: CopilotAction) {
    if (!workspaceId || copilotStreaming) return
    setCopilotStreaming(true)
    setActiveAction(action)
    setCopilotOutput(null)
    setCopilotError(null)
    setStreamBuffer('')

    const actionPrompts: Record<CopilotAction, string> = {
      draft: 'Generate the draft now.',
      verify: 'Verify the current content for accuracy and completeness. Return the same JSON shape but set the draft field to a list of verification notes.',
      improve: 'Improve the current content. Return the same JSON shape with an improved draft.',
      explain: 'Explain the reasoning behind the current content. Return the same JSON shape with an explanation in the draft field.',
    }

    const currentContent = stepId === '4'
      ? painPoints
          .slice(0, activeCount)
          .map(pp => `Pain Point ${pp.index}:\nTitle: ${pp.title}\nDescription: ${pp.description}`)
          .join('\n\n')
      : content

    if (action === 'draft') {
      originalContentRef.current = content
      preApplyContentRef.current = content
      preApplyPainPointsRef.current = painPoints.map(pp => ({ ...pp }))
      localStorage.removeItem(`copilot_applied_${workspaceId}_${stepId}`)
      setDraftApplied(false)
    }

    try {
      const res = await fetch('/api/copilot/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepId,
          workspaceId,
          stepTitle: stepDef?.title ?? `Step ${stepId}`,
          stepDescription: stepDef?.description ?? '',
          currentContent,
          preferredModel,
          ...(action === 'improve' ? { extraContext: 'Improve this draft' } : {}),
        }),
      })

      if (!res.ok || !res.body) {
        setCopilotError(copilotErrorMessage(res.status))
        return
      }

      setIsProvisional(res.headers.get('X-Provisional') === '1')
      const missingHeader = res.headers.get('X-Missing-Prerequisites') ?? ''
      setMissingPrereqs(missingHeader ? missingHeader.split(',') : [])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        accumulated += chunk
        setStreamBuffer(accumulated)
      }

      if (accumulated.includes('__STREAM_ERROR__')) {
        const match = accumulated.match(/__STREAM_ERROR__:(\w+)/)
        setCopilotError(copilotErrorMessage(match ? match[1] : 0))
        return
      }

      let finalOutput: CopilotOutput
      try {
        const parsed = JSON.parse(accumulated) as CopilotOutput
        finalOutput = { ...parsed, draft: extractDraft(parsed.draft) }
      } catch {
        finalOutput = {
          draft: extractDraft(accumulated),
          confidence: 0,
          sources: [],
          assumptions: [],
          open_questions: [],
          verification_checks: [],
        }
      }

      if (action === 'draft' && AUTO_APPLY_STEPS.has(stepId)) {
        // Auto-apply: skip the Proposed Draft review panel for DCP-grounded steps
        applyDraftFromOutput(finalOutput)
        setCopilotOutput(null)
        setShowAppliedFlash(true)
        window.setTimeout(() => setShowAppliedFlash(false), 2000)
      } else {
        setCopilotOutput(finalOutput)
      }
      setStreamBuffer('')
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      const isTimeout = msg.includes('timeout') || msg.includes('aborted')
      setCopilotError(
        isTimeout
          ? 'The request took too long to complete. Try again or shorten your content.'
          : copilotErrorMessage(0),
      )
    } finally {
      setCopilotStreaming(false)
    }
  }

  function applyDraftFromOutput(output: CopilotOutput) {
    if (stepId === '4') {
      const draft = output.draft.trim()
      // Extract first sentence as title (capped at 70 chars)
      const match = draft.match(/^([^.!?]+[.!?])/)
      const rawTitle = match ? match[1].trim() : draft.split(' ').slice(0, 8).join(' ')
      const title = rawTitle.length > 70 ? rawTitle.slice(0, 70) + '…' : rawTitle
      const newPoints = painPoints.map(pp =>
        pp.index === activeTab ? { ...pp, title, description: draft } : pp
      )
      setPainPoints(newPoints)
      scheduleStep4Save()
    } else {
      setContent(output.draft)
      scheduleSave()
    }
    if (workspaceId) localStorage.setItem(`copilot_applied_${workspaceId}_${stepId}`, '1')
    setDraftApplied(true)
  }

  function applyDraft() {
    if (!copilotOutput) return
    applyDraftFromOutput(copilotOutput)
    setCopilotOutput(null)
  }

  function revertToOriginal() {
    if (stepId === '4') {
      setPainPoints(preApplyPainPointsRef.current)
    } else {
      setContent(originalContentRef.current)
    }
    setCopilotOutput(null)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  const stepTitle = stepDef?.title ?? `Step ${stepId}`
  const stepDesc = stepDef?.description ?? ''
  const isStep4 = stepId === '4'
  const isPainPointStep = PAIN_POINT_STEPS.has(stepId)
  const isBlendStep = BLEND_STEPS.has(stepId)
  const isActionPlanStep = ACTION_PLAN_STEPS.has(stepId)
  const stepIndex = allSteps.findIndex(s => s.id === stepId)

  const contentQuality = calculateContentQuality(stepId, content, painPoints, activeCount)
  const cqLabel = contentQuality >= 85 ? 'High' : contentQuality >= 65 ? 'Good' : contentQuality >= 30 ? 'Medium' : 'Low'
  const cqColor = contentQuality >= 85 ? '#16A34A' : contentQuality >= 65 ? '#0EA5E9' : contentQuality >= 30 ? '#D97706' : '#DC2626'
  const prevStep = stepIndex > 0 ? allSteps[stepIndex - 1] : null
  const nextStep = stepIndex >= 0 && stepIndex < allSteps.length - 1 ? allSteps[stepIndex + 1] : null

  // hasContent — gates the Next button. Rules per the step's editor shape.
  let hasContent: boolean
  if (stepId === '4') {
    hasContent = painPoints.slice(0, activeCount).some(pp => (pp.description ?? '').trim().length > 50)
  } else if (stepId === '2' || stepId === '3' || stepId === '3.5') {
    hasContent = outputId !== null
  } else if (stepId === '21') {
    hasContent = true // Acid Test 2 placeholder — Next stays enabled
  } else if (PAIN_POINT_STEPS.has(stepId)) {
    // Pain point editor saves { by_pain_point: [{ index, content }, …] }
    const bpp = rawContent?.['by_pain_point']
    hasContent = Array.isArray(bpp)
      && (bpp as Array<Record<string, unknown>>).some(p =>
        typeof p['content'] === 'string' && (p['content'] as string).trim().length > 50,
      )
  } else if (stepId === '14' || stepId === '38' || ACTION_PLAN_STEPS.has(stepId)) {
    // Component-managed editors — fall back to any substantive saved string
    hasContent = valuesLongerThan(rawContent, 50)
  } else {
    hasContent = content.trim().length > 50
  }

  const warningMessage = buildWarningMessage(stepId, prereqContent)
  const warningBanner = (warningMessage && !warningDismissed) ? (
    <div style={{
      padding: '12px 16px',
      backgroundColor: '#FEF3C7',
      border: '1px solid #FCD34D',
      borderRadius: '8px',
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
        <AlertTriangle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: '13px', color: '#92400E', margin: 0, lineHeight: '1.5' }}>
          {warningMessage}
        </p>
      </div>
      <button
        onClick={dismissWarning}
        aria-label="Dismiss warning"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#92400E',
          cursor: 'pointer',
          padding: '0 4px',
          marginLeft: '8px',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>
  ) : null

  const showDcpBanner = ['4', '5', '6', '7', '8', '9'].includes(stepId) && hasDcpAnalysis
  const dcpBanner = showDcpBanner ? (
    <div style={{
      padding: '12px 16px',
      backgroundColor: 'rgba(14,165,233,0.12)',
      border: '1px solid rgba(14,165,233,0.4)',
      borderRadius: '8px',
      display: 'flex',
      gap: '10px',
      alignItems: 'flex-start',
      marginBottom: '16px',
    }}>
      <Sparkles size={16} style={{ color: '#0EA5E9', flexShrink: 0, marginTop: '1px' }} />
      <p style={{ fontSize: '13px', color: '#0EA5E9', margin: 0, lineHeight: '1.5' }}>
        Buyer research available from your DCP Map. Click Copilot Draft to generate content grounded in real buyer intelligence.
      </p>
    </div>
  ) : null

  const header = (
    <header style={{ backgroundColor: '#0A1628', padding: '14px 32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '12px' }}>
        <Link href="/dashboard/journeys" style={{ color: '#0EA5E9', textDecoration: 'none' }}>
          Journeys
        </Link>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
        <span style={{ color: '#0EA5E9' }}>{stepDef?.section ?? ''}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>›</span>
        <span style={{ color: 'rgba(255,255,255,0.8)' }}>Step {stepId}</span>
      </div>
      <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>{stepTitle}</h1>
      {hasMultipleSegments && primarySegmentName && (
        <div style={{ marginTop: '8px' }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 10px',
            borderRadius: '999px',
            backgroundColor: 'rgba(14,165,233,0.15)',
            color: '#0EA5E9',
            fontSize: '12px',
            fontWeight: 600,
            border: '1px solid rgba(14,165,233,0.3)',
          }}>
            Working on: {primarySegmentName}
          </span>
        </div>
      )}
      {stepDesc && (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
          {stepDesc}
        </p>
      )}
    </header>
  )

  if (stepId === '14' && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1200px', flex: 1 }}>
          <Step14Editor workspaceId={workspaceId} preferredModel={preferredModel} />
        </div>
        <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
      </div>
    )
  }

  if (stepId === '21') {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', flex: 1 }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            overflow: 'hidden',
            maxWidth: '640px',
          }}>
            <div style={{
              backgroundColor: '#0A1628',
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <h2 style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Acid Test 2 — Competitive Gap Analysis
              </h2>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 12px',
                backgroundColor: '#E8520A',
                color: '#FFFFFF',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                Coming Soon
              </span>
            </div>
            <div style={{ padding: '20px 24px' }}>
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.65', margin: 0 }}>
                This step will allow you to evaluate whether your competitors can deliver on your Critical Success Formulas. Coming in Sprint 4.
              </p>
            </div>
          </div>
        </div>
        <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
      </div>
    )
  }

  if (stepId === '2') {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', padding: '28px 32px', maxWidth: '1200px', flex: 1 }}>
          <div>
            <Step2Editor
              segments={step2Segments}
              saveStatus={saveStatus}
              onChange={handleStep2Change}
              onBlur={handleStep2Blur}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TipsPanel tips={STEP_TIPS[stepId] ?? []} />
          </div>
        </div>
        <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
      </div>
    )
  }

  if (stepId === '3') {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', padding: '28px 32px', maxWidth: '1200px', flex: 1 }}>
          <div>
            <Step3Editor
              segmentNames={segmentNames}
              dms={step3DMs}
              activeTab={step3ActiveTab}
              saveStatus={saveStatus}
              onTabChange={setStep3ActiveTab}
              onChange={handleStep3Change}
              onConcernToggle={handleStep3ConcernToggle}
              onAddCustomConcern={handleAddCustomConcern}
              onBlur={handleStep3Blur}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TipsPanel tips={STEP_TIPS[stepId] ?? []} />
          </div>
        </div>
        <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
      </div>
    )
  }

  if (stepId === '3.5') {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', padding: '28px 32px', maxWidth: '1200px', flex: 1 }}>
          <div>
            <Step35Editor
              segmentNames={segmentNames}
              buyingCenter={step35BC}
              activeTab={step35ActiveTab}
              saveStatus={saveStatus}
              onTabChange={setStep35ActiveTab}
              onChange={handleStep35Change}
              onBlur={handleStep35Blur}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <TipsPanel tips={STEP_TIPS[stepId] ?? []} />
          </div>
        </div>
        <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
      </div>
    )
  }

  if (isPainPointStep && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div
          id={stepId === '11' ? 'step-cvp' : undefined}
          style={{ padding: '28px 32px', maxWidth: '1200px', flex: 1 }}
        >
          {warningBanner}
          {dcpBanner}
          {stepId === '9' && step9Data && (
            <div style={{ marginBottom: '16px' }}>
              <Step9Display {...step9Data} />
            </div>
          )}
          <PainPointStepEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
            autoApply={AUTO_APPLY_STEPS.has(stepId)}
          />
        </div>
        <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
      </div>
    )
  }

  if (isBlendStep && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1400px', flex: 1 }}>
          {warningBanner}
          <BlendEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
          />
        </div>
        <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
      </div>
    )
  }

  if (isActionPlanStep && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1200px', flex: 1 }}>
          {warningBanner}
          <ActionPlanEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
          />
        </div>
        <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
      </div>
    )
  }

  if (stepId === '38' && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', flex: 1 }}>
          {warningBanner}
          <DealScorecard
            workspaceId={workspaceId}
            preferredModel={preferredModel}
          />
        </div>
        <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {header}

      {/* Two-column layout (generic + Step 4 steps) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', padding: '28px 32px', maxWidth: '1200px' }}>

        {/* ── Left: Editor ─────────────────────────────────────────────────── */}
        <div>
          {warningBanner}
          {dcpBanner}
          {isStep4 ? (
            <div id="step-pain-points" style={PANEL_CARD}>
              <Step4Editor
                painPoints={painPoints}
                activeCount={activeCount}
                activeTab={activeTab}
                saveState={saveState}
                contentQuality={contentQuality}
                onTabChange={setActiveTab}
                onTitleChange={handleStep4TitleChange}
                onDescriptionChange={handleStep4DescriptionChange}
                onAddPainPoint={handleAddPainPoint}
                onRemovePainPoint={handleRemovePainPoint}
                onBlur={handleStep4Blur}
              />
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={LABEL_STYLE}>Your Content</label>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 700 }}>·</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: cqColor }}>Quality: {contentQuality} · {cqLabel}</span>
                  <div style={{ width: '40px', height: '3px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${contentQuality}%`, height: '100%', backgroundColor: cqColor, borderRadius: '2px' }} />
                  </div>
                </div>
                <SaveIndicator state={saveState} />
              </div>
              <textarea
                value={content}
                onChange={handleContentChange}
                onBlur={handleBlur}
                placeholder="Start writing, or use the Copilot panel to generate a first draft…"
                style={{
                  width: '100%',
                  minHeight: '420px',
                  padding: '16px',
                  border: '1px solid #9CA3AF',
                  borderRadius: '10px',
                  fontSize: '14px',
                  lineHeight: '1.65',
                  color: '#0D0D0D',
                  backgroundColor: '#FFFFFF',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
            </>
          )}

          {/* Missing prerequisites banner */}
          {missingPrereqs.length > 0 && (
            <div style={{
              marginTop: '12px',
              padding: '12px 16px',
              backgroundColor: '#FEF3C7',
              borderRadius: '8px',
              border: '1px solid #FCD34D',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start',
            }}>
              <AlertTriangle size={16} style={{ color: '#D97706', flexShrink: 0, marginTop: '1px' }} />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#92400E', margin: '0 0 2px' }}>
                  Missing prerequisites
                </p>
                <p style={{ fontSize: '12px', color: '#78350F', margin: 0 }}>
                  Steps {missingPrereqs.join(', ')} have no approved output yet. Copilot results may be incomplete.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Copilot panel ──────────────────────────────────────────── */}
        <div id="step-cvp-copilot-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Tips panel */}
          <TipsPanel tips={STEP_TIPS[stepId] ?? []} />

          {/* Action buttons */}
          <div style={PANEL_CARD}>
            <p style={{ ...LABEL_STYLE, color: 'rgba(255,255,255,0.55)' }}>Copilot Actions</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {isStep4 ? (
                draftApplied ? (
                  <button
                    onClick={() => { revertToOriginal(); if (workspaceId) localStorage.removeItem(`copilot_applied_${workspaceId}_${stepId}`); setDraftApplied(false) }}
                    disabled={copilotStreaming}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '0 14px', minHeight: '44px',
                      backgroundColor: '#0A1628',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      fontSize: '14px', fontWeight: 600,
                      cursor: copilotStreaming ? 'not-allowed' : 'pointer',
                      width: '100%',
                    }}
                  >
                    <Wand2 size={16} />
                    Revert
                  </button>
                ) : (
                  <button
                    onClick={() => void runCopilot('draft')}
                    disabled={copilotStreaming}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '0 14px', minHeight: '44px',
                      backgroundColor: copilotStreaming ? 'rgba(232,82,10,0.5)' : '#E8520A',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px', fontWeight: 600,
                      cursor: copilotStreaming ? 'not-allowed' : 'pointer',
                      width: '100%',
                      opacity: copilotStreaming ? 0.6 : 1,
                    }}
                  >
                    <Wand2 size={16} />
                    {`Draft for ${painPoints.find(pp => pp.index === activeTab)?.title || `Pain Point ${activeTab}`}`}
                  </button>
                )
              ) : (
                draftApplied ? (
                  <button
                    onClick={() => { revertToOriginal(); if (workspaceId) localStorage.removeItem(`copilot_applied_${workspaceId}_${stepId}`); setDraftApplied(false) }}
                    disabled={copilotStreaming}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '0 14px', minHeight: '44px',
                      backgroundColor: '#0A1628',
                      color: '#FFFFFF',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      fontSize: '14px', fontWeight: 600,
                      cursor: copilotStreaming ? 'not-allowed' : 'pointer',
                      width: '100%',
                    }}
                  >
                    <Wand2 size={16} />
                    Revert
                  </button>
                ) : (
                  <ActionButton
                    dark
                    icon={Wand2}
                    label="Draft"
                    onClick={() => void runCopilot('draft')}
                    disabled={copilotStreaming}
                    active={activeAction === 'draft' && copilotStreaming}
                  />
                )
              )}
              {false && (
                <ActionButton
                  dark
                  icon={ShieldCheck}
                  label="Verify"
                  onClick={() => void runCopilot('verify')}
                  disabled={copilotStreaming}
                  active={activeAction === 'verify' && copilotStreaming}
                />
              )}
              {!['1', '2', '3', '3.5'].includes(stepId) && (
                <ActionButton
                  dark
                  icon={Sparkles}
                  label="Improve"
                  onClick={() => void runCopilot('improve')}
                  disabled={copilotStreaming}
                  active={activeAction === 'improve' && copilotStreaming}
                />
              )}
              {false && (
                <ActionButton
                  dark
                  icon={HelpCircle}
                  label="Explain"
                  onClick={() => void runCopilot('explain')}
                  disabled={copilotStreaming}
                  active={activeAction === 'explain' && copilotStreaming}
                />
              )}
            </div>
          </div>

          {/* Streaming / output */}
          {copilotStreaming && !copilotOutput && (
            <div style={{ ...PANEL_CARD, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={16} className="animate-spin" style={{ color: '#E8520A', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', margin: '0 0 6px' }}>Generating…</p>
                <p style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.7)',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  margin: 0,
                }}>
                  {streamBuffer.slice(-300)}
                </p>
              </div>
            </div>
          )}

          {copilotError && (
            <div style={{ ...PANEL_CARD, border: '1px solid rgba(248,113,113,0.35)', backgroundColor: 'rgba(239,68,68,0.1)' }}>
              <p style={{ fontSize: '13px', color: '#FCA5A5', margin: '0 0 8px' }}>{copilotError}</p>
              <a
                href="https://status.anthropic.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: '#FCA5A5', textDecoration: 'underline' }}
              >
                Check AI Status ↗
              </a>
            </div>
          )}

          {showAppliedFlash && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(22,163,74,0.15)',
              border: '1px solid rgba(22,163,74,0.45)',
              borderRadius: '8px',
              color: '#86EFAC',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'opacity 300ms ease',
            }}>
              Applied to editor
            </div>
          )}

          {copilotOutput && !copilotStreaming && (
            <>
              {/* Confidence + provisional */}
              <div style={PANEL_CARD}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
                  <ConfidenceBadge score={copilotOutput.confidence} />
                  {isProvisional && (
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#D97706',
                      backgroundColor: '#FEF3C7',
                      padding: '3px 8px',
                      borderRadius: '999px',
                    }}>
                      Provisional
                    </span>
                  )}
                </div>

                {/* Draft */}
                <p style={{ ...LABEL_STYLE, marginBottom: '6px' }}>
                  {isStep4 ? `Proposed draft for Pain Point ${activeTab}` : 'Proposed draft'}
                </p>
                <div style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.8)',
                  lineHeight: '1.6',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  borderRadius: '8px',
                  padding: '12px',
                  marginBottom: '12px',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '220px',
                  overflowY: 'auto',
                }}>
                  {copilotOutput.draft}
                </div>
                <button
                  onClick={revertToOriginal}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    backgroundColor: 'transparent',
                    color: '#FFFFFF',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    marginBottom: '8px',
                  }}
                >
                  Keep Original
                </button>
                <button
                  onClick={applyDraft}
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    backgroundColor: '#E8520A',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isStep4 ? `Apply to Pain Point ${activeTab}` : 'Apply to editor'}
                </button>
              </div>

              {/* Sources */}
              {copilotOutput.sources.length > 0 && (
                <div style={PANEL_CARD}>
                  <p style={LABEL_STYLE}>Sources used</p>
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    {copilotOutput.sources.map((s, i) => (
                      <li key={i} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Verification checks */}
              {copilotOutput.verification_checks.length > 0 && (
                <div style={PANEL_CARD}>
                  <p style={LABEL_STYLE}>Verification checks</p>
                  <ul style={{ margin: 0, paddingLeft: '16px' }}>
                    {copilotOutput.verification_checks.map((v, i) => (
                      <li key={i} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
    </div>
  )
}
