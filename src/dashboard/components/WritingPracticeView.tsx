import React, { useState, useEffect, useRef } from 'react';
import { TargetExam, LearnerProfile } from '../../types';
import { Clock, AlertTriangle, Play, Pause, RotateCcw, Sparkles } from 'lucide-react';
import { evaluatePteEssay, evaluatePteSwt, PteWritingEvaluationResult } from '../../../exams/pte/writing/evaluator';
import { evaluateIeltsTask1, evaluateIeltsTask2, IeltsWritingEvaluationResult } from '../../../exams/ielts/writing/evaluator';
import { MistakeMemoryClient } from '../../services/mistake/client';
import { createExamAiCaller, isPlaceholderScore } from '../../services/ai/examCaller';
import type { CloudExamRequest } from '../../services/ai/cloudProvider';
import { ExamResultCard } from './ExamResultCard';

interface WritingPracticeViewProps {
  learnerProfile?: LearnerProfile | null;
  onNavigateToMistake?: (errorCode: string) => void;
  onOpenSettings?: () => void;
}

type PracticeTask =
  | 'pte_write_essay'
  | 'pte_summarize_written_text'
  | 'ielts_writing_task_1'
  | 'ielts_writing_task_2';

interface TaskConfig {
  id: PracticeTask;
  exam: TargetExam;
  name: string;
  badge: string;
  minWords: number;
  maxWords?: number;
  defaultTimeSeconds: number;
  prompt: string;
  passage?: string;
  instructions: string;
}

const DEFAULT_TASKS: Record<PracticeTask, TaskConfig> = {
  pte_write_essay: {
    id: 'pte_write_essay',
    exam: 'pte_academic',
    name: 'Write Essay',
    badge: 'PTE Academic · 20 Mins',
    minWords: 200,
    maxWords: 300,
    defaultTimeSeconds: 20 * 60,
    prompt:
      'Some people believe that universities should focus exclusively on preparing students for careers, while others think they should provide knowledge for its own sake. Discuss both views and give your own opinion.',
    instructions:
      'Write a 200–300 word essay in 20 minutes. Ensure you organize ideas logically and maintain academic vocabulary.'
  },
  pte_summarize_written_text: {
    id: 'pte_summarize_written_text',
    exam: 'pte_academic',
    name: 'Summarize Written Text',
    badge: 'PTE Academic · 10 Mins',
    minWords: 5,
    maxWords: 75,
    defaultTimeSeconds: 10 * 60,
    passage:
      'Renewable energy sources such as solar and wind power have seen exponential adoption over the past two decades. Driven by declining hardware costs and increasingly ambitious government carbon-reduction mandates, renewable infrastructure has begun displacing fossil fuels in several national power grids. However, grid integration challenges remain due to the intermittent nature of solar and wind generation, necessitating heavy investment in long-duration battery storage and modern transmission corridors.',
    prompt:
      'Read the passage and write a summary in ONE single sentence. Your summary must be between 5 and 75 words.',
    instructions:
      'Strict single sentence rule. Exactly one full stop (.) at the very end. 5–75 words.'
  },
  ielts_writing_task_1: {
    id: 'ielts_writing_task_1',
    exam: 'ielts_academic',
    name: 'Writing Task 1 (Report)',
    badge: 'IELTS Academic · 20 Mins',
    minWords: 150,
    defaultTimeSeconds: 20 * 60,
    prompt:
      'The chart below shows the percentage of households with internet access in five European countries between 2010 and 2024. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.',
    instructions:
      'Write at least 150 words. Include an introductory paraphrase, an overview of key trends, and detailed comparison paragraphs.'
  },
  ielts_writing_task_2: {
    id: 'ielts_writing_task_2',
    exam: 'ielts_academic',
    name: 'Writing Task 2 (Discursive Essay)',
    badge: 'IELTS Academic · 40 Mins',
    minWords: 250,
    defaultTimeSeconds: 40 * 60,
    prompt:
      'In many countries, an increasing number of young people are choosing to take a gap year before entering university. Do the advantages of this trend outweigh the disadvantages?',
    instructions:
      'Write at least 250 words. Present a clear position throughout, give reasons for your answer, and include relevant examples.'
  }
};

export const WritingPracticeView: React.FC<WritingPracticeViewProps> = ({
  learnerProfile,
  onNavigateToMistake,
  onOpenSettings
}) => {
  const activeExam: TargetExam = learnerProfile?.targetExam || 'pte_academic';

  // Default active task based on profile
  const [selectedTask, setSelectedTask] = useState<PracticeTask>(
    activeExam === 'ielts_academic' ? 'ielts_writing_task_2' : 'pte_write_essay'
  );

  const config = DEFAULT_TASKS[selectedTask];

  const [text, setText] = useState<string>(() => {
    try {
      return localStorage.getItem(`lexiflow_writing_draft_${selectedTask}`) || '';
    } catch {
      return '';
    }
  });

  const [timeLeft, setTimeLeft] = useState<number>(config.defaultTimeSeconds);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  const [isTimedMode, setIsTimedMode] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<
    PteWritingEvaluationResult | IeltsWritingEvaluationResult | null
  >(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Auto-switch task options if learner profile changes
  useEffect(() => {
    if (activeExam === 'ielts_academic' && !selectedTask.startsWith('ielts')) {
      setSelectedTask('ielts_writing_task_2');
    } else if (activeExam === 'pte_academic' && !selectedTask.startsWith('pte')) {
      setSelectedTask('pte_write_essay');
    }
  }, [activeExam]);

  // Load draft when task changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`lexiflow_writing_draft_${selectedTask}`);
      setText(saved || '');
    } catch {
      setText('');
    }
    setTimeLeft(config.defaultTimeSeconds);
    setIsTimerRunning(false);
    setEvaluation(null);
  }, [selectedTask]);

  // Autosave draft
  useEffect(() => {
    try {
      localStorage.setItem(`lexiflow_writing_draft_${selectedTask}`, text);
    } catch {}
  }, [text, selectedTask]);

  // Countdown timer
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeLeft]);

  // Real-time deterministic word count
  const wordCount = text.trim() ? text.trim().split(/\s+/).filter((t) => /[a-zA-Z0-9]/.test(t)).length : 0;

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (!isTimerRunning && isTimedMode && timeLeft === config.defaultTimeSeconds && e.target.value.length > 0) {
      setIsTimerRunning(true);
    }
  };

  const handleReset = () => {
    if (window.confirm('Clear your writing draft and reset the countdown timer?')) {
      setText('');
      setTimeLeft(config.defaultTimeSeconds);
      setIsTimerRunning(false);
      setEvaluation(null);
      localStorage.removeItem(`lexiflow_writing_draft_${selectedTask}`);
    }
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setEvaluation(null);
    setAiError(null);
    setIsTimerRunning(false);

    try {
      const taskId = selectedTask;
      const cloud: CloudExamRequest =
        selectedTask === 'pte_write_essay' ? { task: 'pte-essay', prompt: config.prompt, text, taskId }
        : selectedTask === 'pte_summarize_written_text' ? { task: 'pte-swt', passage: config.passage || '', text, taskId }
        : { task: 'ielts-task', taskNumber: selectedTask === 'ielts_writing_task_1' ? 1 : 2, prompt: config.prompt, text, taskId };
      const ai = createExamAiCaller(cloud);
      const options = { aiCaller: ai.call };
      let result: PteWritingEvaluationResult | IeltsWritingEvaluationResult;
      if (selectedTask === 'pte_write_essay') {
        result = await evaluatePteEssay(config.prompt, text, options);
      } else if (selectedTask === 'pte_summarize_written_text') {
        result = await evaluatePteSwt(config.passage || '', text, options);
      } else if (selectedTask === 'ielts_writing_task_1') {
        result = await evaluateIeltsTask1(config.prompt, text, options);
      } else {
        result = await evaluateIeltsTask2(config.prompt, text, options);
      }
      const placeholder = isPlaceholderScore(result.modelUsed);
      if (placeholder) {
        setAiError(ai.lastError() || 'The AI reply could not be read. Please try again.');
      } else if (ai.modelName()) {
        result = { ...result, modelUsed: ai.modelName()! };
      }
      setEvaluation(result);

      // Auto-record detected errors into Mistake Memory (placeholder marks have none worth keeping)
      if (!placeholder && result.errorCodes && result.errorCodes.length > 0) {
        for (const code of result.errorCodes) {
          try {
            MistakeMemoryClient.recordOccurrence(
              code,
              selectedTask,
              text.slice(0, 160),
              `Task: ${DEFAULT_TASKS[selectedTask].name}`
            );
          } catch {}
        }
      }
    } catch (err: any) {
      setAiError(err.message || 'Evaluation failed. Please check your answer and try again.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const availableTasks: PracticeTask[] =
    activeExam === 'ielts_academic'
      ? ['ielts_writing_task_1', 'ielts_writing_task_2']
      : ['pte_write_essay', 'pte_summarize_written_text'];

  const counterTone =
    wordCount === 0 ? 'idle' : wordCount < config.minWords || (config.maxWords && wordCount > config.maxWords) ? 'warn' : 'ok';

  return (
    <div className="exam-container">
      <div className="exam-header">
        <div>
          <div className="exam-badge-row">
            <span className="exam-pill exam-pill-blue">
              {activeExam === 'ielts_academic' ? 'IELTS Academic' : 'PTE Academic'}
            </span>
            <span data-testid="writing-estimate-label" className="exam-pill exam-pill-estimate">
              LexiFlow estimate
            </span>
          </div>
          <h2 className="exam-title">Writing Exam Engine</h2>
          <p className="exam-desc">Timed exam-style writing, marked against the official criteria.</p>
        </div>

        <div className="exam-toggle-group" role="tablist">
          {availableTasks.map((t) => (
            <button
              key={t}
              data-testid={`task-tab-${t}`}
              type="button"
              role="tab"
              aria-selected={selectedTask === t}
              onClick={() => setSelectedTask(t)}
              className={`exam-toggle-btn ${selectedTask === t ? 'active' : ''}`}
            >
              {DEFAULT_TASKS[t].name}
            </button>
          ))}
        </div>
      </div>

      <div className="exam-card">
        <div className="exam-card-topline">
          <span className="exam-eyebrow">{config.badge}</span>
          <span className="exam-meta">
            Target: {config.minWords}
            {config.maxWords ? `–${config.maxWords}` : '+'} words
          </span>
        </div>
        {config.passage && <div className="exam-passage">{config.passage}</div>}
        <p className="exam-prompt">{config.prompt}</p>
        <p className="exam-hint">{config.instructions}</p>
      </div>

      <div className="exam-editor">
        <div className="exam-editor-bar">
          <div className="exam-editor-group">
            <span className={`exam-timer ${timeLeft < 120 ? 'is-low' : ''}`}>
              <Clock size={15} />
              <span data-testid="countdown-timer">{formatTimer(timeLeft)}</span>
            </span>
            <button
              type="button"
              data-testid="btn-timer-toggle"
              onClick={() => setIsTimerRunning((r) => !r)}
              className="exam-btn-secondary exam-btn-sm"
            >
              {isTimerRunning ? <Pause size={13} /> : <Play size={13} />}
              <span>{isTimerRunning ? 'Pause' : 'Start Timer'}</span>
            </button>
            <button type="button" onClick={handleReset} className="exam-btn-ghost exam-btn-sm" title="Reset text and timer">
              <RotateCcw size={13} /> Reset
            </button>
          </div>

          <span className={`exam-counter is-${counterTone}`}>
            Words: <strong data-testid="live-word-count">{wordCount}</strong>
            <span className="exam-counter-target">
              / {config.minWords}
              {config.maxWords ? `–${config.maxWords}` : '+'}
            </span>
          </span>
        </div>

        <textarea
          data-testid="writing-textarea"
          value={text}
          onChange={handleTextChange}
          placeholder="Start typing your response. The timer starts with your first word."
          className="exam-textarea exam-editor-input"
          spellCheck={false}
        />
      </div>

      <div className="exam-action-row">
        <span className="exam-meta">Draft saved on this device</span>
        <button
          type="button"
          data-testid="btn-evaluate-writing"
          onClick={handleEvaluate}
          disabled={isEvaluating || wordCount === 0}
          className="exam-btn-primary"
        >
          <Sparkles size={16} />
          {isEvaluating ? 'Marking…' : 'Submit for marking'}
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
          onNavigateToMistake={onNavigateToMistake}
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  );
};
