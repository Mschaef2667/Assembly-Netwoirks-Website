'use client'

import { Loader2 } from 'lucide-react'
import { useSurveyState } from '@/components/survey-builder/useSurveyState'
import { countAll } from '@/components/survey-builder/constants'
import SurveyAudienceTabs from '@/components/survey-builder/SurveyAudienceTabs'
import SurveyStageList from '@/components/survey-builder/SurveyStageList'
import SurveyCopilotPanel from '@/components/survey-builder/SurveyCopilotPanel'

export default function SurveyBuilderPage() {
  const {
    survey, openStages, editingId, editText, copilotStatus, stageCounts,
    copilotError, orgId, saveState, copyDone, loading, selectedAudience,
    hoveringQId, isApproved, markingComplete,
    segments, selectedSegment, autoWordingStatus, autoWordingLabel,
    setEditingId, setEditText, setHoveringQId,
    handleAudienceSwitch, handleSegmentSwitch,
    toggleStage, addQuestion, deleteQuestion, restoreQuestion,
    commitEdit, cycleType, handleMarkComplete, handleLoadRecommended,
    handleGenerate, handleCopy, handleDownloadCSV,
    addMissingLockedQuestions,
  } = useSurveyState()

  if (loading) {
    return (
      <div style={{ backgroundColor: '#0A1628', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'rgba(255,255,255,0.4)' }} />
      </div>
    )
  }

  const total            = countAll(survey)
  const aboveRecommended = total > 15
  const counterColor     = aboveRecommended ? '#EAB308' : total > 12 ? '#E8520A' : 'rgba(255,255,255,0.7)'
  const progressPct      = Math.min((total / 20) * 100, 100)
  const progressColor    = aboveRecommended ? '#EAB308' : total > 12 ? '#E8520A' : '#0EA5E9'

  return (
    <div style={{ backgroundColor: '#0A1628', minHeight: '100vh' }}>

      <header style={{ backgroundColor: '#0A1628', padding: '24px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ color: '#FFFFFF', fontSize: '22px', fontWeight: 700, margin: 0 }}>
              Decision Clarity Process Survey Builder
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px', margin: '6px 0 0' }}>
              Generate buyer research questions across all 7 buying stages. Keep it under 15 questions for best completion rates.
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
                {aboveRecommended ? `${total} questions (above recommended)` : `${total} of 15 recommended`}
              </span>
              {!aboveRecommended && (
                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                  {Math.max(0, 15 - total)} remaining
                </span>
              )}
            </div>
            <div style={{ height: '6px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                backgroundColor: progressColor, borderRadius: '3px', transition: 'width 0.3s ease',
              }} />
            </div>
            {total >= 15 && (
              <div style={{
                marginTop: '10px', padding: '8px 10px', borderRadius: '6px',
                backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)',
              }}>
                <p style={{ fontSize: '12px', color: '#EAB308', margin: 0, lineHeight: '1.5' }}>
                  You have reached the recommended maximum of 15 questions. Additional questions may reduce completion rates.
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
              total={total}
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
          onGenerate={handleGenerate}
          onLoadRecommended={handleLoadRecommended}
          onCopy={handleCopy}
          onDownloadCSV={handleDownloadCSV}
          onMarkComplete={() => void handleMarkComplete()}
          onAddMissingLockedQuestions={addMissingLockedQuestions}
        />
      </div>
    </div>
  )
}
