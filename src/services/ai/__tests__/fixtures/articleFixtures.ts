/**
 * Pedagogical Evaluation Fixtures for LexiFlow AI Highlight Intelligence
 * 
 * Representative article fixtures across diverse genres with positive
 * learning targets, negative/forbidden trivial examples, and core thematic anchors.
 */

export interface ArticleEvaluationFixture {
  id: string;
  category: 'news' | 'academic' | 'technology' | 'business' | 'lifestyle' | 'sparse';
  title: string;
  text: string;
  expectedTargets: string[];
  forbiddenTrivialWords: string[];
  coreConcepts: string[];
}

export const ARTICLE_FIXTURES: Record<string, ArticleEvaluationFixture> = {
  newsAndCurrentAffairs: {
    id: 'news-001',
    category: 'news',
    title: 'Global Summit Reaches Landmark Accord on Nuclear Non-Proliferation',
    text: `
      In the wake of prolonged multilateral negotiations, world leaders concluded a historic treaty aimed at curbing the proliferation of strategic weapons.
      The accord reinforces national sovereignty while subjecting sensitive enrichment facilities to unprecedented international scrutiny.
      Officials emphasized that member states must take urgent action to implement safeguards.
      Notwithstanding fierce domestic opposition in several capitals, diplomats maintained that the pact marks a decisive turning point for global security.
      A spokesperson said that people had worked for a good outcome all year, but the real work starts now to make sure compliance remains steadfast.
    `,
    expectedTargets: [
      'multilateral',
      'proliferation',
      'sovereignty',
      'scrutiny',
      'unprecedented',
      'notwithstanding',
      'in the wake of',
      'take urgent action'
    ],
    forbiddenTrivialWords: [
      'said',
      'people',
      'good',
      'year',
      'make',
      'starts'
    ],
    coreConcepts: [
      'proliferation',
      'multilateral',
      'sovereignty',
      'scrutiny'
    ]
  },

  academicWriting: {
    id: 'academic-001',
    category: 'academic',
    title: 'Empirical Investigations into Second Language Acquisition and Cognitive Load',
    text: `
      Recent psycholinguistic research has prompted a profound paradigm shift in how instructors conceptualize cognitive load during bilingual instruction.
      By gathering robust empirical evidence across diverse student cohorts, researchers were able to substantiate earlier theoretical hypotheses.
      Furthermore, qualitative analysis revealed that contextual scaffolding mitigates lexical anxiety during complex reading tasks.
      In contrast to legacy models, the findings call into question whether rote memorization yields durable retention.
      Researchers took time to find different things, but showed that simple repetition alone does not help students retain nuanced grammar patterns.
    `,
    expectedTargets: [
      'paradigm shift',
      'empirical evidence',
      'substantiate',
      'mitigate',
      'furthermore',
      'call into question'
    ],
    forbiddenTrivialWords: [
      'took',
      'time',
      'find',
      'things',
      'showed',
      'help'
    ],
    coreConcepts: [
      'paradigm shift',
      'empirical evidence',
      'substantiate'
    ]
  },

  technologyAndAI: {
    id: 'tech-001',
    category: 'technology',
    title: 'Scaling Distributed Neural Architectures for Ultra-Low Latency Inference',
    text: `
      Modern edge intelligence systems increasingly depend on optimizing neural architecture to eliminate runtime latency bottleneck constraints.
      As emerging technologies reshape mission-critical software, engineering teams must cultivate operational resilience against sudden hardware faults.
      The authors propose a deterministic pipeline that achieves sub-millisecond inference without compromising numerical accuracy.
      Engineering leads noted that they need to make systems that work every day without failing when users come online.
    `,
    expectedTargets: [
      'neural architecture',
      'latency bottleneck',
      'emerging technologies',
      'operational resilience'
    ],
    forbiddenTrivialWords: [
      'need',
      'make',
      'work',
      'day',
      'come'
    ],
    coreConcepts: [
      'neural architecture',
      'latency bottleneck'
    ]
  },

  businessEconomics: {
    id: 'business-001',
    category: 'business',
    title: 'Central Banks Tighten Monetary Policy Amid Supply Chain Volatility',
    text: `
      Facing persistent macroeconomic pressures, monetary policy authorities moved decisively to curb systemic market volatility and safeguard liquidity.
      Senior analysts warned that global supply chain disruptions continue to threaten industrial production targets and corporate profit margins.
      Consequently, institutional investors are demanding higher quality standards and robust capital reserves before underwriting high-yield credit portfolios.
      Executives said that they gave workers a piece of advice to look at every change closely.
    `,
    expectedTargets: [
      'monetary policy',
      'volatility',
      'liquidity',
      'supply chain',
      'production targets',
      'quality standards',
      'consequently',
      'disruptions'
    ],
    forbiddenTrivialWords: [
      'said',
      'gave',
      'piece',
      'look',
      'every'
    ],
    coreConcepts: [
      'monetary policy',
      'supply chain',
      'liquidity'
    ]
  },

  lifestyleCulture: {
    id: 'lifestyle-001',
    category: 'lifestyle',
    title: 'Modern Renaissance: How Designers Reimagine the Traditional Drape',
    text: `
      Contemporary South Asian haute couture goes beyond nostalgic homage by reinventing the traditional drape for cosmopolitan wearers.
      By introducing avant-garde blouse pairings and architectural cuts, ateliers celebrate artisanal craftsmanship alongside a sharp minimalist silhouette.
      This deliberate stylistic fusion generates deep cultural resonance among younger generations seeking authentic self-expression.
      Fashion writers noted that wearing a beautiful piece makes people discover new joy in nice clothes.
    `,
    expectedTargets: [
      'traditional drape',
      'blouse pairings',
      'goes beyond',
      'craftsmanship',
      'minimalist',
      'silhouette',
      'resonance'
    ],
    forbiddenTrivialWords: [
      'wearing',
      'discover',
      'piece',
      'nice',
      'makes',
      'good'
    ],
    coreConcepts: [
      'traditional drape',
      'craftsmanship',
      'silhouette'
    ]
  },

  sparseElementaryArticle: {
    id: 'sparse-001',
    category: 'sparse',
    title: 'A Simple Morning Walk',
    text: `
      John took a morning walk in the small city park.
      The weather was nice and warm.
      He saw three birds near a tree.
      After sitting on the wooden bench, he went back home to drink a cup of hot water.
      It was a very good and quiet day.
    `,
    expectedTargets: [],
    forbiddenTrivialWords: [
      'took',
      'walk',
      'nice',
      'warm',
      'tree',
      'went',
      'good',
      'day',
      'water'
    ],
    coreConcepts: []
  }
};
