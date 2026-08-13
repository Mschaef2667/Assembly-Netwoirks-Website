import type { QuestionType, AudienceOption, SurveyState, Question } from './types'

// The seven canonical C3 buyer decision stages. Names and order are the single
// source of truth for the Survey Builder (mirrors lib/c3/decisionStages.ts).
// Descriptions frame what each stage's questions are meant to uncover.
export const STAGES = [
  { id: 1, name: 'Need',         description: 'The buyer realizes something is missing or could be better.' },
  { id: 2, name: 'Motivation',   description: 'Something turns that need into a reason to act now.' },
  { id: 3, name: 'Search',       description: 'They start looking for ways to solve it.' },
  { id: 4, name: 'Evaluation',   description: 'They compare options against what matters to them.' },
  { id: 5, name: 'Select Set',   description: 'They narrow to a short list of real contenders.' },
  { id: 6, name: 'Decision',     description: 'They choose, and justify the choice to themselves and others.' },
  { id: 7, name: 'Confirmation', description: 'They look for reassurance they made the right call.' },
]

// Core locked questions: two per stage, always present and tailored per client
// and audience by the Copilot. Written as neutral, tailorable templates.
export const LOCKED_QUESTIONS: Record<number, Array<Pick<Question, 'text' | 'type'>>> = {
  1: [
    { text: 'What first made you realize your current approach was not good enough?', type: 'open' },
    { text: 'Which best describes the gap you were trying to close?', type: 'multiple_choice' },
  ],
  2: [
    { text: 'What specific event or change moved this from "someday" to "now"?', type: 'multiple_choice' },
    { text: 'What happens if you do nothing about it for the next 90 days?', type: 'open' },
  ],
  3: [
    { text: 'Who typically starts looking for a solution once it becomes a priority?', type: 'multiple_choice' },
    { text: 'Where do you look first when searching for options?', type: 'multiple_choice' },
  ],
  4: [
    { text: 'Rank the criteria that matter most when comparing options.', type: 'multiple_choice' },
    { text: 'What proof or evidence do you need before you take an option seriously?', type: 'open' },
  ],
  5: [
    { text: 'How many options usually make your short list?', type: 'multiple_choice' },
    { text: 'What most often knocks an option off the short list?', type: 'open' },
  ],
  6: [
    { text: 'When it comes down to the final choice, what tips the decision one way or the other?', type: 'open' },
    { text: 'Who has to sign off, and how do you justify the choice to them?', type: 'multiple_choice' },
  ],
  7: [
    { text: 'After committing, what tells you early on that you made the right call?', type: 'open' },
    { text: 'Within the first 90 days, what most determines whether you would stay, renew, or refer?', type: 'multiple_choice' },
  ],
}

// Optional third question per stage. Surfaced via "Load recommended" as an
// unlocked suggestion the user can keep or remove.
export const SUGGESTED_QUESTIONS: Record<number, Array<Pick<Question, 'text' | 'type'>>> = {
  1: [{ text: 'How clearly defined was the problem when you first noticed it?', type: 'scale' }],
  2: [{ text: 'How urgent did solving this become once that shift happened?', type: 'scale' }],
  3: [{ text: 'Which sources do you trust most when researching?', type: 'multiple_choice' }],
  4: [{ text: 'How do you usually compare options against each other?', type: 'multiple_choice' }],
  5: [{ text: 'What earns an option a place on the short list?', type: 'multiple_choice' }],
  6: [{ text: 'What is the biggest risk you weigh before committing?', type: 'open' }],
  7: [{ text: 'What would make you regret the decision?', type: 'open' }],
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
  return Object.values(s).reduce(
    (n, qs) => n + qs.filter(q => q.text.trim().length > 0).length,
    0,
  )
}
