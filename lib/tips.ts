export interface Tip {
  headline: string
  body: string
}

export const STEP_TIPS: Record<string, Tip[]> = {
  '1': [
    { headline: 'Be specific about what you sell', body: 'Describe your primary product or service, not everything you offer. Specificity helps Copilot generate better downstream content.' },
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
  'survey-builder': [
    { headline: 'Keep it under 15 questions', body: 'Surveys over 15 questions see significantly lower completion rates. Prioritize the questions that reveal buying behavior, not product feedback.' },
    { headline: 'Mix question types for richer data', body: 'Open-ended questions reveal the why. Scale questions reveal intensity. Use both for a complete picture.' },
    { headline: 'Send to all four audiences', body: 'The gap between how your team thinks buyers decide and how buyers actually decide is where messaging goes wrong. All four audiences reveal that gap.' },
  ],
}
