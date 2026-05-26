'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2, Wand2, ShieldCheck, Sparkles, HelpCircle, AlertTriangle, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { calculateDecayedConfidence } from '@/lib/context/confidenceDecay'
import ConfidenceBar from '@/components/copilot/ConfidenceBar'
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

interface DecisionMaker {
  title: string
  influence: string
  primary_concern: string
}

const DEFAULT_DM: DecisionMaker = { title: '', influence: '', primary_concern: '' }

function makeDMs(): DecisionMaker[] {
  return [{ ...DEFAULT_DM }, { ...DEFAULT_DM }, { ...DEFAULT_DM }]
}

// ── Step 3.5 types ────────────────────────────────────────────────────────────

interface BuyingCenterRole {
  title: string
  key_concern: string
}

interface BuyingCenterSegment {
  economic_buyer: BuyingCenterRole
  champion: BuyingCenterRole
  evaluator: BuyingCenterRole
  blocker: BuyingCenterRole
}

function makeBCSegment(): BuyingCenterSegment {
  return {
    economic_buyer: { title: '', key_concern: '' },
    champion: { title: '', key_concern: '' },
    evaluator: { title: '', key_concern: '' },
    blocker: { title: '', key_concern: '' },
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AUTOSAVE_DELAY_MS = 1200
const STEP4_AUTOSAVE_DELAY_MS = 800

const PAIN_POINT_STEPS = new Set(['5', '6', '7', '8', '10', '11', '12', '13', '15', '16', '17', '18', '19', '20', '22', '23', '24', '25', '26'])
const BLEND_STEPS = new Set(['27', '28', '29', '30'])
const ACTION_PLAN_STEPS = new Set(['31', '32', '33', '34', '35', '36', '37'])

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
  // Content may be flat or nested under 'buyingCenter'
  const bc = (typeof c['buyingCenter'] === 'object' && c['buyingCenter'] !== null)
    ? (c['buyingCenter'] as Record<string, unknown>)
    : c
  const lines: string[] = []
  if (bc['stakeholderMin'] !== undefined || bc['stakeholderMax'] !== undefined) {
    lines.push(`Stakeholder Count: ${bc['stakeholderMin'] ?? ''}–${bc['stakeholderMax'] ?? ''}`)
  } else if (bc['stakeholderCount'] !== undefined) {
    lines.push(`Stakeholder Count: ${String(bc['stakeholderCount'])}`)
  }
  if (bc['decisionStyle'] !== undefined) lines.push(`Decision Style: ${String(bc['decisionStyle'])}`)
  if (bc['salesCycle'] !== undefined) lines.push(`Sales Cycle: ${String(bc['salesCycle'])}`)
  if (bc['acvRange'] !== undefined) lines.push(`ACV Range: ${String(bc['acvRange'])}`)
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

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null
  if (state === 'saving') return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.45)' }}>
      <Loader2 size={12} className="animate-spin" /> Saving…
    </span>
  )
  if (state === 'saved') return (
    <span style={{ fontSize: '12px', color: '#34D399' }}>Saved</span>
  )
  return <span style={{ fontSize: '12px', color: '#F87171' }}>Save failed</span>
}

// ── Step 4 Editor ─────────────────────────────────────────────────────────────

interface Step4EditorProps {
  painPoints: PainPoint[]
  activeCount: number
  activeTab: number
  saveState: SaveState
  onTabChange: (tab: number) => void
  onTitleChange: (tab: number, title: string) => void
  onDescriptionChange: (tab: number, description: string) => void
  onAddPainPoint: () => void
  onRemovePainPoint: () => void
  onBlur: () => void
}

function Step4Editor({
  painPoints, activeCount, activeTab, saveState,
  onTabChange, onTitleChange, onDescriptionChange,
  onAddPainPoint, onRemovePainPoint, onBlur,
}: Step4EditorProps) {
  const activePP = painPoints.find(pp => pp.index === activeTab) ?? painPoints[0]
  const visibleTabs = painPoints.slice(0, activeCount)

  return (
    <div>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <label style={LABEL_STYLE}>Pain Points</label>
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

function StepNavBar({ stepIndex, total, prevId, nextId }: {
  stepIndex: number
  total: number
  prevId: string | null
  nextId: string | null
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
        {stepIndex >= 0 ? `Step ${stepIndex + 1} of ${total}` : `${total} steps`}
      </span>
      <div style={{ minWidth: '140px', display: 'flex', justifyContent: 'flex-end' }}>
        {nextId ? (
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
        ) : <span />}
      </div>
    </div>
  )
}

// ── Step 2 Editor — Target Market Segments ────────────────────────────────────

interface Step2EditorProps {
  segments: Segment[]
  saveState: SaveState
  onChange: (idx: number, field: keyof Segment, value: string) => void
  onBlur: () => void
}

function Step2Editor({ segments, saveState, onChange, onBlur }: Step2EditorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <label style={LABEL_STYLE}>Target Market Segments</label>
        <SaveIndicator state={saveState} />
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
              <input
                type="text"
                value={seg.industry}
                onChange={e => onChange(i, 'industry', e.target.value)}
                onBlur={onBlur}
                placeholder="e.g. Technology, Healthcare"
                style={FIELD_INPUT}
              />
            </div>
            <div>
              <label style={{ ...LABEL_STYLE, display: 'block' }}>Company Size</label>
              <input
                type="text"
                value={seg.company_size}
                onChange={e => onChange(i, 'company_size', e.target.value)}
                onBlur={onBlur}
                placeholder="e.g. 50–500 employees"
                style={FIELD_INPUT}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ ...LABEL_STYLE, display: 'block' }}>Geography</label>
              <input
                type="text"
                value={seg.geography}
                onChange={e => onChange(i, 'geography', e.target.value)}
                onBlur={onBlur}
                placeholder="e.g. North America, EMEA"
                style={FIELD_INPUT}
              />
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
  saveState: SaveState
  onTabChange: (tab: number) => void
  onChange: (segKey: string, dmIdx: number, field: keyof DecisionMaker, value: string) => void
  onBlur: () => void
}

function Step3Editor({ segmentNames, dms, activeTab, saveState, onTabChange, onChange, onBlur }: Step3EditorProps) {
  const activeKey = SEG_KEYS[activeTab]
  const activeDMs = dms[activeKey] ?? makeDMs()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <label style={LABEL_STYLE}>Key Decision Makers</label>
        <SaveIndicator state={saveState} />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 1fr', gap: '12px' }}>
              <div>
                <label style={{ ...LABEL_STYLE, display: 'block' }}>Title</label>
                <input
                  type="text"
                  value={dm.title}
                  onChange={e => onChange(activeKey, dmIdx, 'title', e.target.value)}
                  onBlur={onBlur}
                  placeholder="e.g. VP of Sales"
                  style={FIELD_INPUT}
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
                  <option value="">Select…</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
              <div>
                <label style={{ ...LABEL_STYLE, display: 'block' }}>Primary Concern</label>
                <input
                  type="text"
                  value={dm.primary_concern}
                  onChange={e => onChange(activeKey, dmIdx, 'primary_concern', e.target.value)}
                  onBlur={onBlur}
                  placeholder="e.g. Revenue predictability"
                  style={FIELD_INPUT}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 3.5 Editor — Buying Center Evaluation ────────────────────────────────

interface Step35EditorProps {
  segmentNames: string[]
  buyingCenter: Record<string, BuyingCenterSegment>
  activeTab: number
  saveState: SaveState
  onTabChange: (tab: number) => void
  onChange: (segKey: string, role: keyof BuyingCenterSegment, field: keyof BuyingCenterRole, value: string) => void
  onBlur: () => void
}

const BC_ROLES: Array<{ key: keyof BuyingCenterSegment; label: string; optional?: boolean }> = [
  { key: 'economic_buyer', label: 'Economic Buyer' },
  { key: 'champion', label: 'Champion' },
  { key: 'evaluator', label: 'Evaluator' },
  { key: 'blocker', label: 'Blocker', optional: true },
]

function Step35Editor({ segmentNames, buyingCenter, activeTab, saveState, onTabChange, onChange, onBlur }: Step35EditorProps) {
  const activeKey = SEG_KEYS[activeTab]
  const activeSeg = buyingCenter[activeKey] ?? makeBCSegment()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <label style={LABEL_STYLE}>Buying Center Evaluation</label>
        <SaveIndicator state={saveState} />
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

      {/* Buying center role cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {BC_ROLES.map(({ key, label, optional }) => {
          const role = activeSeg[key]
          return (
            <div key={key} style={PANEL_CARD}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '14px',
                paddingBottom: '10px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
              }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#FFFFFF' }}>{label}</span>
                {optional && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.4)',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                  }}>
                    optional
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ ...LABEL_STYLE, display: 'block' }}>Title</label>
                  <input
                    type="text"
                    value={role.title}
                    onChange={e => onChange(activeKey, key, 'title', e.target.value)}
                    onBlur={onBlur}
                    placeholder="e.g. CFO"
                    style={FIELD_INPUT}
                  />
                </div>
                <div>
                  <label style={{ ...LABEL_STYLE, display: 'block' }}>Key Concern</label>
                  <input
                    type="text"
                    value={role.key_concern}
                    onChange={e => onChange(activeKey, key, 'key_concern', e.target.value)}
                    onBlur={onBlur}
                    placeholder="e.g. Budget justification and ROI"
                    style={FIELD_INPUT}
                  />
                </div>
              </div>
            </div>
          )
        })}
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
  const [loading, setLoading] = useState(true)

  // Step 9 state
  const [step9Data, setStep9Data] = useState<Step9State | null>(null)

  const [allSteps, setAllSteps] = useState<AllStep[]>([])
  const [decayedConfidence, setDecayedConfidence] = useState<number | null>(null)

  // Step 4 state
  const [painPoints, setPainPoints] = useState<PainPoint[]>(DEFAULT_PAIN_POINTS)
  const [activeCount, setActiveCount] = useState(1)
  const [activeTab, setActiveTab] = useState(1)
  const [draftApplied, setDraftApplied] = useState(false)

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
  const [step35BC, setStep35BC] = useState<Record<string, BuyingCenterSegment>>({
    segment_1: makeBCSegment(),
    segment_2: makeBCSegment(),
    segment_3: makeBCSegment(),
  })
  const [step35ActiveTab, setStep35ActiveTab] = useState(0)

  // Segment names loaded from Step 2 content for display in Steps 3 and 3.5
  const [segmentNames, setSegmentNames] = useState<string[]>(['Segment 1', 'Segment 2', 'Segment 3'])

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
                    title: String(dm['title'] ?? ''),
                    influence: String(dm['influence'] ?? ''),
                    primary_concern: String(dm['primary_concern'] ?? ''),
                  }))
                  loaded[key] = [0, 1, 2].map(i => parsed[i] ?? { ...DEFAULT_DM })
                }
              })
              setStep3DMs(loaded)
            }
          } else if (stepId === '3.5') {
            const bcRaw = c?.['buying_center'] as Record<string, unknown> | undefined
            if (bcRaw) {
              const loaded: Record<string, BuyingCenterSegment> = {
                segment_1: makeBCSegment(), segment_2: makeBCSegment(), segment_3: makeBCSegment(),
              }
              ;(['segment_1', 'segment_2', 'segment_3'] as const).forEach(key => {
                const seg = bcRaw[key] as Record<string, unknown> | undefined
                if (seg) {
                  const loadRole = (r: unknown): BuyingCenterRole => {
                    const role = (typeof r === 'object' && r !== null) ? r as Record<string, unknown> : {}
                    return { title: String(role['title'] ?? ''), key_concern: String(role['key_concern'] ?? '') }
                  }
                  loaded[key] = {
                    economic_buyer: loadRole(seg['economic_buyer']),
                    champion: loadRole(seg['champion']),
                    evaluator: loadRole(seg['evaluator']),
                    blocker: loadRole(seg['blocker']),
                  }
                }
              })
              setStep35BC(loaded)
            }
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

        // Load Step 2 segment names for Steps 3 and 3.5
        if (stepId === '3' || stepId === '3.5') {
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
              const names = (s2c['segments'] as Array<Record<string, unknown>>)
                .slice(0, 3)
                .map((s, i) => String(s['name'] ?? '').trim() || `Segment ${i + 1}`)
              setSegmentNames(names)
            }
          }
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
    setSaveState('saving')
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
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
  }, [outputId, outputVersion, stepId])

  // ── Auto-save (Step 3) ──────────────────────────────────────────────────────

  const persistStep3Content = useCallback(async (dms: Record<string, DecisionMaker[]>, wsId: string) => {
    setSaveState('saving')
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
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
    }
  }, [outputId, outputVersion, stepId])

  // ── Auto-save (Step 3.5) ────────────────────────────────────────────────────

  const persistStep35Content = useCallback(async (bc: Record<string, BuyingCenterSegment>, wsId: string) => {
    setSaveState('saving')
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
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2500)
    } catch {
      setSaveState('error')
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
    setStep2Segments(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s))
    scheduleStep2Save()
  }

  function handleStep2Blur() {
    if (step2SaveTimer.current) clearTimeout(step2SaveTimer.current)
    void step2SaveRef.current()
  }

  function handleStep3Change(segKey: string, dmIdx: number, field: keyof DecisionMaker, value: string) {
    setStep3DMs(prev => ({
      ...prev,
      [segKey]: (prev[segKey] ?? makeDMs()).map((dm, i) => i === dmIdx ? { ...dm, [field]: value } : dm),
    }))
    scheduleStep3Save()
  }

  function handleStep3Blur() {
    if (step3SaveTimer.current) clearTimeout(step3SaveTimer.current)
    void step3SaveRef.current()
  }

  function handleStep35Change(segKey: string, role: keyof BuyingCenterSegment, field: keyof BuyingCenterRole, value: string) {
    setStep35BC(prev => ({
      ...prev,
      [segKey]: { ...(prev[segKey] ?? makeBCSegment()), [role]: { ...(prev[segKey] ?? makeBCSegment())[role], [field]: value } },
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

      try {
        const parsed = JSON.parse(accumulated) as CopilotOutput
        setCopilotOutput({ ...parsed, draft: extractDraft(parsed.draft) })
      } catch {
        setCopilotOutput({
          draft: extractDraft(accumulated),
          confidence: 0,
          sources: [],
          assumptions: [],
          open_questions: [],
          verification_checks: [],
        })
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

  function applyDraft() {
    if (!copilotOutput) return

    if (stepId === '4') {
      const draft = copilotOutput.draft.trim()
      // Extract first sentence as title (capped at 70 chars)
      const match = draft.match(/^([^.!?]+[.!?])/)
      const rawTitle = match ? match[1].trim() : draft.split(' ').slice(0, 8).join(' ')
      const title = rawTitle.length > 70 ? rawTitle.slice(0, 70) + '…' : rawTitle
      const newPoints = painPoints.map(pp =>
        pp.index === activeTab ? { ...pp, title, description: draft } : pp
      )
      setPainPoints(newPoints)
      scheduleStep4Save()
      if (workspaceId) localStorage.setItem(`copilot_applied_${workspaceId}_${stepId}`, '1')
      setDraftApplied(true)
      setCopilotOutput(null)
      return
    }

    setContent(copilotOutput.draft)
    scheduleSave()
    if (workspaceId) localStorage.setItem(`copilot_applied_${workspaceId}_${stepId}`, '1')
    setDraftApplied(true)
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
  const prevStep = stepIndex > 0 ? allSteps[stepIndex - 1] : null
  const nextStep = stepIndex >= 0 && stepIndex < allSteps.length - 1 ? allSteps[stepIndex + 1] : null

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
      {stepDesc && (
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
          {stepDesc}
        </p>
      )}
      {decayedConfidence !== null && (
        <div style={{ marginTop: '14px', maxWidth: '300px' }}>
          <ConfidenceBar score={decayedConfidence} dark />
        </div>
      )}
    </header>
  )

  if (stepId === '9') {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '900px', flex: 1 }}>
          {step9Data
            ? <Step9Display {...step9Data} />
            : <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <Loader2 size={28} className="animate-spin" style={{ color: '#6B7280' }} />
              </div>
          }
        </div>
        <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
      </div>
    )
  }

  if (stepId === '14' && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1200px', flex: 1 }}>
          <Step14Editor workspaceId={workspaceId} preferredModel={preferredModel} />
        </div>
        <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
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
        <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
      </div>
    )
  }

  if (stepId === '2') {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '860px', flex: 1 }}>
          <Step2Editor
            segments={step2Segments}
            saveState={saveState}
            onChange={handleStep2Change}
            onBlur={handleStep2Blur}
          />
        </div>
        <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
      </div>
    )
  }

  if (stepId === '3') {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '900px', flex: 1 }}>
          <Step3Editor
            segmentNames={segmentNames}
            dms={step3DMs}
            activeTab={step3ActiveTab}
            saveState={saveState}
            onTabChange={setStep3ActiveTab}
            onChange={handleStep3Change}
            onBlur={handleStep3Blur}
          />
        </div>
        <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
      </div>
    )
  }

  if (stepId === '3.5') {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '900px', flex: 1 }}>
          <Step35Editor
            segmentNames={segmentNames}
            buyingCenter={step35BC}
            activeTab={step35ActiveTab}
            saveState={saveState}
            onTabChange={setStep35ActiveTab}
            onChange={handleStep35Change}
            onBlur={handleStep35Blur}
          />
        </div>
        <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
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
          <PainPointStepEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
          />
        </div>
        <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
      </div>
    )
  }

  if (isBlendStep && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1400px', flex: 1 }}>
          <BlendEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
          />
        </div>
        <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
      </div>
    )
  }

  if (isActionPlanStep && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1200px', flex: 1 }}>
          <ActionPlanEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
          />
        </div>
        <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
      </div>
    )
  }

  if (stepId === '38' && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', flex: 1 }}>
          <DealScorecard
            workspaceId={workspaceId}
            preferredModel={preferredModel}
          />
        </div>
        <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
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
          {isStep4 ? (
            <div id="step-pain-points" style={PANEL_CARD}>
              <Step4Editor
                painPoints={painPoints}
                activeCount={activeCount}
                activeTab={activeTab}
                saveState={saveState}
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
                <label style={LABEL_STYLE}>Your Content</label>
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
      <StepNavBar stepIndex={stepIndex} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} />
    </div>
  )
}
