import React, { useState } from 'react';
import { TargetExam, LearnerProfile } from '../../types';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Award,
  HelpCircle,
  Headphones
} from 'lucide-react';
import {
  evaluatePteWriteFromDictation,
  evaluatePteHighlightIncorrectWords,
  evaluatePteSummarizeSpokenText,
  PteListeningEvaluation
} from '../../../exams/pte/listening/scorer';
import {
  evaluateIeltsFormCompletion,
  IeltsListeningEvaluation
} from '../../../exams/ielts/listening/scorer';
import { MistakeMemoryClient } from '../../services/mistake/client';

interface ListeningPracticeViewProps {
  learnerProfile?: LearnerProfile | null;
  onNavigateToMistake?: (errorCode: string) => void;
}

type ListeningTask =
  | 'pte_wfd'
  | 'pte_sst'
  | 'pte_hiw'
  | 'ielts_form';

export const ListeningPracticeView: React.FC<ListeningPracticeViewProps> = ({
  learnerProfile,
  onNavigateToMistake
}) => {
  const [activeExam, setActiveExam] = useState<TargetExam>(
    learnerProfile?.targetExam || 'pte_academic'
  );
  const [selectedTask, setSelectedTask] = useState<ListeningTask>(
    learnerProfile?.targetExam === 'ielts_academic' ? 'ielts_form' : 'pte_wfd'
  );

  // Audio Playback simulation
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const [hasPlayedAudio, setHasPlayedAudio] = useState<boolean>(false);

  // User input states
  const [wfdText, setWfdText] = useState<string>('');
  const [sstText, setSstText] = useState<string>('');
  const [hiwClicked, setHiwClicked] = useState<string[]>([]);
  const [formAnswers, setFormAnswers] = useState<Record<string, string>>({});

  // Evaluation
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<PteListeningEvaluation | IeltsListeningEvaluation | null>(null);

  const tasks = {
    pte_wfd: {
      name: 'PTE Write from Dictation',
      exam: 'pte_academic' as const,
      badge: 'PTE Listening · Exact Words',
      spokenPrompt: 'The university library provides extensive digital archives for graduate researchers.',
      instruction: 'Listen to the recording once and type the sentence exactly as spoken. Punctuation does not impact points, but spelling counts.'
    },
    pte_sst: {
      name: 'PTE Summarize Spoken Text',
      exam: 'pte_academic' as const,
      badge: 'PTE Listening · 50–70 Words',
      spokenPrompt:
        'Biotechnology in agriculture has drastically altered modern harvest yields. Through genetically engineered drought-resistant seed varietals, subsistence farmers in sub-Saharan regions can maintain staple crop production during prolonged heatwaves. Critics, however, caution that proprietary corporate seed patents restrict localized agrarian autonomy.',
      instruction: 'Listen to the lecture and write a 50–70 word summary capturing the central themes.'
    },
    pte_hiw: {
      name: 'PTE Highlight Incorrect Words',
      exam: 'pte_academic' as const,
      badge: 'PTE Listening · Discrepancy Detection',
      spokenPrompt:
        'Marine biologists discovered that elevated oceanic acidity impedes calcification across vulnerable bivalve colonies.',
      displayedText:
        'Marine biologists discovered that decreased oceanic acidity impedes calcification across vulnerable bivalve species.',
      incorrectWords: ['decreased', 'species'],
      instruction: 'Click words in the displayed transcription that differ from what is spoken in the audio.'
    },
    ielts_form: {
      name: 'IELTS Form / Note Completion',
      exam: 'ielts_academic' as const,
      badge: 'IELTS Listening · Section 1 Form',
      spokenPrompt:
        'Good morning, thank you for calling Oakridge Community Sports Centre. My name is David. Could I take down your surname, please? Yes, it is Henderson, spelled H-E-N-D-E-R-S-O-N. And which club would you like to register for? The badminton league.',
      instruction: 'Complete the registration notes below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER.',
      fields: [
        { id: 'f1', label: 'Caller Surname', accepted: ['Henderson'], maxWords: 1 },
        { id: 'f2', label: 'Sporting Activity', accepted: ['badminton', 'badminton league'], maxWords: 2 }
      ]
    }
  };

  // Play audio prompt using browser speech synthesis
  const handlePlayAudio = () => {
    if (isPlayingAudio) return;
    setIsPlayingAudio(true);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(tasks[selectedTask].spokenPrompt);
      utterance.rate = 0.95;
      utterance.onend = () => {
        setIsPlayingAudio(false);
        setHasPlayedAudio(true);
      };
      utterance.onerror = () => {
        setIsPlayingAudio(false);
        setHasPlayedAudio(true);
      };
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => {
        setIsPlayingAudio(false);
        setHasPlayedAudio(true);
      }, 3000);
    }
  };

  const handleToggleHiwWord = (word: string) => {
    const clean = word.toLowerCase().replace(/[^\w]/g, '');
    setHiwClicked((prev) =>
      prev.includes(clean) ? prev.filter((w) => w !== clean) : [...prev, clean]
    );
  };

  const handleSubmit = async () => {
    setIsEvaluating(true);
    setEvaluation(null);

    try {
      let evalResult: PteListeningEvaluation | IeltsListeningEvaluation;

      if (selectedTask === 'pte_wfd') {
        evalResult = evaluatePteWriteFromDictation(selectedTask, wfdText, tasks.pte_wfd.spokenPrompt);
      } else if (selectedTask === 'pte_sst') {
        const traits = { content: 2, grammar: 2, vocabulary: 2, spelling: 2 };
        evalResult = evaluatePteSummarizeSpokenText(selectedTask, sstText, traits);
      } else if (selectedTask === 'pte_hiw') {
        evalResult = evaluatePteHighlightIncorrectWords(selectedTask, hiwClicked, tasks.pte_hiw.incorrectWords);
      } else {
        const key: Record<string, any> = {};
        tasks.ielts_form.fields.forEach((f) => {
          key[f.id] = {
            acceptedAnswers: f.accepted,
            maxWords: f.maxWords,
            explanation: `Correct answer: ${f.accepted[0]}`
          };
        });
        evalResult = evaluateIeltsFormCompletion(selectedTask, formAnswers, key);
      }

      setEvaluation(evalResult);

      // Auto-record errors into Mistake Memory
      if (evalResult.detectedErrors && evalResult.detectedErrors.length > 0) {
        for (const code of evalResult.detectedErrors) {
          try {
            MistakeMemoryClient.recordOccurrence(
              code,
              selectedTask,
              `Listening Task: ${tasks[selectedTask].name}`,
              `Detected in ${tasks[selectedTask].badge}`
            );
          } catch {}
        }
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="exam-container">
      {/* Top Header & Task Switcher */}
      <div className="exam-header">
        <div>
          <div className="exam-badge-row">
            <span className="exam-pill exam-pill-purple">
              Listening Engine
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
                setSelectedTask('pte_wfd');
              }}
              className={`exam-toggle-btn ${activeExam === 'pte_academic' ? 'active' : ''}`}
            >
              PTE Academic
            </button>
            <button
              onClick={() => {
                setActiveExam('ielts_academic');
                setSelectedTask('ielts_form');
              }}
              className={`exam-toggle-btn ${activeExam === 'ielts_academic' ? 'active' : ''}`}
            >
              IELTS Academic
            </button>
          </div>

          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value as ListeningTask)}
            className="exam-select"
            style={{ width: 'auto', minWidth: '180px' }}
          >
            {activeExam === 'pte_academic' ? (
              <>
                <option value="pte_wfd">Write from Dictation (WFD)</option>
                <option value="pte_sst">Summarize Spoken Text (SST)</option>
                <option value="pte_hiw">Highlight Incorrect Words (HIW)</option>
              </>
            ) : (
              <option value="ielts_form">Form / Note Completion</option>
            )}
          </select>
        </div>
      </div>

      {/* Audio Prompt Player */}
      <div className="exam-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '12px',
              borderRadius: '12px',
              background: isPlayingAudio ? 'var(--blue-grad)' : 'rgba(196, 167, 242, 0.15)',
              color: isPlayingAudio ? '#ffffff' : 'var(--purple)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Headphones size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Official Audio Prompt Stream
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                {isPlayingAudio ? 'Playing spoken prompt...' : hasPlayedAudio ? 'Prompt played (exam standard: 1 play)' : 'Click play to start audio stream'}
              </p>
            </div>
          </div>

          <button
            onClick={handlePlayAudio}
            disabled={isPlayingAudio}
            className="exam-btn-primary"
          >
            <Play size={15} fill="currentColor" />
            {isPlayingAudio ? 'Audio Playing...' : hasPlayedAudio ? 'Replay Audio Prompt' : 'Play Audio Prompt'}
          </button>
        </div>
      </div>

      {/* Main Task Response Form */}
      <div className="exam-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HelpCircle size={16} style={{ color: 'var(--purple)' }} />
            Candidate Response
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            {tasks[selectedTask].instruction}
          </span>
        </div>

        {/* PTE Write from Dictation */}
        {selectedTask === 'pte_wfd' && (
          <div>
            <textarea
              value={wfdText}
              onChange={(e) => setWfdText(e.target.value)}
              placeholder="Type the exact sentence you heard here..."
              rows={4}
              className="exam-textarea"
            />
          </div>
        )}

        {/* PTE Summarize Spoken Text */}
        {selectedTask === 'pte_sst' && (
          <div>
            <textarea
              value={sstText}
              onChange={(e) => setSstText(e.target.value)}
              placeholder="Write a 50–70 word summary of the lecture..."
              rows={6}
              className="exam-textarea"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>Word limit: 50–70 words</span>
              <span style={{
                fontFamily: 'monospace',
                fontWeight: 700,
                color: sstText.trim().split(/\s+/).filter(Boolean).length >= 50 &&
                  sstText.trim().split(/\s+/).filter(Boolean).length <= 70
                    ? 'var(--success)'
                    : 'var(--warning)'
              }}>
                Current: {sstText.trim() ? sstText.trim().split(/\s+/).filter(Boolean).length : 0} words
              </span>
            </div>
          </div>
        )}

        {/* PTE Highlight Incorrect Words */}
        {selectedTask === 'pte_hiw' && (
          <div style={{ padding: '16px', background: 'var(--fill)', borderRadius: '12px', border: '1px solid var(--line)' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              Click any word that differed from the spoken audio to highlight it:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', fontSize: '14.5px', lineHeight: 1.6 }}>
              {tasks.pte_hiw.displayedText.split(/\s+/).map((word, idx) => {
                const clean = word.toLowerCase().replace(/[^\w]/g, '');
                const isSelected = hiwClicked.includes(clean);
                return (
                  <span
                    key={idx}
                    onClick={() => handleToggleHiwWord(word)}
                    style={{
                      cursor: 'pointer',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      userSelect: 'none',
                      transition: 'all 0.15s ease',
                      background: isSelected ? 'rgba(242, 196, 107, 0.35)' : 'transparent',
                      color: isSelected ? 'var(--text-main)' : 'var(--text-main)',
                      fontWeight: isSelected ? 700 : 400,
                      border: isSelected ? '1px solid var(--warning)' : '1px solid transparent'
                    }}
                  >
                    {word}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* IELTS Form Completion */}
        {selectedTask === 'ielts_form' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {tasks.ielts_form.fields.map((field) => (
              <div key={field.id} style={{ padding: '12px', background: 'var(--fill)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  {field.label}
                </label>
                <input
                  type="text"
                  value={formAnswers[field.id] || ''}
                  onChange={(e) => setFormAnswers({ ...formAnswers, [field.id]: e.target.value })}
                  placeholder={`Write NO MORE THAN ${field.maxWords} word(s)...`}
                  className="exam-input"
                />
              </div>
            ))}
          </div>
        )}

        {/* Submit Action */}
        <div style={{ paddingTop: '8px' }}>
          <button
            onClick={handleSubmit}
            disabled={isEvaluating}
            className="exam-btn-primary"
            style={{ width: '100%' }}
          >
            {isEvaluating ? 'Evaluating Responses...' : 'Submit Answers & Calculate Score'}
          </button>
        </div>
      </div>

      {/* Results & Score Card Section */}
      {evaluation && (
        <div className="exam-score-panel">
          <div className="exam-score-hero">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(196, 167, 242, 0.15)', color: 'var(--purple)' }}>
                <Award size={28} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Listening Evaluation Result
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
              <span className="exam-score-big" style={{ color: 'var(--purple)' }}>
                {'scaledScore' in evaluation ? evaluation.scaledScore : evaluation.bandScore}
              </span>
              <span className="exam-score-scale">
                {'scaledScore' in evaluation ? '/ 90 PTE Scale' : '/ 9.0 IELTS Band'}
              </span>
            </div>
          </div>

          {/* Diagnostic Item Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                    Diagnostic Report
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
      )}
    </div>
  );
};
