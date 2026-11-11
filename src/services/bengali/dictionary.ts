// Curated bilingual Bengali translation dictionary for high-frequency, academic, and GRE/IELTS vocabulary

export interface BengaliEntry {
  bengali: string;
  explanation: string;
  pos: string;
  nuance?: string;
}

export const BENGALI_LEXICON: Record<string, BengaliEntry> = {
  // Academic & Nuanced words
  scrutiny: {
    bengali: "পুঙ্খানুপুঙ্খ পরীক্ষা / তীক্ষ্ণ নজরদারি",
    explanation: "গভীর মনোযোগ সহকারে কোনো বিষয় বা তথ্যের চুলচেরা বিশ্লেষণ করা।",
    pos: "noun",
    nuance: "সাধারণ examination এর চেয়ে scrutiny অনেক বেশি সমালোচনামূলক ও কড়া বিশ্লেষণ বোঝায়।"
  },
  examination: {
    bengali: "পরীক্ষা / নিরীক্ষা",
    explanation: "কোনো কিছুর গুণমান বা অবস্থা জানার জন্য সাধারণ বা বিধিবদ্ধ পরীক্ষা।",
    pos: "noun",
    nuance: "Scrutiny এর মতো তীব্র সন্দেহ বা তদন্তের ভাব এতে নাও থাকতে পারে।"
  },
  mitigate: {
    bengali: "উপশম করা / তীব্রতা কমানো",
    explanation: "কোনো সমস্যা, ক্ষয়ক্ষতি বা যন্ত্রণার তীব্রতা কমিয়ে সহনীয় করে তোলা।",
    pos: "verb",
    nuance: "সমস্যাটি সম্পূর্ণ দূর করে না, বরং এর খারাপ প্রভাব বা ঝুঁকি কমায়।"
  },
  inflict: {
    bengali: "আরোপ করা / চাপিয়ে দেওয়া",
    explanation: "কাউকে আঘাত, ক্ষতি, শাস্তি বা অপ্রীতিকর কষ্ট ভোগ করতে বাধ্য করা।",
    pos: "verb",
    nuance: "সাধারণত ক্ষতিকর বা বেদনাদায়ক বিষয় চাপিয়ে দিতে inflict ব্যবহৃত হয় (যেমন: inflict damage/pain)।"
  },
  alleviate: {
    bengali: "লাঘব করা / কষ্ট হ্রাস করা",
    explanation: "যন্ত্রণা, কষ্ট বা বোঝা সাময়িকভাবে হালকা করা।",
    pos: "verb",
    nuance: "শারীরিক বা মানসিক কষ্ট লাঘব করতে বেশি ব্যবহৃত হয়।"
  },
  ubiquitous: {
    bengali: "সর্বব্যাপী / সর্বত্র বিদ্যমান",
    explanation: "যা একই সাথে সব জায়গায় দেখতে পাওয়া যায় বা ঘটে থাকে।",
    pos: "adjective",
    nuance: "আধুনিক প্রযুক্তি বা স্মার্টফোনের মতো জিনিসের ক্ষেত্রে অত্যন্ত স্বাভাবিক উদাহরণ।"
  },
  ephemeral: {
    bengali: "ক্ষণস্থায়ী / স্বল্পকালীন",
    explanation: "খুব অল্প সময়ের জন্য টিকে থাকা কোনো কিছু।",
    pos: "adjective",
    nuance: "সৌন্দর্য বা ঋতু পরিবর্তনের ক্ষণস্থায়িত্ব প্রকাশে ব্যবহৃত হয়।"
  },
  resilient: {
    bengali: "স্থিতিস্থাপক / প্রতিকূলতা জয় করতে সক্ষম",
    explanation: "বিপর্যয় বা কঠিন পরিস্থিতি থেকে দ্রুত আগের স্বাভাবিক অবস্থায় ফিরে আসার ক্ষমতা।",
    pos: "adjective"
  },
  pragmatic: {
    bengali: "বাস্তবধর্মী / বাস্তবমুখী",
    explanation: "তত্ত্বের চেয়ে বাস্তব অভিজ্ঞতা এবং কার্যকারিতাকে প্রাধান্য দেওয়া।",
    pos: "adjective"
  },
  profound: {
    bengali: "গভীর / সুদূরপ্রসারী",
    explanation: "অত্যন্ত গভীর জ্ঞান, আবেগ বা তাৎপর্যপূর্ণ প্রভাব।",
    pos: "adjective"
  },
  conundrum: {
    bengali: "জটিল ধাঁধা / কঠিন সমস্যা",
    explanation: "এমন একটি ধাঁধাঁপূর্ণ সংকট যার সহজ সমাধান খুঁজে পাওয়া কঠিন।",
    pos: "noun"
  },
  meticulous: {
    bengali: "খুঁতখুঁতে / অত্যন্ত সতর্ক ও নিখুঁত",
    explanation: "ছোটখাটো প্রতিটি খুঁটিনাটি বিষয়ে চরম সতর্কতা প্রদর্শন করা।",
    pos: "adjective"
  },
  ambiguous: {
    bengali: "দ্ব্যর্থবোধক / অস্পষ্ট",
    explanation: "যার একাধিক সম্ভাব্য অর্থ হতে পারে এবং নির্দিষ্ট অর্থ অস্পষ্ট।",
    pos: "adjective"
  },
  eloquent: {
    bengali: "বাকপটু / সুললিত ও প্রভাবশালী বক্তা",
    explanation: "অনর্গল এবং চিত্তাকর্ষক ভঙ্গিতে মনের ভাব প্রকাশ করতে পারদর্শী।",
    pos: "adjective"
  },
  paradigm: {
    bengali: "দৃষ্টিভঙ্গি / প্রতিষ্ঠিত মডেল বা রূপরেখা",
    explanation: "চিন্তাভাবনা বা কাজের ক্ষেত্রে কোনো একটি গ্রহণযোগ্য আদর্শ মডেল।",
    pos: "noun"
  },
  subtle: {
    bengali: "সূক্ষ্ম / চট করে চোখে পড়ে না এমন",
    explanation: "যা খুব স্পষ্ট নয়, গভীরভাবে না দেখলে ধরা পড়ে না।",
    pos: "adjective"
  },
  comprehensive: {
    bengali: "ব্যাপক / সামগ্রিক",
    explanation: "যেখানে কোনো বিষয়ের প্রায় সমস্ত তথ্য বা দিক অন্তর্ভুক্ত থাকে।",
    pos: "adjective"
  },
  elucidate: {
    bengali: "স্পষ্টভাবে ব্যাখ্যা করা",
    explanation: "কোনো জটিল বা দুর্বোধ্য বিষয় প্রাঞ্জল করে বুঝিয়ে দেওয়া।",
    pos: "verb"
  },
  address: {
    bengali: "সমাধানের উদ্যোগ নেওয়া / সম্বোধন করা / ঠিকানা",
    explanation: "প্রসঙ্গে ভেদে: সমস্যার মোকাবিলা করা (verb), বক্তৃতা দেওয়া (verb), বা বাসস্থান (noun)।",
    pos: "verb/noun"
  },
  fastidious: {
    bengali: "অতিশয় খুঁতখুঁতে / সহজে সন্তুষ্ট হয় না এমন",
    explanation: "স্বচ্ছতা, শৃঙ্খলা বা সঠিকতার বিষয়ে অতিরিক্ত খুঁতখুঁতে স্বভাব।",
    pos: "adjective"
  },
  lucid: {
    bengali: "সুস্পষ্ট / সহজবোধ্য",
    explanation: "যা সহজেই বোধগম্য হয় এবং চিন্তাভাবনায় কোনো অস্পষ্টতা থাকে না।",
    pos: "adjective"
  },
  pervasive: {
    bengali: "অনুপ্রবেশকারী / সর্বত্র ছড়িয়ে পড়া",
    explanation: "কোনো জিনিস যখন কোনো সমাজ বা ব্যবস্থার সর্বত্র ছড়িয়ে পড়ে।",
    pos: "adjective"
  },
  tenacious: {
    bengali: "নাছোড়বান্দা / দৃঢ়প্রতিজ্ঞ",
    explanation: "সহজে লক্ষ্য বা আশা না ছেড়ে আঁকড়ে ধরে থাকার মানসিকতা।",
    pos: "adjective"
  },
  venerable: {
    bengali: "শ্রদ্ধেয় / মর্যাদাপূর্ণ",
    explanation: "বয়স, প্রজ্ঞা বা উন্নত চরিত্রের কারণে অগাধ শ্রদ্ধার যোগ্য।",
    pos: "adjective"
  },
  inevitable: {
    bengali: "অনিবার্য / যা এড়ানো যায় না",
    explanation: "যা অবশ্যই ঘটবে এবং প্রতিরোধ করা সম্ভব নয়।",
    pos: "adjective"
  },
  aesthetic: {
    bengali: "নান্দনিক / সৌন্দর্যবোধ সম্পর্কিত",
    explanation: "শিল্প ও সৌন্দর্যের উপলব্ধি বা নীতির সাথে জড়িত।",
    pos: "adjective"
  },
  advocate: {
    bengali: "সমর্থন করা / পৃষ্ঠপোষকতা করা / সমর্থক",
    explanation: "কোনো নীতি, ধারণা বা ব্যক্তির পক্ষে প্রকাশ্যে অবস্থান নেওয়া।",
    pos: "verb/noun"
  },
  diligent: {
    bengali: "পরিশ্রমী / অধ্যবসায়ী",
    explanation: "কাজে নিষ্ঠাবান এবং যত্নশীল প্রচেষ্টা চালানো।",
    pos: "adjective"
  },
  empathy: {
    bengali: "সহমর্মিতা / অন্যের কষ্ট নিজের মধ্যে অনুভব করা",
    explanation: "অন্য কারো অনুভূতি ও মানসিক অবস্থাকে তার দৃষ্টিকোণ থেকে উপলব্ধি করা।",
    pos: "noun"
  },
  innovative: {
    bengali: "উদ্ভাবনী / নতুনত্বপূর্ণ",
    explanation: "নতুন এবং মৌলিক ধারণা বা পদ্ধতির সফল প্রয়োগ।",
    pos: "adjective"
  },
  pivotal: {
    bengali: "কেন্দ্রীয় / অতীব গুরুত্বপূর্ণ",
    explanation: "কোনো ঘটনার ফলাফল নির্ধারণে অত্যন্ত সংকটময় বা প্রধান ভূমিকা পালনকারী।",
    pos: "adjective"
  },
  infrastructure: {
    bengali: "অবকাঠামো / মূল ভিত্তি",
    explanation: "যেকোনো সমাজ, দেশ বা প্রতিষ্ঠানের পরিচালনার জন্য মৌলিক সুযোগ-সুবিধা।",
    pos: "noun"
  },
  compliance: {
    bengali: "নিয়মানুবর্তিতা / বিধিবিধান মান্যকরণ",
    explanation: "আইন বা প্রাতিষ্ঠানিক নীতি অনুসরণ করার বাধ্যবাধকতা।",
    pos: "noun"
  },
  sovereignty: {
    bengali: "সার্বভৌমত্ব / পূর্ণ নিয়ন্ত্রণ ক্ষমতা",
    explanation: "কোনো রাষ্ট্র বা ব্যবস্থার নিজস্ব সিদ্ধান্ত গ্রহণের সর্বোচ্চ ক্ষমতা।",
    pos: "noun"
  },
  vulnerability: {
    bengali: "ঝুঁকি / দুর্বলতা / অরক্ষিত অবস্থা",
    explanation: "কোনো ত্রুটি বা ঘাটতি যার কারণে সহজেই ক্ষতির শিকার হতে পারে।",
    pos: "noun"
  },
  authority: {
    bengali: "কর্তৃপক্ষ / নিয়ন্ত্রক সংস্থা",
    explanation: "সিদ্ধান্ত গ্রহণ ও তদারকি করার আইনি ক্ষমতাসম্পন্ন ব্যক্তি বা প্রতিষ্ঠান।",
    pos: "noun"
  },
  disruption: {
    bengali: "বিঘ্ন / বিশৃঙ্খলা / অচলাবস্থা",
    explanation: "কোনো চলমান কার্যক্রম বা স্বাভাবিক প্রক্রিয়ার ছন্দপতন।",
    pos: "noun"
  },
  substantial: {
    bengali: "যথেষ্ট / উল্লেখযোগ্য পরিমাণে বৃহৎ",
    explanation: "যা পরিমাণে বা গুরুত্বে যথেষ্ট অর্থবহ ও তাৎপর্যপূর্ণ।",
    pos: "adjective"
  },
  rigorous: {
    bengali: "কঠোর / অত্যন্ত নিখুঁত ও নিয়মতান্ত্রিক",
    explanation: "চরম যত্ন ও কড়া নিয়ম অনুসরণ করে সম্পন্ন।",
    pos: "adjective"
  },
  intense: {
    bengali: "তীব্র / প্রখর / প্রচণ্ড",
    explanation: "চরম মাত্রা, গভীর অনুভূতি বা অত্যধিক তাপ ও শক্তি নির্দেশ করে।",
    pos: "adjective",
    nuance: "এখানে intense heat অর্থ প্রচণ্ড বা অসহ্য গরম/উত্তাপ।"
  },
  dense: {
    bengali: "ঘন / নিবিড়",
    explanation: "ঠাসাঠাসি বা পুরু অবস্থা, যা ভেদ করা কঠিন। যেমন: dense smoke (ঘন ধোঁয়া)।",
    pos: "adjective"
  },
  technically: {
    bengali: "বাস্তবিকপক্ষে / নিয়ম অনুযায়ী / টেকনিক্যালি",
    explanation: "আইনগত বা ব্যাকরণগত নিয়মের দিক দিয়ে সঠিক, যদিও সাধারণ বাস্তবতায় ভিন্ন হতে পারে।",
    pos: "adverb",
    nuance: "Strict facts বা নিয়মের ওপর ভিত্তি করে সত্য বোঝাতে ব্যবহৃত হয়।"
  },
  original: {
    bengali: "মূল / আদি / আসল",
    explanation: "প্রথম থেকে বিদ্যমান বা অবিকৃত রূপ।",
    pos: "adjective"
  },
  twist: {
    bengali: "অপ্রত্যাশিত মোড় / চমক",
    explanation: "কোনো ঘটনা বা বর্ণনায় অপ্রত্যাশিত পরিবর্তন।",
    pos: "noun"
  },
  reluctant: {
    bengali: "অনিচ্ছুক / দ্বিধাগ্রস্ত",
    explanation: "কোনো কাজ করতে মন না চাওয়া, যদিও কাজটি প্রয়োজন হতে পারে।",
    pos: "adjective",
    nuance: "Not wanting to do something, even when you may need to do it."
  },
  run: {
    bengali: "চালানো / পরিচালিত হওয়া / দৌড়ানো",
    explanation: "কোনো প্রোগ্রাম বা কাজ চালু থাকা অথবা দ্রুত গতিতে চলা।",
    pos: "verb",
    nuance: "In software context: to execute or operate smoothly."
  },
  set: {
    bengali: "স্থাপন করা / ঠিক করা / গুচ্ছ",
    explanation: "কোনো নির্দিষ্ট জায়গায় কিছু রাখা বা সময় ঠিক করা।",
    pos: "verb",
    nuance: "To place something in a particular position with care."
  },
  light: {
    bengali: "আলো / উজ্জ্বলতা / হালকা",
    explanation: "দৃষ্টিগোচর উজ্জ্বলতা অথবা ওজনে কম কিছু।",
    pos: "noun",
    nuance: "The natural brightness that makes things visible."
  },
  bank: {
    bengali: "তীর / পাড় / অর্থ লেনদেনের ব্যাংক",
    explanation: "নদীর কিনারা অথবা অর্থ জমা রাখার নিরাপদ প্রতিষ্ঠান।",
    pos: "noun",
    nuance: "In geography: river bank (নদীর তীর); in finance: money institution."
  },
  "break the ice": {
    bengali: "আড়ষ্টতা বা জড়তা দূর করা",
    explanation: "অপরিচিত পরিবেশে আলাপ শুরু করে পরিবেশ সহজ করা।",
    pos: "phrase",
    nuance: "Making people feel more relaxed at the start of a conversation."
  },
  "give up": {
    bengali: "হাল ছেড়ে দেওয়া / চেষ্টা বন্ধ করা",
    explanation: "কোনো কঠিন কাজের ক্ষেত্রে আর লড়াই না করা।",
    pos: "phrase",
    nuance: "To stop trying to do something difficult."
  },
  "look up": {
    bengali: "উন্নতি হওয়া / আশাব্যঞ্জক হওয়া",
    explanation: "পরিস্থিতি ধীরে ধীরে ভালো ও ইতিবাচক রূপ নেওয়া।",
    pos: "phrase",
    nuance: "To become better or show signs of improvement."
  },
  fast: {
    bengali: "দ্রুত / চটজলদি",
    explanation: "অল্প সময়ের মধ্যে দ্রুত গতিতে সম্পন্ন কিছু।",
    pos: "adjective",
    nuance: "Moving or happening at high speed."
  },
  thingamajig: {
    bengali: "নির্দিষ্ট নাম না জানা জিনিস",
    explanation: "কোনো বস্তুর সঠিক নাম মনে না পড়লে ব্যবহৃত অনানুষ্ঠানিক শব্দ।",
    pos: "noun",
    nuance: "Used when the speaker cannot recall the exact name of an object."
  },
  blaze: {
    bengali: "প্রচণ্ড আগুন / লেলিহান শিখা",
    explanation: "বড় ধরনের তীব্র বা বিধ্বংসী অগ্নিকাণ্ড।",
    pos: "noun",
    nuance: "A very large, fierce, and burning fire."
  },
  "battle blaze": {
    bengali: "আগুন নেভাতে লড়াই করা",
    explanation: "ভয়াবহ আগুন নিয়ন্ত্রণে আনার জন্য দমকল বাহিনীর প্রাণপণ প্রচেষ্টা।",
    pos: "phrase",
    nuance: "To fight vigorously to put out a fierce fire."
  },
  battle: {
    bengali: "লড়াই করা / সংগ্রাম করা",
    explanation: "কোনো কঠিন সমস্যা বা দুর্যোগের বিরুদ্ধে আপ্রাণ চেষ্টা চালানো।",
    pos: "verb",
    nuance: "To try very hard to overcome or deal with a difficult situation."
  },
  "fire engine": {
    bengali: "দমকলের গাড়ি / অগ্নিনির্বাপক যান",
    explanation: "আগুন নেভানোর যন্ত্রপাতি ও জল বহনের বিশেষ জরুরি যান।",
    pos: "noun",
    nuance: "A large vehicle carrying firefighters and equipment for putting out fires."
  },
  // Stage 7: Curated Editorial, Policy & Economic Lexicon
  subsidy: {
    bengali: "ভর্তুকি / সরকারি আর্থিক সহায়তা",
    explanation: "পণ্যের মূল্য সাধারণ মানুষের নাগালের মধ্যে রাখতে সরকারের প্রদত্ত অনুদান।",
    pos: "noun",
    nuance: "Government financial grant to keep prices affordable or support an industry."
  },
  fertiliser: {
    bengali: "সার / জমির উর্বরতা বৃদ্ধিকারী উপাদান",
    explanation: "ফসলের উৎপাদন ও জমির উর্বরতা বৃদ্ধির জন্য ব্যবহৃত রাসায়নিক বা জৈব পদার্থ।",
    pos: "noun",
    nuance: "Substance added to soil or land to increase its fertility."
  },
  fertilizer: {
    bengali: "সার / জমির উর্বরতা বৃদ্ধিকারী উপাদান",
    explanation: "ফসলের উৎপাদন ও জমির উর্বরতা বৃদ্ধির জন্য ব্যবহৃত রাসায়নিক বা জৈব পদার্থ।",
    pos: "noun",
    nuance: "American spelling variant of fertiliser."
  },
  reform: {
    bengali: "সংস্কার / ইতিবাচক পরিবর্তন",
    explanation: "কোনো ব্যবস্থা বা নীতির ত্রুটি দূর করে নতুন রূপ দেওয়া।",
    pos: "noun/verb",
    nuance: "Improvement or amendment of what is wrong, corrupt, or unsatisfactory."
  },
  rethink: {
    bengali: "পুনর্বিবেচনা করা / নতুন করে ভাবা",
    explanation: "বিদ্যমান কোনো নীতি বা পরিকল্পনা গভীরভাবে খতিয়ে দেখে পরিবর্তন আনা।",
    pos: "verb/noun",
    nuance: "Reconsider or review a policy or decision especially in light of new facts."
  },
  fiscal: {
    bengali: "রাজস্বসংক্রান্ত / সরকারি আর্থিক",
    explanation: "সরকারের রাজস্ব আয়, কর এবং সরকারি ব্যয়ের হিসাব সংক্রান্ত।",
    pos: "adjective",
    nuance: "Relating to government revenue, especially taxes and public expenditures."
  },
  procurement: {
    bengali: "সরকারি সংগ্রহ / পণ্য ও সেবা ক্রয়",
    explanation: "রাষ্ট্রীয় বা প্রাতিষ্ঠানিক প্রয়োজনে আনুষ্ঠানিকভাবে পণ্যসামগ্রী বা সেবা ক্রয়।",
    pos: "noun",
    nuance: "The official process of obtaining supplies, goods, or services."
  },
  allocation: {
    bengali: "বরাদ্দ / অংশ বণ্টন",
    explanation: "নির্দিষ্ট কোনো উন্নয়ন প্রকল্প বা খাতের জন্য অর্থ বা সম্পদ নির্দিষ্ট করে দেওয়া।",
    pos: "noun",
    nuance: "The distribution or assignment of resources for a specific purpose."
  },
  revenue: {
    bengali: "রাজস্ব / সরকারের মোট আয়",
    explanation: "কর, শুল্ক বা বিভিন্ন খাত থেকে রাষ্ট্রের কোষাগারে জমা হওয়া অর্থ।",
    pos: "noun",
    nuance: "Income received by an organization or government from taxes and duties."
  },
  deficit: {
    bengali: "ঘাটতি / আয়ের চেয়ে ব্যয়ের আধিক্য",
    explanation: "আয়ের তুলনায় ব্যয়ের পরিমাণ বেশি হলে যে ঋণাত্মক ভারসাম্য সৃষ্টি হয়।",
    pos: "noun",
    nuance: "Amount by which expenditures exceed total income or revenue."
  },
  smuggling: {
    bengali: "চোরাচালান / অবৈধ পাচার",
    explanation: "আইন অমান্য করে সীমান্ত দিয়ে অবৈধভাবে পণ্য বা সার পাচার করা।",
    pos: "noun",
    nuance: "The illegal movement of goods or commodities across borders."
  },
  diversion: {
    bengali: "উদ্দেশ্য পরিবর্তন / অপব্যবহার বা ভিন্ন খাতে ব্যবহার",
    explanation: "নির্দিষ্ট লক্ষ্য বা খাতের বরাদ্দকৃত পণ্য অবৈধভাবে অন্য খাতে সরিয়ে নেওয়া।",
    pos: "noun",
    nuance: "The unauthorized redirecting of resources or goods away from their intended use."
  },
  productivity: {
    bengali: "উৎপাদনশীলতা / দক্ষতা",
    explanation: "নির্দিষ্ট পরিমাণ শ্রম ও সম্পদ ব্যবহার করে উৎপাদনের কার্যকারিতা বৃদ্ধি।",
    pos: "noun",
    nuance: "The effectiveness of productive effort, especially measured in output per input."
  },
  agriculture: {
    bengali: "কৃষি / চাষাবাদ",
    explanation: "ফসল উৎপাদন ও পশুপালনের সামগ্রিক কর্মকাণ্ড।",
    pos: "noun",
    nuance: "The science, art, or practice of cultivating soil, producing crops, and raising livestock."
  },
  sustainable: {
    bengali: "টেকসই / দীর্ঘস্থায়ী ও পরিবেশবান্ধব",
    explanation: "যা ভবিষ্যতের ক্ষতি না করে দীর্ঘদিন ধরে বজায় রাখা সম্ভব।",
    pos: "adjective",
    nuance: "Able to be maintained at a certain rate or level without depleting natural resources."
  },
  curb: {
    bengali: "লাগাম টানা / নিয়ন্ত্রণ করা",
    explanation: "অবাঞ্ছিত বৃদ্ধি বা কোনো ক্ষতিকর প্রবণতা জোরপূর্বক দমিয়ে রাখা।",
    pos: "verb/noun",
    nuance: "To restrain, check, or limit something undesirable."
  },
  soar: {
    bengali: "আকাশচুম্বী হওয়া / দ্রুত বৃদ্ধি পাওয়া",
    explanation: "মূল্য বা পরিসংখ্যান অত্যন্ত দ্রুত গতিতে বৃদ্ধি পাওয়া।",
    pos: "verb",
    nuance: "To increase rapidly above the normal level or rise steeply."
  },
  plummet: {
    bengali: "দ্রুত হ্রাস পাওয়া / খাড়া নিচে নেমে যাওয়া",
    explanation: "কোনো সূচক বা পরিমাণ অত্যন্ত দ্রুত ধসে পড়া।",
    pos: "verb",
    nuance: "To fall or drop straight down at very high speed."
  },
  tariff: {
    bengali: "শুল্ক / আমদানি বা রপ্তানি কর",
    explanation: "সীমান্ত দিয়ে পণ্য প্রবেশের সময় সরকারের নির্ধারিত কর।",
    pos: "noun",
    nuance: "A tax or duty imposed on imports or exports."
  },
  expenditure: {
    bengali: "ব্যয় / সরকারি খরচের পরিমাণ",
    explanation: "নির্দিষ্ট কোনো খাতে ব্যয়িত মোট অর্থের পরিমাণ।",
    pos: "noun",
    nuance: "Total amount of money spent by a government or organization."
  },
  stimulus: {
    bengali: "অর্থনৈতিক প্রণোদনা / উদ্দীপনা",
    explanation: "মন্দা কাটিয়ে অর্থনীতিকে গতিশীল করতে সরকারের বিশেষ অর্থায়ন।",
    pos: "noun",
    nuance: "Economic incentives or spending introduced by government to boost activity."
  },
  austerity: {
    bengali: "কৃচ্ছ্রসাধন / সরকারি ব্যয় সংকোচন",
    explanation: "ঋণ কমাতে সরকারের বাজেট ও সুযোগ-সুবিধা কঠোরভাবে সীমিত করার নীতি।",
    pos: "noun",
    nuance: "Difficult economic conditions created by government measures to reduce public spending."
  },
  inflation: {
    bengali: "মুদ্রাস্ফীতি / নিত্যপণ্যের মূল্যবৃদ্ধি",
    explanation: "বাজারে জিনিসপত্রের দাম ক্রমাগত বেড়ে যাওয়া এবং মুদ্রার ক্রয়ক্ষমতা হ্রাস।",
    pos: "noun",
    nuance: "A general increase in prices and fall in the purchasing power of money."
  },
  monopoly: {
    bengali: "একচেটিয়া আধিপত্য / একক নিয়ন্ত্রণ",
    explanation: "কোনো পণ্য বা সেবার বাজারে একমাত্র সরবরাহকারী হিসেবে একক নিয়ন্ত্রণ প্রতিষ্ঠা।",
    pos: "noun",
    nuance: "Exclusive control of the supply of or trade in a commodity or service."
  },
  deregulation: {
    bengali: "সরকারি নিয়ন্ত্রণ শিথিলকরণ",
    explanation: "ব্যবসা-বাণিজ্যে প্রতিযোগিতার পথ সুগম করতে সরকারি বিধিনিষেধ তুলে নেওয়া।",
    pos: "noun",
    nuance: "The removal or reduction of state regulations in an economic sector."
  },
  privatisation: {
    bengali: "বেসরকারিকরণ / ব্যক্তিমালিকানায় হস্তান্তর",
    explanation: "রাষ্ট্রীয় প্রতিষ্ঠান বা শিল্পকে বেসরকারি খাতে হস্তান্তর করা।",
    pos: "noun",
    nuance: "Transfer of a business, industry, or service from public to private ownership."
  },
  privatization: {
    bengali: "বেসরকারিকরণ / ব্যক্তিমালিকানায় হস্তান্তর",
    explanation: "রাষ্ট্রীয় প্রতিষ্ঠান বা শিল্পকে বেসরকারি খাতে হস্তান্তর করা।",
    pos: "noun",
    nuance: "American spelling of privatisation."
  },
  stagnation: {
    bengali: "স্থবিরতা / অর্থনৈতিক অচলাবস্থা",
    explanation: "অর্থনীতি বা কোনো ব্যবস্থার উন্নতি সম্পূর্ণ থেমে যাওয়া।",
    pos: "noun",
    nuance: "A prolonged period of little or no growth in an economy."
  },
  disparity: {
    bengali: "বৈষম্য / ব্যাপক ফারাক",
    explanation: "দুই বা ততোধিক দল বা শ্রেণির মধ্যে দৃশ্যমান অন্যায্য অসমতা।",
    pos: "noun",
    nuance: "A noticeable and usually unfair difference between people or things."
  },
  catalyst: {
    bengali: "অনুঘটক / পরিবর্তনের চালিকাশক্তি",
    explanation: "যা কোনো গভীর রূপান্তর বা ঘটনাকে ত্বরান্বিত করে।",
    pos: "noun",
    nuance: "A person or thing that precipitates an event or significant change."
  },
  bolster: {
    bengali: "জোরদার করা / শক্তি যোগানো",
    explanation: "কোনো দুর্বল ক্ষেত্রকে অতিরিক্ত সহায়তা দিয়ে শক্তিশালী করা।",
    pos: "verb",
    nuance: "To support, strengthen, or boost something that may be faltering."
  },
  hinder: {
    bengali: "বাধাগ্রস্ত করা / ব্যাহত করা",
    explanation: "কোনো অগ্রযাত্রা বা কাজে প্রতিকূল পরিস্থিতি সৃষ্টি করা।",
    pos: "verb",
    nuance: "To create difficulties resulting in delay or obstruction."
  },
  corroborate: {
    bengali: "সত্যতা প্রমাণ করা / সমর্থন করা",
    explanation: "প্রমাণ বা সাক্ষ্য দিয়ে কোনো বক্তব্যকে সুনিশ্চিত করা।",
    pos: "verb",
    nuance: "To confirm or give support to a statement, theory, or finding with evidence."
  },
  deteriorate: {
    bengali: "ক্রমশ অবনতি ঘটা / পরিস্থিতি খারাপ হওয়া",
    explanation: "সময়ের সাথে সাথে মান বা অবস্থার অবনতি হওয়া।",
    pos: "verb",
    nuance: "To become progressively worse in condition or quality."
  },
  enhance: {
    bengali: "উন্নীত করা / মান বৃদ্ধি করা",
    explanation: "কোনো কিছুর আকর্ষণ, কার্যকারিতা বা শক্তি বৃদ্ধি করা।",
    pos: "verb",
    nuance: "To intensify, increase, or further improve the quality, value, or extent of something."
  },
  facilitate: {
    bengali: "সহজতর করা / পথ সুগম করা",
    explanation: "কোনো জটিল কাজ বা প্রক্রিয়াকে সহজ করে তোলা।",
    pos: "verb",
    nuance: "To make an action or process easy or easier to accomplish."
  },
  undermine: {
    bengali: "ক্ষতিগ্রস্ত করা / তলে তলে দুর্বল করা",
    explanation: "কারো ক্ষমতা, বিশ্বাসযোগ্যতা বা ভিত্তি গোপনে ক্ষুণ্ণ করা।",
    pos: "verb",
    nuance: "To lessen the effectiveness, power, or credibility of something gradually."
  },
  validate: {
    bengali: "যাচাই করা / বৈধতা প্রদান করা",
    explanation: "নিয়মমাফিক পরীক্ষা করে নির্ভুলতা নিশ্চিত করা।",
    pos: "verb",
    nuance: "To check or prove the validity, accuracy, or legitimacy of something."
  },
  withstand: {
    bengali: "সহ্য করা / টিকে থাকা",
    explanation: "তীব্র চাপ বা প্রতিকূল পরিস্থিতিতে ভেঙে না পড়ে অটুট থাকা।",
    pos: "verb",
    nuance: "To remain undamaged, unaffected, or resist successfully against strong forces."
  },
  prevalent: {
    bengali: "ব্যাপকভাবে প্রচলিত / বিরাজমান",
    explanation: "কোনো বিশেষ অঞ্চল বা সময়ে যা খুব বেশি মাত্রায় বিদ্যমান।",
    pos: "adjective",
    nuance: "Widespread, common, or predominant in a particular area or period."
  }
};

