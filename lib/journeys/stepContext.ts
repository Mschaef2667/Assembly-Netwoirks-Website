'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { calculateDecayedConfidence } from '@/lib/context/confidenceDecay'
import { isJourneyStep } from '@/lib/journey/canonicalSteps'
import {
  DEFAULT_DM,
  DEFAULT_PAIN_POINTS,
  DEFAULT_SEGMENT,
  makeBCEntry,
  makeDMs,
  prereqIdsForStep,
  valuesLongerThan,
  extractStepContent,
  type AllStep,
  type BuyingCenterEntry,
  type DcpStageSummary,
  type DecisionMaker,
  type InfluenceLevel,
  type PainPoint,
  type PrereqInfo,
  type RoleCategory,
  type Segment,
  type Step9State,
  type StepDef,
} from './stepHelpers'

export interface StepContext {
  loading: boolean
  workspaceId: string | null
  preferredModel: string
  stepDef: StepDef | null

  // Output row
  outputId: string | null
  setOutputId: (id: string | null) => void
  outputVersion: number
  rawContent: Record<string, unknown> | null

  // Generic content (used by steps without a dedicated editor shape)
  content: string
  setContent: React.Dispatch<React.SetStateAction<string>>

  // Step 4 (pain points)
  painPoints: PainPoint[]
  setPainPoints: React.Dispatch<React.SetStateAction<PainPoint[]>>
  activeCount: number
  setActiveCount: React.Dispatch<React.SetStateAction<number>>

  // Step 2 (target segments)
  step2Segments: Segment[]
  setStep2Segments: React.Dispatch<React.SetStateAction<Segment[]>>

  // Step 3 (decision makers per segment)
  step3DMs: Record<string, DecisionMaker[]>
  setStep3DMs: React.Dispatch<React.SetStateAction<Record<string, DecisionMaker[]>>>

  // Step 3.5 (buying center)
  step35BC: Record<string, BuyingCenterEntry>
  setStep35BC: React.Dispatch<React.SetStateAction<Record<string, BuyingCenterEntry>>>

  // Display data shared by multiple steps
  segmentNames: string[]
  primarySegmentName: string | null
  hasMultipleSegments: boolean

  // Step 9 (DCP Stage 3 read-only display)
  step9Data: Step9State | null

  // Steps 4-9: indicates DCP analysis is available so the buyer-research banner shows
  hasDcpAnalysis: boolean

  // Prerequisite step statuses for soft dependency warnings
  prereqContent: Record<string, PrereqInfo>

  // All steps for prev/next navigation
  allSteps: AllStep[]

  decayedConfidence: number | null
}

export function useStepContext(stepId: string): StepContext {
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)
  const [preferredModel, setPreferredModel] = useState('claude-sonnet-4-5')
  const [stepDef, setStepDef] = useState<StepDef | null>(null)
  const [content, setContent] = useState('')
  const [outputId, setOutputId] = useState<string | null>(null)
  const [outputVersion, setOutputVersion] = useState(1)
  const [loading, setLoading] = useState(true)

  const [step9Data, setStep9Data] = useState<Step9State | null>(null)
  const [hasDcpAnalysis, setHasDcpAnalysis] = useState(false)
  const [rawContent, setRawContent] = useState<Record<string, unknown> | null>(null)
  const [prereqContent, setPrereqContent] = useState<Record<string, PrereqInfo>>({})
  const [allSteps, setAllSteps] = useState<AllStep[]>([])
  const [decayedConfidence, setDecayedConfidence] = useState<number | null>(null)

  const [painPoints, setPainPoints] = useState<PainPoint[]>(DEFAULT_PAIN_POINTS)
  const [activeCount, setActiveCount] = useState(3)

  const [step2Segments, setStep2Segments] = useState<Segment[]>([
    { ...DEFAULT_SEGMENT },
    { ...DEFAULT_SEGMENT },
    { ...DEFAULT_SEGMENT },
  ])

  const [step3DMs, setStep3DMs] = useState<Record<string, DecisionMaker[]>>({
    segment_1: makeDMs(),
    segment_2: makeDMs(),
    segment_3: makeDMs(),
  })

  const [step35BC, setStep35BC] = useState<Record<string, BuyingCenterEntry>>({
    segment_1: makeBCEntry(),
    segment_2: makeBCEntry(),
    segment_3: makeBCEntry(),
  })

  const [segmentNames, setSegmentNames] = useState<string[]>(['Segment 1', 'Segment 2', 'Segment 3'])
  const [primarySegmentName, setPrimarySegmentName] = useState<string | null>(null)
  const [hasMultipleSegments, setHasMultipleSegments] = useState(false)

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

        // Load all steps for prev/next navigation. Filter through isJourneyStep
        // so the linear sequence (and the "Step X of N" footer total) covers
        // only the 38 canonical steps — sub-steps like 3.5 are reachable by
        // direct URL but skipped by prev/next.
        const { data: allStepRows } = await supabase
          .from('step_definition')
          .select('id, phase')
          .order('phase', { ascending: true })
        if (allStepRows) {
          const steps = (allStepRows as Array<Record<string, unknown>>)
            .map(r => ({
              id: String(r['id'] ?? ''),
              phase: Number(r['phase'] ?? 0),
            }))
            .filter(s => isJourneyStep(s.id))
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

  return {
    loading,
    workspaceId,
    preferredModel,
    stepDef,
    outputId,
    setOutputId,
    outputVersion,
    rawContent,
    content,
    setContent,
    painPoints,
    setPainPoints,
    activeCount,
    setActiveCount,
    step2Segments,
    setStep2Segments,
    step3DMs,
    setStep3DMs,
    step35BC,
    setStep35BC,
    segmentNames,
    primarySegmentName,
    hasMultipleSegments,
    step9Data,
    hasDcpAnalysis,
    prereqContent,
    allSteps,
    decayedConfidence,
  }
}
