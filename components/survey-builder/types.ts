export type QuestionType = 'open' | 'scale' | 'multiple_choice'

export interface Question {
  id: string
  text: string
  type: QuestionType
  stageId: number
}

export type SurveyState = Record<number, Question[]>

export type CopilotStatus = 'idle' | 'generating' | 'done' | 'error'

export type Audience = 'internal' | 'current' | 'lost' | 'potential'

export interface AudienceOption {
  id: Audience
  label: string
  stepId: string
}
