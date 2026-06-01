import type { QuestionType, AudienceOption, SurveyState, Question } from './types'

export const STAGES = [
  { id: 1, name: 'Need Recognition',           description: 'What most often triggers the search for outside GTM help?' },
  { id: 2, name: 'Motivation to Act',          description: 'What business outcome is expected and what is the cost of inaction?' },
  { id: 3, name: 'Information Search',         description: 'Who initiates the search and where do they look first?' },
  { id: 4, name: 'Evaluation of Alternatives', description: 'Which partner types are considered and what proof is required?' },
  { id: 5, name: 'Select Set',                 description: 'Which partners made the shortlist and what eliminated the others?' },
  { id: 6, name: 'Purchase Decision',          description: 'Who controls budget and what is the typical investment range?' },
  { id: 7, name: 'Confirmation',               description: 'Who has final approval and what determines success within 90 days?' },
]

export const DEFAULT_SURVEY_QUESTIONS: Record<number, Array<{ text: string; type: QuestionType }>> = {
  1: [
    { text: 'What most often triggers your organization to consider outside GTM strategy help?', type: 'multiple_choice' },
    { text: 'How urgent is the need once it is recognized?', type: 'multiple_choice' },
  ],
  2: [
    { text: 'What is the primary business outcome you expect from a GTM strategy partner?', type: 'multiple_choice' },
    { text: 'What happens if you do nothing for the next 90 days?', type: 'scale' },
  ],
  3: [
    { text: 'Who typically initiates the search for an outside GTM strategy partner?', type: 'multiple_choice' },
    { text: 'Where do you look first to find or validate potential partners?', type: 'multiple_choice' },
  ],
  4: [
    { text: 'Which partner type are you most likely to hire for GTM strategy?', type: 'multiple_choice' },
    { text: 'Rank the top 5 criteria you use to evaluate potential partners.', type: 'multiple_choice' },
    { text: 'What proof do you require before moving a partner to the shortlist?', type: 'multiple_choice' },
  ],
  5: [
    { text: 'How many partners typically make your shortlist?', type: 'multiple_choice' },
    { text: 'What most often eliminates a partner during shortlisting?', type: 'multiple_choice' },
  ],
  6: [
    { text: 'Who controls the budget for hiring the GTM strategy partner?', type: 'multiple_choice' },
    { text: 'What is your typical budget range for GTM strategy support (initial engagement)?', type: 'multiple_choice' },
  ],
  7: [
    { text: 'Who has final approval or veto on selecting the GTM strategy partner?', type: 'multiple_choice' },
    { text: 'Within 90 days, what most determines whether you would rehire or refer the partner?', type: 'multiple_choice' },
  ],
}

// Same 15 questions as DEFAULT_SURVEY_QUESTIONS but flagged locked: true.
// These are the core DCP questions that must always be present in every survey.
export const LOCKED_QUESTIONS: Record<number, Array<Pick<Question, 'text' | 'type'>>> = {
  1: [
    { text: 'What most often triggers your organization to consider outside GTM strategy help?', type: 'multiple_choice' },
    { text: 'How urgent is the need once it is recognized?', type: 'multiple_choice' },
  ],
  2: [
    { text: 'What is the primary business outcome you expect from a GTM strategy partner?', type: 'multiple_choice' },
    { text: 'What happens if you do nothing for the next 90 days?', type: 'scale' },
  ],
  3: [
    { text: 'Who typically initiates the search for an outside GTM strategy partner?', type: 'multiple_choice' },
    { text: 'Where do you look first to find or validate potential partners?', type: 'multiple_choice' },
  ],
  4: [
    { text: 'Which partner type are you most likely to hire for GTM strategy?', type: 'multiple_choice' },
    { text: 'Rank the top 5 criteria you use to evaluate potential partners.', type: 'multiple_choice' },
    { text: 'What proof do you require before moving a partner to the shortlist?', type: 'multiple_choice' },
  ],
  5: [
    { text: 'How many partners typically make your shortlist?', type: 'multiple_choice' },
    { text: 'What most often eliminates a partner during shortlisting?', type: 'multiple_choice' },
  ],
  6: [
    { text: 'Who controls the budget for hiring the GTM strategy partner?', type: 'multiple_choice' },
    { text: 'What is your typical budget range for GTM strategy support (initial engagement)?', type: 'multiple_choice' },
  ],
  7: [
    { text: 'Who has final approval or veto on selecting the GTM strategy partner?', type: 'multiple_choice' },
    { text: 'Within 90 days, what most determines whether you would rehire or refer the partner?', type: 'multiple_choice' },
  ],
}

export const TYPE_ORDER: QuestionType[] = ['open', 'scale', 'multiple_choice']

export const TYPE_LABELS: Record<QuestionType, string> = {
  open: 'Open-ended',
  scale: 'Scale 1-10',
  multiple_choice: 'Multiple choice',
}

export const TYPE_COLORS: Record<QuestionType, { bg: string; color: string }> = {
  open:            { bg: 'rgba(14,165,233,0.15)', color: '#0EA5E9' },
  scale:           { bg: 'rgba(139,92,246,0.15)', color: '#A78BFA' },
  multiple_choice: { bg: 'rgba(232,82,10,0.15)',  color: '#E8520A' },
}

export const AUDIENCES: AudienceOption[] = [
  { id: 'internal',  label: 'Internal Stakeholders', stepId: 'survey-builder-internal' },
  { id: 'current',   label: 'Current Customers',     stepId: 'survey-builder-current' },
  { id: 'lost',      label: 'Lost Customers',        stepId: 'survey-builder-lost' },
  { id: 'potential', label: 'Potential Customers',   stepId: 'survey-builder-potential' },
]

export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function countAll(s: SurveyState): number {
  return Object.values(s).reduce((n, qs) => n + qs.length, 0)
}
