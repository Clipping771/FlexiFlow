import React, { useState, useEffect, useRef } from 'react';
import { TargetExam, LearnerProfile } from '../../types';
import { Mic, Clock, RotateCcw, Sparkles, Volume2, AlertTriangle, Square } from 'lucide-react';
import {
  evaluateReadAloud,
  evaluateRepeatSentence,
  evaluateAnswerShortQuestion,
  PteSpeakingEvaluationResult
} from '../../../exams/pte/speaking/evaluator';
import {
  evaluateIeltsSpeakingPart2,
  evaluateIeltsSpeakingPart1,
  IeltsSpeakingEvaluationResult
} from '../../../exams/ielts/speaking/evaluator';
import { MistakeMemoryClient } from '../../services/mistake/client';
import { createExamAiCaller, isPlaceholderScore } from '../../services/ai/examCaller';
import type { CloudExamRequest } from '../../services/ai/cloudProvider';
import { isSpeechToTextSupported, startSpeechToText, SpeechToTextSession } from '../../services/audio/speechToText';
import { playNaturalSpeech, stopAllAudio } from '../../services/audio/voiceService';
import { ExamResultCard } from './ExamResultCard';

interface SpeakingPracticeViewProps {
  learnerProfile?: LearnerProfile | null;
  onNavigateToMistake?: (errorCode: string) => void;
  onOpenSettings?: () => void;
}

type SpeakingTask =
  | 'pte_read_aloud'
  | 'pte_repeat_sentence'
  | 'pte_describe_image'
  | 'pte_answer_short_question'
  | 'ielts_speaking_part_1'
  | 'ielts_speaking_part_2'
  | 'ielts_speaking_part_3';

interface SpeakingTaskConfig {
  id: SpeakingTask;
  exam: TargetExam;
  name: string;
  badge: string;
  prepSeconds: number;
  recordSeconds: number;
  prompt: string;
  subPrompt?: string;
  expectedAnswers?: string[];
  /** The prompt is heard, not read (Repeat Sentence, Answer Short Question). */
  listenOnly?: boolean;
  instructions: string;
}

const DEFAULT_SPEAKING_TASKS: Record<SpeakingTask, SpeakingTaskConfig> = {
  pte_read_aloud: {
    id: 'pte_read_aloud',
    exam: 'pte_academic',
    name: 'Read Aloud',
    badge: 'PTE Academic · 35s Prep · 40s Speak',
    prepSeconds: 35,
    recordSeconds: 40,
    prompt:
      'The rapid development of renewable energy technology has significantly reduced carbon emissions across developed economies. Government subsidies, alongside technological breakthroughs in battery storage, continue to accelerate global adoption of solar and wind power infrastructure.',
    instructions:
      'Look at the text below. In 35 seconds, you must read this text aloud as naturally and clearly as possible. You have 40 seconds to speak.'
  },
  pte_repeat_sentence: {
    id: 'pte_repeat_sentence',
    exam: 'pte_academic',
    name: 'Repeat Sentence',
    badge: 'PTE Academic · Audio Recall',
    prepSeconds: 3,
    recordSeconds: 15,
    prompt:
      'Students must submit their laboratory research proposals before the end of the semester.',
    listenOnly: true,
    instructions:
      'Listen to the sentence and repeat it exactly as you hear it. Speak immediately when the microphone opens.'
  },
  pte_describe_image: {
    id: 'pte_describe_image',
    exam: 'pte_academic',
    name: 'Describe Image',
    badge: 'PTE Academic · 25s Prep · 40s Speak',
    prepSeconds: 25,
    recordSeconds: 40,
    prompt:
      '[Bar Chart: Average Monthly Household Electricity Consumption in Megawatt-hours from January to December. Peak in July and August at 1.4 MWh; lowest in April at 0.7 MWh].',
    instructions:
      'Look at the chart description. In 25 seconds, please speak into the microphone and describe in detail what the chart shows. You have 40 seconds.'
  },
  pte_answer_short_question: {
    id: 'pte_answer_short_question',
    exam: 'pte_academic',
    name: 'Answer Short Question',
    badge: 'PTE Academic · Quick Vocab',
    prepSeconds: 3,
    recordSeconds: 10,
    prompt:
      'What instrument is used by scientists to magnify tiny organisms that are invisible to the naked human eye?',
    expectedAnswers: ['microscope', 'microscopes'],
    listenOnly: true,
    instructions:
      'Please give a simple and short answer. Often just one or a few words is enough.'
  },
  ielts_speaking_part_1: {
    id: 'ielts_speaking_part_1',
    exam: 'ielts_academic',
    name: 'Part 1 (Interview)',
    badge: 'IELTS Academic · Introduction & Interview',
    prepSeconds: 5,
    recordSeconds: 30,
    prompt:
      'Let’s talk about your hometown. What is the most interesting part of your hometown, and how has it changed over the last few years?',
    instructions:
      'Answer in 2–4 natural sentences. Aim for continuous flow with clear pronunciation.'
  },
  ielts_speaking_part_2: {
    id: 'ielts_speaking_part_2',
    exam: 'ielts_academic',
    name: 'Part 2 (Cue Card)',
    badge: 'IELTS Academic · 1 Min Prep · 2 Min Speak',
    prepSeconds: 60,
    recordSeconds: 120,
    prompt:
      'Describe a person who has had a strong positive influence on your life.\n\nYou should say:\n- Who this person is\n- How you met them\n- What special qualities they possess\n- And explain why they had such a profound influence on you.',
    instructions:
      'You have 1 minute to prepare your notes. Then speak for 1 to 2 minutes continuously.'
  },
  ielts_speaking_part_3: {
    id: 'ielts_speaking_part_3',
    exam: 'ielts_academic',
    name: 'Part 3 (Discussion)',
    badge: 'IELTS Academic · Two-Way Discussion',
    prepSeconds: 5,
    recordSeconds: 60,
    prompt:
      'Do you think modern social media makes it easier or harder for young people to find genuinely positive role models? Why?',
    instructions:
      'Provide an extended, analytical response with reasons and examples.'
  }
};

export const SpeakingPracticeView: React.FC<SpeakingPracticeViewProps> = ({
  learnerProfile,
  onNavigateToMistake,
  onOpenSettings
}) => {
  const activeExam: TargetExam = learnerProfile?.targetExam || 'pte_academic';

  const [selectedTask, setSelectedTask] = useState<SpeakingTask>(
    activeExam === 'ielts_academic' ? 'ielts_speaking_part_2' : 'pte_read_aloud'
  );

  const config = DEFAULT_SPEAKING_TASKS[selectedTask];

  const [status, setStatus] = useState<'idle' | 'preparing' | 'recording' | 'recorded' | 'evaluating'>('idle');
  const [prepSecondsLeft, setPrepSecondsLeft] = useState<number>(config.prepSeconds);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [spokenTranscript, setSpokenTranscript] = useState<string>('');
  const [micError, setMicError] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isPlayingPrompt, setIsPlayingPrompt] = useState<boolean>(false);
  const [showPromptText, setShowPromptText] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<
    PteSpeakingEvaluationResult | IeltsSpeakingEvaluationResult | null
  >(null);
  const speechRef = useRef<SpeechToTextSession | null>(null);
  const sttSupported = isSpeechToTextSupported();

  const stopListening = () => {
    speechRef.current?.stop();
    speechRef.current = null;
  };

  // Auto-switch tasks when profile exam changes
  useEffect(() => {
    if (activeExam === 'ielts_academic' && !selectedTask.startsWith('ielts')) {
      setSelectedTask('ielts_speaking_part_2');
    } else if (activeExam === 'pte_academic' && !selectedTask.startsWith('pte')) {
      setSelectedTask('pte_read_aloud');
    }
  }, [activeExam]);

  // Reset timers on task change
  useEffect(() => {
    stopListening();
    stopAllAudio();
    setStatus('idle');
    setPrepSecondsLeft(config.prepSeconds);
    setRecordingSeconds(0);
    setSpokenTranscript('');
    setMicError(null);
    setAiError(null);
    setIsPlayingPrompt(false);
    setShowPromptText(false);
    setEvaluation(null);
  }, [selectedTask]);

  // Release the microphone when leaving the tab
  useEffect(
    () => () => {
      stopListening();
      stopAllAudio();
    },
    []
  );

  // Live transcription runs exactly while recording
  useEffect(() => {
    if (status !== 'recording') {
      stopListening();
      return;
    }
    if (!sttSupported) return;
    setMicError(null);
    speechRef.current = startSpeechToText({
      onTranscript: setSpokenTranscript,
      onError: setMicError
    });
  }, [status]);

  // Preparation countdown timer
  useEffect(() => {
    let timer: any = null;
    if (status === 'preparing' && prepSecondsLeft > 0) {
      timer = setInterval(() => {
        setPrepSecondsLeft((prev) => {
          if (prev <= 1) {
            setStatus('recording');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, prepSecondsLeft]);

  // Recording timer
  useEffect(() => {
    let timer: any = null;
    if (status === 'recording') {
      timer = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= config.recordSeconds) {
            setStatus('recorded');
            return config.recordSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status, config.recordSeconds]);

  const handlePlayPrompt = () => {
    setIsPlayingPrompt(true);
    playNaturalSpeech(config.prompt, {
      rate: 0.95,
      onEnd: () => {
        setIsPlayingPrompt(false);
        // In the real test the microphone opens shortly after the audio ends
        setPrepSecondsLeft(config.prepSeconds);
        setStatus((s) => (s === 'idle' ? 'preparing' : s));
      }
    });
  };

  const handleStartPrep = () => {
    setSpokenTranscript('');
    setRecordingSeconds(0);
    setEvaluation(null);
    if (config.listenOnly) {
      handlePlayPrompt();
      return;
    }
    setStatus('preparing');
    setPrepSecondsLeft(config.prepSeconds);
  };

  const handleStartRecording = () => {
    setSpokenTranscript('');
    setStatus('recording');
    setRecordingSeconds(0);
  };

  const handleStopRecording = () => {
    setStatus('recorded');
  };

  const handleReset = () => {
    stopListening();
    stopAllAudio();
    setIsPlayingPrompt(false);
    setStatus('idle');
    setPrepSecondsLeft(config.prepSeconds);
    setRecordingSeconds(0);
    setSpokenTranscript('');
    setMicError(null);
    setAiError(null);
    setEvaluation(null);
  };

  const handleEvaluate = async () => {
    stopListening();
    setStatus('evaluating');
    setEvaluation(null);
    setAiError(null);

    // A typed answer has no recording, so it gets a nominal duration instead of a "too short" penalty
    const effectiveDurationMs =
      recordingSeconds > 0 ? recordingSeconds * 1000 : Math.max(5000, config.recordSeconds * 500);
    const transcript = spokenTranscript.trim();
    const speech = { prompt: config.prompt, transcript, durationMs: effectiveDurationMs, taskId: selectedTask };
    // Repeat Sentence and Answer Short Question are scored by rules alone, so they never reach the AI
    const cloud: CloudExamRequest =
      selectedTask === 'pte_read_aloud' ? { task: 'pte-read-aloud', ...speech }
      : { task: 'ielts-speaking', part: selectedTask === 'ielts_speaking_part_2' ? 2 : 1, ...speech };
    const ai = createExamAiCaller(cloud);
    const aiOptions = { aiCaller: ai.call };

    try {
      let result: PteSpeakingEvaluationResult | IeltsSpeakingEvaluationResult;
      if (selectedTask === 'pte_read_aloud') {
        result = await evaluateReadAloud(config.prompt, transcript, { durationMs: effectiveDurationMs }, aiOptions);
      } else if (selectedTask === 'pte_repeat_sentence') {
        result = await evaluateRepeatSentence(config.prompt, transcript, { durationMs: effectiveDurationMs });
      } else if (selectedTask === 'pte_answer_short_question') {
        result = evaluateAnswerShortQuestion(config.expectedAnswers || [], transcript, {
          durationMs: effectiveDurationMs
        });
      } else if (selectedTask === 'ielts_speaking_part_2') {
        result = await evaluateIeltsSpeakingPart2(config.prompt, transcript, { durationMs: effectiveDurationMs }, aiOptions);
      } else {
        result = await evaluateIeltsSpeakingPart1(config.prompt, transcript, { durationMs: effectiveDurationMs }, aiOptions);
      }
      const placeholder = isPlaceholderScore(result.modelUsed);
      if (placeholder) {
        setAiError(ai.lastError() || 'The AI reply could not be read. Please try again.');
      } else if (ai.modelName() && !result.modelUsed.startsWith('deterministic')) {
        result = { ...result, modelUsed: ai.modelName()! };
      }
      setEvaluation(result);

      // Auto-record errors into Mistake Memory (placeholder marks have none worth keeping)
      if (!placeholder && result.errorCodes && result.errorCodes.length > 0) {
        for (const code of result.errorCodes) {
          try {
            MistakeMemoryClient.recordOccurrence(
              code,
              selectedTask,
              transcript.slice(0, 160),
              `Task: ${DEFAULT_SPEAKING_TASKS[selectedTask].name}`
            );
          } catch {}
        }
      }
    } catch (err: any) {
      setAiError(err.message || 'Evaluation failed. Please try again.');
    } finally {
      setStatus('recorded');
    }
  };

  const availableTasks: SpeakingTask[] =
    activeExam === 'ielts_academic'
      ? ['ielts_speaking_part_1', 'ielts_speaking_part_2', 'ielts_speaking_part_3']
      : ['pte_read_aloud', 'pte_repeat_sentence', 'pte_answer_short_question'];

  const promptHidden = config.listenOnly && !showPromptText;
  const recordProgress = Math.min(100, (recordingSeconds / config.recordSeconds) * 100);

  return (
    <div className="exam-container">
      <div className="exam-header">
        <div>
          <div className="exam-badge-row">
            <span className="exam-pill exam-pill-blue">
              {activeExam === 'ielts_academic' ? 'IELTS Academic' : 'PTE Academic'}
            </span>
            <span data-testid="speaking-estimate-label" className="exam-pill exam-pill-estimate">
              LexiFlow estimate
            </span>
          </div>
          <h2 className="exam-title">Speaking Exam Engine</h2>
          <p className="exam-desc">Speak into your microphone. LexiFlow transcribes you live, then marks the transcript.</p>
        </div>

        <div className="exam-toggle-group" role="tablist">
          {availableTasks.map((t) => (
            <button
              key={t}
              data-testid={`speaking-tab-${t}`}
              type="button"
              role="tab"
              aria-selected={selectedTask === t}
              onClick={() => setSelectedTask(t)}
              className={`exam-toggle-btn ${selectedTask === t ? 'active' : ''}`}
            >
              {DEFAULT_SPEAKING_TASKS[t].name}
            </button>
          ))}
        </div>
      </div>

      <div className="exam-card">
        <div className="exam-card-topline">
          <span className="exam-eyebrow">{config.badge}</span>
          <span className="exam-meta">
            {config.listenOnly ? 'Listen' : `Prep ${config.prepSeconds}s`} · Speak {config.recordSeconds}s
          </span>
        </div>

        {promptHidden ? (
          <div className="exam-listen-box">
            <button
              type="button"
              data-testid="btn-play-prompt"
              className="exam-btn-secondary"
              onClick={handlePlayPrompt}
              disabled={isPlayingPrompt || status === 'recording'}
            >
              <Volume2 size={15} /> {isPlayingPrompt ? 'Playing…' : 'Play audio'}
            </button>
            <span className="exam-meta">The text stays hidden, as in the real test.</span>
            {(status === 'recorded' || evaluation) && (
              <button type="button" className="exam-btn-ghost exam-btn-sm" onClick={() => setShowPromptText(true)}>
                Show text
              </button>
            )}
          </div>
        ) : (
          <div className="exam-passage exam-passage-lg">{config.prompt}</div>
        )}
        <p className="exam-hint">{config.instructions}</p>
      </div>

      <div className={`exam-card exam-studio is-${status}`}>
        <div className="exam-studio-timers">
          <div className="exam-studio-timer">
            <span className="exam-studio-label">Preparation</span>
            <span className={`exam-studio-value ${status === 'preparing' ? 'is-prep' : ''}`}>
              <span data-testid="prep-timer-display">{prepSecondsLeft}s</span>
            </span>
          </div>
          <div className="exam-studio-divider" />
          <div className="exam-studio-timer">
            <span className="exam-studio-label">Recording</span>
            <span className={`exam-studio-value ${status === 'recording' ? 'is-rec' : ''}`}>
              <span data-testid="record-timer-display">{recordingSeconds}s</span>
              <small> / {config.recordSeconds}s</small>
            </span>
          </div>
        </div>

        <div className="exam-studio-progress" aria-hidden="true">
          <div style={{ width: `${recordProgress}%` }} />
        </div>

        <div className={`exam-status-pill is-${status}`}>
          <span className="exam-status-dot" />
          {status === 'idle' && (config.listenOnly ? 'Play the audio to begin' : 'Ready when you are')}
          {status === 'preparing' && 'Preparing (Reviewing prompt)...'}
          {status === 'recording' && 'Recording Audio (Speak naturally)...'}
          {status === 'recorded' && 'Recording Completed'}
          {status === 'evaluating' && 'Marking your answer…'}
        </div>

        <div className="exam-studio-actions">
          {status === 'idle' && (
            <button
              type="button"
              data-testid="btn-start-prep"
              onClick={handleStartPrep}
              className="exam-btn-primary"
              disabled={isPlayingPrompt}
            >
              {config.listenOnly ? <Volume2 size={16} /> : <Clock size={16} />}
              {config.listenOnly ? 'Play audio & start' : `Start Prep Timer (${config.prepSeconds}s)`}
            </button>
          )}

          {status === 'preparing' && (
            <button
              type="button"
              data-testid="btn-skip-prep-record"
              onClick={handleStartRecording}
              className="exam-btn-primary exam-btn-rec"
            >
              <Mic size={16} /> Speak Now (Skip Prep)
            </button>
          )}

          {status === 'recording' && (
            <button
              type="button"
              data-testid="btn-stop-recording"
              onClick={handleStopRecording}
              className="exam-btn-primary exam-btn-done"
            >
              <Square size={13} fill="currentColor" /> Finish Recording
            </button>
          )}

          {status === 'recorded' && (
            <button type="button" onClick={handleStartRecording} className="exam-btn-secondary">
              <Mic size={14} /> Record again
            </button>
          )}

          <button type="button" onClick={handleReset} className="exam-btn-ghost">
            <RotateCcw size={14} /> Reset
          </button>
        </div>

        {(micError || !sttSupported) && (
          <div className="exam-inline-error" role="status">
            <AlertTriangle size={15} />
            {micError || 'This browser cannot transcribe speech. Type what you said below instead.'}
          </div>
        )}

        <div className="exam-transcript">
          <label htmlFor="speaking-transcript">
            Transcript {status === 'recording' && sttSupported && !micError && <span className="exam-live-tag">live</span>}
          </label>
          <textarea
            id="speaking-transcript"
            data-testid="speaking-transcript-input"
            value={spokenTranscript}
            onChange={(e) => setSpokenTranscript(e.target.value)}
            placeholder={
              sttSupported
                ? 'Your words appear here as you speak. You can fix recognition slips before marking.'
                : 'Type what you said…'
            }
            className="exam-textarea"
            readOnly={status === 'recording' && sttSupported && !micError}
          />
        </div>

        <button
          type="button"
          data-testid="btn-evaluate-speaking"
          onClick={handleEvaluate}
          disabled={status === 'evaluating' || status === 'recording' || !spokenTranscript.trim()}
          className="exam-btn-primary exam-btn-wide"
        >
          <Sparkles size={16} />
          {status === 'evaluating' ? 'Marking…' : 'Mark my answer'}
        </button>
      </div>

      {aiError && !evaluation && (
        <div className="exam-inline-error" role="alert">
          <AlertTriangle size={15} /> {aiError}
        </div>
      )}

      {evaluation && (
        <ExamResultCard
          evaluation={evaluation}
          scale={activeExam === 'ielts_academic' ? 'ielts' : 'pte'}
          aiError={aiError}
          testIdPrefix="speaking-"
          note={
            evaluation.modelUsed.startsWith('deterministic')
              ? undefined
              : 'Pronunciation and fluency are judged from the transcript, not the audio itself, so treat them as rough.'
          }
          onNavigateToMistake={onNavigateToMistake}
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  );
};
