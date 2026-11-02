import React, { useState, useEffect } from 'react';
import { TargetExam, LearnerProfile } from '../../types';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  BookOpen,
  Award,
  HelpCircle
} from 'lucide-react';
import {
  evaluatePteFillInBlanks,
  evaluatePteReorderParagraphs,
  evaluatePteMultipleChoiceMultiple,
  PteReadingEvaluation
} from '../../../exams/pte/reading/scorer';
import {
  evaluateIeltsTrueFalseNotGiven,
  evaluateIeltsMatchingHeadings,
  IeltsReadingEvaluation
} from '../../../exams/ielts/reading/scorer';
import { MistakeMemoryClient } from '../../services/mistake/client';

interface ReadingPracticeViewProps {
  learnerProfile?: LearnerProfile | null;
  onNavigateToMistake?: (errorCode: string) => void;
}

type ReadingTask =
  | 'pte_fib_rw'
  | 'pte_reorder'
  | 'pte_mcm'
  | 'ielts_tf_ng'
  | 'ielts_headings';

export const ReadingPracticeView: React.FC<ReadingPracticeViewProps> = ({
  learnerProfile,
  onNavigateToMistake
}) => {
  const [activeExam, setActiveExam] = useState<TargetExam>(
    learnerProfile?.targetExam || 'pte_academic'
  );
  const [selectedTask, setSelectedTask] = useState<ReadingTask>(
    learnerProfile?.targetExam === 'ielts_academic' ? 'ielts_tf_ng' : 'pte_fib_rw'
  );

  // Timer
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 mins
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // User responses
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [mcmSelections, setMcmSelections] = useState<string[]>([]);
  const [reorderList, setReorderList] = useState<string[]>([]);

  // Evaluation
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<PteReadingEvaluation | IeltsReadingEvaluation | null>(null);

  // Task definitions
  const tasks = {
    pte_fib_rw: {
      name: 'PTE Fill in the Blanks (R&W)',
      exam: 'pte_academic' as const,
      badge: 'PTE Reading · 4 Blanks',
      passage:
        'Global climate patterns have undergone [Blank 1] shifts over the past century. Satellite telemetry reveals that marine heatwaves are becoming increasingly [Blank 2], causing severe degradation across tropical coral [Blank 3]. Marine biologists urge international policymakers to enact [Blank 4] conservation frameworks before thermal tipping points are irreversibly crossed.',
      blanks: [
        { id: 'b1', options: ['profound', 'marginal', 'shallow', 'accidental'], answer: 'profound' },
        { id: 'b2', options: ['frequent', 'sparse', 'absent', 'temporary'], answer: 'frequent' },
        { id: 'b3', options: ['reefs', 'mines', 'plains', 'glaciers'], answer: 'reefs' },
        { id: 'b4', options: ['binding', 'optional', 'casual', 'tentative'], answer: 'binding' }
      ]
    },
    pte_reorder: {
      name: 'PTE Re-order Paragraphs',
      exam: 'pte_academic' as const,
      badge: 'PTE Reading · Pair Adjacency',
      passage: 'Drag or click arrows to sequence the paragraphs into the correct logical narrative:',
      initialParagraphs: [
        { id: 'C', text: 'This reliance on finite fossil fuel reserves triggered systemic volatility across international commodity markets.' },
        { id: 'A', text: 'During the mid-twentieth century, industrialized economies expanded at unprecedented rates powered predominantly by coal and oil.' },
        { id: 'D', text: 'Consequently, sovereign governments initiated large-scale subsidies to accelerate the development of renewable energy infrastructure.' },
        { id: 'B', text: 'However, by the late 1970s, sudden geopolitical shocks disrupted oil extraction across major producing regions.' }
      ],
      correctOrder: ['A', 'B', 'C', 'D']
    },
    pte_mcm: {
      name: 'PTE Multiple Choice (Multiple)',
      exam: 'pte_academic' as const,
      badge: 'PTE Reading · Partial Negative Marking',
      passage:
        'Artificial Intelligence architectures utilizing transformer models have democratized multilingual neural machine translation. Unlike legacy statistical models that mapped phrase tables probabilistically, neural transformers process sentence-wide semantic dependencies concurrently. However, high-throughput model inference demands enormous graphics compute clusters, leading to substantial energy footprints.',
      question: 'Which TWO characteristics of transformer translation models are explicitly cited?',
      options: [
        'Concurrent sentence-wide semantic dependency processing',
        'Substantial compute energy demands during model inference',
        'Reliance on static probabilistic phrase tables',
        'Zero requirement for specialized hardware acceleration'
      ],
      correctOptions: [
        'Concurrent sentence-wide semantic dependency processing',
        'Substantial compute energy demands during model inference'
      ]
    },
    ielts_tf_ng: {
      name: 'IELTS True / False / Not Given',
      exam: 'ielts_academic' as const,
      badge: 'IELTS Academic Reading · 3 Items',
      passage:
        'Urban green roofs—rooftops partially or completely covered with vegetation—provide measurable thermodynamic benefits. Empirical data recorded in Melbourne demonstrated that green roofs reduced roof surface temperatures by up to 28°C compared to conventional bitumen surfaces. While installation costs are approximately 30% higher than traditional roofing systems, municipal tax abatements have incentivized commercial adoption. No comprehensive longitudinal studies have yet examined their long-term waterproofing integrity beyond 25 years.',
      questions: [
        {
          id: 'q1',
          statement: 'Green roofs achieved a surface temperature decrease in empirical trials.',
          answer: 'TRUE' as const,
          explanation: 'Passage directly confirms reduction up to 28°C.'
        },
        {
          id: 'q2',
          statement: 'Installing green roofs is less expensive than traditional roofing.',
          answer: 'FALSE' as const,
          explanation: 'Passage states installation costs are approximately 30% higher.'
        },
        {
          id: 'q3',
          statement: 'Green roofs have been proven to cause water leakage after 20 years.',
          answer: 'NOT GIVEN' as const,
          explanation: 'Passage states no studies have yet examined waterproofing beyond 25 years; it does not claim leakage occurs at 20 years.'
        }
      ]
    },
    ielts_headings: {
      name: 'IELTS Matching Headings',
      exam: 'ielts_academic' as const,
      badge: 'IELTS Academic Reading · Paragraph Matching',
      passage:
        'Paragraph A: Ancient Mesopotamian farmers pioneered sophisticated irrigation canals diverged from the Tigris and Euphrates rivers, allowing continuous barley yields.\n\nParagraph B: Nevertheless, perpetual flood irrigation without sufficient drainage gradually accumulated toxic mineral salts in the upper soil layers, ultimately collapsing crop fertility.',
      paragraphs: [
        { id: 'pA', label: 'Paragraph A', correctHeading: 'iii' },
        { id: 'pB', label: 'Paragraph B', correctHeading: 'i' }
      ],
      headingOptions: [
        { id: 'i', title: 'i. The unintended environmental collapse of farmland fertility' },
        { id: 'ii', title: 'ii. Trade expeditions for exotic timber and minerals' },
        { id: 'iii', title: 'iii. Early hydraulic engineering breakthroughs for agriculture' }
      ]
    }
  };

  // Switch task defaults
  useEffect(() => {
    setAnswers({});
    setEvaluation(null);
    setIsTimerRunning(false);
    setTimeLeft(300);

    if (selectedTask === 'pte_reorder') {
      setReorderList(tasks.pte_reorder.initialParagraphs.map((p) => p.id));
    } else {
      setReorderList([]);
    }
    setMcmSelections([]);
  }, [selectedTask]);

  // Countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      handleSubmit();
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timeLeft]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleMoveParagraph = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= reorderList.length) return;
    const copy = [...reorderList];
    const temp = copy[index];
    copy[index] = copy[target];
    copy[target] = temp;
    setReorderList(copy);
  };

  const toggleMcmSelection = (opt: string) => {
    setMcmSelections((prev) =>
      prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
    );
  };

  const handleSubmit = async () => {
    setIsEvaluating(true);
    setEvaluation(null);

    try {
      let evalResult: PteReadingEvaluation | IeltsReadingEvaluation;

      if (selectedTask === 'pte_fib_rw') {
        const answerKey: Record<string, string> = {};
        tasks.pte_fib_rw.blanks.forEach((b) => (answerKey[b.id] = b.answer));
        evalResult = evaluatePteFillInBlanks(selectedTask, 'pte_fill_in_blanks_rw', answers, answerKey);
      } else if (selectedTask === 'pte_reorder') {
        evalResult = evaluatePteReorderParagraphs(selectedTask, reorderList, tasks.pte_reorder.correctOrder);
      } else if (selectedTask === 'pte_mcm') {
        evalResult = evaluatePteMultipleChoiceMultiple(selectedTask, mcmSelections, tasks.pte_mcm.correctOptions);
      } else if (selectedTask === 'ielts_tf_ng') {
        const key: Record<string, any> = {};
        tasks.ielts_tf_ng.questions.forEach((q) => (key[q.id] = { answer: q.answer, explanation: q.explanation }));
        evalResult = evaluateIeltsTrueFalseNotGiven(selectedTask, answers, key);
      } else {
        const key: Record<string, any> = {};
        tasks.ielts_headings.paragraphs.forEach((p) => (key[p.id] = { heading: p.correctHeading, paragraph: p.label }));
        evalResult = evaluateIeltsMatchingHeadings(selectedTask, answers, key);
      }

      setEvaluation(evalResult);

      // Auto-record detected errors into Mistake Memory
      if (evalResult.detectedErrors && evalResult.detectedErrors.length > 0) {
        for (const code of evalResult.detectedErrors) {
          try {
            MistakeMemoryClient.recordOccurrence(
              code,
              selectedTask,
              `Reading Task: ${tasks[selectedTask].name}`,
              `Detected in ${tasks[selectedTask].badge}`
            );
          } catch {}
        }
      }
    } finally {
      setIsEvaluating(false);
      setIsTimerRunning(false);
    }
  };

  return (
    <div className="exam-container">
      {/* Top Header & Task Switcher */}
      <div className="exam-header">
        <div>
          <div className="exam-badge-row">
            <span className="exam-pill exam-pill-blue">
              Reading Engine
            </span>
            <span className="exam-pill exam-pill-subtle">
              {tasks[selectedTask].badge}
            </span>
            <span className="exam-pill exam-pill-estimate">
              LexiFlow estimate
            </span>
          </div>
          <h2 className="exam-title">
            {tasks[selectedTask].name}
          </h2>
        </div>

        {/* Exam & Task Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="exam-toggle-group">
            <button
              onClick={() => {
                setActiveExam('pte_academic');
                setSelectedTask('pte_fib_rw');
              }}
              className={`exam-toggle-btn ${activeExam === 'pte_academic' ? 'active' : ''}`}
            >
              PTE Academic
            </button>
            <button
              onClick={() => {
                setActiveExam('ielts_academic');
                setSelectedTask('ielts_tf_ng');
              }}
              className={`exam-toggle-btn ${activeExam === 'ielts_academic' ? 'active' : ''}`}
            >
              IELTS Academic
            </button>
          </div>

          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value as ReadingTask)}
            className="exam-select"
            style={{ width: 'auto', minWidth: '180px' }}
          >
            {activeExam === 'pte_academic' ? (
              <>
                <option value="pte_fib_rw">Fill in the Blanks (R&W)</option>
                <option value="pte_reorder">Re-order Paragraphs</option>
                <option value="pte_mcm">Multiple Choice (Multiple)</option>
              </>
            ) : (
              <>
                <option value="ielts_tf_ng">True / False / Not Given</option>
                <option value="ielts_headings">Matching Headings</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* Main Workspace (Split View) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Left Column: Passage Text */}
        <div className="exam-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', marginBottom: '16px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={16} style={{ color: 'var(--blue)' }} />
                Reading Passage
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  fontSize: '12px',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: timeLeft < 60 ? 'rgba(242, 139, 130, 0.15)' : 'var(--fill)',
                  color: timeLeft < 60 ? 'var(--danger)' : 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px'
                }}>
                  <Clock size={13} />
                  {formatTime(timeLeft)}
                </span>
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                  title={isTimerRunning ? 'Pause timer' : 'Start timer'}
                >
                  {isTimerRunning ? <Pause size={15} /> : <Play size={15} />}
                </button>
              </div>
            </div>

            <div style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-main)', whiteSpace: 'pre-line', fontFamily: 'serif' }}>
              {tasks[selectedTask].passage}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Questions & Inputs */}
        <div className="exam-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', marginBottom: '16px', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <HelpCircle size={16} style={{ color: 'var(--blue)' }} />
                Question Items
              </span>
            </div>

            {/* PTE Fill in Blanks */}
            {selectedTask === 'pte_fib_rw' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {tasks.pte_fib_rw.blanks.map((b, i) => (
                  <div key={b.id} style={{ padding: '12px', borderRadius: '10px', background: 'var(--fill)', border: '1px solid var(--line)' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                      Blank {i + 1}
                    </label>
                    <select
                      value={answers[b.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [b.id]: e.target.value })}
                      className="exam-select"
                    >
                      <option value="">-- Choose word --</option>
                      {b.options.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            {/* PTE Re-order Paragraphs */}
            {selectedTask === 'pte_reorder' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {reorderList.map((id, index) => {
                  const para = tasks.pte_reorder.initialParagraphs.find((p) => p.id === id);
                  return (
                    <div
                      key={id}
                      style={{ padding: '12px', background: 'var(--fill)', borderRadius: '10px', border: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}
                    >
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--blue)', background: 'rgba(138, 180, 248, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
                        #{index + 1}
                      </span>
                      <p style={{ fontSize: '12.5px', lineHeight: 1.5, color: 'var(--text-main)', flex: 1, margin: 0 }}>
                        {para?.text}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        <button
                          disabled={index === 0}
                          onClick={() => handleMoveParagraph(index, 'up')}
                          className="exam-btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '11px', opacity: index === 0 ? 0.3 : 1 }}
                        >
                          ▲
                        </button>
                        <button
                          disabled={index === reorderList.length - 1}
                          onClick={() => handleMoveParagraph(index, 'down')}
                          className="exam-btn-secondary"
                          style={{ padding: '2px 6px', fontSize: '11px', opacity: index === reorderList.length - 1 ? 0.3 : 1 }}
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* PTE Multiple Choice Multiple */}
            {selectedTask === 'pte_mcm' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  {tasks.pte_mcm.question}
                </p>
                {tasks.pte_mcm.options.map((opt) => {
                  const checked = mcmSelections.includes(opt);
                  return (
                    <div
                      key={opt}
                      onClick={() => toggleMcmSelection(opt)}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: checked ? '1px solid var(--blue)' : '1px solid var(--line)',
                        background: checked ? 'rgba(138, 180, 248, 0.1)' : 'var(--fill)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        color: 'var(--text-main)'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {}}
                        style={{ marginTop: '3px', accentColor: 'var(--blue)' }}
                      />
                      <span>{opt}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* IELTS True/False/Not Given */}
            {selectedTask === 'ielts_tf_ng' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {tasks.ielts_tf_ng.questions.map((q, index) => (
                  <div key={q.id} style={{ padding: '12px', borderRadius: '10px', background: 'var(--fill)', border: '1px solid var(--line)' }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-main)', marginBottom: '10px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--blue)', marginRight: '6px' }}>
                        Q{index + 1}.
                      </span>
                      {q.statement}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {(['TRUE', 'FALSE', 'NOT GIVEN'] as const).map((choice) => (
                        <button
                          key={choice}
                          onClick={() => setAnswers({ ...answers, [q.id]: choice })}
                          style={{
                            flex: 1,
                            padding: '8px 4px',
                            fontSize: '11px',
                            fontWeight: 700,
                            borderRadius: '8px',
                            border: answers[q.id] === choice ? '1px solid var(--blue)' : '1px solid var(--line)',
                            background: answers[q.id] === choice ? 'var(--blue-grad)' : 'var(--card)',
                            color: answers[q.id] === choice ? '#ffffff' : 'var(--text-muted)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* IELTS Matching Headings */}
            {selectedTask === 'ielts_headings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {tasks.ielts_headings.paragraphs.map((p) => (
                  <div key={p.id} style={{ padding: '12px', borderRadius: '10px', background: 'var(--fill)', border: '1px solid var(--line)' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                      {p.label}
                    </label>
                    <select
                      value={answers[p.id] || ''}
                      onChange={(e) => setAnswers({ ...answers, [p.id]: e.target.value })}
                      className="exam-select"
                    >
                      <option value="">-- Choose correct heading --</option>
                      {tasks.ielts_headings.headingOptions.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit Action */}
          <div style={{ paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
            <button
              onClick={handleSubmit}
              disabled={isEvaluating}
              className="exam-btn-primary"
              style={{ width: '100%' }}
            >
              {isEvaluating ? 'Evaluating Responses...' : 'Submit Answers & Check Score'}
            </button>
          </div>
        </div>
      </div>

      {/* Results & Score Card Section */}
      {evaluation && (
        <div className="exam-score-panel">
          <div className="exam-score-hero">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(138, 180, 248, 0.15)', color: 'var(--blue)' }}>
                <Award size={28} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Reading Evaluation Result
                  </h3>
                  <span className="exam-pill exam-pill-estimate">
                    LexiFlow estimate
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                  Raw Score: {evaluation.rawScore} / {evaluation.maxScore}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span className="exam-score-big">
                {'scaledScore' in evaluation ? evaluation.scaledScore : evaluation.bandScore}
              </span>
              <span className="exam-score-scale">
                {'scaledScore' in evaluation ? '/ 90 PTE Scale' : '/ 9.0 IELTS Band'}
              </span>
            </div>
          </div>

          {/* Question Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', margin: 0 }}>
              Item-by-Item Diagnostics
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
              {evaluation.itemResults.map((item, idx) => (
                <div
                  key={idx}
                  className={`exam-diagnostic-card ${item.isCorrect ? 'correct' : 'incorrect'}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {item.isCorrect ? (
                        <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                      ) : (
                        <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
                      )}
                      Item {item.questionNumber}
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                      {item.earnedPoints} / {item.maxPoints} pts
                    </span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '12.5px' }}>
                    {item.explanation}
                  </p>
                  {item.matchedTaxonomyCode && (
                    <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: 'var(--danger)' }}>
                        {item.matchedTaxonomyCode}
                      </span>
                      {onNavigateToMistake && (
                        <button
                          onClick={() => onNavigateToMistake(item.matchedTaxonomyCode!)}
                          className="exam-drill-link"
                        >
                          → Drill in Lab
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
