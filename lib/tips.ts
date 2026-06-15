export interface Tip {
  headline: string
  body: string
}

export const STEP_TIPS: Record<string, Tip[]> = {
  '1': [
    { headline: 'Be specific about what you sell', body: 'Describe your primary product, service, or cause, not everything you offer. Specificity helps Copilot generate better downstream content.' },
    { headline: 'Use your buyers language', body: 'Avoid internal jargon. Write your product description the way your best customer would describe it to a colleague.' },
    { headline: 'Name your primary use case', body: 'Focus on the one problem you solve best, not every possible application. This keeps your messaging sharp.' },
  ],
  '2': [
    { headline: 'Your best segment is who you have already won', body: 'Start with customers you have closed and work backwards. The pattern in your wins is your real target market.' },
    { headline: 'Smaller and specific beats broad', body: 'A segment of 500 companies you can name beats a market of 50,000 you cannot. Specificity drives conversion.' },
    { headline: 'Industry plus size plus geography equals a real segment', body: 'All three fields together create a segment you can actually target with a list.' },
  ],
  '3': [
    { headline: 'Find the blocker before you pitch', body: 'Every B2B deal has at least one person who can kill it. Map them in this step before you build messaging around them.' },
    { headline: 'Primary concern drives the message', body: 'The decision maker title matters less than what keeps them up at night. Let the concern guide your CVP, not the job title.' },
    { headline: 'Map all four influence types', body: 'Economic buyer, champion, evaluator, and blocker — missing any one of them means your strategy has a blind spot.' },
  ],
  '3.5': [
    { headline: 'The economic buyers yes criteria is almost always ROI or risk', body: 'If they control the budget, they need to justify the spend. Lead with measurable outcomes and reduced downside.' },
    { headline: 'If you do not know what makes them say yes you are guessing on price', body: 'Without clear yes criteria, deals stall in negotiation. This step prevents that.' },
  ],
  '4': [
    { headline: 'The problem must exist without your product', body: 'An endemic problem is market-wide and structural — it exists whether or not your solution does. Do not describe a gap your product fills.' },
    { headline: 'Write from the buyers perspective', body: 'The problem statement should read like something your buyer would say, not something your sales team would say.' },
    { headline: 'Never name your solution in the problem', body: 'If your product appears in the problem statement, you have written a pitch, not a problem. Keep them separate.' },
  ],
  '5': [
    { headline: 'Instruction', body: 'What is the root cause of each pain point? What structural or systemic issue creates the problem?' },
    { headline: 'The cause is not the symptom -- go one level deeper than what buyers describe on the surface', body: 'Surface-level descriptions miss the structural driver. Dig past the complaint to the underlying mechanism.' },
    { headline: 'Pull from DCP Stage 1 research -- buyers told you what creates their problem', body: 'Use the exact language buyers used to describe the root cause.' },
    { headline: 'A strong cause statement explains WHY the pain point exists, not just that it exists', body: 'If your cause could be swapped with the pain point itself, you have not gone deep enough.' },
  ],
  '6': [
    { headline: 'Instruction', body: 'What is the business consequence if the pain point goes unsolved? What happens to the company?' },
    { headline: 'Effects should be measurable -- missed targets, lost deals, board pressure, leadership turnover', body: 'Quantifiable consequences carry more weight than abstract concerns.' },
    { headline: 'Pull from DCP Stage 2 -- buyers described the cost of inaction in their own words', body: 'Use the exact language buyers used to describe what happens if the problem persists.' },
    { headline: 'The effect is what motivates buyers to act. Make it feel urgent and real', body: 'A vague effect produces a vague pipeline. Sharp effects drive action.' },
  ],
  '7': [
    { headline: 'Instruction', body: 'When does the buyer have their aha moment? What triggers the recognition that they have this problem?' },
    { headline: 'The realization is a specific moment -- a board meeting, a missed quarter, a lost deal', body: 'Name the scenario concretely. Generic realizations do not resonate.' },
    { headline: 'Pull from DCP Stage 2 trigger moments -- these are the exact scenarios to reference in messaging', body: 'The trigger moments your buyers reported become the hooks for outbound and content.' },
    { headline: 'If you can name the realization moment, buyers will say yes, that is exactly what happened to us', body: 'Recognition is the first step to engagement.' },
  ],
  '8': [
    { headline: 'Instruction', body: 'What must the ideal solution do to solve this pain point? What are the non-negotiable requirements?' },
    { headline: 'Pull from DCP Stage 4 -- buyers told you exactly what they evaluate solutions on', body: 'Buyer evaluation criteria are gold -- use them verbatim.' },
    { headline: 'Solution criteria are buyer requirements, not your product features', body: 'Describe what the solution must do, not what your product does.' },
    { headline: 'If your solution does not meet these criteria, that is a critical gap to address', body: 'Gaps surfaced here should feed back into roadmap and positioning decisions.' },
  ],
  '9': [
    { headline: 'Instruction', body: 'How do buyers find and evaluate potential solutions? What channels and sources do they use?' },
    { headline: 'Pull from DCP Stage 3 -- buyers described their search behavior in detail', body: 'Use the actual channels buyers said they rely on, not the channels you wish they used.' },
    { headline: 'Where buyers search tells you where to invest in awareness and content', body: 'Marketing spend should follow buyer attention, not internal preference.' },
    { headline: 'Who initiates the search (from Step 3) determines which channels matter most', body: 'A CFO and a VP of Engineering search in very different places.' },
  ],
  '10': [
    { headline: 'Instruction', body: 'If you implement this solution, it will solve this problem, thereby reducing this effect on your business.' },
    { headline: 'This is the bridge between problem understanding and solution positioning', body: 'The Formula is where the buyer first hears how solving the problem changes their business.' },
    { headline: 'Use exact language from Steps 4, 6, and 8 -- do not paraphrase', body: 'Consistency across steps reinforces the message. Paraphrasing dilutes it.' },
    { headline: 'A strong Formula makes the buyer think: that is exactly what we need', body: 'If the Formula lands, the rest of the journey gets easier.' },
  ],
  '11': [
    { headline: 'Instruction', body: 'How do your products, services, or causes solve each pain point? Write as a promise: If you purchase this, it will solve this, thereby reducing this.' },
    { headline: 'Each CVP must be a specific promise -- not a generic claim', body: 'Specificity drives belief. Vague promises produce vague pipeline.' },
    { headline: 'WARNING: If your product does not actually solve the pain point, this is a critical point of failure', body: 'Honest CVPs only. Overpromising at this stage breaks trust later.' },
    { headline: 'The CVP must be grounded in your actual capabilities from Steps 13 and 14', body: 'Tie every promise back to a formula and a competency that delivers it.' },
  ],
  '12': [
    { headline: 'Instruction', body: 'What must the company do to successfully fulfill each CVP promise?' },
    { headline: 'CSFs are non-negotiable execution requirements -- not aspirational goals', body: 'If the CSF is not in place, the CVP cannot be delivered. Treat it as a hard requirement.' },
    { headline: 'If you cannot execute a CSF, your CVP promise will fail in the field', body: 'Execution gaps surface as churn and broken references.' },
    { headline: 'Connect each CSF directly to the CVP it supports', body: 'A CSF without a CVP is overhead. A CVP without a CSF is a wish.' },
  ],
  '13': [
    { headline: 'Instruction', body: 'What repeatable processes does the company have to meet the Critical Success Factors?' },
    { headline: 'A formula is repeatable and documentable -- if you cannot write it in 3 steps it is not a formula yet', body: 'If it lives in one person\'s head, it is not yet a formula.' },
    { headline: 'Be honest about which formulas exist vs which you wish you had', body: 'Self-deception here shows up as inconsistent delivery later.' },
    { headline: 'Formulas should directly map to your Critical Success Factors', body: 'Every CSF needs a formula. Every formula should serve a CSF.' },
  ],
  '14': [
    { headline: 'Instruction', body: 'Does the company have the internal capabilities to implement the Critical Success Formulas?' },
    { headline: 'Be brutally honest -- your buyers will discover gaps you hide from yourself', body: 'Hidden gaps become public during evaluation. Find them first.' },
    { headline: 'A core competency is consistent, documented, and teachable -- not just something you did once', body: 'One-time wins are not competencies. Repeatability is the test.' },
    { headline: 'Critical gaps identified here must be resolved before your CVP promises are credible', body: 'Close the gap or adjust the promise -- do not ship both.' },
  ],
  '15': [
    { headline: 'Instruction', body: 'We will deliver this CVP by implementing this formula because of this core competency.' },
    { headline: 'The KSP is the sales narrative that connects promise to process to proof', body: 'A complete KSP gives buyers a reason to believe, not just a reason to listen.' },
    { headline: 'Use exact content from Steps 11, 13, and 14 -- do not generalize', body: 'Consistency across steps compounds credibility. Generalizing breaks the chain.' },
    { headline: 'A strong KSP gives your sales team a clear, confident story to tell', body: 'If reps cannot deliver the KSP from memory, it is not yet sharp enough.' },
  ],
  '16': [
    { headline: 'Instruction', body: 'Do the key decision makers believe you have the competencies and formulas to fulfill your CVP promises? How do you know?' },
    { headline: 'If a CEO would rate your delivery as Unlikely -- that is your most important sales problem', body: 'Belief is the gating factor at the top of the buying center. Solve it first.' },
    { headline: 'Evidence that works: peer references from similar companies, pilot results, methodology previews', body: 'Buyers trust proof from people like them more than any pitch deck.' },
    { headline: 'Use your DCP Stage 4 research -- buyers told you exactly what proof they require', body: 'The evidence buyers asked for is the evidence you must produce.' },
  ],
  '27': [
    { headline: 'Instruction', body: 'The company strategic messaging should heighten the awareness of the causes and effects of the endemic problems the key decision makers experience.' },
    { headline: 'Write from the buyer perspective', body: 'Describe their world, not your solution.' },
    { headline: 'Create the recognition moment first', body: 'The Set-Up should make the buyer think "yes, that is exactly our problem" before you mention your company.' },
    { headline: 'Pull directly from Steps 5 and 6', body: 'The Cause (Step 5) and Effect (Step 6) ground the Set-Up — use them for maximum accuracy.' },
  ],
  '28': [
    { headline: 'Instruction', body: 'The company strategic messaging should effectively communicate the company key selling points.' },
    { headline: 'Introduce the solution category, not your product name', body: 'The Jab establishes what kind of solution you bring. Save the brand name for the Knock-Out.' },
    { headline: 'Connect to your CVP and Core Competency', body: 'Tie the Jab directly to the CVP from Step 11 and the Core Competency from Step 14.' },
    { headline: 'Make them think "that is exactly what we need"', body: 'A strong Jab triggers immediate recognition that your category is the right fit.' },
  ],
  '29': [
    { headline: 'Instruction', body: 'The company strategic messaging should effectively communicate the company competitive differentiators and competitive advantages.' },
    { headline: 'Name your company and make the direct claim', body: 'This is the moment to name yourselves and state the differentiator clearly.' },
    { headline: 'Explain why competitors cannot replicate it', body: 'State specifically why competitors cannot copy your differentiator.' },
    { headline: 'Pull from Steps 18 and 19 for specificity', body: 'Use the Differentiators (Step 18) and Advantages (Step 19) directly so the claim lands with proof.' },
  ],
  '30': [
    { headline: 'Instruction', body: 'The company strategic messaging should downplay the importance of the competitive threats and heighten the awareness of the company retaliatory measures.' },
    { headline: 'Address the last objection the buyer is feeling', body: 'Surface the most likely objection or risk on the buyer\'s mind right now and remove it.' },
    { headline: 'Connect Step 19 advantage to Step 6 effect', body: 'Tie your Competitive Advantage (Step 19) directly to the Effect (Step 6) so the fix lands as safest.' },
    { headline: 'Make it safe to move forward', body: 'A strong Clean-Up removes the last barrier to yes.' },
  ],
  '31': [
    { headline: 'Instruction', body: 'What 3-4 actions can the company take to raise awareness of the causes and effects of the pain points in order to trigger a search for a solution by the decision makers?' },
    { headline: 'Focus on surfacing the problem -- not selling the solution', body: 'Buyers need to feel the pain before they search.' },
    { headline: 'Use the realization triggers from Step 7', body: 'Those are the exact moments to target.' },
    { headline: 'Target the decision makers from Step 3', body: 'Different roles need different awareness tactics.' },
  ],
  '32': [
    { headline: 'Instruction', body: 'What actions can the company take to establish its competitive position before entering a sales conversation?' },
    { headline: 'Focus on proof points, references, and content that buyers find before they reach out', body: 'Buyers form opinions long before the first call -- shape that view in advance.' },
    { headline: 'Position against your Select Set competitors specifically', body: 'Generic positioning loses to specific positioning every time.' },
    { headline: 'Use your differentiators from Steps 18-19 to shape how buyers think before evaluating', body: 'Set the criteria buyers use to compare options.' },
  ],
  '33': [
    { headline: 'Instruction', body: 'What actions can the company take to build internal champions and grow support among the key decision makers?' },
    { headline: 'Different decision makers need different messages -- use Step 3 to guide your approach', body: 'A CFO and a VP of Engineering will not respond to the same pitch.' },
    { headline: 'Champions are made not found -- give them the tools and language to sell internally', body: 'Equip champions with one-pagers, ROI math, and answers to likely objections.' },
    { headline: 'Connect each outreach to the CVP that matters most to that role', body: 'Tie the message to what keeps that person up at night.' },
  ],
  '34': [
    { headline: 'Instruction', body: 'What specific actions will close the deal based on how this buyer actually makes decisions?' },
    { headline: 'Use the Keys to Winning from Step 22 -- they are your closing playbook', body: 'The buyer told you what they care about. Lead with it.' },
    { headline: 'Address the top-ranked decision factor from Step 23 in your final proposal', body: 'The number one factor decides the deal -- do not bury it.' },
    { headline: 'The CEO or CRO makes the final call -- make sure they have what they need to say yes', body: 'Arm the economic buyer with the proof they need to defend the choice internally.' },
  ],
  '35': [
    { headline: 'Instruction', body: 'What actions will validate the buying decision and prevent buyer regret in the first 30-90 days?' },
    { headline: 'Buyers validate success through adoption metrics -- not just deliverables', body: 'Track usage, not just delivery. Adoption is the proof point that protects renewals.' },
    { headline: 'Quick wins in the first 30 days protect the relationship for the long term', body: 'Early momentum sets the tone for the entire engagement.' },
    { headline: 'Reference the Confirmation signals from DCP Stage 7 -- buyers told you exactly what they watch for', body: 'Mirror back the proof points buyers said they look for after a purchase.' },
  ],
  '36': [
    { headline: 'Instruction', body: 'What actions will re-engage stalled deals or recover lost opportunities?' },
    { headline: 'Most deals stall because of unresolved risk -- not lack of interest', body: 'Identify the unspoken concern and address it directly.' },
    { headline: 'Use your Competitive Retaliation strategies from Step 24 to reframe the conversation', body: 'Bring a new angle, not a new follow-up.' },
    { headline: 'A changed circumstance at the buyer is often your best re-entry point', body: 'Leadership change, funding event, or new pain are natural reasons to re-engage.' },
  ],
  '37': [
    { headline: 'Instruction', body: 'What specific tools and assets does the team need to execute the action plan from Steps 31-36?' },
    { headline: 'Each tool should connect to at least one action step', body: 'Map every asset back to a specific Step 31-36 action it enables.' },
    { headline: 'Build assets that sales will actually use in the field', body: 'Ask reps what they would open before you build it.' },
    { headline: 'Prioritize tools that address the most common objections and barriers in your evaluation process', body: 'The highest-leverage assets remove friction at the points where deals stall.' },
  ],
  '38': [
    { headline: 'Instruction', body: 'What criteria should the team use to qualify and score opportunities against the ideal customer profile?' },
    { headline: 'Not all opportunities are worth pursuing -- use these criteria to focus on the right ones', body: 'Disqualifying fast protects the pipeline and the team\'s time.' },
    { headline: 'The decision factors from Step 23 are your best qualifying questions', body: 'Ask buyers what they value most -- their answer reveals fit.' },
    { headline: 'A qualified opportunity should match your ICP on at least 3 of the top 5 criteria', body: 'Use a clear threshold so the team scores consistently.' },
  ],
  'survey-builder': [
    { headline: 'Keep it under 15 questions', body: 'Surveys over 15 questions see significantly lower completion rates. Prioritize the questions that reveal buying behavior, not product feedback.' },
    { headline: 'Mix question types for richer data', body: 'Open-ended questions reveal the why. Scale questions reveal intensity. Use both for a complete picture.' },
    { headline: 'Send to all four audiences', body: 'The gap between how your team thinks buyers decide and how buyers actually decide is where messaging goes wrong. All four audiences reveal that gap.' },
  ],
}
