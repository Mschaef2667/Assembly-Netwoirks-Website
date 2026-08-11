'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, ClipboardList, Mic, Lock } from 'lucide-react'
import { useSurveyState } from '@/components/survey-builder/useSurveyState'
import { countAll } from '@/components/survey-builder/constants'
import SurveyAudienceTabs from '@/components/survey-builder/SurveyAudienceTabs'
import SurveyStageList from '@/components/survey-builder/SurveyStageList'
import SurveyCopilotPanel from '@/components/survey-builder/SurveyCopilotPanel'

export default function SurveyBuilderPage() {
  const [selectedMode, setSelectedMode] = useState<'survey' | 'interview'>('survey')

  const {
    survey, openStages, editingId, editText, copilotStatus, stageCounts,
    copilotError, orgId, orgName, saveState, copyDone, loading, selectedAudience,
    hoveringQId, isApproved, markingComplete,
    segments, selectedSegment, autoWordingStatus, autoWordingLabel,
    probes,
    setEditingId, setEditText, setHoveringQId,
    handleAudienceSwitch, handleSegmentSwitch,
    toggleStage, addQuestion, deleteQuestion, restoreQuestion,
    commitEdit, cycleType, handleMarkComplete, handleLoadRecommended,
    handleGenerate, handleCopy, handleDownloadReview,
    addMissingLockedQuestions,
    generateInterviewProbes,
    handleAutoWord,
  } = useSurveyState()

  function handleModeSwitch(mode: 'survey' | 'interview') {
    setSelectedMode(mode)
    if (mode === 'interview') {
      void generateInterviewProbes()
    }
  }

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  // Gate the Survey Builder behind the company foundation. Without target-market
  // segments (Step 2), the Copilot has no context to tailor questions to, so it
  // would only produce generic, un-personalized prompts. Guide the user to
  // complete Phase 1 first instead of showing empty-context questions.
  if (segments.length === 0) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ maxWidth: '540px', backgroundColor: '#0F2140', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '14px', padding: '36px 32px', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Lock size={22} color="#0EA5E9" />
          </div>
          <h1 style={{ color: '#FFFFFF', fontSize: '20px', fontWeight: 700, margin: '0 0 10px' }}>
            Set up your foundation first
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', lineHeight: 1.6, margin: '0 0 22px' }}>
            The Survey Builder tailors buyer-research questions to your business. Before it can do that, complete your{' '}
            <strong style={{ color: '#FFFFFF' }}>Company Profile</strong>,{' '}
            <strong style={{ color: '#FFFFFF' }}>Target Markets</strong>, and{' '}
            <strong style={{ color: '#FFFFFF' }}>Decision Makers</strong>. Once those are in, your questions come out tailored to your company, segments, and buyers.
          </p>
          <Link href="/dashboard/journeys" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#E8520A', color: '#FFFFFF', textDecoration: 'none', borderRadius: '8px', padding: '12px 22px', fontSize: '14px', fontWeight: 600, minHeight: '44px' }}>
            Go to your journey
          </Link>
        </div>
      </div>
    )
  }

  // Counts only filled questions (empty placeholder slots don't count).
  // 15-20 per audience is the ideal range; above 20 is a soft warning, not a block.
  const total           = countAll(survey)
  const inIdealRange    = total >= 15 && total <= 20
  const aboveSoftCap    = total > 20
  const counterColor    = aboveSoftCap ? '#EAB308' : inIdealRange ? '#16A34A' : 'rgba(255,255,255,0.7)'
  const progressPct     = Math.min((total / 20) * 100, 100)
  const progressColor   = aboveSoftCap ? '#EAB308' : inIdealRange ? '#16A34A' : '#0EA5E9'

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>

      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>
              Decision Clarity Process Survey Builder
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
              Generate buyer research questions across all 7 buying stages. Aim for 15–20 questions per audience.
            </p>
          </div>
          <span style={{
            fontSize: '13px', paddingTop: '4px', flexShrink: 0,
            color: saveState === 'saved' ? '#16A34A' : saveState === 'error' ? '#EF4444' : 'rgba(255,255,255,0.35)',
          }}>
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && 'Saved'}
            {saveState === 'error' && 'Save failed'}
          </span>
        </div>
      </header>

      {/* Mode toggle */}
      <div style={{ padding: '16px 32px 0', display: 'flex', gap: '8px' }}>
        {(['survey', 'interview'] as const).map(m => (
          <button
            key={m}
            onClick={() => handleModeSwitch(m)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '8px 18px', minHeight: '40px',
              borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '14px', fontWeight: 700,
              backgroundColor: selectedMode === m ? '#E8520A' : 'rgba(255,255,255,0.07)',
              color: selectedMode === m ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            {m === 'survey'
              ? <><ClipboardList size={15} /> Survey Mode</>
              : <><Mic size={15} /> Interview Mode</>
            }
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '24px', padding: '28px 32px', alignItems: 'flex-start' }}>

        {/* Left: survey editor (60%) */}
        <div style={{ flex: '0 0 60%', minWidth: 0 }}>

          <SurveyAudienceTabs
            selectedAudience={selectedAudience}
            onSwitch={audience => void handleAudienceSwitch(audience)}
            segments={segments}
            selectedSegment={selectedSegment}
            onSegmentChange={segment => void handleSegmentSwitch(segment)}
          />

          {/* Question counter */}
          <div style={{
            backgroundColor: '#0F2140', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px', marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 700, color: counterColor }}>
                {total} {total === 1 ? 'question' : 'questions'} · ideal range 15–20
              </span>
              {total < 15 && (
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                  {15 - total} to reach 15
                </span>
              )}
            </div>
            <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                backgroundColor: progressColor, borderRadius: '3px', transition: 'width 0.3s ease',
              }} />
            </div>
            {aboveSoftCap && (
              <div style={{
                marginTop: '10px', padding: '8px 10px', borderRadius: '6px',
                backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)',
              }}>
                <p style={{ fontSize: '12px', color: '#EAB308', margin: 0, lineHeight: '1.5' }}>
                  Past 20 questions, completion rates drop — consider trimming.
                </p>
              </div>
            )}
          </div>

          {/* Auto-wording loading state */}
          {autoWordingStatus === 'loading' ? (
            <div style={{
              backgroundColor: '#0F2140', borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.1)', padding: '40px 24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
            }}>
              <Loader2 size={28} className="animate-spin" style={{ color: '#0EA5E9' }} />
              <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', margin: 0, textAlign: 'center' }}>
                Tailoring questions for <strong style={{ color: '#FFFFFF' }}>{autoWordingLabel}</strong>…
              </p>
            </div>
          ) : (
            <SurveyStageList
              survey={survey}
              openStages={openStages}
              editingId={editingId}
              editText={editText}
              hoveringQId={hoveringQId}
              isApproved={isApproved}
              mode={selectedMode}
              probes={probes}
              onToggleStage={toggleStage}
              onAddQuestion={addQuestion}
              onDeleteQuestion={deleteQuestion}
              onRestoreQuestion={restoreQuestion}
              onCommitEdit={commitEdit}
              onCycleType={cycleType}
              onSetEditingId={setEditingId}
              onSetEditText={setEditText}
              onSetHoveringQId={setHoveringQId}
            />
          )}
        </div>

        {/* Right: Copilot panel (40%) */}
        <SurveyCopilotPanel
          copilotStatus={copilotStatus}
          stageCounts={stageCounts}
          copilotError={copilotError}
          orgId={orgId}
          selectedAudience={selectedAudience}
          survey={survey}
          total={total}
          copyDone={copyDone}
          isApproved={isApproved}
          markingComplete={markingComplete}
          mode={selectedMode}
          probes={probes}
          selectedSegment={selectedSegment}
          orgName={orgName}
          autoWordingStatus={autoWordingStatus}
          onAutoWord={handleAutoWord}
          onGenerate={handleGenerate}
          onLoadRecommended={handleLoadRecommended}
          onCopy={handleCopy}
          onDownloadReview={handleDownloadReview}
          onMarkComplete={() => void handleMarkComplete()}
          onAddMissingLockedQuestions={addMissingLockedQuestions}
        />
      </div>
    </div>
  )
}
