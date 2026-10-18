import { getLanguageConfig } from '../../config/languages';

/**
 * Dynamic Grammar Localization System.
 * Ensures all grammatical explanations (Subject, Verb, Object, Clauses, Tense,
 * Sentence Patterns, Guiding Questions, Rules, and Vocabulary) follow the user's
 * selected explanation language with beginner-friendly clarity.
 */

export interface GrammarL10n {
  selfCorrection: (original: string, corrected: string, marker: string) => string;
  stanceMarker: (marker: string) => string;
  discourseMarker: () => string;
  subordinateClause: (subMarker: string, catType: string) => string;
  mainClause: () => string;
  compoundClause1: () => string;
  compoundClause2: (coord: string) => string;
  trailingSubordinateClause: (subMarker: string, isTime: boolean) => string;
  nounClause: () => string;
  relativeClause: (relWord: string) => string;
  clauseRelationshipIntro: (subMarker: string, catType: string) => string;
  clauseRelationshipCompound: (coord: string) => string;
  clauseRelationshipTrailing: (subMarker: string, isTime: boolean) => string;
  clauseRelationshipNoun: () => string;
  clauseRelationshipRelative: () => string;
  subjectExplanation: (subject: string) => string;
  verbExplanation: (verb: string, tense?: string, isLinking?: boolean, isCoordinated?: boolean) => string;
  directObjectExplanation: (obj: string) => string;
  indirectObjectExplanation: (obj: string) => string;
  complementExplanation: (comp: string, subject: string) => string;
  purposeExplanation: (purpose: string) => string;
  adverbialLocation: (text: string) => string;
  adverbialDirection: (text: string) => string;
  adverbialModalStance: (text: string) => string;
  sentenceStructureOverview: (
    type: 'simple' | 'compound' | 'complex' | 'compound-complex',
    independentCount: number,
    dependentCount: number,
    depReason?: string
  ) => string;
  patternSummary: (formula: string) => string;
  appositiveAge: (age: string) => string;
  appositiveLocation: (loc: string) => string;
  pastContinuousAspect: (vp: string) => string;
  phraseConstituent: (headNoun: string) => string;
  headNounRole: (noun: string) => string;
  determinerRole: (det: string) => string;
  superlativeRole: (adj: string) => string;
  adverbRole: (adv: string) => string;
  articleRole: (art: string) => string;
  properNounAdjunctRole: (noun: string) => string;
  structureMapNode: (isMain: boolean, text: string) => string;
  getVocabularyWord: (word: string) => { meaning: string; localized: string; pos: string; role: string } | null;
}

export function getGrammarL10n(targetLang: string = 'bn'): GrammarL10n {
  const cleanLang = (targetLang || 'bn').toLowerCase().trim();

  // ENGLISH MODE ('en')
  if (cleanLang === 'en') {
    return {
      selfCorrection: (orig, corr, marker) =>
        `The speaker initially says "${orig}" and immediately self-corrects to "${corr}" using "${marker}". This is a natural spoken correction, not a separate clause.`,
      stanceMarker: (marker) =>
        `Modal stance adverb qualifying the statement as a reasonable claim rather than an absolute fact ("${marker}").`,
      discourseMarker: () =>
        `Conversational discourse marker used to establish tone, connection, or emphasis with the listener.`,
      subordinateClause: (subMarker) =>
        `Dependent adverbial clause introduced by "${subMarker}". It cannot stand on its own and provides background context for the main event.`,
      mainClause: () =>
        `Independent main clause that forms a complete, standalone thought with its own subject and finite verb.`,
      compoundClause1: () =>
        `First independent clause, expressing a complete thought on its own.`,
      compoundClause2: (coord) =>
        `Second independent clause, joined by the coordinating conjunction "${coord}".`,
      trailingSubordinateClause: (subMarker, isTime) =>
        isTime
          ? `Time clause introduced by "${subMarker}", indicating the specific moment or event that happened during the background situation.`
          : `Dependent clause introduced by "${subMarker}", providing condition, cause, or context for the main clause.`,
      nounClause: () =>
        `Dependent noun clause acting as the direct object of the main verb, answering "what" was stated or believed.`,
      relativeClause: (relWord) =>
        `Relative (adjective) clause starting with "${relWord}", giving extra descriptive details about the preceding noun.`,
      clauseRelationshipIntro: (subMarker, catType) =>
        `The introductory dependent clause of ${catType} sets the background, followed by the main clause delivering the outcome.`,
      clauseRelationshipCompound: (coord) =>
        `Two complete independent clauses joined together by the connecting word "${coord}".`,
      clauseRelationshipTrailing: (subMarker, isTime) =>
        isTime
          ? `The main clause sets the ongoing background situation, while the "${subMarker}" clause tells what event occurred during that time.`
          : `The main clause states the primary thought, while the "${subMarker}" clause provides supporting context.`,
      clauseRelationshipNoun: () =>
        `The main clause introduces the reporting action, and the noun clause supplies the exact statement or discovery as direct object.`,
      clauseRelationshipRelative: () =>
        `The relative clause describes and gives essential detail about a noun inside the main clause.`,
      subjectExplanation: (subject) =>
        `Subject: the person, group, or entity performing the action or being discussed ("${subject}").`,
      verbExplanation: (verb, tense, isLinking, isCoordinated) => {
        if (isLinking) {
          return `Linking verb (copula) connecting the subject to its descriptive complement ("${verb}").`;
        }
        if (isCoordinated) {
          return `Coordinated finite verbs joined by "and", expressing two connected actions ("${verb}").`;
        }
        return `Finite verb: the core action word that drives the clause ("${verb}"${tense ? `, in ${tense}` : ''}).`;
      },
      directObjectExplanation: (obj) =>
        `Direct Object: the thing, entity, or resource that directly receives the action of the verb ("${obj}").`,
      indirectObjectExplanation: (obj) =>
        `Indirect Object: the recipient who receives the benefit or outcome of the action ("${obj}").`,
      complementExplanation: (comp, subject) =>
        `Subject Complement: descriptive phrase that describes or gives identity to the subject "${subject}" ("${comp}").`,
      purposeExplanation: (purpose) =>
        `Infinitive of Purpose: explains "Why" or the intended goal of the action ("${purpose}").`,
      adverbialLocation: (text) =>
        `Adverbial of Place: specifies where the activity occurred ("${text}"). It is not a direct object.`,
      adverbialDirection: (text) =>
        `Adverbial of Direction: indicates the movement, trajectory, or path of the action ("${text}").`,
      adverbialModalStance: (text) =>
        `Stance Adverb: softens or qualifies the claim as a defensible perspective ("${text}").`,
      sentenceStructureOverview: (type, indCount, depCount, depReason) => {
        if (type === 'compound-complex') {
          return `Compound-complex sentence: contains ${indCount} independent clauses joined by coordination and ${depCount} dependent clause(s).`;
        }
        if (type === 'compound') {
          return `Compound sentence: joins ${indCount} complete independent clauses using a coordinating conjunction.`;
        }
        if (type === 'complex') {
          return `Complex sentence: combines one main independent clause with ${depCount === 1 ? (depReason || 'one dependent clause') : `${depCount} dependent clauses`}.`;
        }
        return `Simple sentence: contains exactly one independent clause with a complete subject-verb thought. Conversational self-corrections or parentheticals do not count as separate clauses.`;
      },
      patternSummary: (formula) =>
        `Sentence pattern: follows the "${formula}" structure. It shows a clear subject, a finite verb, and purposeful constituents showing how clear English sentences are constructed.`,
      appositiveAge: (age) =>
        `Age appositive: extra numerical phrase enclosed by commas specifying the subject's age ("${age}").`,
      appositiveLocation: (loc) =>
        `Location modifier: prepositional phrase giving the geographical origin or background ("${loc}").`,
      pastContinuousAspect: (vp) =>
        `Past Continuous: verb phrase establishing the ongoing background situation in the past ("${vp}").`,
      phraseConstituent: (headNoun) =>
        `Noun phrase structured around the core noun "${headNoun}", expanded with descriptive modifiers.`,
      headNounRole: (noun) => `Head noun: the central noun anchor ("${noun}").`,
      determinerRole: (det) => `Possessive determiner: identifies who possesses or relates to the noun ("${det}").`,
      superlativeRole: (adj) => `Superlative adjective: expresses the highest degree or quality ("${adj}").`,
      adverbRole: (adv) => `Modal adverb: qualifies the assertion as a reasoned viewpoint ("${adv}").`,
      articleRole: () => `Definite article: identifies a specific, known individual or entity.`,
      properNounAdjunctRole: (noun) => `Proper noun adjunct: names the organization or context ("${noun}").`,
      structureMapNode: (isMain) =>
        isMain ? 'Core independent assertion' : 'Supporting dependent construction',
      getVocabularyWord: (word) => lookupVocabularyWord(word, 'en')
    };
  }

  // SPANISH MODE ('es')
  if (cleanLang === 'es') {
    return {
      selfCorrection: (orig, corr, marker) =>
        `El hablante comienza diciendo "${orig}" y se autocorrige inmediatamente a "${corr}" usando "${marker}". Es una corrección conversacional, no una cláusula separada.`,
      stanceMarker: (marker) =>
        `Adverbio modal de postura que califica la afirmación como una opinión razonable ("${marker}").`,
      discourseMarker: () =>
        `Marcador discursivo conversacional para conectar con el oyente o dar énfasis.`,
      subordinateClause: (subMarker) =>
        `Cláusula adverbial dependiente introducida por "${subMarker}". Aporta el contexto previo para la acción principal.`,
      mainClause: () =>
        `Cláusula principal independiente que expresa una idea completa por sí misma.`,
      compoundClause1: () =>
        `Primera cláusula independiente que expresa una idea completa.`,
      compoundClause2: (coord) =>
        `Segunda cláusula independiente coordinada mediante "${coord}".`,
      trailingSubordinateClause: (subMarker, isTime) =>
        isTime
          ? `Cláusula temporal introducida por "${subMarker}" que señala el evento ocurrido durante la situación de fondo.`
          : `Cláusula dependiente introducida por "${subMarker}" que aporta condición o causa a la oración principal.`,
      nounClause: () =>
        `Cláusula sustantiva dependiente que actúa como objeto directo del verbo principal.`,
      relativeClause: (relWord) =>
        `Cláusula relativa (adjetiva) introducida por "${relWord}" que describe al sustantivo anterior.`,
      clauseRelationshipIntro: (subMarker, catType) =>
        `La cláusula dependiente de ${catType} presenta la condición, seguida de la cláusula principal con el resultado.`,
      clauseRelationshipCompound: (coord) =>
        `Dos cláusulas independientes completas unidas por la conjunción "${coord}".`,
      clauseRelationshipTrailing: (subMarker, isTime) =>
        isTime
          ? `La cláusula principal establece el contexto de fondo y la cláusula "${subMarker}" indica el hecho ocurrido.`
          : `La cláusula principal expresa la idea central y la cláusula subordinada aporta contexto de apoyo.`,
      clauseRelationshipNoun: () =>
        `La cláusula principal contiene el verbo de comunicación y la cláusula sustantiva suministra el contenido como objeto directo.`,
      clauseRelationshipRelative: () =>
        `La cláusula relativa describe y complementa a un sustantivo dentro de la cláusula principal.`,
      subjectExplanation: (subject) =>
        `Sujeto: la persona, grupo o entidad que realiza la acción ("${subject}").`,
      verbExplanation: (verb, tense, isLinking, isCoordinated) => {
        if (isLinking) return `Verbo copulativo que une al sujeto con su complemento descriptivo ("${verb}").`;
        if (isCoordinated) return `Verbos coordinados unidos por "and", expresando dos acciones vinculadas ("${verb}").`;
        return `Verbo principal: palabra de acción que impulsa la cláusula ("${verb}"${tense ? `, en ${tense}` : ''}).`;
      },
      directObjectExplanation: (obj) =>
        `Objeto Directo: la entidad o recurso que recibe directamente la acción del verbo ("${obj}").`,
      indirectObjectExplanation: (obj) =>
        `Objeto Indirecto: el destinatario que recibe el beneficio de la acción ("${obj}").`,
      complementExplanation: (comp, subject) =>
        `Complemento del Sujeto: describe o da identidad al sujeto "${subject}" ("${comp}").`,
      purposeExplanation: (purpose) =>
        `Infinitivo de propósito: explica el "por qué" o el objetivo de la acción ("${purpose}").`,
      adverbialLocation: (text) =>
        `Adverbio de lugar: indica dónde ocurrió la actividad ("${text}"). No es un objeto directo.`,
      adverbialDirection: (text) =>
        `Adverbio de dirección: señala la trayectoria o camino de la acción ("${text}").`,
      adverbialModalStance: (text) =>
        `Adverbio de postura: matiza la afirmación como un punto de vista defendible ("${text}").`,
      sentenceStructureOverview: (type, indCount, depCount) => {
        if (type === 'compound-complex') {
          return `Oración compuesta-compleja: contiene ${indCount} cláusulas independientes coordinadas y ${depCount} cláusula(s) dependiente(s).`;
        }
        if (type === 'compound') {
          return `Oración compuesta: une ${indCount} cláusulas independientes con una conjunción coordinante.`;
        }
        if (type === 'complex') {
          return `Oración compleja: combina una cláusula principal independiente con ${depCount} cláusula(s) dependiente(s).`;
        }
        return `Oración simple: contiene exactamente una cláusula independiente con una estructura unificada de sujeto y predicado.`;
      },
      patternSummary: (formula) =>
        `Patrón de la oración: sigue la estructura "${formula}", mostrando claramente quién actúa, qué hace y qué objetivo persigue.`,
      appositiveAge: (age) => `Aposición de edad: especifica la edad del sujeto entre comas ("${age}").`,
      appositiveLocation: (loc) => `Modificador de ubicación: frase preposicional que indica el origen geográfico ("${loc}").`,
      pastContinuousAspect: (vp) => `Pasado continuo: tiempo verbal que establece la acción de fondo en el pasado ("${vp}").`,
      phraseConstituent: (headNoun) => `Frase nominal organizada en torno al sustantivo núcleo "${headNoun}".`,
      headNounRole: (noun) => `Sustantivo núcleo: el centro de la frase nominal ("${noun}").`,
      determinerRole: (det) => `Determinante posesivo: indica pertenencia ("${det}").`,
      superlativeRole: (adj) => `Adjetivo superlativo: expresa el grado máximo de cualidad ("${adj}").`,
      adverbRole: (adv) => `Adverbio modal: califica la afirmación como una opinión sustentada ("${adv}").`,
      articleRole: () => `Artículo definido: identifica a un individuo específico o conocido.`,
      properNounAdjunctRole: (noun) => `Modificador de nombre propio: especifica la organización ("${noun}").`,
      structureMapNode: (isMain) => isMain ? 'Afirmación independiente principal' : 'Construcción dependiente de apoyo',
      getVocabularyWord: (word) => lookupVocabularyWord(word, 'es')
    };
  }

  // HINDI MODE ('hi')
  if (cleanLang === 'hi') {
    return {
      selfCorrection: (orig, corr, marker) =>
        `वक्ता पहले "${orig}" कहता है और तुरंत "${marker}" कहकर खुद को सुधारते हुए "${corr}" कहता है। यह बोलचाल का स्वाभाविक सुधार है, कोई अलग उपवाक्य नहीं।`,
      stanceMarker: (marker) =>
        `मूल्यांकन क्रिया-विशेषण जो दावे को अकाट्य सत्य न मानकर तर्कसंगत दृष्टिकोण के रूप में व्यक्त करता है ("${marker}")।`,
      discourseMarker: () =>
        `बोलचाल का मार्कर जो श्रोता का ध्यान आकर्षित करने या आत्मीयता स्थापित करने के लिए प्रयोग होता है।`,
      subordinateClause: (subMarker) =>
        `आश्रित क्रिया-विशेषण उपवाक्य जो "${subMarker}" से शुरू होता है और मुख्य कार्य की पृष्ठभूमि बताता है।`,
      mainClause: () =>
        `मुख्य स्वतंत्र उपवाक्य जो अपने आप में एक संपूर्ण विचार व्यक्त करता है।`,
      compoundClause1: () =>
        `पहला स्वतंत्र उपवाक्य जो अपने आप में पूर्ण अर्थ देता है।`,
      compoundClause2: (coord) =>
        `दूसरा स्वतंत्र उपवाक्य जो संयोजक "${coord}" द्वारा जुड़ा है।`,
      trailingSubordinateClause: (subMarker, isTime) =>
        isTime
          ? `समयवाचक उपवाक्य ("${subMarker}") जो बताता है कि पृष्ठभूमि के दौरान कौन सी घटना घटी।`
          : `आश्रित उपवाक्य ("${subMarker}") जो मुख्य वाक्य को कारण या शर्त प्रदान करता है।`,
      nounClause: () =>
        `संज्ञा उपवाक्य जो मुख्य क्रिया के कर्म के रूप में कार्य करता है।`,
      relativeClause: (relWord) =>
        `संबन्धवाचक उपवाक्य जो "${relWord}" से शुरू होकर संज्ञा की विशेषता बताता है।`,
      clauseRelationshipIntro: (subMarker, catType) =>
        `प्रारंभिक आश्रित उपवाक्य पृष्ठभूमि तैयार करता है और मुख्य उपवाक्य परिणाम प्रस्तुत करता है।`,
      clauseRelationshipCompound: (coord) =>
        `दो स्वतंत्र उपवाक्य संयोजक "${coord}" द्वारा जुड़े हैं।`,
      clauseRelationshipTrailing: (subMarker, isTime) =>
        isTime
          ? `मुख्य उपवाक्य पृष्ठभूमि स्पष्ट करता है और "${subMarker}" उपवाक्य उस समय घटी घटना को दर्शाता है।`
          : `मुख्य उपवाक्य मूल बात कहता है और आश्रित उपवाक्य सहायक संदर्भ देता है।`,
      clauseRelationshipNoun: () =>
        `मुख्य उपवाक्य कथन प्रस्तुत करता है और संज्ञा उपवाक्य विषयवस्तु को कर्म के रूप में रखता है।`,
      clauseRelationshipRelative: () =>
        `संबन्धवाचक उपवाक्य मुख्य उपवाक्य की संज्ञा की व्याख्या करता है।`,
      subjectExplanation: (subject) =>
        `कर्ता (Subject): वह व्यक्ति, समूह या संस्था जो कार्य करती है ("${subject}")।`,
      verbExplanation: (verb, tense, isLinking, isCoordinated) => {
        if (isLinking) return `योजक क्रिया (Linking Verb) जो कर्ता को उसके पूरक से जोड़ती है ("${verb}")।`;
        if (isCoordinated) return `संयोजक क्रियाएं ("${verb}") जो "and" से जुड़ी हैं।`;
        return `मुख्य क्रिया: कार्य दर्शाने वाला शब्द जो वाक्य को गति देता है ("${verb}"${tense ? `, ${tense}` : ''})।`;
      },
      directObjectExplanation: (obj) =>
        `प्रत्यक्ष कर्म (Direct Object): वह वस्तु, लक्ष्य या संसाधन जिस पर क्रिया का सीधा प्रभाव पड़ता है ("${obj}")।`,
      indirectObjectExplanation: (obj) =>
        `अप्रत्यक्ष कर्म: जिसे कार्य का लाभ प्राप्त होता है ("${obj}")।`,
      complementExplanation: (comp, subject) =>
        `पूरक: जो कर्ता "${subject}" का परिचय या गुण बताता है ("${comp}")।`,
      purposeExplanation: (purpose) =>
        `उद्देश्य वाक्यांश (Purpose Infinitive): कार्य करने का लक्ष्य या 'क्यों' स्पष्ट करता है ("${purpose}")।`,
      adverbialLocation: (text) =>
        `स्थानवाचक क्रिया-विशेषण: स्थान की जानकारी देता है ("${text}")। यह कर्म नहीं है।`,
      adverbialDirection: (text) =>
        `दिशावाचक क्रिया-विशेषण: गति या दिशा का संकेत देता है ("${text}")।`,
      adverbialModalStance: (text) =>
        `दृष्टिकोण क्रिया-विशेषण: दावे को एक विचारणीय राय के रूप में प्रस्तुत करता है ("${text}")।`,
      sentenceStructureOverview: (type, indCount, depCount) => {
        if (type === 'compound-complex') {
          return `संयुक्त-मिश्र वाक्य: इसमें ${indCount} मुख्य उपवाक्य और ${depCount} आश्रित उपवाक्य शामिल हैं।`;
        }
        if (type === 'compound') {
          return `संयुक्त वाक्य (Compound Sentence): दो स्वतंत्र उपवाक्य संयोजक शब्द द्वारा जुड़े हैं।`;
        }
        if (type === 'complex') {
          return `मिश्र वाक्य (Complex Sentence): एक मुख्य स्वतंत्र उपवाक्य और ${depCount} आश्रित उपवाक्य का संयोजन।`;
        }
        return `सरल वाक्य (Simple Sentence): इसमें केवल एक स्वतंत्र उपवाक्य और पूर्ण विचार होता है।`;
      },
      patternSummary: (formula) =>
        `वाक्य संरचना: "${formula}" पैटर्न का पालन करता है, जो स्पष्ट रूप से दिखाता है कि कौन कार्य करता है और क्या उद्देश्य है।`,
      appositiveAge: (age) => `आयु सूचक पद: कर्ता की आयु को दर्शाने वाला अल्पविराम से घिरा वाक्यांश ("${age}")।`,
      appositiveLocation: (loc) => `स्थान सूचक पद: कर्ता के भौगोलिक निवास या मूल स्थान को दर्शाता है ("${loc}")।`,
      pastContinuousAspect: (vp) => `अपूर्ण भूतकाल (Past Continuous): अतीत में निरंतर चल रही पृष्ठभूमि को दर्शाता है ("${vp}")।`,
      phraseConstituent: (headNoun) => `संज्ञा पदबंध जो मुख्य संज्ञा "${headNoun}" पर आधारित है।`,
      headNounRole: (noun) => `मुख्य संज्ञा: पदबंध का केंद्रीय शब्द ("${noun}")।`,
      determinerRole: (det) => `संबन्धवाचक निर्धारक: स्वामित्व दर्शाता है ("${det}")।`,
      superlativeRole: (adj) => `उत्तम अवस्था विशेषण: उच्चतम गुण या स्तर को व्यक्त करता है ("${adj}")।`,
      adverbRole: (adv) => `मूल्यांकन क्रिया-विशेषण: कथन को तर्कसंगत दृष्टिकोण प्रदान करता है ("${adv}")।`,
      articleRole: () => `निश्चयवाचक उपपद: किसी विशिष्ट, ज्ञात व्यक्ति या वस्तु को निर्दिष्ट करता है।`,
      properNounAdjunctRole: (noun) => `व्यक्तिवाचक संज्ञा विशेषण: संस्था या संदर्भ का नाम देता है ("${noun}")।`,
      structureMapNode: (isMain) => isMain ? 'मुख्य स्वतंत्र कथन' : 'सहायक आश्रित संरचना',
      getVocabularyWord: (word) => lookupVocabularyWord(word, 'hi')
    };
  }

  // DEFAULT: BENGALI MODE ('bn') OR OTHER
  return {
    selfCorrection: (orig, corr, marker) =>
      `বক্তা প্রথমে "${orig}" শব্দটি ব্যবহার করেন এবং পরক্ষণেই "${marker}" বলে নিজেকে সংশোধন করে "${corr}" বলেন। এটি মুখের ভাষার একটি স্বাভাবিক আত্ম-সংশোধন (Self-Correction), কোনো আলাদা খণ্ডবাক্য নয়।`,
    stanceMarker: () =>
      `মন্তব্যসূচক ক্রিয়া-বিশেষণ যা বক্তব্যটিকে নিশ্চিত সত্য হিসেবে দাবি না করে যুক্তিগ্রাহ্য অভিমত হিসেবে প্রকাশ করে।`,
    discourseMarker: () =>
      `কথোপকথনমূলক প্রারম্ভিক বা মধ্যবর্তী পদবন্ধ যা শ্রোতার মনোযোগ আকর্ষণ বা বক্তব্যের আন্তরিকতা প্রকাশ করে।`,
    subordinateClause: (subMarker) =>
      `অধীন বা নির্ভরশীল খণ্ডবাক্য ("${subMarker}" দিয়ে শুরু), যা প্রধান বক্তব্যের প্রেক্ষাপট নির্দেশ করে।`,
    mainClause: () =>
      `প্রধান স্বাধীন খণ্ডবাক্য যা বাক্যের মূল ভাবটি স্বয়ংসম্পূর্ণভাবে প্রকাশ করে।`,
    compoundClause1: () =>
      `প্রথম প্রধান খণ্ডবাক্য (স্বাধীন ও অর্থপূর্ণ)।`,
    compoundClause2: (coord) =>
      `দ্বিতীয় প্রধান খণ্ডবাক্য (সংযোজক অব্যয় "${coord}" দিয়ে যুক্ত)।`,
    trailingSubordinateClause: (subMarker, isTime) =>
      isTime
        ? `সময় নির্দেশক অধীন খণ্ডবাক্য, যা চলমান পটভূমির সময়ে সংঘটিত ঘটনা নির্দেশ করে।`
        : `অধীন খণ্ডবাক্য যা মূল বক্তব্যকে শর্ত বা কারণ দিয়ে সীমাবদ্ধ করে।`,
    nounClause: () =>
      `বিশেষ্য খণ্ডবাক্য (Noun Clause), যা মূল ক্রিয়ার কর্ম (Object) হিসেবে কাজ করছে।`,
    relativeClause: () =>
      `সম্বন্ধবাচক খণ্ডবাক্য (Relative Clause), যা পূর্ববর্তী বিশেষ্য পদকে বিস্তারিত করে।`,
    clauseRelationshipIntro: (subMarker, catType) =>
      `শুরুর অধীন খণ্ডবাক্যটি ${catType} প্রকাশ করে, যার পর প্রধান খণ্ডবাক্যটি ফলাফল উপস্থাপন করে।`,
    clauseRelationshipCompound: (coord) =>
      `দুটি স্বাধীন খণ্ডবাক্য সংযোজক অব্যয় "${coord}" দ্বারা যুক্ত।`,
    clauseRelationshipTrailing: (subMarker, isTime) =>
      isTime
        ? `প্রধান খণ্ডবাক্যটি মূল প্রেক্ষাপট নির্দেশ করে এবং "${subMarker}" দ্বারা যুক্ত অধীন খণ্ডবাক্যটি সেই সময়ে সংঘটিত আকস্মিক ঘটনাটি উল্লেখ করে।`
        : `প্রধান খণ্ডবাক্যটি মূল বক্তব্য প্রকাশ করে এবং অধীন খণ্ডবাক্যটি সহায়ক প্রেক্ষাপট প্রদান করে।`,
    clauseRelationshipNoun: () =>
      `মূল খণ্ডবাক্যটি বিবৃতি প্রকাশ করে এবং বিশেষ্য খণ্ডবাক্যটি কর্ম হিসেবে বিবৃতির বিষয়বস্তু তুলে ধরে।`,
    clauseRelationshipRelative: () =>
      `সম্বন্ধবাচক খণ্ডবাক্যটি প্রধান খণ্ডবাক্যের কোনো বিশেষ্য পদকে অলংকৃত বা নির্দিষ্ট করে।`,
    subjectExplanation: (subject) =>
      `উদ্দেশ্য বা কর্তা (Subject): বাক্যটিতে যে সত্তা ক্রিয়া সম্পাদন করছে ("${subject}")।`,
    verbExplanation: (verb, tense, isLinking, isCoordinated) => {
      if (isLinking) return `সংযোজক ক্রিয়া (Linking Verb) যা কর্তার সাথে তার পরিপূরক অবস্থা যুক্ত করে ("${verb}")।`;
      if (isCoordinated) return `সংযোজক "and" দিয়ে যুক্ত দুটি সমাপিকা ক্রিয়া ("${verb}")।`;
      return `সকর্মক সমাপিকা ক্রিয়া (Finite Verb): যার প্রভাব বাক্যের অর্থের উপর বর্তায় ("${verb}"${tense ? `, ${tense}` : ''})।`;
    },
    directObjectExplanation: (obj) =>
      `সরাসরি কর্ম পদবন্ধ (Direct Object): ক্রিয়ার সরাসরি লক্ষ্যবস্তু ("${obj}")।`,
    indirectObjectExplanation: (obj) =>
      `গৌণ কর্ম (Indirect Object): ক্রিয়ার ফল বা সুবিধা গ্রহণকারী ("${obj}")।`,
    complementExplanation: (comp) =>
      `কর্তার পরিপূরক (Subject Complement): যা কর্তার পরিচয় বা গুণ প্রকাশ করে ("${comp}")।`,
    purposeExplanation: (purpose) =>
      `উদ্দেশ্যমূলক পদবন্ধ (Purpose Infinitive): কাজটি করার লক্ষ্য বা উদ্দেশ্য নির্দেশ করে ("${purpose}")।`,
    adverbialLocation: (text) =>
      `স্থান নির্দেশক ক্রিয়া-বিশেষণ পদবন্ধ (Adverbial of Place), যা কোনো কর্ম (Direct Object) নয় ("${text}")।`,
    adverbialDirection: (text) =>
      `দিক ও গতি নির্দেশক ক্রিয়া-বিশেষণ পদবন্ধ ("${text}")।`,
    adverbialModalStance: (text) =>
      `মন্তব্যসূচক ক্রিয়া-বিশেষণ (Modal Adverb) যা কর্ম পদবন্ধের মর্যাদাকে অভিমত হিসেবে প্রকাশ করে ("${text}")।`,
    sentenceStructureOverview: (type, indCount, depCount) => {
      if (type === 'compound-complex') {
        return `যৌগিক-জটিল বাক্য (Compound-Complex Sentence): এতে ${indCount}টি প্রধান খণ্ডবাক্য এবং ${depCount}টি নির্ভরশীল খণ্ডবাক্য যুক্ত রয়েছে।`;
      }
      if (type === 'compound') {
        return `যৌগিক বাক্য (Compound Sentence): দুটি সম্পূর্ণ স্বাধীন খণ্ডবাক্য সংযোজক অব্যয় দিয়ে যুক্ত।`;
      }
      if (type === 'complex') {
        return `জটিল বাক্য (Complex Sentence): কারণ এতে একটি প্রধান খণ্ডবাক্য এবং একটি নির্ভরশীল খণ্ডবাক্য যুক্ত রয়েছে।`;
      }
      return `সরল বাক্য (Simple Sentence): এতে একটিমাত্র স্বাধীন খণ্ডবাক্য ও পূর্ণাঙ্গ বক্তব্য রয়েছে। মুখের ভাষার আত্ম-সংশোধন বা মন্তব্য কোনো আলাদা খণ্ডবাক্য নয়।`;
    },
    patternSummary: (formula) =>
      `বাক্য কাঠামো: এই বাক্যটি "${formula}" কাঠামোটি অনুসরণ করে। এটি উদ্দেশ্য, সমাপিকা ক্রিয়া এবং লক্ষ্যবস্তুর স্বাভাবিক ব্যবহারের পাশাপাশি অর্থবহ ভাব প্রকাশ করে।`,
    appositiveAge: () => `কমা দ্বারা আবদ্ধ বয়স নির্দেশক উপবাক্যাংশ (Appositive)।`,
    appositiveLocation: () => `কর্তার বাসস্থান ও ভৌগোলিক উৎস নির্দেশক পদবন্ধ।`,
    pastContinuousAspect: () => `অতীত ঘটমান কাল (Past Continuous) যা চলমান পটভূমি প্রকাশ করে।`,
    phraseConstituent: (headNoun) =>
      `প্রধান বিশেষ্য "${headNoun}"-কে কেন্দ্র করে গঠিত একটি বিশেষ্য পদবন্ধ।`,
    headNounRole: (noun) => `প্রধান বিশেষ্য (Head Noun): পদবন্ধের মূল কেন্দ্রবিন্দু বিশেষ্য ("${noun}")।`,
    determinerRole: (det) => `সম্বন্ধসূচক নির্দেশক: মালিকানা নির্দেশ করে ("${det}")।`,
    superlativeRole: (adj) => `সর্বোচ্চ মাত্রাবাচক বিশেষণ: বিশেষ্যের সর্বোচ্চ গুণ প্রকাশ করে ("${adj}")।`,
    adverbRole: () => `মন্তব্যসূচক ক্রিয়া-বিশেষণ (Adverb)।`,
    articleRole: () => `নির্দিষ্টতাবাচক নির্দেশক।`,
    properNounAdjunctRole: (noun) => `নামবাচক বিশেষ্য বিশেষণ ("${noun}")।`,
    structureMapNode: (isMain) => isMain ? 'মূল স্বাধীন খণ্ডবাক্য' : 'সহায়ক খণ্ডবাক্য',
    getVocabularyWord: (word) => lookupVocabularyWord(word, 'bn')
  };
}

interface LocalizedWordBankEntry {
  meaning: string;
  bn: string;
  en: string;
  es: string;
  hi: string;
  pos: string;
  role: string;
}

const EXTENDED_WORD_BANK: Record<string, LocalizedWordBankEntry> = {
  researchers: {
    meaning: 'Scientists or medical experts who conduct systematic investigations to discover new facts or treatments.',
    bn: 'গবেষকগণ বা বিজ্ঞানী দল',
    en: 'Medical experts and scientists investigating treatments',
    es: 'Investigadores o científicos',
    hi: 'शोधकर्ता या वैज्ञानिक',
    pos: 'Plural Noun',
    role: 'Subject Noun Phrase'
  },
  demand: {
    meaning: 'Ask for something forcefully and urgently, expressing a non-negotiable need.',
    bn: 'জরুরি দাবি জানাচ্ছেন',
    en: 'Ask forcefully and urgently for a vital need',
    es: 'Exigen o demandan firmemente',
    hi: 'पुरजोर मांग कर रहे हैं',
    pos: 'Transitive Verb (Present Tense)',
    role: 'Main Finite Verb'
  },
  urgent: {
    meaning: 'Requiring immediate action, attention, or financial support without delay.',
    bn: 'জরুরি বা অবিলম্বে প্রয়োজনীয়',
    en: 'Needing immediate attention or action without delay',
    es: 'Urgente o inmediato',
    hi: 'अति आवश्यक या तत्काल',
    pos: 'Adjective',
    role: 'Pre-nominal Modifier of Object'
  },
  funding: {
    meaning: 'Financial resources or money provided by government or organizations for a specific purpose.',
    bn: 'অর্থায়ন বা তহবিল',
    en: 'Financial support or money provided for research',
    es: 'Fondos o financiamiento',
    hi: 'धन या वित्तीय सहायता',
    pos: 'Uncountable Noun',
    role: 'Head Noun of Direct Object'
  },
  transform: {
    meaning: 'To completely and dramatically improve the condition, quality, or outcome of something.',
    bn: 'আমূল রূপান্তর বা পরিবর্তন করা',
    en: 'To completely change and dramatically improve',
    es: 'Transformar o mejorar drásticamente',
    hi: 'युगांतरकारी बदलाव लाना',
    pos: 'Infinitive Verb',
    role: 'Verb in Purpose Clause'
  },
  survival: {
    meaning: 'The state or fact of continuing to live, especially after serious illness.',
    bn: 'বেঁচে থাকার হার বা জীবনরক্ষা',
    en: 'Continuing to live and overcome serious illness',
    es: 'Supervivencia o tasa de vida',
    hi: 'जीवन रक्षा या जीवित रहने की दर',
    pos: 'Noun',
    role: 'Object in Purpose Clause'
  },
  ovarian: {
    meaning: 'Relating to the ovaries (the female reproductive organs).',
    bn: 'ডিম্বাশয় সংক্রান্ত',
    en: 'Relating to the ovaries',
    es: 'Ovárico o de los ovarios',
    hi: 'डिम्बग्रंथि संबंधी',
    pos: 'Adjective Modifier',
    role: 'Noun Adjunct'
  },
  cancer: {
    meaning: 'A serious medical disease characterized by uncontrolled cell growth.',
    bn: 'ক্যান্সার বা মারাত্মক কর্কটরোগ',
    en: 'A serious medical illness with abnormal cell growth',
    es: 'Cáncer',
    hi: 'कैंसर',
    pos: 'Noun Modifier',
    role: 'Noun Adjunct'
  },
  revealed: {
    meaning: 'Made previously unknown or secret information visible or known to the public.',
    bn: 'প্রকাশ করলেন বা উন্মোচন করলেন',
    en: 'Made previously unknown facts publicly known',
    es: 'Reveló o dio a conocer públicamente',
    hi: 'खुलासा किया या सार्वजनिक किया',
    pos: 'Transitive Verb (Past Tense)',
    role: 'Main Finite Verb'
  },
  arguably: {
    meaning: 'It may be reasonably argued or defended (used to soften a superlative claim).',
    bn: 'যুক্তিগ্রাহ্যভাবে বা অনেকের মতে',
    en: 'Plausibly argued, though open to interpretation',
    es: 'Posiblemente o según se puede argumentar',
    hi: 'तर्कसंगत रूप से या कई लोगों के अनुसार',
    pos: 'Adverb of Stance / Modal Adverb',
    role: 'Adverbial Modifier of Noun Phrase'
  },
  invention: {
    meaning: 'A completely new device, concept, or process created for the first time.',
    bn: 'উদ্ভাবন বা নতুন সৃষ্টি',
    en: 'A completely new device or concept created for the first time',
    es: 'Invención o nueva creación',
    hi: 'आविष्कार या नई रचना',
    pos: 'Countable Noun',
    role: 'Head Noun (Original Target of Self-Correction)'
  },
  product: {
    meaning: 'An article or substance that is manufactured or refined for sale to consumers.',
    bn: 'পণ্য বা বাণিজ্যিক দ্রব্য',
    en: 'Commercial good produced for sale',
    es: 'Producto o artículo comercial',
    hi: 'उत्पाद या व्यापारिक वस्तु',
    pos: 'Countable Noun',
    role: 'Head Noun (Corrected Term)'
  },
  greatest: {
    meaning: 'Surpassing all others in magnitude, importance, or achievement.',
    bn: 'সর্বশ্রেষ্ঠ বা সবচেয়ে গুরুত্বপূর্ণ',
    en: 'Best, supreme, or most significant',
    es: 'El mejor o más grande',
    hi: 'सर्वश्रेष्ठ या सबसे महान',
    pos: 'Superlative Adjective',
    role: 'Pre-nominal Modifier'
  },
  boss: {
    meaning: 'A person who is in charge of an organization or business enterprise.',
    bn: 'প্রধান বা শীর্ষ কর্তা',
    en: 'Leader or head executive of an organization',
    es: 'Jefe o líder directivo',
    hi: 'प्रमुख या मुख्य अधिकारी',
    pos: 'Noun',
    role: 'Head Noun of Subject'
  },
  hurdles: {
    meaning: 'Obstacles, difficulties, or challenges that need to be overcome.',
    bn: 'প্রতিবন্ধকতা বা বাধা',
    en: 'Obstacles or unexpected challenges',
    es: 'Obstáculos o dificultades imprevistas',
    hi: 'बाधाएं या अप्रत्याशित चुनौतियां',
    pos: 'Plural Noun',
    role: 'Direct Object of Subordinate Clause'
  },
  hypothesis: {
    meaning: 'A proposed explanation or starting assumption made for further testing.',
    bn: 'অনুমিত সিদ্ধান্ত বা প্রকল্প',
    en: 'Proposed scientific explanation tested by evidence',
    es: 'Hipótesis o explicación propuesta',
    hi: 'परिकल्पना या परीक्षण योग्य सिद्धांत',
    pos: 'Singular Noun',
    role: 'Direct Object'
  },
  archives: {
    meaning: 'A collection of historical records or documents providing primary evidence.',
    bn: 'নথিপত্র বা ঐতিহাসিক সংরক্ষণাগার',
    en: 'Historical records or preserved documents',
    es: 'Archivos o registros históricos',
    hi: 'ऐतिहासिक अभिलेखागार या दस्तावेज',
    pos: 'Plural Noun',
    role: 'Object of Preposition'
  },
  holidaying: {
    meaning: 'Spending time away from home for recreation and leisure (vacationing).',
    bn: 'ছুটি উদযাপন বা অবকাশ যাপন করছিলেন',
    en: 'Vacationing or taking leisure time away from home',
    es: 'De vacaciones o pasando días de descanso',
    hi: 'छुट्टियां मना रहे थे',
    pos: 'Verb (Present Participle)',
    role: 'Main Verb in Verb Phrase'
  },
  slipped: {
    meaning: 'Lost footing or balance accidentally.',
    bn: 'পা পিছলে গিয়েছিল',
    en: 'Accidentally lost balance or footing',
    es: 'Resbaló accidentalmente',
    hi: 'पैर फिसल गया था',
    pos: 'Past Simple Verb',
    role: 'First Coordinated Finite Verb'
  },
  fell: {
    meaning: 'Dropped suddenly downward under the force of gravity.',
    bn: 'পড়ে গিয়েছিলেন',
    en: 'Dropped downward after losing footing',
    es: 'Cayó hacia abajo',
    hi: 'नीचे गिर गए थे',
    pos: 'Past Simple Verb',
    role: 'Second Coordinated Finite Verb'
  },
  stairwell: {
    meaning: 'A vertical shaft in a building containing a staircase.',
    bn: 'সিঁড়ির খোলা খাঁদ বা খাঁচা',
    en: 'Vertical opening in a building for a staircase',
    es: 'Hueco de la escalera',
    hi: 'सीढ़ियों का शाफ्ट या खुला स्थान',
    pos: 'Compound Noun',
    role: 'Object of Preposition "into"'
  },
  island: {
    meaning: 'A piece of land surrounded by water.',
    bn: 'দ্বীপ',
    en: 'Land mass entirely surrounded by water',
    es: 'Isla',
    hi: 'द्वीप या टापू',
    pos: 'Noun',
    role: 'Object of Preposition "on"'
  }
};

function lookupVocabularyWord(
  rawWord: string,
  targetLang: string
): { meaning: string; localized: string; pos: string; role: string } | null {
  const lower = rawWord.toLowerCase().replace(/^[^\w'-]+|[^\w'-]+$/g, '');
  const entry = EXTENDED_WORD_BANK[lower];
  if (!entry) return null;

  let localized = entry.bn;
  if (targetLang === 'en') localized = entry.en;
  else if (targetLang === 'es') localized = entry.es;
  else if (targetLang === 'hi') localized = entry.hi;
  else if (targetLang === 'bn') localized = entry.bn;
  else localized = entry.en;

  return {
    meaning: entry.meaning,
    localized,
    pos: entry.pos,
    role: entry.role
  };
}

export interface BeginnerComponentSection {
  num: string;
  typeKey: string;
  title: string;
  phrase: string;
  roleLabel: string;
  simpleTitle: string;
  simpleText: string;
  tipTitle: string;
  tipText: string;
  isOpen: boolean;
  badgeLetter: string;
  badgeBg: string;
  guidingQuestion: string;
}

export function getSentenceOverviewTeaching(
  type: string = 'simple',
  targetLang: string = 'bn'
): { badgeLabel: string; explanation: string } {
  const cleanType = (type || 'simple').toLowerCase();
  const cleanLang = (targetLang || 'bn').toLowerCase();

  if (cleanType === 'compound-complex') {
    return {
      badgeLabel: 'Compound Complex Sentence',
      explanation: cleanLang === 'en'
        ? 'This type of sentence contains at least two independent main clauses and at least one dependent clause. The complete sentence must be examined to verify this classification.'
        : (cleanLang === 'es'
          ? 'Este tipo de oración contiene al menos dos cláusulas principales independientes y al menos una cláusula dependiente.'
          : (cleanLang === 'hi'
            ? 'इस प्रकार के वाक्य में कम से कम दो मुख्य उपवाक्य और एक आश्रित उपवाक्य होते हैं।'
            : 'এই ধরনের বাক্যে কমপক্ষে দুটি Main Clause এবং একটি Dependent Clause থাকে। সম্পূর্ণ বাক্য দেখে এই classification যাচাই করতে হবে।'))
    };
  }

  if (cleanType === 'compound') {
    return {
      badgeLabel: 'Compound Sentence',
      explanation: cleanLang === 'en'
        ? 'Compound sentence: contains two independent main clauses linked by a coordinating conjunction (such as and, but, or so).'
        : (cleanLang === 'es'
          ? 'Oración compuesta: contiene dos cláusulas independientes unidas por una conjunción coordinante.'
          : 'যৌগিক বাক্য (Compound Sentence): এতে দুটি সম্পূর্ণ স্বাধীন বক্তব্য সংযোজক অব্যয় দিয়ে যুক্ত থাকে।')
    };
  }

  if (cleanType === 'complex') {
    return {
      badgeLabel: 'Complex Sentence',
      explanation: cleanLang === 'en'
        ? 'Complex sentence: contains one main independent clause paired with one or more dependent clauses providing background context.'
        : (cleanLang === 'es'
          ? 'Oración compleja: contiene una cláusula independiente principal junto con una o más cláusulas dependientes subordinadas.'
          : 'জটিল বাক্য (Complex Sentence): এতে একটি প্রধান বক্তব্য এবং তার সাথে যুক্ত এক বা একাধিক সহায়ক নির্ভরশীল খণ্ডবাক্য (Dependent Clause) থাকে।')
    };
  }

  return {
    badgeLabel: 'Simple Sentence',
    explanation: cleanLang === 'en'
      ? 'Simple sentence: contains exactly one independent clause conveying a single complete, direct message without separate subordinate clauses.'
      : (cleanLang === 'es'
        ? 'Oración simple: contiene exactamente una cláusula independiente con una idea completa y directa.'
        : 'সরল বাক্য (Simple Sentence): এতে একটিমাত্র মূল বক্তব্য বা স্বাধীন খণ্ডবাক্য (Independent Clause) রয়েছে, যাতে সরাসরি একটি স্পষ্ট অর্থ প্রকাশ পায়।')
  };
}

export function buildBeginnerBreakdownSections(
  clause: any,
  sentenceText: string = '',
  targetLang: string = 'bn'
): BeginnerComponentSection[] {
  const sections: BeginnerComponentSection[] = [];
  const cleanSentence = (sentenceText || '').toLowerCase();
  const cleanLang = (targetLang || 'bn').toLowerCase();

  const isEn = cleanLang === 'en';
  const isEs = cleanLang === 'es';
  const isHi = cleanLang === 'hi';

  const simpleWordTitle = isEn ? 'In simple words' : (isEs ? 'En palabras sencillas' : (isHi ? 'सरल भाषा में' : 'সহজ ভাষায়'));
  const tipTitle = isEn ? '💡 Remember this' : (isEs ? '💡 Recuerda esto' : (isHi ? '💡 याद रखें' : '💡 মনে রাখো'));

  // 01: SUBJECT
  const subjectText = clause?.subject || (cleanSentence ? cleanSentence.split(/\s+/)[0] : 'Subject');
  let subjectRole = isEn ? 'Subject' : (isEs ? 'Sujeto' : (isHi ? 'कर्ता' : 'কর্তা'));
  const subjectSimple = (isEn ? clause?.subjectExplanation : clause?.subjectExplanationBengali) ||
    clause?.subjectExplanationBengali ||
    clause?.subjectExplanation ||
    (isEn
      ? `'${subjectText}' is the entity performing the action or being discussed in this clause.`
      : (isEs
        ? `'${subjectText}' es quien realiza la acción principal de la oración. Por eso funciona como el Sujeto.`
        : `'${subjectText}' হলো বাক্যের মূল কর্তা। কার সম্পর্কে বা কে কাজটি করছে? '${subjectText}'। তাই এটি হলো Subject বা কর্তা।`));
  const subjectTip = isEn
    ? 'Look for who is performing the action or who is being discussed to identify the Subject.'
    : (isEs
      ? 'Identifica quién realiza la acción o de quién se habla para encontrar el Sujeto.'
      : 'কে কাজটি করছে বা কার সম্পর্কে বলা হচ্ছে, তা খুঁজে Subject শেখো।');
  const subjectQA = isEn ? `Who? ${subjectText}.` : (isEs ? `¿Quién? ${subjectText}.` : `কারা / কে? ${subjectText}।`);

  sections.push({
    num: '01',
    typeKey: 'subject',
    title: 'Subject',
    phrase: subjectText,
    roleLabel: subjectRole,
    simpleTitle: simpleWordTitle,
    simpleText: subjectSimple,
    tipTitle,
    tipText: subjectTip,
    isOpen: true,
    badgeLetter: 'S',
    badgeBg: '#2563eb',
    guidingQuestion: subjectQA
  });

  // 02: VERB PHRASE
  const verbText = clause?.verbPhrase || clause?.verb || 'Verb';
  let verbRole = isEn ? 'Verb Phrase' : (isEs ? 'Frase verbal' : (isHi ? 'क्रिया' : 'ক্রিয়া পদবন্ধ'));
  const verbSimple = (isEn ? clause?.verbExplanation : clause?.verbExplanationBengali) ||
    clause?.verbExplanationBengali ||
    clause?.verbExplanation ||
    (isEn
      ? `'${verbText}' expresses the core action or state of being of the subject. It is the engine that drives the sentence.`
      : (isEs
        ? `'${verbText}' expresa la acción o estado del sujeto en la oración.`
        : `'${verbText}' হলো বাক্যের প্রধান সমাপিকা ক্রিয়া (Verb)। কর্তা কী করছে বা কী অবস্থা, তা সরাসরি প্রকাশ করছে।`));
  const verbTip = isEn
    ? 'The verb tells you what action the subject performed, did not perform, or what state they are in.'
    : (isEs
      ? 'El verbo indica qué acción realizó el sujeto o en qué estado se encuentra.'
      : 'কর্তা ঠিক কী কাজ করছে বা তার অবস্থা কী, তা যে শব্দ দিয়ে বোঝায় সেটাই Verb।');
  const verbQA = isEn ? `What action? ${verbText}.` : (isEs ? `¿Qué acción? ${verbText}.` : `কী কাজ / ক্রিয়া? ${verbText}।`);

  sections.push({
    num: '02',
    typeKey: 'verb',
    title: 'Verb Phrase',
    phrase: verbText,
    roleLabel: verbRole,
    simpleTitle: simpleWordTitle,
    simpleText: verbSimple,
    tipTitle,
    tipText: verbTip,
    isOpen: false,
    badgeLetter: 'V',
    badgeBg: '#3b82f6',
    guidingQuestion: verbQA
  });

  // 03: DIRECT OBJECT
  const doText = clause?.directObject || '';
  if (doText) {
    let doRole = isEn ? 'Direct Object' : (isEs ? 'Objeto Directo' : (isHi ? 'प्रत्यक्ष कर्म' : 'সরাসরি কর্ম'));
    const doSimple = (isEn ? clause?.directObjectExplanation : clause?.directObjectExplanationBengali) ||
      clause?.directObjectExplanationBengali ||
      clause?.directObjectExplanation ||
      (isEn
        ? `'${doText}' directly receives the action of the verb. Asking "what?" or "whom?" after the verb reveals it as the Direct Object.`
        : (isEs
          ? `'${doText}' recibe directamente la acción del verbo como el Objeto Directo.`
          : `'${doText}' হলো Direct Object (সরাসরি কর্ম)। ক্রিয়াকে 'কী?' বা 'কাকে?' প্রশ্ন করলে '${doText}' উত্তর পাওয়া যায়।`));
    const doTip = isEn
      ? 'Ask "what?" or "whom?" after the verb to find the Direct Object.'
      : (isEs
        ? 'Pregunta "¿qué?" o "¿a quién?" al verbo para encontrar el Objeto Directo.'
        : 'ক্রিয়াকে "কী?" বা "কাকে?" প্রশ্ন করে Direct Object খুঁজে বের করো।');
    const doQA = isEn ? `Receives what? ${doText}.` : (isEs ? `¿Qué recibe la acción? ${doText}.` : `কী বা কাকে? ${doText}।`);

    sections.push({
      num: String(sections.length + 1).padStart(2, '0'),
      typeKey: 'object',
      title: 'Direct Object',
      phrase: doText,
      roleLabel: doRole,
      simpleTitle: simpleWordTitle,
      simpleText: doSimple,
      tipTitle,
      tipText: doTip,
      isOpen: false,
      badgeLetter: 'DO',
      badgeBg: '#64748b',
      guidingQuestion: doQA
    });
  }

  // 04: COMPLEMENT (if present)
  const complementText = clause?.complement || '';
  if (complementText) {
    const compRole = isEn ? 'Complement' : (isEs ? 'Complemento' : 'পরিপূরক (Complement)');
    const compSimple = (isEn ? clause?.complementExplanation : clause?.complementExplanationBengali) ||
      clause?.complementExplanationBengali ||
      clause?.complementExplanation ||
      (isEn
        ? `'${complementText}' completes the predicate and describes the subject or object.`
        : `'${complementText}' বাক্যের অর্থ পূর্ণ করে কর্তা বা কর্মের বৈশিষ্ট্য প্রকাশ করে।`);
    sections.push({
      num: String(sections.length + 1).padStart(2, '0'),
      typeKey: 'complement',
      title: 'Complement',
      phrase: complementText,
      roleLabel: compRole,
      simpleTitle: simpleWordTitle,
      simpleText: compSimple,
      tipTitle,
      tipText: isEn ? 'Complements describe or identify the subject or object.' : 'Subject বা Object সম্পর্কে তথ্য দিয়ে অর্থ পূর্ণ করে।',
      isOpen: false,
      badgeLetter: 'C',
      badgeBg: '#6366f1',
      guidingQuestion: isEn ? `What is it? ${complementText}.` : `কেমন বা কী? ${complementText}।`
    });
  }

  // 05: ADVERBIALS / PREPOSITIONAL PHRASES
  if (Array.isArray(clause?.adverbials) && clause.adverbials.length > 0) {
    clause.adverbials.forEach((adv: any, i: number) => {
      const advText = adv.text || '';
      if (!advText) return;
      const advRole = isEn ? (adv.type || 'Adverbial') : (isEs ? 'Adverbial' : 'ক্রিয়া-বিশেষণীয় পদবন্ধ (Adverbial)');
      const advSimple = (isEn ? adv.explanation : adv.explanationBengali) ||
        adv.explanationBengali ||
        adv.explanation ||
        (isEn
          ? `'${advText}' provides contextual information explaining when, where, why, or how the action occurred.`
          : `'${advText}' বাক্যে কাজের সময়, স্থান, কারণ বা ধরন প্রকাশ করছে।`);
      sections.push({
        num: String(sections.length + 1).padStart(2, '0'),
        typeKey: `adverbial_${i}`,
        title: adv.type || 'Adverbial',
        phrase: advText,
        roleLabel: advRole,
        simpleTitle: simpleWordTitle,
        simpleText: advSimple,
        tipTitle,
        tipText: isEn ? 'Adverbials tell you when, where, why, or how the action took place.' : 'কখন, কোথায়, কীভাবে বা কেন নির্দেশ করলে তা Adverbial।',
        isOpen: false,
        badgeLetter: 'ADV',
        badgeBg: '#0f766e',
        guidingQuestion: isEn ? `Context: ${advText}.` : `প্রেক্ষাপট: ${advText}।`
      });
    });
  }
  return sections;
}

