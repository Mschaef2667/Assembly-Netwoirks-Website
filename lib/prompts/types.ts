import type { ContextPacket } from '@/lib/context/resolveContextPacket'

export interface PromptContext {
  stepId: string
  stepTitle: string
  stepDescription: string
  currentContent: string
  extraContext?: string
  isImprove: boolean

  contextPacket: ContextPacket

  // DCP data (steps 4-9, 22)
  dcpStage1Summary: string
  dcpStage2Summary: string
  dcpStage3Summary: string
  dcpStage4Summary: string
  dcpStage5Summary: string
  dcpStage6Summary: string

  // Survey-builder data
  surveyBuilderStep1: string
  surveyBuilderStep2: string
  surveyBuilderStep3: string
  surveyBuilderIcpBlock: string

  // Step 1 web search results
  webSearchResults: string

  // Pre-fetched non-dependency step content
  step3Text: string
  step12Text: string
  step13Text: string
  step14Text: string
  step17Text: string
  step18Text: string
  step19Text: string
}

export const DCP_RESEARCH_INSTRUCTION = 'DCP RESEARCH: Use the following buyer research to ground this step in real data rather than assumptions. The research reflects what actual buyers told us about their decision journey.'

export function stepText(ctx: PromptContext, stepId: string): string {
  const row = ctx.contextPacket.prerequisites.find(p => p.step_id === stepId)
  return row ? JSON.stringify(row.content, null, 2) : 'Not yet available.'
}

export function provisionalNote(ctx: PromptContext): string {
  return ctx.contextPacket.is_provisional
    ? '\nNOTE: Some prerequisite data is not yet approved — mark confidence accordingly.\n'
    : ''
}
