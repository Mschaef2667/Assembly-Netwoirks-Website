'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Loader2, Wand2, ShieldCheck, Sparkles, HelpCircle, AlertTriangle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import TipsPanel from '@/components/ui/TipsPanel'
import { STEP_TIPS } from '@/lib/tips'

import PainPointStepEditor from '@/components/journeys/PainPointStepEditor'
import CompetitorStepEditor from '@/components/journeys/CompetitorStepEditor'
import AssessmentStepEditor from '@/components/journeys/AssessmentStepEditor'
import BlendEditor from '@/components/journeys/BlendEditor'
import ActionPlanEditor from '@/components/journeys/ActionPlanEditor'
import DealScorecard from '@/components/journeys/DealScorecard'
import AcidTestEditor from '@/components/journeys/AcidTestEditor'
import CompetitiveEvaluationEditor from '@/components/journeys/CompetitiveEvaluationEditor'
import DecisionProcessEditor from '@/components/journeys/DecisionProcessEditor'

import { Step2Editor } from '@/components/journeys/Step2Editor'
import { Step3Editor } from '@/components/journeys/Step3Editor'
import { Step35Editor } from '@/components/journeys/Step35Editor'
import { Step4Editor } from '@/components/journeys/Step4Editor'
import { Step9Display } from '@/components/journeys/Step9Display'
import { ActionButton } from '@/components/journeys/shared/ActionButton'
import { ConfidenceBadge } from '@/components/journeys/shared/ConfidenceBadge'
import { SaveIndicator } from '@/components/journeys/shared/SaveIndicator'
import { StepNavBar } from '@/components/journeys/shared/StepNavBar'

import {
  ACTION_PLAN_STEPS,
  ASSESSMENT_STEPS,
  AUTOSAVE_DELAY_MS,
  AUTO_APPLY_STEPS,
  BLEND_STEPS,
  LABEL_STYLE,
  PAIN_POINT_STEPS,
  PANEL_CARD,
  PRIMARY_CONCERN_MAP,
  STEP4_AUTOSAVE_DELAY_MS,
  buildWarningMessage,
  calculateContentQuality,
  copilotErrorMessage,
  extractDraft,
  hasContentForStep,
  makeBCEntry,
  makeDMs,
  type BuyingCenterEntry,
  type CopilotAction,
  type CopilotOutput,
  type DecisionMaker,
  type PainPoint,
  type RoleCategory,
  type SaveState,
  type SaveStatus,
  type Segment,
  type Step4Content,
} from '@/lib/journeys/stepHelpers'
import { useStepContext } from '@/lib/journeys/stepContext'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function StepPage() {
  const { stepId } = useParams<{ stepId: string }>()

  const ctx = useStepContext(stepId)
  const {
    loading, workspaceId, preferredModel, stepDef,
    outputId, setOutputId, outputVersion, rawContent,
    content, setContent,
    painPoints, setPainPoints,
    activeCount, setActiveCount,
    step2Segments, setStep2Segments,
    step3DMs, setStep3DMs,
    step35BC, setStep35BC,
    segmentNames, primarySegmentName, hasMultipleSegments,
    step9Data, hasDcpAnalysis, prereqContent, allSteps,
  } = ctx

  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  const [activeTab, setActiveTab] = useState(1)
  const [step3ActiveTab, setStep3ActiveTab] = useState(0)
  const [step35ActiveTab, setStep35ActiveTab] = useState(0)

  // Reflect "saved" once outputId becomes known on Steps 2 / 3 / 3.5
  useEffect(() => {
    if ((stepId === '2' || stepId === '3' || stepId === '3.5') && outputId !== null) {
      setSaveStatus('saved')
    }
  }, [stepId, outputId])

  const [draftApplied, setDraftApplied] = useState(false)
  const [showAppliedFlash, setShowAppliedFlash] = useState(false)
  const [rawContentUpdated, setRawContentUpdated] = useState(false)
  const [warningDismissed, setWarningDismissed] = useState(false)

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
  }, [outputId, outputVersion, stepId, setOutputId])

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
  }, [outputId, outputVersion, stepId, setOutputId])

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
  }, [outputId, outputVersion, stepId, setOutputId])

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
  }, [outputId, outputVersion, stepId, setOutputId])

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
  }, [outputId, outputVersion, stepId, setOutputId])

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

  const hasContent = hasContentForStep({
    stepId, content, painPoints, activeCount, outputId, rawContent, rawContentUpdated,
  })

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

  const navBar = (
    <StepNavBar stepId={stepId} total={allSteps.length} prevId={prevStep?.id ?? null} nextId={nextStep?.id ?? null} hasContent={hasContent} />
  )

  if (ASSESSMENT_STEPS.has(stepId) && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1400px', flex: 1 }}>
          {warningBanner}
          <AssessmentStepEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
            onContentChange={hasNonEmptyContent => setRawContentUpdated(hasNonEmptyContent)}
          />
        </div>
        {navBar}
      </div>
    )
  }

  if (stepId === '16' && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1400px', flex: 1 }}>
          {warningBanner}
          <AcidTestEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
            onContentChange={hasNonEmptyContent => setRawContentUpdated(hasNonEmptyContent)}
          />
        </div>
        {navBar}
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
        {navBar}
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
        {navBar}
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
        {navBar}
      </div>
    )
  }

  if (stepId === '17' && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1400px', flex: 1 }}>
          {warningBanner}
          <CompetitorStepEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
            onContentChange={hasNonEmptyContent => setRawContentUpdated(hasNonEmptyContent)}
          />
        </div>
        {navBar}
      </div>
    )
  }

  if (stepId === '22' && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1400px', flex: 1 }}>
          {warningBanner}
          <CompetitiveEvaluationEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
            onContentChange={hasNonEmptyContent => setRawContentUpdated(hasNonEmptyContent)}
          />
        </div>
        {navBar}
      </div>
    )
  }

  if (stepId === '23' && workspaceId) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {header}
        <div style={{ padding: '28px 32px', maxWidth: '1400px', flex: 1 }}>
          {warningBanner}
          <DecisionProcessEditor
            workspaceId={workspaceId}
            stepId={stepId}
            stepTitle={stepTitle}
            preferredModel={preferredModel}
            onContentChange={hasNonEmptyContent => setRawContentUpdated(hasNonEmptyContent)}
          />
        </div>
        {navBar}
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
            autoGenerate={AUTO_APPLY_STEPS.has(stepId)}
            tabLabel={stepId === '12' ? 'CVP' : stepId === '15' ? 'KSP' : stepId === '17' || stepId === '19' || stepId === '20' || stepId === '21' || stepId === '24' || stepId === '26' ? 'Comp' : undefined}
            showUpstreamContext={stepId === '12'}
            onContentChange={hasNonEmptyContent => setRawContentUpdated(hasNonEmptyContent)}
            tips={STEP_TIPS[stepId]}
          />
        </div>
        {navBar}
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
        {navBar}
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
            tips={STEP_TIPS[stepId]}
            {...(stepId === '37' ? { tabLabel: 'Tool' } : {})}
            onContentChange={hasNonEmptyContent => setRawContentUpdated(hasNonEmptyContent)}
          />
        </div>
        {navBar}
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
        {navBar}
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {header}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', padding: '28px 32px', maxWidth: '1200px' }}>

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

        <div id="step-cvp-copilot-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <TipsPanel tips={STEP_TIPS[stepId] ?? []} />

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
      {navBar}
    </div>
  )
}
