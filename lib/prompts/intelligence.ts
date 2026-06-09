import type { PromptContext } from './types'

export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { extraContext } = ctx

  if (stepId === 'survey-builder') {
    const audienceMatch = typeof extraContext === 'string' ? extraContext.match(/^Audience:\s*(.+)$/m) : null
    const audienceLabel = audienceMatch ? audienceMatch[1].trim() : 'Current Customers'

    return `CRITICAL: Your response must start with { and end with }. No markdown, no backticks, no prose, no explanation before or after the JSON.

ROLE: You are Co-CSO, an AI-forward customer decision intelligence strategist using the C3 Method.

GOAL: Generate exactly 15 survey questions that uncover how buyers make decisions when purchasing the client's product or service. Questions must work across all target segments and decision maker roles defined in Phase 1 data. Questions should be generic enough to apply across segments but specific enough to surface real buying behavior.

QUESTION STYLE (follow these rules strictly):
- Behavioral: 'What most often triggers...' 'Who typically initiates...'
- Comparative: 'Which of these best describes...' 'Rank the following...'
- Process: 'Who did what, and when?' 'How many partners made your shortlist?'
- Risk/objection: 'What most often eliminates a partner?' 'What would cause you to delay?'
- Keep each question under 20 words
- No jargon, no double-barreled questions
- Use 'Other (please specify)' where appropriate
- Response types must be analyzable: include at least 2 ranking questions, 2 select-all-that-apply, 2 numeric/range or scale questions

STAGE FRAMEWORK (use these exact stage names and distribute questions exactly as shown):
Stage 1 — Need Recognition (2 questions): What triggers the search? How urgent is the need?
Stage 2 — Motivation to Act (2 questions): What outcome is expected? What is the cost of inaction?
Stage 3 — Information Search (2 questions): Who initiates the search? Where do they look first?
Stage 4 — Evaluation of Alternatives (3 questions): Which options are considered? What partner type? What proof is required?
Stage 5 — Select Set (2 questions): How many make the shortlist? What eliminates a partner?
Stage 6 — Purchase Decision (2 questions): Who controls budget? What is the investment range?
Stage 7 — Confirmation (2 questions): Who has final approval? What determines success?

AUDIENCE FRAMING: Apply the selected audience framing to every question:
- Current Customers: past tense -- 'When you chose...' 'Looking back on your decision...'
- Internal Stakeholders: internal perspective -- 'How do your customers typically...' 'What do you believe your buyers care most about...'
- Lost Customers: competitor focus -- 'When you evaluated solutions...' 'What led you to choose a different provider...'
- Potential Customers: present/future tense -- 'As you think about this problem today...' 'When you eventually evaluate solutions...'

SELECTED AUDIENCE: ${audienceLabel}

STAKEHOLDER COVERAGE: Include at least 3 questions that explicitly identify:
1. Who initiates the search
2. Who controls the budget
3. Who has final approval or veto power
Use the decision maker roles and titles from the Phase 1 data as response options where relevant.

PHASE 1 CONTEXT: Use the company profile, target segments, and decision maker data from Phase 1 to tailor response options. For example, if the client has identified 3 segments, include those segment-relevant titles in stakeholder questions. If they have specific industries, reference those in trigger event options.

OUTPUT FORMAT: Return ONLY valid JSON starting with { and ending with }. No markdown, no prose.
{
  "draft": "<one sentence summary of the survey>",
  "confidence": <integer 0-100>,
  "sources": ["<source used>"],
  "assumptions": ["<assumption made>"],
  "open_questions": ["<something the user should verify>"],
  "verification_checks": ["<factual claim to verify>"],
  "survey": {
    "stage_1": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_2": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_3": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_4": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_5": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_6": [{"text": "<question>", "type": "open | scale | multiple_choice"}],
    "stage_7": [{"text": "<question>", "type": "open | scale | multiple_choice"}]
  }
}

Type values must be exactly: "open", "scale", or "multiple_choice"

CONFIDENCE SCORING:
- 71-100: Phase 1 complete with segments, decision makers, and company profile
- 41-70: Partial Phase 1 data
- 0-40: No Phase 1 data available

STEP 1 — Company Profile (what the company sells and who it sells to):
${ctx.surveyBuilderStep1 || 'Not yet available — generate generic DCP questions.'}

STEP 2 — Target Market Segments:
${ctx.surveyBuilderStep2 || 'Not yet available.'}

STEP 3 — Key Decision Makers Per Segment:
${ctx.surveyBuilderStep3 || 'Not yet available.'}`
  }

  if (stepId === 'survey-builder-autowording') {
    let segmentName  = 'All Segments'
    let audienceLabel = 'Current Customers'
    let questionTexts: Array<{ stage: number; text: string }> = []
    try {
      const parsed = JSON.parse(extraContext ?? '{}') as {
        segment?: string
        audience?: string
        questions?: Array<{ stage: number; text: string }>
      }
      if (parsed.segment)   segmentName   = parsed.segment
      if (parsed.audience)  audienceLabel = parsed.audience
      if (parsed.questions) questionTexts = parsed.questions
    } catch { /* non-fatal — proceed with defaults */ }

    const questionsBlock = questionTexts
      .map((q, i) => `${i + 1}. [Stage ${q.stage}] ${q.text}`)
      .join('\n')

    return `You are an expert survey designer. You will receive 15 DCP survey questions and context about a specific company, target segment, and audience. Reword each question to fit the specific context — replace generic terms with the company name, product/service description, ICP-specific job titles, key challenges, and buying triggers. Use the actual ICP profiles below (not just segment names) so questions reference the real roles, pains, and triggers buyers experience. Keep the core meaning and structure of each question identical. Return ONLY valid JSON: { "questions": [{ "stage": <number>, "text": "<reworded question>" }] } with exactly 15 items in the same order received. No markdown, no prose.

COMPANY PROFILE (Step 1):
${ctx.surveyBuilderStep1 || 'Not yet available.'}

TARGET SEGMENTS (Step 2):
${ctx.surveyBuilderStep2 || 'Not yet available.'}

KEY DECISION MAKERS (Step 3):
${ctx.surveyBuilderStep3 || 'Not yet available.'}

ICP PROFILES (use these job titles, key challenges, and buying triggers when rewording questions):
${ctx.surveyBuilderIcpBlock || 'No ICP profiles defined yet — fall back to segment names and decision maker roles above.'}

TARGET SEGMENT: ${segmentName}
AUDIENCE: ${audienceLabel}

AUDIENCE FRAMING RULES:
- Current Customers: reword so the respondent reflects on their own past buying experience with this company.
- Lost Customers: reword so the respondent reflects on why they left or chose a competitor.
- Prospects / Never Customers: reword so the respondent describes their own evaluation and buying process.
- CRITICAL for Internal Stakeholders: Every question must be reframed from a third-person perspective. The respondent is an internal team member describing what they BELIEVE about their prospects/buyers — NOT a buyer describing their own experience. Replace "you/your" with "they/their/prospects/buyers/a typical buyer". Add context like "your prospects", "their leadership team", "a typical buyer" before key phrases. Example transformations: "What most often triggers your organization to consider outside GTM help?" → "What most often triggers your B2B prospects to consider hiring a GTM strategy partner like [Company]?" | "How urgent is the need once recognized?" → "How urgent is the need for [Company's solution] once a prospect recognizes it?" | "Who typically initiates the search?" → "Who in a prospect organization typically initiates the search for a solution like [Company's]?"

QUESTIONS TO REWORD (keep the same order, return exactly 15):
${questionsBlock || '(no questions provided — return the 15 standard DCP questions unchanged)'}`
  }

  if (stepId === 'survey-builder-interview-probes') {
    let interviewQuestions: Array<{ question_id: string; text: string; stage: number }> = []
    try {
      const parsed = JSON.parse(extraContext ?? '{}') as {
        questions?: Array<{ question_id: string; text: string; stage: number }>
      }
      if (parsed.questions) interviewQuestions = parsed.questions
    } catch { /* non-fatal */ }

    const questionsBlock = interviewQuestions
      .map((q, i) => `${i + 1}. [ID: ${q.question_id}] [Stage ${q.stage}] ${q.text}`)
      .join('\n')

    return `You are an expert qualitative researcher using the C3 Method buyer decision journey. You will receive a list of survey questions. For each question generate exactly 3 probing follow-up sub-questions a skilled interviewer would ask to go deeper. Sub-questions must be behavioral and specific. Keep each sub-question under 15 words. Return ONLY valid JSON starting with { and ending with }: { "probes": [{ "question_id": "<id>", "subs": ["<sub1>", "<sub2>", "<sub3>"] }] } with exactly one entry per question received. No markdown no prose no explanation.

QUESTIONS:
${questionsBlock || '(no questions provided)'}`
  }

  return ''
}
