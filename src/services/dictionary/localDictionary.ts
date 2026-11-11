import { DictionaryResult } from '../../types';
import { BengaliService } from '../bengali';
import { DictionaryProvider } from './types';
import { getCandidateLemmas } from './lemmatizer';

export const OFFLINE_LEXICON: Record<string, Partial<DictionaryResult>> = {
  scrutiny: {
    word: 'scrutiny',
    phonetics: [{ text: '/ˈskruː.tɪ.ni/', audio: '' }],
    meanings: [
      {
        partOfSpeech: 'noun',
        definitions: [
          {
            definition: 'Critical observation or examination; close and careful inspection.',
            example: 'The government\'s economic policies have come under increasing scrutiny.',
            synonyms: ['inspection', 'examination', 'investigation', 'audit'],
            antonyms: ['neglect', 'glance', 'inattention']
          }
        ]
      }
    ]
  },
  inflict: {
    word: 'inflict',
    phonetics: [{ text: '/ɪnˈflɪkt/', audio: '' }],
    bengaliMeaning: 'আরোপ করা বা চাপিয়ে দেওয়া',
    bengaliExplanation: 'কাউকে আঘাত, ক্ষতি বা অপ্রীতিকর পরিস্থিতির সম্মুখীন করা।',
    meanings: [
      {
        partOfSpeech: 'verb',
        definitions: [
          {
            definition: 'Cause (something unpleasant or painful) to be suffered by someone or something.',
            example: 'The storm inflicted severe damage on the coastal village.',
            exampleBengali: 'ঝড়টি উপকূলীয় গ্রামে মারাত্মক ক্ষয়ক্ষতি সাধন করেছিল।',
            synonyms: ['impose', 'administer', 'deliver', 'wreak'],
            antonyms: ['withhold', 'spare']
          }
        ]
      }
    ]
  },
  mitigate: {
    word: 'mitigate',
    phonetics: [{ text: '/ˈmɪt.ɪ.ɡeɪt/', audio: '' }],
    meanings: [
      {
        partOfSpeech: 'verb',
        definitions: [
          {
            definition: 'Make (something bad) less severe, serious, or painful.',
            example: 'Drainage schemes have helped mitigate the risk of regular flooding.',
            synonyms: ['alleviate', 'reduce', 'diminish', 'lessen', 'ease'],
            antonyms: ['aggravate', 'exacerbate', 'worsen']
          }
        ]
      }
    ]
  },
  ubiquitous: {
    word: 'ubiquitous',
    phonetics: [{ text: '/juːˈbɪk.wɪ.təs/', audio: '' }],
    meanings: [
      {
        partOfSpeech: 'adjective',
        definitions: [
          {
            definition: 'Present, appearing, or found everywhere at the same time.',
            example: 'Smartphones have become ubiquitous in modern society.',
            synonyms: ['omnipresent', 'pervasive', 'universal', 'everywhere'],
            antonyms: ['rare', 'scarce', 'isolated']
          }
        ]
      }
    ]
  },
  resilient: {
    word: 'resilient',
    phonetics: [{ text: '/rɪˈzɪl.jənt/', audio: '' }],
    meanings: [
      {
        partOfSpeech: 'adjective',
        definitions: [
          {
            definition: 'Able to withstand or recover quickly from difficult conditions.',
            example: 'The local economy proved remarkably resilient despite global disruptions.',
            synonyms: ['tough', 'hardy', 'buoyant', 'adaptable'],
            antonyms: ['fragile', 'vulnerable', 'weak']
          }
        ]
      }
    ]
  },
  pragmatic: {
    word: 'pragmatic',
    phonetics: [{ text: '/præɡˈmæt.ɪk/', audio: '' }],
    meanings: [
      {
        partOfSpeech: 'adjective',
        definitions: [
          {
            definition: 'Dealing with things sensibly and realistically in a way that is based on practical rather than theoretical considerations.',
            example: 'We need a pragmatic approach to solving the urban housing crisis.',
            synonyms: ['practical', 'realistic', 'sensible', 'matter-of-fact'],
            antonyms: ['idealistic', 'impractical', 'dogmatic']
          }
        ]
      }
    ]
  },
  ephemeral: {
    word: 'ephemeral',
    phonetics: [{ text: '/ɪˈfem.ər.əl/', audio: '' }],
    meanings: [
      {
        partOfSpeech: 'adjective',
        definitions: [
          {
            definition: 'Lasting for a very short time; transitory.',
            example: 'Fame in the age of social media is often ephemeral.',
            synonyms: ['transitory', 'fleeting', 'transient', 'short-lived'],
            antonyms: ['permanent', 'enduring', 'eternal']
          }
        ]
      }
    ]
  },
  address: {
    word: 'address',
    phonetics: [{ text: '/əˈdres/', audio: '' }],
    meanings: [
      {
        partOfSpeech: 'verb',
        definitions: [
          {
            definition: 'Think about and begin to deal with (an issue or problem).',
            example: 'A committee was formed to address the environmental concerns.',
            synonyms: ['tackle', 'handle', 'confront', 'deal with']
          },
          {
            definition: 'Speak to (a person or an assembly), typically in a formal way.',
            example: 'She addressed the international summit with confidence.',
            synonyms: ['greet', 'speak to', 'salute']
          }
        ]
      },
      {
        partOfSpeech: 'noun',
        definitions: [
          {
            definition: 'The particulars of the place where someone lives or an organization is situated.',
            example: 'Please send your reply to the postal address listed below.',
            synonyms: ['location', 'residence', 'domicile']
          }
        ]
      }
    ]
  },
  infrastructure: {
    word: 'infrastructure',
    phonetics: [{ text: '/ˈɪn.frəˌstrʌk.tʃər/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The basic physical and organizational structures and facilities needed for the operation of a society or enterprise.',
        example: 'Major investments are required to modernize national transport infrastructure.',
        synonyms: ['framework', 'foundation', 'substructure']
      }]
    }]
  },
  compliance: {
    word: 'compliance',
    phonetics: [{ text: '/kəmˈplaɪ.əns/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The action or fact of complying with a wish, command, or official regulation.',
        example: 'All financial institutions must ensure full compliance with anti-fraud laws.',
        synonyms: ['adherence', 'conformity', 'observance']
      }]
    }]
  },
  sovereignty: {
    word: 'sovereignty',
    phonetics: [{ text: '/ˈsɒv.rɪn.ti/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'Supreme power or authority; the authority of a state to govern itself or regulate data.',
        example: 'Debates over digital sovereignty have intensified in international diplomacy.',
        synonyms: ['autonomy', 'independence', 'self-governance']
      }]
    }]
  },
  vulnerability: {
    word: 'vulnerability',
    phonetics: [{ text: '/ˌvʌl.nər.əˈbɪl.ə.ti/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The quality or state of being exposed to the possibility of being attacked or harmed.',
        example: 'The security audit identified a critical vulnerability in the core network.',
        synonyms: ['weakness', 'susceptibility', 'frailty']
      }]
    }]
  },
  authority: {
    word: 'authority',
    phonetics: [{ text: '/ɔːˈθɒr.ə.ti/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The power or right to give orders, make decisions, and enforce obedience.',
        example: 'National regulatory authorities have issued new guidelines for fintech firms.',
        synonyms: ['power', 'jurisdiction', 'command']
      }]
    }]
  },
  disruption: {
    word: 'disruption',
    phonetics: [{ text: '/dɪsˈrʌp.ʃən/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'Disturbance or problems which interrupt an event, activity, or process.',
        example: 'The strike caused widespread disruption to the domestic rail network.',
        synonyms: ['interruption', 'disturbance', 'disorder']
      }]
    }]
  },
  substantial: {
    word: 'substantial',
    phonetics: [{ text: '/səbˈstæn.ʃəl/', audio: '' }],
    meanings: [{
      partOfSpeech: 'adjective',
      definitions: [{
        definition: 'Of considerable importance, size, or value.',
        example: 'The research project received a substantial grant from the foundation.',
        synonyms: ['considerable', 'significant', 'sizeable']
      }]
    }]
  },
  rigorous: {
    word: 'rigorous',
    phonetics: [{ text: '/ˈrɪɡ.ər.əs/', audio: '' }],
    meanings: [{
      partOfSpeech: 'adjective',
      definitions: [{
        definition: 'Extremely thorough, exhaustive, or accurate.',
        example: 'The clinical trial followed a rigorous testing methodology.',
        synonyms: ['meticulous', 'stringent', 'thorough']
      }]
    }]
  },
  // Stage 7: Curated Editorial, Economic & Policy Vocabulary
  subsidy: {
    word: 'subsidy',
    phonetics: [{ text: '/ˈsʌb.sɪ.di/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'A sum of money granted by the government or a public body to assist an industry or business so that the price of a commodity or service may remain low or competitive.',
        example: 'Agricultural subsidies have come under intense scrutiny in the latest national budget.',
        synonyms: ['grant', 'allowance', 'financial aid', 'subvention']
      }]
    }]
  },
  fertiliser: {
    word: 'fertiliser',
    phonetics: [{ text: '/ˈfɜː.tɪ.laɪ.zər/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'A chemical or natural substance added to soil or land to increase its fertility and promote crop growth.',
        example: 'Rising prices of imported chemical fertiliser placed a heavy burden on marginal farmers.',
        synonyms: ['plant food', 'manure', 'soil enricher']
      }]
    }]
  },
  fertilizer: {
    word: 'fertilizer',
    phonetics: [{ text: '/ˈfɜːr.t̬əl.aɪ.zɚ/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'A chemical or natural substance added to soil to promote plant growth and productivity.',
        example: 'The government revised fertilizer allocation policies to prevent regional shortages.',
        synonyms: ['plant food', 'manure']
      }]
    }]
  },
  reform: {
    word: 'reform',
    phonetics: [{ text: '/rɪˈfɔːm/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The improvement or amendment of what is wrong, corrupt, or unsatisfactory in a system or policy.',
        example: 'Comprehensive economic reforms are required to stabilize the national balance of payments.',
        synonyms: ['improvement', 'overhaul', 'restructuring', 'reorganization']
      }]
    }, {
      partOfSpeech: 'verb',
      definitions: [{
        definition: 'Make changes in (something, typically a social, political, or economic system) in order to improve it.',
        example: 'The administration pledged to reform the agricultural distribution network.',
        synonyms: ['reorganize', 'revamp', 'restructure']
      }]
    }]
  },
  rethink: {
    word: 'rethink',
    phonetics: [{ text: '/riːˈθɪŋk/', audio: '' }],
    meanings: [{
      partOfSpeech: 'verb',
      definitions: [{
        definition: 'Consider or assess (something, especially a policy or plan) again, especially with a view to making changes.',
        example: 'Escalating fiscal costs prompted policymakers to rethink the entire subsidy framework.',
        synonyms: ['reconsider', 're-evaluate', 'review', 'reassess']
      }]
    }]
  },
  fiscal: {
    word: 'fiscal',
    phonetics: [{ text: '/ˈfɪs.kəl/', audio: '' }],
    meanings: [{
      partOfSpeech: 'adjective',
      definitions: [{
        definition: 'Relating to government revenue, especially taxes, and public expenditures.',
        example: 'The state faced widening fiscal deficits due to mounting subsidy obligations.',
        synonyms: ['monetary', 'financial', 'budgetary', 'economic']
      }]
    }]
  },
  procurement: {
    word: 'procurement',
    phonetics: [{ text: '/prəˈkjʊəmənt/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The action of obtaining or procuring equipment, goods, or services, especially for public administration.',
        example: 'Irregularities were uncovered in the emergency wheat procurement process.',
        synonyms: ['acquisition', 'purchasing', 'sourcing']
      }]
    }]
  },
  allocation: {
    word: 'allocation',
    phonetics: [{ text: '/ˌæl.əˈkeɪ.ʃən/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The action or process of allocating or distributing resources or shares.',
        example: 'The national budget outlined a larger capital allocation for rural infrastructure.',
        synonyms: ['allotment', 'distribution', 'assignment', 'quota']
      }]
    }]
  },
  revenue: {
    word: 'revenue',
    phonetics: [{ text: '/ˈrev.ən.juː/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'Income, especially when of a company or organization and of a substantial nature, or a state’s annual income from taxes.',
        example: 'Customs duties accounted for a significant portion of national tax revenue.',
        synonyms: ['income', 'earnings', 'receipts', 'proceeds']
      }]
    }]
  },
  deficit: {
    word: 'deficit',
    phonetics: [{ text: '/ˈdef.ɪ.sɪt/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The amount by which something, especially a sum of money, is too small; an excess of expenditures over income.',
        example: 'The government struggled to contain its widening current account deficit.',
        synonyms: ['shortfall', 'deficiency', 'shortage', 'loss']
      }]
    }]
  },
  smuggling: {
    word: 'smuggling',
    phonetics: [{ text: '/ˈsmʌɡ.lɪŋ/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The illegal movement of goods into or out of a country.',
        example: 'Border surveillance was heightened to curb cross-border fertiliser smuggling.',
        synonyms: ['trafficking', 'contraband trade', 'black-marketeering']
      }]
    }]
  },
  diversion: {
    word: 'diversion',
    phonetics: [{ text: '/daɪˈvɜː.ʃən/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The unauthorized redirecting of resources or goods from their intended target or purpose.',
        example: 'Auditors flagged the diversion of subsidized supplies into the commercial open market.',
        synonyms: ['rerouting', 'misappropriation', 'deflection']
      }]
    }]
  },
  productivity: {
    word: 'productivity',
    phonetics: [{ text: '/ˌprɒd.ʌkˈtɪv.ə.ti/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The effectiveness of productive effort, especially in industry, as measured in terms of the rate of output per unit of input.',
        example: 'Modern mechanized tilling substantially boosted agricultural productivity.',
        synonyms: ['efficiency', 'yield', 'output', 'capacity']
      }]
    }]
  },
  agriculture: {
    word: 'agriculture',
    phonetics: [{ text: '/ˈæɡ.rɪ.kʌl.tʃər/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'The science or practice of farming, including cultivation of the soil for the growing of crops and the rearing of animals.',
        example: 'Agriculture remains the primary source of rural livelihood and food security.',
        synonyms: ['farming', 'cultivation', 'agronomy', 'husbandry']
      }]
    }]
  },
  sustainable: {
    word: 'sustainable',
    phonetics: [{ text: '/səˈsteɪ.nə.bəl/', audio: '' }],
    meanings: [{
      partOfSpeech: 'adjective',
      definitions: [{
        definition: 'Able to be maintained at a certain rate or level without depleting natural resources.',
        example: 'The transition toward sustainable farming practices is vital for long-term ecological balance.',
        synonyms: ['viable', 'maintainable', 'enduring', 'eco-friendly']
      }]
    }]
  },
  curb: {
    word: 'curb',
    phonetics: [{ text: '/kɜːb/', audio: '' }],
    meanings: [{
      partOfSpeech: 'verb',
      definitions: [{
        definition: 'Restrain or keep in check.',
        example: 'The central bank raised benchmark interest rates to curb runaway inflation.',
        synonyms: ['restrain', 'check', 'rein in', 'suppress', 'restrict']
      }]
    }]
  },
  soar: {
    word: 'soar',
    phonetics: [{ text: '/sɔːr/', audio: '' }],
    meanings: [{
      partOfSpeech: 'verb',
      definitions: [{
        definition: 'Increase rapidly above the usual or expected level.',
        example: 'Global commodity prices soared following prolonged supply-chain bottlenecks.',
        synonyms: ['surge', 'skyrocket', 'escalate', 'climb']
      }]
    }]
  },
  plummet: {
    word: 'plummet',
    phonetics: [{ text: '/ˈplʌm.ɪt/', audio: '' }],
    meanings: [{
      partOfSpeech: 'verb',
      definitions: [{
        definition: 'Fall or drop straight down at high speed; decrease precipitously.',
        example: 'Domestic farm revenues plummeted during the seasonal market glut.',
        synonyms: ['plunge', 'dive', 'drop', 'slump', 'crash']
      }]
    }]
  },
  tariff: {
    word: 'tariff',
    phonetics: [{ text: '/ˈtær.ɪf/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'A tax or duty to be paid on a particular class of imports or exports.',
        example: 'Higher protective tariffs were imposed on imported grains to shield local growers.',
        synonyms: ['duty', 'tax', 'customs', 'levy']
      }]
    }]
  },
  inflation: {
    word: 'inflation',
    phonetics: [{ text: '/ɪnˈfleɪ.ʃən/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'A general increase in prices and fall in the purchasing value of money.',
        example: 'Persistent double-digit food inflation eroded consumer purchasing power.',
        synonyms: ['price increases', 'cost-of-living rise']
      }]
    }]
  },
  catalyst: {
    word: 'catalyst',
    phonetics: [{ text: '/ˈkæt.əl.ɪst/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'A person or thing that precipitates an event or accelerates change.',
        example: 'The technology incubator served as a catalyst for local entrepreneurship.',
        synonyms: ['stimulus', 'spark', 'impetus', 'incitement']
      }]
    }]
  },
  disparity: {
    word: 'disparity',
    phonetics: [{ text: '/dɪˈspær.ə.ti/', audio: '' }],
    meanings: [{
      partOfSpeech: 'noun',
      definitions: [{
        definition: 'A great difference or inequality.',
        example: 'Wide economic disparities persist between urban centers and rural agricultural districts.',
        synonyms: ['discrepancy', 'imbalance', 'inequality', 'gap']
      }]
    }]
  },
  bolster: {
    word: 'bolster',
    phonetics: [{ text: '/ˈbəʊl.stər/', audio: '' }],
    meanings: [{
      partOfSpeech: 'verb',
      definitions: [{
        definition: 'Support or strengthen; prop up.',
        example: 'Emergency central bank liquidity helped bolster commercial bank reserves.',
        synonyms: ['strengthen', 'reinforce', 'fortify', 'boost']
      }]
    }]
  },
  hinder: {
    word: 'hinder',
    phonetics: [{ text: '/ˈhɪn.dər/', audio: '' }],
    meanings: [{
      partOfSpeech: 'verb',
      definitions: [{
        definition: 'Create difficulties for (someone or something), resulting in delay or obstruction.',
        example: 'Bureaucratic red tape continues to hinder timely disbursement of farm relief funds.',
        synonyms: ['obstruct', 'hamper', 'impede', 'inhibit']
      }]
    }]
  },
  undermine: {
    word: 'undermine',
    phonetics: [{ text: '/ˌʌn.dəˈmaɪn/', audio: '' }],
    meanings: [{
      partOfSpeech: 'verb',
      definitions: [{
        definition: 'Lessen the effectiveness, power, or ability of, especially gradually or insidiously.',
        example: 'Widespread leakages undermine the impact of targeted social welfare schemes.',
        synonyms: ['subvert', 'weaken', 'compromise', 'damage']
      }]
    }]
  },
  prevalent: {
    word: 'prevalent',
    phonetics: [{ text: '/ˈprev.əl.ənt/', audio: '' }],
    meanings: [{
      partOfSpeech: 'adjective',
      definitions: [{
        definition: 'Widespread in a particular area or at a particular time.',
        example: 'Informal moneylending remains prevalent across low-income agrarian communities.',
        synonyms: ['widespread', 'common', 'frequent', 'predominant']
      }]
    }]
  }
};

export class LocalDictionaryProvider implements DictionaryProvider {
  name = 'local_offline';

  lookupSync(word: string, contextSentence?: string): DictionaryResult | null {
    const raw = (word || '').trim().toLowerCase();
    if (!raw) return null;

    // Check all morphological lemmas, inflections, and spelling twins
    const candidateLemmas = getCandidateLemmas(raw);
    let entry: Partial<DictionaryResult> | undefined;

    for (const lemma of candidateLemmas) {
      if (OFFLINE_LEXICON[lemma]) {
        entry = OFFLINE_LEXICON[lemma];
        break;
      }
    }

    if (!entry) return null;

    const bengaliInfo = BengaliService.getMeaning(entry.word || word, contextSentence);

    return {
      word: entry.word || word,
      phonetics: entry.phonetics || [],
      meanings: entry.meanings || [],
      bengaliMeaning: bengaliInfo.bengaliWord,
      bengaliExplanation: bengaliInfo.bengaliExplanation,
      source: 'offline_lexicon',
      isVerified: true,
      contextSentence
    };
  }

  async lookup(word: string, contextSentence?: string): Promise<DictionaryResult | null> {
    return this.lookupSync(word, contextSentence);
  }
}

