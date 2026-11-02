import React, { useState, useEffect, useRef } from 'react';
import { TargetExam, LearnerProfile } from '../../types';
import {
  Clock,
  Award,
  BookOpen,
  PenTool,
  Mic,
  Headphones,
  Play,
  RotateCcw,
  ShieldCheck,
  BrainCircuit,
  Volume2,
  Square,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { MistakeMemoryClient } from '../../services/mistake/client';
import { createExamAiCaller, isPlaceholderScore } from '../../services/ai/examCaller';
import type { CloudExamRequest } from '../../services/ai/cloudProvider';
import { isSpeechToTextSupported, startSpeechToText, SpeechToTextSession } from '../../services/audio/speechToText';
import { playNaturalSpeech, stopAllAudio } from '../../services/audio/voiceService';
import { evaluateReadAloud } from '../../../exams/pte/speaking/evaluator';
import { evaluatePteSwt } from '../../../exams/pte/writing/evaluator';
import { evaluatePteFillInBlanks } from '../../../exams/pte/reading/scorer';
import { evaluatePteWriteFromDictation } from '../../../exams/pte/listening/scorer';
import { evaluateIeltsFormCompletion } from '../../../exams/ielts/listening/scorer';
import { evaluateIeltsTrueFalseNotGiven } from '../../../exams/ielts/reading/scorer';
import { evaluateIeltsTask2 } from '../../../exams/ielts/writing/evaluator';
import { evaluateIeltsSpeakingPart2 } from '../../../exams/ielts/speaking/evaluator';

interface FullMockExamViewProps {
  learnerProfile?: LearnerProfile | null;
  onNavigateToMistake?: (errorCode: string) => void;
  onOpenSettings?: () => void;
}

type ExamState = 'idle' | 'running' | 'scoring' | 'completed';
type Section = 'Speaking' | 'Writing' | 'Reading' | 'Listening';

interface SectionResult {
  sectionName: Section;
  /** null when the section could not be marked (no AI provider). */
  score: number | null;
  scaleType: 'pte' | 'ielts';
  detectedErrors: string[];
  status: 'scored' | 'skipped' | 'unmarked';
  detail?: string;
}

interface StageAnswer {
  text?: string;
  fields?: Record<string, string>;
  durationSec?: number;
}

type MockStage = {
  id: string;
  section: Section;
  name: string;
  icon: React.ReactNode;
  instructions: string;
} & (
  | { kind: 'speak'; prompt: string; recordSeconds: number }
  | { kind: 'write'; prompt: string; passage?: string; minWords: number; maxWords?: number }
  | { kind: 'blanks'; parts: string[]; blanks: { id: string; options: string[]; answer: string }[] }
  | { kind: 'dictation'; audio: string }
  | { kind: 'form'; audio: string; fields: { id: string; label: string; accepted: string[]; maxWords: number }[] }
  | { kind: 'tfng'; passage: string; statements: { id: string; text: string; answer: 'TRUE' | 'FALSE' | 'NOT GIVEN'; explanation: string }[] }
);

const MOCK_SECONDS = 20 * 60;

const PTE_STAGES: MockStage[] = [
  {
    id: 'pte_speaking',
    section: 'Speaking',
    name: 'Speaking: Read Aloud',
    icon: <Mic size={18} />,
    instructions: 'Read the passage aloud clearly. Press Record, read, then Stop.',
    kind: 'speak',
    recordSeconds: 40,
    prompt:
      'The unprecedented expansion of urban transportation networks has fundamentally restructured metropolitan economic productivity across Southeast Asia.'
  },
  {
    id: 'pte_writing',
    section: 'Writing',
    name: 'Writing: Summarize Written Text',
    icon: <PenTool size={18} />,
    instructions: 'Write a one-sentence summary of the passage in 5–75 words.',
    kind: 'write',
    minWords: 5,
    maxWords: 75,
    prompt: 'Summarise the passage in ONE sentence.',
    passage:
      'Renewable energy deployment has grown exponentially due to plummeting manufacturing costs for photovoltaic solar modules and battery storage. However, existing grid transmission corridors remain insufficient to distribute electricity from rural solar fields to metropolitan urban hubs without substantial capital investments.'
  },
  {
    id: 'pte_reading',
    section: 'Reading',
    name: 'Reading: Fill in the Blanks',
    icon: <BookOpen size={18} />,
    instructions: 'Choose the most appropriate word for each gap.',
    kind: 'blanks',
    parts: ['Forest conservation requires ', ' legislative enforcement to prevent illegal ', ' and to protect the habitats of ', ' species.'],
    blanks: [
      { id: 'b1', options: ['robust', 'fragile', 'casual', 'minor'], answer: 'robust' },
      { id: 'b2', options: ['voting', 'logging', 'farming', 'singing'], answer: 'logging' },
      { id: 'b3', options: ['imaginary', 'abundant', 'endangered', 'domestic'], answer: 'endangered' }
    ]
  },
  {
    id: 'pte_listening',
    section: 'Listening',
    name: 'Listening: Write from Dictation',
    icon: <Headphones size={18} />,
    instructions: 'Play the sentence once, then type exactly what you heard.',
    kind: 'dictation',
    audio: 'Scientific research must adhere to strict ethical guidelines.'
  }
];

const IELTS_STAGES: MockStage[] = [
  {
    id: 'ielts_listening',
    section: 'Listening',
    name: 'Listening: Form Completion',
    icon: <Headphones size={18} />,
    instructions: 'Play the recording once and complete the form. Write NO MORE THAN TWO WORDS for each answer.',
    kind: 'form',
    audio:
      "Hello, I'd like to join the sports centre. My surname is Henderson, that's H, E, N, D, E, R, S, O, N. I want to register for the badminton league, and I can only play on Thursday evenings.",
    fields: [
      { id: 'f1', label: 'Surname', accepted: ['henderson'], maxWords: 2 },
      { id: 'f2', label: 'Sport', accepted: ['badminton', 'badminton league'], maxWords: 2 },
      { id: 'f3', label: 'Day available', accepted: ['thursday', 'thursdays', 'thursday evenings', 'thursday evening'], maxWords: 2 }
    ]
  },
  {
    id: 'ielts_reading',
    section: 'Reading',
    name: 'Reading: True / False / Not Given',
    icon: <BookOpen size={18} />,
    instructions: 'Decide whether each statement agrees with the passage.',
    kind: 'tfng',
    passage:
      'Green roofs, which are covered with soil and plants, can lower the surface temperature of a building by up to 28°C on a summer day. They also absorb rainwater, reducing pressure on city drains. Installation costs remain higher than for conventional roofs, although many owners recover the difference through lower energy bills.',
    statements: [
      { id: 's1', text: 'Green roofs can make a building surface cooler in summer.', answer: 'TRUE', explanation: 'The passage says they lower surface temperature by up to 28°C.' },
      { id: 's2', text: 'Green roofs are cheaper to install than conventional roofs.', answer: 'FALSE', explanation: 'Installation costs remain higher than for conventional roofs.' },
      { id: 's3', text: 'Most cities now require green roofs on new buildings.', answer: 'NOT GIVEN', explanation: 'The passage says nothing about city requirements.' }
    ]
  },
  {
    id: 'ielts_writing',
    section: 'Writing',
    name: 'Writing: Task 2 Essay',
    icon: <PenTool size={18} />,
    instructions: 'Write at least 250 words. Discuss both views and give your own opinion.',
    kind: 'write',
    minWords: 250,
    prompt: 'Some people believe higher education should be free for all students, while others think students should pay for it. Discuss both views and give your opinion.'
  },
  {
    id: 'ielts_speaking',
    section: 'Speaking',
    name: 'Speaking: Part 2 Cue Card',
    icon: <Mic size={18} />,
    instructions: 'Speak for 1–2 minutes. Press Record, talk, then Stop.',
    kind: 'speak',
    recordSeconds: 120,
    prompt: 'Describe a teacher who greatly influenced your academic journey. Say who they were, what they taught you, and why they mattered to you.'
  }
];

const countWords = (text: string) => text.trim().split(/\s+/).filter((t) => /[a-zA-Z0-9]/.test(t)).length;

const formatTimer = (totalSeconds: number) => {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

function ieltsCompositeBand(scores: number[]): number {
  if (scores.length === 0) return 0;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const integerPart = Math.floor(avg);
  const fraction = avg - integerPart;
  if (fraction < 0.25) return integerPart;
  if (fraction < 0.75) return integerPart + 0.5;
  return integerPart + 1.0;
}

function pteCompositeScore(scores: number[]): number {
  if (scores.length === 0) return 10;
  const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  return Math.min(90, Math.max(10, avg));
}

/** Marks one stage with the same engines the single-skill practice screens use. */
async function scoreStage(stage: MockStage, answer: StageAnswer | undefined, scale: 'pte' | 'ielts'): Promise<SectionResult> {
  const base = { sectionName: stage.section, scaleType: scale };
  const text = (answer?.text || '').trim();
  const fields = answer?.fields || {};
  const empty = stage.kind === 'speak' || stage.kind === 'write' || stage.kind === 'dictation'
    ? !text
    : Object.values(fields).every((v) => !v.trim());
  if (empty) {
    return { ...base, score: scale === 'pte' ? 10 : 0, detectedErrors: [], status: 'skipped', detail: 'Not attempted' };
  }

  // A typed answer has no recording, so it gets a nominal duration instead of a "too short" penalty
  const durationMs = stage.kind === 'speak' ? (answer?.durationSec ? answer.durationSec * 1000 : stage.recordSeconds * 500) : 0;
  const cloud: CloudExamRequest | undefined =
    stage.kind === 'speak'
      ? scale === 'pte'
        ? { task: 'pte-read-aloud', prompt: stage.prompt, transcript: text, durationMs, taskId: stage.id }
        : { task: 'ielts-speaking', part: 2, prompt: stage.prompt, transcript: text, durationMs, taskId: stage.id }
      : stage.kind === 'write'
        ? scale === 'pte'
          ? { task: 'pte-swt', passage: stage.passage || '', text, taskId: stage.id }
          : { task: 'ielts-task', taskNumber: 2, prompt: stage.prompt, text, taskId: stage.id }
        : undefined;
  const ai = createExamAiCaller(cloud);
  const aiResult = (overallScore: string, modelUsed: string, errorCodes: string[]): SectionResult =>
    isPlaceholderScore(modelUsed)
      ? { ...base, score: null, detectedErrors: [], status: 'unmarked', detail: ai.lastError() || 'Needs an AI provider' }
      : { ...base, score: Number(overallScore), detectedErrors: errorCodes, status: 'scored' };

  switch (stage.kind) {
    case 'speak': {
      const r = scale === 'pte'
        ? await evaluateReadAloud(stage.prompt, text, { durationMs }, { aiCaller: ai.call })
        : await evaluateIeltsSpeakingPart2(stage.prompt, text, { durationMs }, { aiCaller: ai.call });
      return aiResult(r.overallScore, r.modelUsed, r.errorCodes);
    }
    case 'write': {
      const r = scale === 'pte'
        ? await evaluatePteSwt(stage.passage || '', text, { aiCaller: ai.call })
        : await evaluateIeltsTask2(stage.prompt, text, { aiCaller: ai.call });
      return aiResult(r.overallScore, r.modelUsed, r.errorCodes);
    }
    case 'blanks': {
      const key = Object.fromEntries(stage.blanks.map((b) => [b.id, b.answer]));
      const r = evaluatePteFillInBlanks(stage.id, 'pte_fill_in_blanks_rw', fields, key);
      return { ...base, score: r.scaledScore, detectedErrors: r.detectedErrors, status: 'scored', detail: `${r.rawScore} of ${r.maxScore} correct` };
    }
    case 'dictation': {
      const r = evaluatePteWriteFromDictation(stage.id, text, stage.audio);
      return { ...base, score: r.scaledScore, detectedErrors: r.detectedErrors, status: 'scored', detail: `${r.rawScore} of ${r.maxScore} words` };
    }
    case 'form': {
      const key = Object.fromEntries(
        stage.fields.map((f) => [f.id, { acceptedAnswers: f.accepted, maxWords: f.maxWords, explanation: `Accepted: ${f.accepted[0]}` }])
      );
      const r = evaluateIeltsFormCompletion(stage.id, fields, key);
      return { ...base, score: r.bandScore, detectedErrors: r.detectedErrors, status: 'scored', detail: `${r.rawScore} of ${r.maxScore} correct` };
    }
    case 'tfng': {
      const key = Object.fromEntries(stage.statements.map((s) => [s.id, { answer: s.answer, explanation: s.explanation }]));
      const r = evaluateIeltsTrueFalseNotGiven(stage.id, fields, key);
      return { ...base, score: r.bandScore, detectedErrors: r.detectedErrors, status: 'scored', detail: `${r.rawScore} of ${r.maxScore} correct` };
    }
  }
}

export const FullMockExamView: React.FC<FullMockExamViewProps> = ({
  learnerProfile,
  onNavigateToMistake,
  onOpenSettings
}) => {
  const [targetExam, setTargetExam] = useState<TargetExam>(learnerProfile?.targetExam || 'pte_academic');
  const [examState, setExamState] = useState<ExamState>('idle');
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(MOCK_SECONDS);
  const [answers, setAnswers] = useState<Record<string, StageAnswer>>({});
  const [sectionResults, setSectionResults] = useState<SectionResult[]>([]);
  const [playedAudio, setPlayedAudio] = useState<Record<string, boolean>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const speechRef = useRef<SpeechToTextSession | null>(null);
  const recordStartRef = useRef<number>(0);
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const scale: 'pte' | 'ielts' = targetExam === 'pte_academic' ? 'pte' : 'ielts';
  const stages = scale === 'pte' ? PTE_STAGES : IELTS_STAGES;
  const stage = stages[currentStageIndex];
  const answer = answers[stage.id] || {};

  const updateAnswer = (patch: StageAnswer) =>
    setAnswers((prev) => ({ ...prev, [stage.id]: { ...prev[stage.id], ...patch } }));

  const stopRecording = () => {
    if (!speechRef.current && !isRecording) return;
    speechRef.current?.stop();
    speechRef.current = null;
    const seconds = Math.round((Date.now() - recordStartRef.current) / 1000);
    setIsRecording(false);
    setAnswers((prev) => ({ ...prev, [stage.id]: { ...prev[stage.id], durationSec: seconds } }));
  };

  useEffect(() => {
    if (learnerProfile?.targetExam && examState === 'idle') setTargetExam(learnerProfile.targetExam);
  }, [learnerProfile?.targetExam]);

  // Release microphone and speech when leaving the screen
  useEffect(
    () => () => {
      speechRef.current?.stop();
      stopAllAudio();
    },
    []
  );

  // Countdown timer
  useEffect(() => {
    if (examState !== 'running') return;
    if (timeLeft <= 0) {
      void handleCompleteExam();
      return;
    }
    const interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [examState, timeLeft]);

  const handleStartExam = () => {
    setExamState('running');
    setCurrentStageIndex(0);
    setTimeLeft(MOCK_SECONDS);
    setAnswers({});
    setPlayedAudio({});
    setSectionResults([]);
    setMicError(null);
  };

  const handleCompleteExam = async () => {
    stopRecording();
    stopAllAudio();
    setExamState('scoring');

    const finalAnswers = answersRef.current;
    const results: SectionResult[] = [];
    for (const s of stages) {
      try {
        results.push(await scoreStage(s, finalAnswers[s.id], scale));
      } catch {
        results.push({ sectionName: s.section, score: null, scaleType: scale, detectedErrors: [], status: 'unmarked', detail: 'Could not be marked' });
      }
    }
    setSectionResults(results);
    setExamState('completed');

    results.forEach((r) =>
      r.detectedErrors.forEach((err) => {
        try {
          MistakeMemoryClient.recordOccurrence(
            err,
            scale === 'pte' ? 'pte_full_mock' : 'ielts_full_mock',
            `Mock Exam Section: ${r.sectionName}`,
            scale === 'pte' ? 'PTE Full-Length Simulation' : 'IELTS Full-Length Simulation'
          );
        } catch {}
      })
    );
  };

  const handleNextStage = () => {
    stopRecording();
    stopAllAudio();
    setIsPlaying(false);
    setMicError(null);
    if (currentStageIndex < stages.length - 1) setCurrentStageIndex((prev) => prev + 1);
    else void handleCompleteExam();
  };

  const handlePlay = (text: string) => {
    setIsPlaying(true);
    setPlayedAudio((prev) => ({ ...prev, [stage.id]: true }));
    playNaturalSpeech(text, { rate: 0.95, onEnd: () => setIsPlaying(false) });
  };

  const handleRecord = () => {
    if (isRecording) return stopRecording();
    setMicError(null);
    recordStartRef.current = Date.now();
    setIsRecording(true);
    updateAnswer({ text: '' });
    const stageId = stage.id;
    speechRef.current = startSpeechToText({
      onTranscript: (t) => setAnswers((prev) => ({ ...prev, [stageId]: { ...prev[stageId], text: t } })),
      onError: (msg) => {
        setMicError(msg);
        stopRecording();
      }
    });
    if (!speechRef.current) {
      setIsRecording(false);
      setMicError('This browser cannot transcribe speech. Type what you said instead.');
    }
  };

  const scored = sectionResults.filter((r) => r.score !== null) as (SectionResult & { score: number })[];
  const hasUnmarked = sectionResults.some((r) => r.status === 'unmarked');
  const overall = scale === 'pte'
    ? pteCompositeScore(scored.map((r) => r.score))
    : ieltsCompositeBand(scored.map((r) => r.score)).toFixed(1);
  const errorItems = sectionResults.flatMap((r) => r.detectedErrors.map((code) => ({ code, section: r.sectionName })));

  const renderStageInput = () => {
    switch (stage.kind) {
      case 'speak':
        return (
          <>
            <div className="exam-passage exam-passage-lg">{stage.prompt}</div>
            <div className="mock-record-row">
              <button
                type="button"
                className={`exam-btn-primary ${isRecording ? 'exam-btn-done' : 'exam-btn-rec'}`}
                onClick={handleRecord}
                disabled={!isSpeechToTextSupported() && !isRecording}
              >
                {isRecording ? <Square size={13} fill="currentColor" /> : <Mic size={15} />}
                {isRecording ? 'Stop recording' : answer.text ? 'Record again' : 'Record'}
              </button>
              {isRecording && <span className="exam-live-tag">listening</span>}
            </div>
            {micError && (
              <div className="exam-inline-error" role="status">
                <AlertTriangle size={15} /> {micError}
              </div>
            )}
            <textarea
              rows={4}
              value={answer.text || ''}
              onChange={(e) => updateAnswer({ text: e.target.value })}
              readOnly={isRecording}
              placeholder="Your transcript appears here as you speak. You can also type it."
              className="exam-textarea"
            />
          </>
        );
      case 'write': {
        const words = countWords(answer.text || '');
        const ok = words >= stage.minWords && (!stage.maxWords || words <= stage.maxWords);
        return (
          <>
            {stage.passage && <div className="exam-passage">{stage.passage}</div>}
            <p className="exam-prompt">{stage.prompt}</p>
            <textarea
              rows={stage.minWords > 100 ? 12 : 4}
              value={answer.text || ''}
              onChange={(e) => updateAnswer({ text: e.target.value })}
              placeholder="Type your answer…"
              className="exam-textarea"
            />
            <span className={`exam-counter is-${words === 0 ? 'idle' : ok ? 'ok' : 'warn'}`}>
              Words: <strong>{words}</strong>
              <span className="exam-counter-target">
                / {stage.minWords}
                {stage.maxWords ? `–${stage.maxWords}` : '+'}
              </span>
            </span>
          </>
        );
      }
      case 'blanks':
        return (
          <div className="exam-passage exam-passage-lg mock-blanks">
            {stage.parts.map((part, i) => (
              <React.Fragment key={i}>
                {part}
                {stage.blanks[i] && (
                  <select
                    aria-label={`Gap ${i + 1}`}
                    className="exam-select mock-inline-select"
                    value={answer.fields?.[stage.blanks[i].id] || ''}
                    onChange={(e) => updateAnswer({ fields: { ...answer.fields, [stage.blanks[i].id]: e.target.value } })}
                  >
                    <option value="">—</option>
                    {stage.blanks[i].options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                )}
              </React.Fragment>
            ))}
          </div>
        );
      case 'dictation':
      case 'form': {
        const played = playedAudio[stage.id];
        return (
          <>
            <div className="exam-listen-box">
              <button type="button" className="exam-btn-secondary" onClick={() => handlePlay(stage.audio)} disabled={played}>
                <Volume2 size={15} /> {isPlaying ? 'Playing…' : played ? 'Played' : 'Play recording'}
              </button>
              <span className="exam-meta">You can play it once, as in the real test.</span>
            </div>
            {stage.kind === 'dictation' ? (
              <textarea
                rows={3}
                value={answer.text || ''}
                onChange={(e) => updateAnswer({ text: e.target.value })}
                placeholder="Type the sentence you heard…"
                className="exam-textarea"
              />
            ) : (
              <div className="mock-form-grid">
                {stage.fields.map((f) => (
                  <label key={f.id} className="mock-form-field">
                    <span>{f.label}</span>
                    <input
                      className="exam-input"
                      value={answer.fields?.[f.id] || ''}
                      onChange={(e) => updateAnswer({ fields: { ...answer.fields, [f.id]: e.target.value } })}
                    />
                  </label>
                ))}
              </div>
            )}
          </>
        );
      }
      case 'tfng':
        return (
          <>
            <div className="exam-passage">{stage.passage}</div>
            <div className="mock-tfng-list">
              {stage.statements.map((st, i) => (
                <div key={st.id} className="mock-tfng-row">
                  <span className="mock-tfng-text">
                    {i + 1}. {st.text}
                  </span>
                  <div className="exam-toggle-group mock-tfng-choices">
                    {(['TRUE', 'FALSE', 'NOT GIVEN'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`exam-toggle-btn ${answer.fields?.[st.id] === opt ? 'active' : ''}`}
                        onClick={() => updateAnswer({ fields: { ...answer.fields, [st.id]: opt } })}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        );
    }
  };

  return (
    <div className="exam-container">
      <div className="exam-header">
        <div>
          <div className="exam-badge-row">
            <span className="exam-pill exam-pill-green">Full Mock Exam</span>
            <span className="exam-pill exam-pill-estimate">LexiFlow estimate</span>
          </div>
          <h2 className="exam-title">{targetExam === 'pte_academic' ? 'PTE Academic' : 'IELTS Academic'} Full Simulation</h2>
          <p className="exam-desc">A short timed run through all four skills, marked by the same engines as the practice screens.</p>
        </div>

        {examState === 'idle' && (
          <div className="exam-toggle-group">
            <button
              type="button"
              onClick={() => setTargetExam('pte_academic')}
              className={`exam-toggle-btn ${targetExam === 'pte_academic' ? 'active' : ''}`}
            >
              PTE Academic
            </button>
            <button
              type="button"
              onClick={() => setTargetExam('ielts_academic')}
              className={`exam-toggle-btn ${targetExam === 'ielts_academic' ? 'active' : ''}`}
            >
              IELTS Academic
            </button>
          </div>
        )}
      </div>

      {examState === 'idle' && (
        <div className="mock-intro-grid">
          <div className="exam-card">
            <h3 className="exam-card-title">
              <ShieldCheck size={18} className="tone-green" /> Standard Exam Structure
            </h3>
            <ol className="mock-stage-list">
              {stages.map((s, idx) => (
                <li key={s.id}>
                  <span className="mock-stage-num">{idx + 1}</span>
                  <span className="mock-stage-icon">{s.icon}</span>
                  {s.name}
                </li>
              ))}
            </ol>
          </div>

          <div className="exam-card mock-rules">
            <div>
              <h3 className="exam-card-title">How it works</h3>
              <p className="exam-desc">
                Answer each section, then move on. Reading and listening are marked instantly; speaking and writing are marked by your
                AI provider. Every score is a <strong>LexiFlow estimate</strong>, and mistakes go straight to Mistake Memory.
              </p>
              <div className="mock-rule-chips">
                <span>
                  <Clock size={15} className="tone-green" /> 20 minutes
                </span>
                <span>
                  <Award size={15} className="tone-blue" /> 4 sections
                </span>
              </div>
            </div>
            <button type="button" onClick={handleStartExam} className="exam-btn-primary exam-btn-go">
              <Play size={15} fill="currentColor" />
              Begin Full Mock Exam
            </button>
          </div>
        </div>
      )}

      {examState === 'running' && (
        <>
          <div className="exam-card mock-runbar">
            <div className="mock-runbar-left">
              <span className="exam-pill exam-pill-blue">
                Stage {currentStageIndex + 1} of {stages.length}
              </span>
              <h3 className="exam-card-title">
                {stage.icon}
                {stage.name}
              </h3>
            </div>
            <div className="mock-runbar-right">
              <span className={`exam-timer ${timeLeft < 120 ? 'is-low' : ''}`}>
                <Clock size={14} /> {formatTimer(timeLeft)}
              </span>
              <button type="button" onClick={() => void handleCompleteExam()} className="exam-btn-ghost exam-btn-danger">
                End Test Early
              </button>
            </div>
          </div>
          <div className="mock-progress" aria-hidden="true">
            {stages.map((s, i) => (
              <span key={s.id} className={i < currentStageIndex ? 'done' : i === currentStageIndex ? 'current' : ''} />
            ))}
          </div>

          <div className="exam-card mock-stage">
            <p className="exam-hint">{stage.instructions}</p>
            {renderStageInput()}
            <div className="exam-action-row">
              <span />
              <button type="button" onClick={handleNextStage} className="exam-btn-primary">
                {currentStageIndex < stages.length - 1 ? 'Next Section →' : 'Submit & Finish Mock Exam'}
              </button>
            </div>
          </div>
        </>
      )}

      {examState === 'scoring' && (
        <div className="exam-card mock-scoring">
          <Loader2 size={22} className="spin" />
          <span>Marking your answers…</span>
        </div>
      )}

      {examState === 'completed' && (
        <>
          <div className="exam-score-panel">
            <div className="exam-score-hero">
              <div>
                <div className="exam-badge-row">
                  <span className="exam-pill exam-pill-green">Completed Simulation</span>
                  <span className="exam-pill exam-pill-estimate">LexiFlow estimate</span>
                </div>
                <h3 className="exam-title">{targetExam === 'pte_academic' ? 'PTE Academic' : 'IELTS Academic'} Scorecard</h3>
                <p className="exam-desc">
                  {hasUnmarked
                    ? 'Overall is based only on the sections that could be marked.'
                    : 'Performance across all four skills.'}
                </p>
              </div>
              <div className="mock-overall">
                <span className="exam-score-big">{scored.length ? overall : '—'}</span>
                <span className="exam-score-scale">{scale === 'pte' ? '/ 90 Overall' : '/ 9.0 Overall Band'}</span>
              </div>
            </div>

            <div className="mock-section-grid">
              {sectionResults.map((sec) => (
                <div key={sec.sectionName} className={`mock-section is-${sec.status}`}>
                  <span className="mock-section-name">{sec.sectionName}</span>
                  <div className="mock-section-score">
                    <strong>{sec.score === null ? '—' : scale === 'ielts' ? sec.score.toFixed(1) : sec.score}</strong>
                    <span>{scale === 'pte' ? '/ 90' : '/ 9.0'}</span>
                  </div>
                  {sec.detail && <span className="mock-section-detail">{sec.detail}</span>}
                </div>
              ))}
            </div>

            {hasUnmarked && onOpenSettings && (
              <div className="exam-inline-error">
                <AlertTriangle size={15} />
                Speaking and writing need an AI provider to be marked.
                <button type="button" className="exam-btn-ghost exam-btn-sm" onClick={onOpenSettings}>
                  Open AI settings
                </button>
              </div>
            )}
          </div>

          <div className="exam-card">
            <div className="mock-errors-head">
              <h4 className="exam-card-title">
                <BrainCircuit size={18} className="tone-purple" /> Detected Error Patterns Recorded in Mistake Memory
              </h4>
            </div>

            {errorItems.length === 0 ? (
              <p className="exam-desc">No error patterns found in this attempt.</p>
            ) : (
              <div className="mock-error-grid">
                {errorItems.map(({ code, section }) => (
                  <div key={`${section}_${code}`} className="mock-error-item">
                    <div>
                      <span className="mock-error-code">{code}</span>
                      <span className="mock-error-section">Section: {section}</span>
                    </div>
                    {onNavigateToMistake && (
                      <button type="button" onClick={() => onNavigateToMistake(code)} className="exam-drill-link">
                        Drill →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="exam-action-row">
              <span />
              <button type="button" onClick={handleStartExam} className="exam-btn-secondary">
                <RotateCcw size={14} />
                Retake Full Simulation
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
