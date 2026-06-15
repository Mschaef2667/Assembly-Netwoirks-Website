// White paper content — structured for PDF generation.
// Source: Assembly Networks, "Why Most B2B Go-To-Market Strategies Fail" (2026).

export type WhitepaperParagraph = string

export interface WhitepaperSection {
  number: number
  title: string
  paragraphs: WhitepaperParagraph[]
  bullets?: string[]
}

export interface WhitepaperDocument {
  title: string
  subtitle: string
  author: string
  organization: string
  publicationDate: string
  executiveSummary: WhitepaperParagraph[]
  sections: WhitepaperSection[]
  conclusion: WhitepaperParagraph[]
  callToAction: WhitepaperParagraph
}

export const WHITEPAPER: WhitepaperDocument = {
  title: 'Why Most B2B Go-To-Market Strategies Fail',
  subtitle: 'How buyer-led research transforms positioning, messaging, and competitive strategy',
  author: 'Michael Schaefer',
  organization: 'Assembly Networks',
  publicationDate: 'June 2026',

  executiveSummary: [
    'B2B leaders spend millions every year on go-to-market planning that never reaches the field intact. Positioning gets rewritten quarterly, sales teams reach for their own decks, and revenue targets slip while leadership debates whose theory of the customer is correct. The root cause is not effort or talent — it is a process problem. Most strategies are built from internal opinion and competitor noise, not from the people whose decisions actually drive revenue: the buyers.',
    'This paper introduces the C3 Method — a structured approach that requires GTM teams to earn their strategy from buyer research before they execute it. It explains why assumption-led strategy keeps failing, walks through the seven-stage Decision Clarity Profile that grounds the method, and shows how a disciplined sequence (Intelligence → Strategy → Plan) produces messaging, competitive positioning, and a 38-step Strategic Plan that the field can actually use.',
    'Readers will leave with a clear framework, a checklist to audit their current GTM motion, and a path to operationalizing a buyer-led strategy inside their own organization.',
  ],

  sections: [
    {
      number: 1,
      title: 'The Hidden Cost of Assumption-Led GTM',
      paragraphs: [
        'When a strategy fails, the first instinct is to blame execution: the reps did not follow the playbook, the marketing team did not generate enough pipeline, the product team shipped too slowly. The data tells a different story. In a recent survey of B2B revenue leaders, fewer than one in five could point to a single piece of primary buyer research that underpinned their current positioning. The rest were running on a mix of analyst reports, sales anecdotes, and competitive teardowns.',
        'That gap shows up everywhere. ICPs get drafted in a conference room and then re-drafted six months later when no one can find a match in the pipeline. Messaging is written for the persona the team wishes existed, not the one signing the contract. Competitive analysis fixates on the loudest competitor instead of the alternatives buyers are actually evaluating. Every assumption is a hidden tax on revenue.',
      ],
      bullets: [
        'Pipeline that converts at a fraction of plan because messaging misses the real pain.',
        'Sales cycles that stall in middle stages because no one mapped the buying committee.',
        'Product roadmaps that lag the market because feedback loops are filtered through sales, not buyers.',
        'Re-positioning cycles every 9 to 12 months — a tell that the original strategy was never grounded.',
      ],
    },
    {
      number: 2,
      title: 'Why Buyer Research Is the Missing Layer',
      paragraphs: [
        'There is a category of evidence that almost every GTM team ignores: structured, first-party research with the people who actually buy and use the product. Not satisfaction surveys. Not analyst calls. Direct conversations with buyers, influencers, and champions about how they recognized the problem, who they involved, how they searched, what they compared, and why they chose.',
        'When that data exists, strategy stops being an argument and becomes a synthesis. ICPs sharpen. Pain points are stated in the buyer\'s own language. Competitive positioning is grounded in the alternatives buyers actually weigh, not the ones the team is anxious about. Every downstream decision — from packaging to outbound copy — has a defensible source.',
      ],
    },
    {
      number: 3,
      title: 'The Decision Clarity Profile: Seven Stages of Buyer Truth',
      paragraphs: [
        'The Decision Clarity Profile (DCP) is the structured artifact at the heart of the C3 Method. It maps the buyer\'s journey across seven stages, each one a question the GTM team must be able to answer with evidence rather than opinion.',
      ],
      bullets: [
        'Stage 1 — Problem Recognition: What conditions make the buyer realize a problem exists?',
        'Stage 2 — Consequences: What happens if the problem stays unsolved, and what triggers urgency?',
        'Stage 3 — Information Search: Where do buyers go, and who do they trust, when they start looking?',
        'Stage 4 — Solution Evaluation: What criteria do they apply, and what signals make a vendor credible?',
        'Stage 5 — Decision Process: Who is involved, what role do they play, and how is consensus reached?',
        'Stage 6 — Selection: Why the chosen vendor wins — and why finalists lose.',
        'Stage 7 — Post-Decision: What does success look like 90 days in, and what would have caused a churn?',
      ],
    },
    {
      number: 4,
      title: 'From Insight to Ideal Customer Profile',
      paragraphs: [
        'Most ICPs are built before any buyer research happens, which is precisely why they keep getting rewritten. In a buyer-led process, the ICP is a downstream artifact. It is the place where firmographic patterns from the DCP intersect with the deals the team has actually closed — segmented by what those buyers had in common at the moment they recognized the problem.',
        'A validated ICP answers three questions cleanly: who experiences this problem with enough intensity to act, who has the budget and authority to solve it, and who will champion the decision internally. When any of those three are fuzzy, the ICP is not done.',
      ],
    },
    {
      number: 5,
      title: 'Messaging That Lands: The Set-Up, Jab, Knock-Out, Clean-Up Model',
      paragraphs: [
        'Strategic messaging in the C3 Method follows a four-beat structure designed to move a buyer from recognition to commitment without skipping the emotional logic of the journey. The Set-Up confirms the problem and its consequences in the buyer\'s own language. The Jab introduces the Compelling Value Proposition tied to a specific core competency. The Knock-Out establishes uniqueness against the competitive set the buyer actually considers. The Clean-Up makes the solution concrete with the competitive advantage that closes the effect.',
        'Every one of those beats has an upstream dependency: a problem, a CVP, a competitor, a differentiator. Each is sourced from a specific step in the journey, which is why the messages hold up under scrutiny instead of collapsing the first time a competitor responds.',
      ],
    },
    {
      number: 6,
      title: 'Competitive Intelligence Buyers Actually Use',
      paragraphs: [
        'Most competitive analysis is built around the vendors the team is anxious about, not the ones buyers compare. The C3 Method inverts that. Competitors are grouped by their relevance to specific ICPs and pain points — and by whether buyers in the research mentioned them at all. The acid test is unforgiving: if real buyers do not consider a competitor in their selection process, that competitor does not belong in the messaging.',
        'The same approach extends to differentiators. A differentiator is only credible if it maps to a competitor that buyers actually consider, and only useful if it closes an effect the buyer already named as costly. Anything else is feature marketing.',
      ],
    },
    {
      number: 7,
      title: 'The 38-Step Strategic Plan',
      paragraphs: [
        'The C3 Method produces a 38-step Strategic Plan that compiles everything into a single, executable document. Steps cover endemic problems, compelling value propositions, key selling points, competitive analysis, strategic messages, action plans, and a deal scorecard. Each step is dependent on the one before it, so a weakness early in the chain cannot hide.',
        'The point of the Strategic Plan is not to be impressive. It is to be defensible. When a rep is in a deal and a buyer pushes back on a differentiator, the answer should not be a marketing claim — it should be a citation back to a piece of buyer research the rep can trust.',
      ],
    },
    {
      number: 8,
      title: 'Operationalizing the Method: People, Cadence, and Tools',
      paragraphs: [
        'A method is only as good as the cadence that sustains it. Assembly Networks recommends a quarterly review of the Decision Clarity Profile (refreshed with at least 8 to 12 new buyer conversations) and a monthly working session on the four messaging beats. Tooling matters: trying to run this in slide decks and shared docs guarantees drift. A purpose-built operating system — like Assembly AI — keeps the dependencies visible, the buyer research connected to the messaging, and the Strategic Plan updated as the market moves.',
        'The teams that get the most out of the C3 Method treat it as a discipline, not a one-time project. They make buyer research a quarterly habit, they hold the line on the dependency chain, and they refuse to ship messaging that cannot point back to a buyer source.',
      ],
    },
  ],

  conclusion: [
    'Strategy is not a slide. It is a chain of evidence that runs from a buyer\'s first realization that they have a problem all the way to the rep\'s last objection handler on a closing call. Most B2B teams have never built that chain. They have built a series of unconnected guesses and called it a strategy.',
    'The C3 Method is the alternative. It is opinionated, sequential, and grounded in primary buyer research. It will not make strategy easier — it will make it real. The teams that adopt it stop arguing about messaging in conference rooms and start winning deals in the field.',
  ],

  callToAction:
    'To see how Assembly AI operationalizes the C3 Method end to end, request beta access at assemblyai.net or write to info@assemblynetworks.net.',
}
