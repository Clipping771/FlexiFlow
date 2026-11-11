/**
 * Short Bengali explanations for each Error Taxonomy v1 code, written for Bangla speakers:
 * why the mistake happens (often a Bangla habit) and how English does it.
 */
export const BENGALI_HINTS: Record<string, string> = {
  'GRA.SUBJ_VERB_AGR':
    'বাংলায় ক্রিয়া কর্তার সংখ্যা (এক/বহু) অনুযায়ী বদলায় না, কিন্তু ইংরেজিতে বদলায়। He/She/It হলে বর্তমান কালে ক্রিয়ায় -s লাগে (she goes), আর "the number of", "each" একবচন ধরে।',
  'GRA.TENSE_INCONSISTENCY':
    'বাংলায় কথা বলার সময় অতীতের ঘটনাও প্রায়ই বর্তমান কালে বলি ("কাল আমি বাজারে যাই, তারপর...")। ইংরেজিতে শেষ হয়ে যাওয়া ঘটনার সব ক্রিয়া অতীত কালে রাখুন।',
  'GRA.ARTICLE_DEF_INDEF':
    'বাংলায় a/an/the নেই, তাই এটা সবচেয়ে সাধারণ ভুল। একবচন গণনাযোগ্য বিশেষ্যের আগে a/an লাগে; আগে বলা বা নির্দিষ্ট জিনিসের আগে the; সাধারণ অর্থে অগণনীয় বিশেষ্যে (pollution, education) কোনো article লাগে না।',
  'GRA.RUN_ON_SENTENCE':
    'বাংলায় কমা দিয়ে দুটো বাক্য জুড়ে দেওয়া চলে, ইংরেজিতে চলে না। দুটো পূর্ণ বাক্য জুড়তে and/so/but, সেমিকোলন (;) বা দাঁড়ি (.) ব্যবহার করুন।',
  'GRA.FRAGMENT':
    '"Because...", "Although..." বা -ing দিয়ে শুরু অংশ একা পূর্ণ বাক্য নয়। একে মূল বাক্যের সাথে কমা দিয়ে জুড়ে দিন, যাতে কর্তা আর মূল ক্রিয়া থাকে।',
  'GRA.PREPOSITION_COLLOCATION':
    'বাংলার "সম্পর্কে আলোচনা", "এর উপর নির্ভর" সরাসরি অনুবাদ করলে ভুল হয়। ইংরেজিতে discuss something (about ছাড়া), depend on, interested in, married to — এগুলো জোড়া হিসেবে মুখস্থ করুন।',
  'GRA.PASSIVE_CONSTRUCTION':
    'Passive বাক্যে be + past participle (৩য় রূপ) লাগে: was built, is spoken, will be announced। শুধু be দিলে বা ক্রিয়ার মূল রূপ রাখলে ভুল হয়।',
  'GRA.CONDITIONAL_ERROR':
    'বাংলায় "যদি আমি যাব" বলা যায়, কিন্তু ইংরেজিতে if-এর পরে will বসে না। ভবিষ্যতের শর্তে: If I finish, I will...; কাল্পনিক শর্তে: If I had..., I would...',
  'VOC.COLLOCATION_UNNATURAL':
    'বাংলায় "ভুল করা", "চেষ্টা করা", "সিদ্ধান্ত নেওয়া" সবকিছুতে "করা/নেওয়া", কিন্তু ইংরেজিতে নির্দিষ্ট জোড়া আছে: make a mistake, make an effort, heavy rain। শব্দগুলো জোড়ায় শিখুন।',
  'VOC.IMPRECISE_WORD_CHOICE':
    '"big", "good", "a lot of things" খুব সাধারণ শব্দ। সংখ্যা বা প্রবণতা বোঝাতে increase/rise, significant-এর মতো নির্দিষ্ট শব্দ ব্যবহার করুন।',
  'VOC.INFORMAL_REGISTER':
    'কথ্য শব্দ (kids, loads of, sort out, way cheaper) আর সংক্ষিপ্ত রূপ (it\'s, don\'t) লেখায় বেশি অনানুষ্ঠানিক শোনায়। প্রবন্ধে children, a great deal of, resolve লিখুন।',
  'VOC.REDUNDANT_WORDINESS':
    'একই কথা দুবার বলা (plan ahead for the future, final outcome, my personal opinion) লেখাকে দুর্বল করে। একটি শব্দেই অর্থ পূর্ণ হলে বাড়তি শব্দ বাদ দিন।',
  'VOC.FALSE_FRIEND_L1':
    'বাংলা থেকে সরাসরি অনুবাদ: "লাইট খোলা" নয় turn on the light; "পরীক্ষা দেওয়া" নয় take an exam; "কাজিন ব্রাদার" নয় শুধু cousin; "ভালো ইন" নয় good at।',
  'VOC.MALAPROPISM_CONFUSION':
    'কাছাকাছি শব্দ গুলিয়ে যায়: affect (ক্রিয়া, প্রভাবিত করা) আর effect (বিশেষ্য, প্রভাব); lend (ধার দেওয়া) আর borrow (ধার নেওয়া); advice অগণনীয়, তাই advices হয় না।',
  'MEC.SPELLING_ACADEMIC':
    'ইংরেজি বানান উচ্চারণ মেনে চলে না, তাই কঠিন শব্দগুলো (environment, government, necessary, receive) আলাদা করে লিখে লিখে মুখস্থ করুন।',
  'MEC.APOSTROPHE_CONFUSION':
    "it's মানে it is, আর its মানে 'এর' (মালিকানা)। their মানে 'তাদের', there মানে 'সেখানে'। বহুবচনের মালিকানায় apostrophe s-এর পরে: students' results।",
  'MEC.PUNCTUATION_CLAUSE':
    'However, In conclusion, Although... এর মতো শুরুর অংশের পরে কমা দিন। এতে পাঠক বোঝে মূল বাক্য কোথা থেকে শুরু।',
  'MEC.CAPITALIZATION_PROPER':
    'বাংলায় বড় হাতের অক্ষর নেই, তাই এটা ভুলে যাওয়া সহজ। দেশ, ভাষা, দিন ও মাসের নাম ইংরেজিতে সবসময় বড় হাতের অক্ষরে শুরু হয়: Bangladesh, English, Monday, June।',
  'PTE.SWT_MULTI_SENTENCE':
    'Summarize Written Text-এ পুরো উত্তর একটিই বাক্য হতে হবে, একটিই দাঁড়ি। ভাবগুলো although, while, and, which দিয়ে জুড়ুন।',
  'PTE.SWT_WORD_COUNT_BOUNDARY':
    'উত্তর ৫ থেকে ৭৫ শব্দের মধ্যে না হলে শূন্য পাবেন। নিরাপদ থাকতে ২৫–৫০ শব্দের লক্ষ্য রাখুন।',
  'PTE.ORAL_HESITATION_LONG':
    'প্রায় ৩ সেকেন্ড চুপ থাকলে মাইক্রোফোন বন্ধ হয়ে যেতে পারে। শব্দ মনে না এলে থেমে না থেকে সহজ শব্দে কথা চালিয়ে যান।',
  'PTE.READ_ALOUD_FLAT_PITCH':
    'এক শব্দ এক শব্দ করে একই সুরে পড়লে যান্ত্রিক শোনায়। অর্থ অনুযায়ী ছোট ছোট ভাগে পড়ুন, কমায় সামান্য থামুন, মূল শব্দে জোর দিন।',
  'PTE.ESSAY_WORD_LIMIT':
    'প্রবন্ধ ২০০–৩০০ শব্দের মধ্যে রাখুন। ভূমিকা ~৪০, দুটি মূল অনুচ্ছেদ ~৯০ করে, উপসংহার ~৪০ শব্দ — এভাবে পরিকল্পনা করুন।',
  'PTE.REPEAT_SENTENCE_OMISSION':
    'পুরো বাক্য মনে না থাকলেও যতটুকু শুনেছেন সাবলীলভাবে বলুন। প্রতিটি শব্দ নয়, অর্থের দুই-তিনটি অংশ মনে রাখার চেষ্টা করুন।',
  'IELTS.TASK2_TR_INCOMPLETE':
    'প্রশ্নের প্রতিটি অংশের উত্তর দিতে হবে। "Discuss both views and give your opinion" হলে দুই পক্ষ এবং নিজের মত — তিনটিই লিখুন।',
  'IELTS.TASK2_MEMORIZED_TEMPLATE':
    '"Every coin has two sides"-এর মতো মুখস্থ বাক্য পরীক্ষক গোনেন না। প্রশ্নটিকে নিজের ভাষায় নতুন করে লিখে শুরু করুন।',
  'IELTS.TASK1_MISSING_OVERVIEW':
    'Task 1-এ "Overall,..." দিয়ে মূল প্রবণতার একটি সারাংশ লিখুন, নির্দিষ্ট সংখ্যা ছাড়া। এটা না থাকলে Task Achievement সীমিত হয়ে যায়।',
  'IELTS.COHESION_OVERUSE_CONNECTORS':
    'প্রতিটি বাক্য Furthermore/Moreover দিয়ে শুরু করলে যান্ত্রিক শোনায়। this, these, such policies-এর মতো শব্দ দিয়ে ভাবগুলো জুড়ুন।',
  'IELTS.SPEAKING_SHORT_TURNS':
    'শুধু "Yes, I do" বললে চলবে না। উত্তর + কারণ + উদাহরণ — এভাবে দুই-তিন বাক্যে বলুন।',
  'IELTS.SPEAKING_SELF_CORRECTION_OVERLOAD':
    'ছোট ভুল ধরে বারবার বাক্য নতুন করে শুরু করলে সাবলীলতা কমে। অর্থ না বদলালে ভুল রেখেই কথা চালিয়ে যান।'
};

export function bengaliHint(code: string): string | null {
  return BENGALI_HINTS[code] ?? null;
}
