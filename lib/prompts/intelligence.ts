import type { PromptContext } from './types'

export function buildPrompt(stepId: string, ctx: PromptContext): string {
  const { extraContext } = ctx

  if (stepId === 'survey-builder') {
    const audienceMatch = typeof extraContext === 'string' ? extraContext.match(/^Audience:\s*(.+)$/m) : null
    const audienceLabel = audienceMatch ? audienceMatch[1].trim() : 'Current Customers'

    return `CRITICAL: Your response must start with { and end with }. No markdown, no backticks, no prose, no explanation before or after the JSON.

ROLE: You are Co-CSO, an AI-forward customer decision intelligence strategist using the C3 Method.

GOAL: Generate exactly 14 survey questions that uncover how buyers make decisions when purchasing the client's product, service, or cause. Questions must work across all target segments and decision maker roles defined in Phase 1 data. Questions should be generic enough to apply across segments but specific enough to surface real buying behavior.

QUESTION STYLE (follow these rules strictly):
- Behavioral: 'What most often triggers...' 'Who typically initiates...'
- Comparative: 'Which of these best describes...' 'Rank the following...'
- Process: 'Who did what, and when?' 'How many options made your short list?'
- Risk/objection: 'What most often eliminates an option?' 'What would cause you to delay?'
- Keep each question under 20 words
- No jargon, no double-barreled questions
- Use 'Other (please specify)' where appropriate
- Response types must be analyzable: include at least 2 ranking questions, 2 select-all-that-apply, 2 numeric/range or scale questions

STAGE FRAMEWORK (use these exact stage names and distribute questions exactly as shown, 2 per stage):
Stage 1 — Need (2 questions): What made them realize the current approach is not good enough? How do they describe the gap?
Stage 2 — Motivation (2 questions): What event turned the need into urgency? What is the cost of doing nothing?
Stage 3 — Search (2 questions): Who initiates the search? Where do they look first?
Stage 4 — Evaluation (2 questions): Which criteria matter most? What proof is required?
Stage 5 — Select Set (2 questions): How many make the short list? What eliminates an option?
Stage 6 — Decision (2 questions): What tips the final choice? Who signs off and how do they justify it?
Stage 7 — Confirmation (2 questions): What signals early that it was the right call? What determines success, renewal, or referral?

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
    const questionCount = questionTexts.length

    return `You are an expert survey designer. You will receive ${questionCount} DCP survey questions and context about a specific company, target segment, and audience. Reword each question to fit the specific context — replace generic terms with the company name, product, service, or cause description, ICP-specific job titles, key challenges, and buying triggers. Use the actual ICP profiles below (not just segment names) so questions reference the real roles, pains, and triggers buyers experience. Keep the core meaning and structure of each question identical. Return ONLY valid JSON: { "questions": [{ "stage": <number>, "text": "<reworded question>" }] } with exactly ${questionCount} items in the same order received. No markdown, no prose.

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

QUESTIONS TO REWORD (keep the same order, return exactly ${questionCount}):
${questionsBlock || '(no questions provided — return an empty questions array)'}`
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

  if (stepId === 'survey-builder-interview-transcript') {
    let questions: Array<{ question_id: string; text: string; stage: number }> = []
    let transcript = ''
    try {
      const parsed = JSON.parse(extraContext ?? '{}') as {
        questions?: Array<{ question_id: string; text: string; stage: number }>
        transcript?: string
      }
      if (parsed.questions) questions = parsed.questions
      if (parsed.transcript) transcript = parsed.transcript
    } catch { /* non-fatal */ }

    const questionsBlock = questions
      .map((q, i) => `${i + 1}. [ID: ${q.question_id}] [Stage ${q.stage}] ${q.text}`)
      .join('\n')

    return `You are processing a recorded buyer interview transcript for the C3 Method decision journey. The interviewer worked from a fixed question list, reading each main question aloud before the answer, then probing freely.

Your job is to extract what the INTERVIEWEE said in response to each question.

RULES, in priority order:

1. NEVER INVENT AN ANSWER. This is the most important rule. These answers become the evidence base for the client's entire go-to-market strategy. A fabricated or inferred answer is far worse than a missing one. If a question was not actually asked, or was asked but not meaningfully answered, omit that question_id entirely from your output.

2. USE THE INTERVIEWEE'S OWN WORDS. Quote them as closely as the transcript allows. Do not paraphrase, summarise, tidy the grammar, or make the answer more articulate than it was. Their exact phrasing is the entire point. Light cleanup of transcription artifacts (stray "um", duplicated words from a stutter, obvious mis-transcriptions) is fine. Rewriting is not.

3. INCLUDE THE FOLLOW-UPS. An answer usually spans the initial reply plus whatever came out during probing. Combine those into one answer for that question, in the order spoken. Do not include the interviewer's own words.

4. MATCH ON MEANING, NOT JUST WORDING. The interviewer may have rephrased slightly or asked questions out of order. Match an exchange to the question it actually addresses. If a passage genuinely answers two questions, assign it to the better fit and do not duplicate it.

5. ATTRIBUTE ONLY THE INTERVIEWEE. Transcripts label speakers inconsistently. The interviewee is the person answering, not the one asking. If a third party is present, include only material from the person being interviewed.

Return ONLY valid JSON starting with { and ending with }:
{ "answers": [{ "question_id": "<id>", "answer": "<what they said>", "confidence": "high" | "low" }] }

Set confidence to "low" when you matched a passage to a question by inference rather than because the question was clearly asked, so a human can check it. Omit unanswered questions entirely. No markdown, no prose, no explanation.

QUESTIONS ASKED:
${questionsBlock || '(no questions provided)'}

TRANSCRIPT:
${transcript || '(no transcript provided)'}`
  }

  return ''
}
