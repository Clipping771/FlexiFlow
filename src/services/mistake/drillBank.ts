/**
 * Hand-written drill content for every Error Taxonomy v1 code.
 *
 * Sentence codes (GRA, VOC, MEC) use `pairs`: a sentence with the error and its corrected form.
 * A pair can be used as a "fix it" drill (type the corrected sentence) or a "choose" drill
 * (pick the correct sentence). `alsoRight` lists other corrections that are equally good.
 *
 * Exam strategy codes (PTE, IELTS) cannot be checked by rewriting one sentence, so they use
 * `choices`: a short scenario with one correct option.
 *
 * The taxonomy's own incorrect/correct example is added to the pairs automatically by the
 * drill engine, so it is not repeated here.
 */

export interface DrillPair {
  wrong: string;
  right: string;
  alsoRight?: string[];
  /** Short reason shown after the answer */
  why: string;
}

export interface DrillChoice {
  prompt: string;
  options: string[];
  answer: number;
  why: string;
}

export interface DrillBankEntry {
  pairs?: DrillPair[];
  choices?: DrillChoice[];
}

export const DRILL_BANK: Record<string, DrillBankEntry> = {
  // ===================== Grammar =====================
  'GRA.SUBJ_VERB_AGR': {
    pairs: [
      {
        wrong: 'The number of students living abroad have risen sharply.',
        right: 'The number of students living abroad has risen sharply.',
        why: 'The subject is "the number", which is singular, so the verb is "has".'
      },
      {
        wrong: 'Each of the participants were given a questionnaire.',
        right: 'Each of the participants was given a questionnaire.',
        why: '"Each" is singular, so it takes "was".'
      },
      {
        wrong: 'Public transport in big cities are often overcrowded.',
        right: 'Public transport in big cities is often overcrowded.',
        why: 'The subject is "public transport" (uncountable), not "cities".'
      },
      {
        wrong: 'She always go to the library after class.',
        right: 'She always goes to the library after class.',
        why: 'He, she and it take a verb ending in -s in the present simple.'
      }
    ]
  },
  'GRA.TENSE_INCONSISTENCY': {
    pairs: [
      {
        wrong: 'In 2010 the company opens a new factory and hired 500 workers.',
        right: 'In 2010 the company opened a new factory and hired 500 workers.',
        why: 'Both actions finished in 2010, so both verbs are past simple.'
      },
      {
        wrong: 'Yesterday I go to the market and bought some vegetables.',
        right: 'Yesterday I went to the market and bought some vegetables.',
        why: '"Yesterday" needs the past simple: "went".'
      },
      {
        wrong: 'Sales rose steadily until 2015, and then they fall dramatically.',
        right: 'Sales rose steadily until 2015, and then they fell dramatically.',
        why: 'A finished period in the past keeps the past simple: "fell".'
      }
    ]
  },
  'GRA.ARTICLE_DEF_INDEF': {
    pairs: [
      {
        wrong: 'He is engineer at a large software company.',
        right: 'He is an engineer at a large software company.',
        why: 'A singular countable job noun needs "a" or "an".'
      },
      {
        wrong: 'The pollution is a serious problem in many cities.',
        right: 'Pollution is a serious problem in many cities.',
        why: 'Uncountable nouns used in a general sense take no article.'
      },
      {
        wrong: 'I bought a book yesterday. A book was very interesting.',
        right: 'I bought a book yesterday. The book was very interesting.',
        why: 'The second time you mention the same thing, use "the".'
      },
      {
        wrong: 'Sun rises in the east.',
        right: 'The sun rises in the east.',
        why: 'There is only one sun, so it takes "the".'
      }
    ]
  },
  'GRA.RUN_ON_SENTENCE': {
    pairs: [
      {
        wrong: 'Many people work from home now, this saves them time.',
        right: 'Many people work from home now; this saves them time.',
        alsoRight: [
          'Many people work from home now. This saves them time.',
          'Many people work from home now, and this saves them time.',
          'Many people work from home now, which saves them time.'
        ],
        why: 'Two full sentences cannot be joined with only a comma.'
      },
      {
        wrong: 'The experiment failed, the researchers repeated it.',
        right: 'The experiment failed, so the researchers repeated it.',
        alsoRight: [
          'The experiment failed; the researchers repeated it.',
          'The experiment failed. The researchers repeated it.'
        ],
        why: 'Join two full sentences with a linking word, a semicolon or a full stop.'
      },
      {
        wrong: 'Prices increased sharply, demand fell.',
        right: 'Prices increased sharply, and demand fell.',
        alsoRight: ['Prices increased sharply; demand fell.', 'Prices increased sharply. Demand fell.'],
        why: 'A comma alone cannot join two full sentences.'
      }
    ]
  },
  'GRA.FRAGMENT': {
    pairs: [
      {
        wrong: 'Because the cost of living is rising. Many families are struggling.',
        right: 'Because the cost of living is rising, many families are struggling.',
        why: 'A "because" clause cannot stand alone as a sentence.'
      },
      {
        wrong: 'Students who study abroad. They often become more independent.',
        right: 'Students who study abroad often become more independent.',
        why: 'The first part has no main verb, so it is not a sentence.'
      },
      {
        wrong: 'The city built new parks. Making it more attractive to families.',
        right: 'The city built new parks, making it more attractive to families.',
        why: 'An -ing phrase cannot stand alone; attach it to the sentence before.'
      }
    ]
  },
  'GRA.PREPOSITION_COLLOCATION': {
    pairs: [
      {
        wrong: 'We discussed about the new policy in class.',
        right: 'We discussed the new policy in class.',
        why: '"Discuss" takes a direct object, with no "about".'
      },
      {
        wrong: 'Many young people are interested on technology.',
        right: 'Many young people are interested in technology.',
        why: 'The fixed pattern is "interested in".'
      },
      {
        wrong: 'The success of the project depends of good planning.',
        right: 'The success of the project depends on good planning.',
        why: 'The fixed pattern is "depend on".'
      },
      {
        wrong: 'She is married with a doctor.',
        right: 'She is married to a doctor.',
        why: 'The fixed pattern is "married to".'
      }
    ]
  },
  'GRA.PASSIVE_CONSTRUCTION': {
    pairs: [
      {
        wrong: 'The bridge was build in 1998.',
        right: 'The bridge was built in 1998.',
        why: 'The passive needs "be" + past participle: "built".'
      },
      {
        wrong: 'The results will announced next week.',
        right: 'The results will be announced next week.',
        why: 'The future passive is "will be" + past participle.'
      },
      {
        wrong: 'English is speak in many countries.',
        right: 'English is spoken in many countries.',
        why: 'The past participle of "speak" is "spoken".'
      }
    ]
  },
  'GRA.CONDITIONAL_ERROR': {
    pairs: [
      {
        wrong: 'If I will finish early, I will call you.',
        right: 'If I finish early, I will call you.',
        why: 'After "if", use the present simple to talk about the future.'
      },
      {
        wrong: 'If I would have more time, I would learn French.',
        right: 'If I had more time, I would learn French.',
        why: 'An unreal present condition uses the past simple after "if".'
      },
      {
        wrong: 'If the government had invested earlier, the crisis would not happen.',
        right: 'If the government had invested earlier, the crisis would not have happened.',
        why: 'An unreal past condition uses "would have" + past participle.'
      }
    ]
  },

  // ===================== Vocabulary =====================
  'VOC.COLLOCATION_UNNATURAL': {
    pairs: [
      {
        wrong: 'Students should do more effort in their studies.',
        right: 'Students should make more effort in their studies.',
        why: 'English says "make an effort", not "do an effort".'
      },
      {
        wrong: 'There is a strong rain outside.',
        right: 'There is heavy rain outside.',
        why: 'English says "heavy rain", not "strong rain".'
      },
      {
        wrong: 'The government should take a decision soon.',
        right: 'The government should make a decision soon.',
        why: '"Make a decision" is the natural collocation in academic English.'
      },
      {
        wrong: 'Many people say a lie to avoid trouble.',
        right: 'Many people tell a lie to avoid trouble.',
        why: 'English says "tell a lie", not "say a lie".'
      }
    ]
  },
  'VOC.IMPRECISE_WORD_CHOICE': {
    pairs: [
      {
        wrong: 'The graph shows that unemployment got bigger in 2020.',
        right: 'The graph shows that unemployment increased in 2020.',
        alsoRight: ['The graph shows that unemployment rose in 2020.'],
        why: '"Increased" or "rose" is more precise than "got bigger" for figures.'
      },
      {
        wrong: 'Technology has a big effect on the way we live.',
        right: 'Technology has a significant effect on the way we live.',
        alsoRight: ['Technology has a profound effect on the way we live.', 'Technology has a considerable effect on the way we live.'],
        why: '"Significant" is more precise and academic than "big".'
      },
      {
        wrong: 'The study did a lot of things to find the cause.',
        right: 'The study used several methods to find the cause.',
        why: 'Say exactly what was done instead of "a lot of things".'
      }
    ]
  },
  'VOC.INFORMAL_REGISTER': {
    pairs: [
      {
        wrong: 'Kids these days spend loads of time online.',
        right: 'Children today spend a great deal of time online.',
        alsoRight: ['Children today spend a lot of time online.', 'Children nowadays spend a great deal of time online.'],
        why: '"Kids" and "loads of" are too informal for an essay.'
      },
      {
        wrong: 'The government needs to sort out the housing problem.',
        right: 'The government needs to resolve the housing problem.',
        alsoRight: ['The government needs to address the housing problem.', 'The government needs to solve the housing problem.'],
        why: 'Phrasal verbs like "sort out" sound informal in academic writing.'
      },
      {
        wrong: "Plus, it's way cheaper to travel by train.",
        right: 'Moreover, it is much cheaper to travel by train.',
        alsoRight: ['In addition, it is much cheaper to travel by train.', 'Furthermore, it is much cheaper to travel by train.'],
        why: '"Plus", "way" and contractions are spoken English; use formal forms in an essay.'
      }
    ]
  },
  'VOC.REDUNDANT_WORDINESS': {
    pairs: [
      {
        wrong: 'We need to plan ahead for the future.',
        right: 'We need to plan for the future.',
        alsoRight: ['We need to plan ahead.'],
        why: '"Plan ahead" and "for the future" repeat the same idea.'
      },
      {
        wrong: 'The final outcome of the experiment was surprising.',
        right: 'The outcome of the experiment was surprising.',
        why: 'An outcome is already final, so "final" adds nothing.'
      },
      {
        wrong: 'In my personal opinion, cities should be greener.',
        right: 'In my opinion, cities should be greener.',
        why: 'An opinion is already personal.'
      },
      {
        wrong: 'The two companies joined together to form a new brand.',
        right: 'The two companies joined to form a new brand.',
        why: '"Joined" already means "came together".'
      }
    ]
  },
  'VOC.FALSE_FRIEND_L1': {
    pairs: [
      {
        wrong: 'Please open the light because it is dark.',
        right: 'Please turn on the light because it is dark.',
        alsoRight: ['Please switch on the light because it is dark.'],
        why: 'In English you "turn on" or "switch on" a light, not "open" it.'
      },
      {
        wrong: 'My cousin-brother is coming to visit us.',
        right: 'My cousin is coming to visit us.',
        why: '"Cousin" already covers male and female cousins in English.'
      },
      {
        wrong: 'I am having a fever since yesterday.',
        right: 'I have had a fever since yesterday.',
        why: 'With "since", English uses the present perfect: "have had".'
      },
      {
        wrong: 'He is very good in mathematics.',
        right: 'He is very good at mathematics.',
        why: 'English says "good at" a subject or skill.'
      }
    ]
  },
  'VOC.MALAPROPISM_CONFUSION': {
    pairs: [
      {
        wrong: 'The new rules will effect thousands of workers.',
        right: 'The new rules will affect thousands of workers.',
        why: '"Affect" is the verb; "effect" is usually the noun.'
      },
      {
        wrong: 'The teacher gave us some good advices.',
        right: 'The teacher gave us some good advice.',
        why: '"Advice" is uncountable, so it has no plural.'
      },
      {
        wrong: 'Can you lend me your notes? I want to borrow you my pen too.',
        right: 'Can you lend me your notes? I want to lend you my pen too.',
        why: 'You "lend" something to someone; you "borrow" something from someone.'
      },
      {
        wrong: 'The weather had a positive affect on tourism.',
        right: 'The weather had a positive effect on tourism.',
        why: 'After an adjective, the noun is "effect".'
      }
    ]
  },

  // ===================== Mechanics =====================
  'MEC.SPELLING_ACADEMIC': {
    pairs: [
      {
        wrong: 'The enviroment needs better protection.',
        right: 'The environment needs better protection.',
        why: 'Environment has an "n" before "-ment": enviro-n-ment.'
      },
      {
        wrong: 'It is neccessary to recieve proper training.',
        right: 'It is necessary to receive proper training.',
        why: 'Necessary has one c and two s; "i before e except after c" gives "receive".'
      },
      {
        wrong: 'The goverment published a new arguement.',
        right: 'The government published a new argument.',
        why: 'Government keeps the "n" from "govern"; argument drops the "e".'
      },
      {
        wrong: 'This will definately benifit students.',
        right: 'This will definitely benefit students.',
        why: 'Definitely comes from "finite"; benefit starts with "bene".'
      }
    ]
  },
  'MEC.APOSTROPHE_CONFUSION': {
    pairs: [
      {
        wrong: 'The students submitted there assignments late.',
        right: 'The students submitted their assignments late.',
        why: '"Their" shows possession; "there" is a place.'
      },
      {
        wrong: "Its important to check the student's results.",
        right: "It's important to check the students' results.",
        alsoRight: ["It is important to check the students' results."],
        why: '"It\'s" means "it is"; for many students the apostrophe goes after the s.'
      },
      {
        wrong: "The childrens' playground was closed.",
        right: "The children's playground was closed.",
        why: '"Children" is already plural, so add \'s.'
      }
    ]
  },
  'MEC.PUNCTUATION_CLAUSE': {
    pairs: [
      {
        wrong: 'However the data does not support this claim.',
        right: 'However, the data does not support this claim.',
        why: 'Put a comma after a linking word at the start of a sentence.'
      },
      {
        wrong: 'Although prices fell sales did not improve.',
        right: 'Although prices fell, sales did not improve.',
        why: 'Put a comma after an "although" clause at the start of a sentence.'
      },
      {
        wrong: 'In conclusion technology brings more benefits than drawbacks.',
        right: 'In conclusion, technology brings more benefits than drawbacks.',
        why: 'Put a comma after an introductory phrase.'
      }
    ]
  },
  'MEC.CAPITALIZATION_PROPER': {
    pairs: [
      {
        wrong: 'Many students from bangladesh study in australia.',
        right: 'Many students from Bangladesh study in Australia.',
        why: 'Country names always start with a capital letter.'
      },
      {
        wrong: 'The exam is on monday, 5 june.',
        right: 'The exam is on Monday, 5 June.',
        why: 'Days and months are capitalised in English.'
      },
      {
        wrong: 'She speaks english and bengali fluently.',
        right: 'She speaks English and Bengali fluently.',
        why: 'Languages are capitalised in English.'
      }
    ]
  },

  // ===================== PTE strategy =====================
  'PTE.SWT_MULTI_SENTENCE': {
    choices: [
      {
        prompt: 'Which response is acceptable for Summarize Written Text?',
        options: [
          'Remote work saves commuting time. However, it can make workers feel isolated.',
          'Although remote work saves commuting time, it can make workers feel isolated, so companies should plan regular team contact.',
          'Remote work saves time; it is good. Workers feel isolated.'
        ],
        answer: 1,
        why: 'Summarize Written Text must be ONE sentence with one full stop. Join ideas with although, while, and, so or which.'
      },
      {
        prompt: 'Your summary has two sentences. What is the best fix?',
        options: [
          'Delete the second sentence even if it holds a key idea.',
          'Join the two sentences with a linking word such as "while", "and" or "which".',
          'Replace the full stop with a comma only.'
        ],
        answer: 1,
        why: 'Keep both key ideas and join them grammatically. A comma alone creates a run-on sentence.'
      }
    ]
  },
  'PTE.SWT_WORD_COUNT_BOUNDARY': {
    choices: [
      {
        prompt: 'Your Summarize Written Text answer has 82 words. What will happen?',
        options: [
          'It is fine; longer summaries score higher.',
          'It is outside the 5–75 word range, so it gets zero. Cut it below 75 words.',
          'Only the first 75 words are marked.'
        ],
        answer: 1,
        why: 'Answers outside 5–75 words get zero. Aim for 25–50 words to stay safe.'
      },
      {
        prompt: 'What is a safe target length for Summarize Written Text?',
        options: ['3–5 words', '25–50 words', '80–100 words'],
        answer: 1,
        why: 'Inside 5–75 words, around 25–50 words leaves room for all the key ideas.'
      }
    ]
  },
  'PTE.ORAL_HESITATION_LONG': {
    choices: [
      {
        prompt: 'In Describe Image you forget a word mid-sentence. What should you do?',
        options: [
          'Stop and think until the word comes back.',
          'Keep talking with a simpler word or move on to the next feature.',
          'Start the whole answer again from the beginning.'
        ],
        answer: 1,
        why: 'A silence of about 3 seconds can close the microphone. Keep speaking, even with simpler words.'
      },
      {
        prompt: 'Which habit protects your Oral Fluency score the most?',
        options: [
          'Speaking very fast with no pauses at all.',
          'Steady, even speech with short natural pauses between phrases.',
          'Long pauses to choose the perfect vocabulary.'
        ],
        answer: 1,
        why: 'Fluency is about smooth, steady delivery, not speed or perfect words.'
      }
    ]
  },
  'PTE.READ_ALOUD_FLAT_PITCH': {
    choices: [
      {
        prompt: 'How should you read aloud: "Although the results were promising, further research is needed."?',
        options: [
          'One word at a time at the same pitch.',
          'In two thought groups, pausing briefly at the comma and stressing key words like "promising" and "further".',
          'As fast as possible without any pause.'
        ],
        answer: 1,
        why: 'Chunk text into thought groups, pause at punctuation and stress the content words.'
      },
      {
        prompt: 'Which words usually carry stress in a sentence?',
        options: ['Articles and prepositions (the, of, in)', 'Content words (nouns, main verbs, adjectives)', 'Every word equally'],
        answer: 1,
        why: 'Stressing content words gives natural rhythm; small grammar words stay weak.'
      }
    ]
  },
  'PTE.ESSAY_WORD_LIMIT': {
    choices: [
      {
        prompt: 'Your PTE essay has 340 words. What should you do?',
        options: [
          'Leave it; more words show better English.',
          'Cut it to between 200 and 300 words.',
          'Add a longer conclusion.'
        ],
        answer: 1,
        why: 'PTE Write Essay asks for 200–300 words. Going far outside the range costs Form marks.'
      },
      {
        prompt: 'A simple plan that keeps a PTE essay inside the limit is:',
        options: [
          'Intro 40, two body paragraphs of about 90, conclusion 40 words.',
          'One long paragraph with no plan.',
          'Intro 150 words and a short body.'
        ],
        answer: 0,
        why: 'Planning paragraph lengths keeps you near 260 words, safely inside 200–300.'
      }
    ]
  },
  'PTE.REPEAT_SENTENCE_OMISSION': {
    choices: [
      {
        prompt: 'In Repeat Sentence you only caught the first half. What is best?',
        options: [
          'Say nothing to avoid mistakes.',
          'Repeat what you caught and keep speaking fluently with the words you remember from the end.',
          'Repeat only the first three words.'
        ],
        answer: 1,
        why: 'Content is marked by the words you get right. Say as much as you can, fluently.'
      },
      {
        prompt: 'What helps you remember the whole sentence?',
        options: [
          'Listening for meaning in chunks, not single words.',
          'Writing every word on the erasable board.',
          'Closing your eyes and waiting.'
        ],
        answer: 0,
        why: 'Remembering two or three meaning chunks is easier than remembering 12 separate words.'
      }
    ]
  },

  // ===================== IELTS strategy =====================
  'IELTS.TASK2_TR_INCOMPLETE': {
    choices: [
      {
        prompt: 'The question says: "Discuss both views and give your own opinion." Which plan is complete?',
        options: [
          'Body 1: view A. Body 2: view B. Your opinion clearly stated in the introduction and conclusion.',
          'Two body paragraphs that both support your opinion.',
          'Body 1: view A. Body 2: more examples of view A.'
        ],
        answer: 0,
        why: 'Every part of the question must be answered: both views and your opinion.'
      },
      {
        prompt: 'For "What are the causes of this problem and what solutions can you suggest?", what must you include?',
        options: ['Only causes, explained in detail', 'Both causes and solutions', 'Only solutions'],
        answer: 1,
        why: 'Two-part questions need both parts answered, or Task Response is limited.'
      }
    ]
  },
  'IELTS.TASK2_MEMORIZED_TEMPLATE': {
    choices: [
      {
        prompt: 'Which essay opening is better?',
        options: [
          'In this modern era of technology, every coin has two sides.',
          'Many governments now spend more on space research than on public health, which some people believe is a mistake.',
          'Nowadays, this is a very controversial topic that has both advantages and disadvantages.'
        ],
        answer: 1,
        why: 'Paraphrase the actual question. Memorised openings fit every topic, so examiners ignore them.'
      },
      {
        prompt: 'What do examiners do with memorised phrases?',
        options: ['Give extra marks for them', 'Ignore them when judging your language', 'Count them as strong vocabulary'],
        answer: 1,
        why: 'Memorised language is not counted, so it adds words without adding to your score.'
      }
    ]
  },
  'IELTS.TASK1_MISSING_OVERVIEW': {
    choices: [
      {
        prompt: 'Which sentence is a good Task 1 overview?',
        options: [
          'In 2010, car sales were 20,000 and in 2020 they were 35,000.',
          'Overall, car sales rose steadily over the period, while bicycle sales remained the lowest throughout.',
          'The graph has many interesting numbers.'
        ],
        answer: 1,
        why: 'An overview gives the main trends without exact figures. Without it, Task Achievement is capped.'
      },
      {
        prompt: 'Where should the overview go?',
        options: [
          'After the introduction or as the conclusion, clearly labelled with "Overall,"',
          'It is optional, so leave it out if time is short.',
          'Hidden inside the detailed figures.'
        ],
        answer: 0,
        why: 'Make the overview easy to find; starting with "Overall," signals it clearly.'
      }
    ]
  },
  'IELTS.COHESION_OVERUSE_CONNECTORS': {
    choices: [
      {
        prompt: 'Which paragraph links ideas more naturally?',
        options: [
          'Furthermore, cars pollute. Moreover, they are expensive. In addition, they cause traffic.',
          'Cars pollute the air, and they are also expensive to run. This cost, along with heavy traffic, pushes many people towards public transport.',
          'Firstly cars pollute. Secondly cars are expensive. Thirdly cars cause traffic.'
        ],
        answer: 1,
        why: 'Use reference words (this, these, such) and varied structures, not a linker at the start of every sentence.'
      },
      {
        prompt: 'What is the best way to avoid over-using linkers?',
        options: [
          'Start every sentence with a different linker.',
          'Use pronouns and reference words like "this trend" or "such policies" to connect ideas.',
          'Remove all linking words.'
        ],
        answer: 1,
        why: 'Reference words create cohesion without sounding mechanical.'
      }
    ]
  },
  'IELTS.SPEAKING_SHORT_TURNS': {
    choices: [
      {
        prompt: 'Examiner: "Do you like cooking?" Which answer is best?',
        options: [
          'Yes, I do.',
          'Yes, I really enjoy it, especially on weekends. I usually cook Bengali dishes like bhuna khichuri, because it reminds me of home.',
          'Cooking is the process of preparing food using heat.'
        ],
        answer: 1,
        why: 'Answer, then extend with a reason and an example. One-sentence answers limit Fluency.'
      },
      {
        prompt: 'A simple way to extend a Part 1 answer is:',
        options: ['Answer + reason + example', 'Answer + repeat the question', 'Answer + silence'],
        answer: 0,
        why: 'Answer, reason, example gives 2–3 natural sentences every time.'
      }
    ]
  },
  'IELTS.SPEAKING_SELF_CORRECTION_OVERLOAD': {
    choices: [
      {
        prompt: 'You make a small grammar slip while speaking. What is best?',
        options: [
          'Stop and restart the sentence until it is perfect.',
          'Keep going; only correct an error that changes the meaning.',
          'Apologise and explain the grammar rule.'
        ],
        answer: 1,
        why: 'Constant restarts hurt Fluency more than a small slip hurts Grammar.'
      },
      {
        prompt: 'Which answer sounds more fluent?',
        options: [
          'I go, I mean I went, no, I have gone to Sylhet last year.',
          'I went to Sylhet last year, and it was a wonderful trip.',
          'I... went... to... Sylhet.'
        ],
        answer: 1,
        why: 'Smooth delivery with one small error scores better than many restarts.'
      }
    ]
  }
};
