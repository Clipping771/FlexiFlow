import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  ExternalLink,
  Eye,
  FileText,
  Gauge,
  Headphones,
  Languages,
  Lightbulb,
  Loader2,
  Mic,
  PenLine,
  Play,
  RefreshCw,
  Sparkles,
  Square,
  Target,
  TrendingUp,
  X
} from 'lucide-react';
import type { VocabularyItem } from '../../types';
import { useExamArticle, ExamArticleGate, PasteArticle } from './ExamArticle';
import { paragraphsWithOffsets } from '../../services/examContent/articleClean';
import { getExamItem, requestExamItem } from '../../services/examContent/generate';
import type { ExamItem } from '../../services/examContent/aiItems';
import type { SmartItem, SmartKind } from '../../services/smartPractice/items';
import {
  answerProblems,
  checkReading,
  checkVocab,
  countWords,
  Difficulty,
  learnerBrief,
  mistakesFromFeedback,
  loadProgress,
  nextDifficulty,
  PracticeSkill,
  recordAnswer,
  saveProgress,
  SKILL_LABELS,
  SmartProgress,
  Span,
  speechMetrics,
  SpeechMetrics,
  weakSkills
} from '../../services/smartPractice/logic';
import { MistakeMemoryClient } from '../../services/mistake/client';
import { recordActivity } from '../../services/learner/activity';
import { TaxonomyService } from '../../services/taxonomy/catalog';
import { isSpeechToTextSupported, startSpeechToText, SpeechToTextSession } from '../../services/audio/speechToText';
import { playListening, prepareListening, stopListening, VoiceKind } from '../../services/audio/listeningPlayer';

type Section = 'reading' | 'vocab' | 'listening' | 'writing' | 'speaking';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'reading', label: 'Reading', icon: <BookOpen size={15} /> },
  { id: 'vocab', label: 'Vocabulary', icon: <Languages size={15} /> },
  { id: 'listening', label: 'Listening', icon: <Headphones size={15} /> },
  { id: 'writing', label: 'Writing', icon: <PenLine size={15} /> },
  { id: 'speaking', label: 'Speaking', icon: <Mic size={15} /> }
];

const DIFFICULTY_LABEL: Record<Difficulty, string> = { gentle: 'Gentle', standard: 'Standard', stretch: 'Stretch' };

/** Answers to the auto-marked questions this round, keyed like "reading:2". */
type Answers = Record<string, { choice: string | number; correct: boolean }>;

/** Turns provider and server errors into plain advice. */
export function friendlyError(message: string): string {
  if (/unknown exam item kind/i.test(message)) {
    return 'Smart Practice is not on LexiFlow Cloud yet. To use it now, choose your own AI provider (Gemini, OpenAI, Claude or Ollama) in Settings.';
  }
  return message || 'Something went wrong. Please try again.';
}

function useSmartItem<K extends SmartKind>(kind: K, source: string | null, cacheKey: string, context: string) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = source ? `${kind}|${cacheKey}|${attempt}` : '';
  const [state, setState] = useState<{ key: string; data: ExamItem<K> | null; error: string | null }>({ key: '', data: null, error: null });

  useEffect(() => {
    if (!source) return;
    let live = true;
    getExamItem(kind, source, `${cacheKey}:${attempt}`, context)
      .then((data) => live && setState({ key: requestKey, data, error: null }))
      .catch((err: Error) => live && setState({ key: requestKey, data: null, error: friendlyError(err.message) }));
    return () => {
      live = false;
    };
  }, [requestKey]);

  const current = requestKey !== '' && state.key === requestKey;
  return {
    data: current ? (state.data as SmartItem<K> | null) : null,
    error: current ? state.error : null,
    loading: requestKey !== '' && !current,
    retry: () => setAttempt((a) => a + 1)
  };
}

export const SmartPracticeView: React.FC<{ vocabItems?: VocabularyItem[]; onOpenSettings?: () => void; initialSection?: Section }> = ({
  vocabItems = [],
  onOpenSettings,
  initialSection
}) => {
  const { article, loading: articleLoading, key, seed, newQuestions, applyPastedText } = useExamArticle();
  const [progress, setProgress] = useState<SmartProgress>(loadProgress);
  const [section, setSection] = useState<Section>(initialSection ?? 'reading');
  const [answers, setAnswers] = useState<Answers>({});
  const [highlight, setHighlight] = useState<Span | null>(null);
  const [roundClosed, setRoundClosed] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [deckIndex, setDeckIndex] = useState<Partial<Record<Section, number>>>({});

  // The brief is fixed for a round, so the cached questions match the difficulty they were written for
  const weakWords = useMemo(
    () => vocabItems.filter((i) => i.isMarkedDifficult || (i.fsrs?.lapses ?? 0) > 0).map((i) => i.word),
    [vocabItems]
  );
  const roundKey = `${key}:${seed}:${progress.difficulty}`;
  const brief = useMemo(() => learnerBrief(progress, weakWords), [roundKey]);
  const source = article?.text ?? null;

  const reading = useSmartItem('smart_reading', source, roundKey, brief);
  const vocab = useSmartItem('smart_vocab', source, roundKey, brief);
  const listening = useSmartItem('smart_listening', source, roundKey, brief);
  const tasks = useSmartItem('smart_tasks', source, roundKey, brief);

  const readingQs = useMemo(() => (article && reading.data ? checkReading(article.text, reading.data) : []), [reading.data, article]);
  const vocabWords = useMemo(() => (article && vocab.data ? checkVocab(article.text, vocab.data) : []), [vocab.data, article]);

  useEffect(() => {
    setAnswers({});
    setHighlight(null);
    setRoundClosed(false);
    setDeckIndex({});
  }, [roundKey]);

  const answer = (id: string, skill: PracticeSkill, choice: string | number, correct: boolean, counts = true) => {
    if (answers[id]) return;
    setAnswers((a) => ({ ...a, [id]: { choice, correct } }));
    recordActivity('practice');
    if (counts) {
      setProgress((p) => {
        const next = recordAnswer(p, skill, correct);
        saveProgress(next);
        return next;
      });
    }
  };

  // Round score: the auto-marked questions the article can back up
  const markable = [
    ...readingQs.map((q, i) => ({ id: `reading:${i}`, counts: !q.uncertain })),
    ...vocabWords.map((_, i) => ({ id: `vocab:${i}`, counts: true })),
    ...(listening.data?.questions ?? []).map((_, i) => ({ id: `listening:${i}`, counts: true }))
  ].filter((m) => m.counts);
  const answered = markable.filter((m) => answers[m.id]);
  const right = answered.filter((m) => answers[m.id].correct).length;
  const roundDone = markable.length > 0 && answered.length === markable.length;
  const upcoming = nextDifficulty(progress.difficulty, right, answered.length);

  const startNextRound = () => {
    const next: SmartProgress = { ...progress, difficulty: upcoming, sessions: progress.sessions + 1 };
    saveProgress(next);
    setRoundClosed(true);
    setProgress(next);
    setSection('reading');
    newQuestions();
  };

  const setProducedLevel = (level: string) =>
    setProgress((p) => {
      const next = { ...p, producedLevel: level };
      saveProgress(next);
      return next;
    });

  const sectionCount = (s: Section): string | null => {
    const ids = markable.filter((m) => m.id.startsWith(`${s}:`));
    if (s === 'writing' || s === 'speaking' || ids.length === 0) return null;
    return `${ids.filter((m) => answers[m.id]).length}/${ids.length}`;
  };

  const focus = weakSkills(progress);
  const host = article && /^https?:/.test(article.url) ? hostLabel(article.url) : null;

  const showEvidence = (span: Span) => {
    setHighlight(span);
    setReaderOpen(true);
  };
  const nextSection = (s: Section): Section | null => {
    const i = SECTIONS.findIndex((x) => x.id === s);
    return i >= 0 && i < SECTIONS.length - 1 ? SECTIONS[i + 1].id : null;
  };
  const deck = (s: Section, count: number) => ({
    index: Math.min(deckIndex[s] ?? 0, Math.max(count - 1, 0)),
    setIndex: (i: number) => setDeckIndex((d) => ({ ...d, [s]: i })),
    onFinish: () => {
      const n = nextSection(s);
      if (n) setSection(n);
    },
    finishLabel: (() => {
      const n = nextSection(s);
      return n ? `Next: ${SECTIONS.find((x) => x.id === n)!.label}` : 'Done';
    })()
  });

  return (
    <div className="view-container smart-practice" data-testid="smart-practice">
      <header className="smart-head">
        <div className="smart-head-text">
          <h2 className="view-title">Smart Practice</h2>
          {article ? (
            <div className="smart-source" data-testid="exam-article-bar">
              <FileText size={14} />
              <span className="smart-source-title" title={article.title}>
                {article.title}
              </span>
              {host && <span className="smart-source-host">{host}</span>}
            </div>
          ) : (
            <p className="view-desc">Practice written from the article you're reading. It adapts to you as you answer.</p>
          )}
        </div>
        {article && (
          <div className="smart-head-actions">
            <button type="button" className="btn-secondary" onClick={() => setReaderOpen(true)} data-testid="smart-open-article">
              <BookOpen size={14} /> Read article
            </button>
            <button type="button" className="btn-secondary" onClick={newQuestions} data-testid="btn-new-questions" title="Write a new set from this article">
              <RefreshCw size={14} /> New set
            </button>
            <button type="button" className="smart-icon-btn" onClick={() => setPasting((p) => !p)} title="Use a different article" aria-label="Change article">
              <ClipboardPaste size={15} />
            </button>
          </div>
        )}
      </header>

      {!article ? (
        <ExamArticleGate loading={articleLoading} onUsePastedText={applyPastedText} />
      ) : (
        <div className="smart-stage">
          {pasting && (
            <div className="smart-card smart-paste">
              <PasteArticle
                onUse={async (t, title) => {
                  await applyPastedText(t, title);
                  setPasting(false);
                }}
              />
            </div>
          )}

          <div className="smart-meta-row">
            <span className="smart-chip" title="Questions get harder when you do well and easier when you struggle">
              <Gauge size={13} /> Difficulty <strong data-testid="smart-difficulty">{DIFFICULTY_LABEL[progress.difficulty]}</strong>
            </span>
            {reading.data && <span className="smart-chip">Article level <strong>{reading.data.level}</strong></span>}
            {focus.length > 0 && (
              <span className="smart-chip tone-warn" title="Your weakest question types get extra practice">
                <Target size={13} /> Focus: {focus.map((f) => SKILL_LABELS[f]).join(', ')}
              </span>
            )}
          </div>

          <div className="smart-tabs" role="tablist">
            {SECTIONS.map((s) => {
              const count = sectionCount(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={section === s.id}
                  className={`smart-tab ${section === s.id ? 'active' : ''}`}
                  onClick={() => setSection(s.id)}
                  data-testid={`smart-tab-${s.id}`}
                >
                  {s.icon}
                  <span>{s.label}</span>
                  {count && <span className="smart-tab-count">{count}</span>}
                </button>
              );
            })}
          </div>

          {section === 'reading' && (
            <ItemState state={reading} onOpenSettings={onOpenSettings}>
              <div className="smart-stack">
                {(deckIndex.reading ?? 0) === 0 && <InShort data={reading.data} />}
                <QuestionDeck
                  {...deck('reading', readingQs.length)}
                  count={readingQs.length}
                  states={readingQs.map((_, i) => answers[`reading:${i}`])}
                  render={(i) => {
                    const q = readingQs[i];
                    const id = `reading:${i}`;
                    const given = answers[id];
                    const prompt = q.type === 'choice' ? q.question : `True, false, or not given: "${q.statement}"`;
                    const options = q.type === 'choice' ? q.options : ['True', 'False', 'Not given'];
                    const correctIndex = q.type === 'choice' ? q.answer : ['true', 'false', 'not_given'].indexOf(q.answer);
                    return (
                      <QuestionCard
                        key={id}
                        testId={`smart-q-${i}`}
                        tag={SKILL_LABELS[q.skill]}
                        prompt={prompt}
                        options={options}
                        correctIndex={correctIndex}
                        chosen={given ? Number(given.choice) : null}
                        onChoose={(c) => answer(id, q.skill, c, c === correctIndex, !q.uncertain)}
                        explanation={q.explanation}
                        uncertain={q.uncertain}
                        onShowEvidence={q.span ? () => showEvidence(q.span!) : undefined}
                      />
                    );
                  }}
                />
              </div>
            </ItemState>
          )}

          {section === 'vocab' && (
            <ItemState state={vocab} onOpenSettings={onOpenSettings}>
              <QuestionDeck
                {...deck('vocab', vocabWords.length)}
                count={vocabWords.length}
                states={vocabWords.map((_, i) => answers[`vocab:${i}`])}
                render={(i) => {
                  const w = vocabWords[i];
                  const id = `vocab:${i}`;
                  const given = answers[id];
                  return (
                    <QuestionCard
                      key={id}
                      testId={`smart-v-${i}`}
                      tag="Word in context"
                      prompt={
                        <>
                          What does <strong className="smart-word">{w.word}</strong> mean here?
                          <span className="smart-quote">“{markWord(w.sentence, w.word)}”</span>
                        </>
                      }
                      options={w.options}
                      correctIndex={w.answer}
                      chosen={given ? Number(given.choice) : null}
                      onChoose={(c) => answer(id, 'vocabulary', c, c === w.answer)}
                      explanation={w.explanation}
                      extra={
                        <p className="smart-example">
                          <Lightbulb size={13} /> {w.example}
                        </p>
                      }
                      onShowEvidence={w.span ? () => showEvidence(w.span!) : undefined}
                    />
                  );
                }}
              />
            </ItemState>
          )}

          {section === 'listening' && (
            <ItemState state={listening} onOpenSettings={onOpenSettings}>
              {listening.data && (
                <ListeningSection
                  data={listening.data}
                  answers={answers}
                  deck={deck('listening', listening.data.questions.length)}
                  onAnswer={(i, c, correct) => answer(`listening:${i}`, 'listening', c, correct)}
                />
              )}
            </ItemState>
          )}

          {section === 'writing' && (
            <ItemState state={tasks} onOpenSettings={onOpenSettings}>
              {tasks.data && (
                <WritingSection key={roundKey} task={tasks.data.writing} article={article.text} onLevel={setProducedLevel} />
              )}
            </ItemState>
          )}

          {section === 'speaking' && (
            <ItemState state={tasks} onOpenSettings={onOpenSettings}>
              {tasks.data && (
                <SpeakingSection key={roundKey} task={tasks.data.speaking} article={article.text} onLevel={setProducedLevel} />
              )}
            </ItemState>
          )}

          {roundDone && !roundClosed && (
            <div className="smart-card smart-round" data-testid="smart-round-summary">
              <div className="smart-round-score">
                <TrendingUp size={20} />
                <div>
                  <strong>
                    {right} of {answered.length} correct
                  </strong>
                  <span>
                    {upcoming !== progress.difficulty
                      ? upcoming === 'stretch' || (upcoming === 'standard' && progress.difficulty === 'gentle')
                        ? `Great work. The next set moves up to ${DIFFICULTY_LABEL[upcoming]}.`
                        : `The next set eases to ${DIFFICULTY_LABEL[upcoming]} so you can build up.`
                      : `The next set stays at ${DIFFICULTY_LABEL[upcoming]}.`}
                  </span>
                </div>
              </div>
              <button type="button" className="btn-primary" onClick={startNextRound} data-testid="smart-next-round">
                <Sparkles size={15} /> Next set
              </button>
            </div>
          )}

          <ArticleReader
            open={readerOpen}
            onClose={() => setReaderOpen(false)}
            title={article.title}
            url={host ? article.url : null}
            level={reading.data?.level}
            text={article.text}
            highlight={highlight}
            onClear={() => setHighlight(null)}
          />
        </div>
      )}
    </div>
  );
};

function hostLabel(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------

function markWord(sentence: string, word: string): React.ReactNode {
  const i = sentence.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return sentence;
  return (
    <>
      {sentence.slice(0, i)}
      <mark>{sentence.slice(i, i + word.length)}</mark>
      {sentence.slice(i + word.length)}
    </>
  );
}

const ItemState: React.FC<{
  state: { loading: boolean; error: string | null; retry: () => void };
  onOpenSettings?: () => void;
  children: React.ReactNode;
}> = ({ state, onOpenSettings, children }) => {
  if (state.loading) {
    return (
      <div className="smart-card smart-loading" data-testid="smart-loading">
        <Loader2 size={18} className="spin" />
        <div>
          <strong>Reading the article…</strong>
          <span>Writing questions that fit it and you.</span>
        </div>
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="smart-card smart-error" data-testid="smart-error">
        <p>
          <AlertTriangle size={15} /> {state.error}
        </p>
        <div className="smart-actions">
          <button type="button" className="btn-secondary" onClick={state.retry}>
            <RefreshCw size={14} /> Try again
          </button>
          {onOpenSettings && /provider|Settings/i.test(state.error) && (
            <button type="button" className="btn-secondary" onClick={onOpenSettings}>
              Open AI settings
            </button>
          )}
        </div>
      </div>
    );
  }
  return <>{children}</>;
};

/** A short summary of the article above the reading questions. */
const InShort: React.FC<{ data: SmartItem<'smart_reading'> | null }> = ({ data }) => {
  if (!data) return null;
  return (
    <section className="smart-card smart-inshort" data-testid="smart-insight">
      <div className="smart-inshort-head">
        <Sparkles size={15} className="smart-accent" />
        <span className="smart-inshort-label">In short</span>
        <span className="smart-inshort-topic">{data.topic}</span>
      </div>
      <p className="smart-gist">{data.gist}</p>
      <ul className="smart-ideas">
        {data.keyIdeas.map((idea, i) => (
          <li key={i}>{idea}</li>
        ))}
      </ul>
    </section>
  );
};

type DeckProps = {
  index: number;
  setIndex: (i: number) => void;
  onFinish: () => void;
  finishLabel: string;
};

/** One question at a time, with a progress bar and Previous / Next. */
const QuestionDeck: React.FC<
  DeckProps & {
    count: number;
    states: (Answers[string] | undefined)[];
    render: (i: number) => React.ReactNode;
  }
> = ({ index, setIndex, onFinish, finishLabel, count, states, render }) => {
  if (count === 0) return null;
  const answeredHere = Boolean(states[index]);
  const last = index === count - 1;
  return (
    <div className="smart-deck">
      <div className="smart-deck-head">
        <span className="smart-deck-count" data-testid="smart-deck-count">
          Question {index + 1} of {count}
        </span>
        <div className="smart-deck-bar" aria-hidden="true">
          {states.map((st, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              className={`smart-deck-seg ${i === index ? 'current' : ''} ${st ? (st.correct ? 'right' : 'wrong') : ''}`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>

      {render(index)}

      <div className="smart-deck-nav">
        <button type="button" className="btn-ghost" onClick={() => setIndex(index - 1)} disabled={index === 0}>
          <ChevronLeft size={16} /> Previous
        </button>
        {last ? (
          <button type="button" className={answeredHere ? 'btn-primary' : 'btn-ghost'} onClick={onFinish} data-testid="smart-deck-finish">
            {finishLabel} <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            className={answeredHere ? 'btn-primary' : 'btn-ghost'}
            onClick={() => setIndex(index + 1)}
            data-testid="smart-deck-next"
          >
            {answeredHere ? 'Next question' : 'Skip'} <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

const LETTERS = ['A', 'B', 'C', 'D'];

const QuestionCard: React.FC<{
  testId: string;
  tag: string;
  prompt: React.ReactNode;
  options: string[];
  correctIndex: number;
  chosen: number | null;
  onChoose: (i: number) => void;
  explanation: string;
  uncertain?: boolean;
  extra?: React.ReactNode;
  onShowEvidence?: () => void;
}> = ({ testId, tag, prompt, options, correctIndex, chosen, onChoose, explanation, uncertain, extra, onShowEvidence }) => {
  const done = chosen !== null;
  return (
    <div className={`smart-card smart-question ${done ? (chosen === correctIndex ? 'is-right' : 'is-wrong') : ''}`} data-testid={testId}>
      <div className="smart-q-head">
        <span className="smart-tag">{tag}</span>
      </div>
      <div className="smart-q-prompt">{prompt}</div>
      <div className="smart-options">
        {options.map((opt, i) => {
          const state = !done ? '' : i === correctIndex ? 'correct' : i === chosen ? 'wrong' : 'dim';
          return (
            <button
              key={i}
              type="button"
              className={`smart-option ${state}`}
              disabled={done}
              onClick={() => onChoose(i)}
              data-testid={`${testId}-opt-${i}`}
            >
              <span className="smart-option-letter">{LETTERS[i]}</span>
              <span className="smart-option-text">{opt}</span>
              {state === 'correct' && <Check size={16} />}
              {state === 'wrong' && <X size={16} />}
            </button>
          );
        })}
      </div>
      {done && (
        <div className="smart-explain" data-testid={`${testId}-explain`}>
          <p>
            <strong>{chosen === correctIndex ? 'Correct.' : 'Not quite.'}</strong> {explanation}
          </p>
          {extra}
          {uncertain && (
            <p className="smart-uncertain">
              <AlertTriangle size={13} /> LexiFlow could not find this answer in the article, so it does not count toward your
              score.
            </p>
          )}
          {onShowEvidence && (
            <button type="button" className="smart-link" onClick={onShowEvidence}>
              <Eye size={13} /> Show in article
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const ListeningSection: React.FC<{
  data: SmartItem<'smart_listening'>;
  answers: Answers;
  deck: DeckProps;
  onAnswer: (i: number, choice: number, correct: boolean) => void;
}> = ({ data, answers, deck, onAnswer }) => {
  const [playing, setPlaying] = useState(false);
  const [plays, setPlays] = useState(0);
  const [slow, setSlow] = useState(false);
  const [showScript, setShowScript] = useState(false);
  /** 'checking' while the AI voice is being made; then which voice will play */
  const [voice, setVoice] = useState<'checking' | VoiceKind>('checking');
  const allAnswered = data.questions.every((_, i) => answers[`listening:${i}`]);

  // Make the natural AI audio as soon as the card opens, so Play starts at once
  useEffect(() => {
    let alive = true;
    setVoice('checking');
    prepareListening(data.script).then((url) => {
      if (alive) setVoice(url ? 'ai' : 'browser');
    });
    return () => {
      alive = false;
    };
  }, [data.script]);

  useEffect(() => () => stopListening(), []);

  const play = () => {
    if (playing) {
      stopListening();
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setPlays((p) => p + 1);
    playListening(data.script, { slow }).then((used) => {
      setVoice(used);
      setPlaying(false);
    });
  };

  return (
    <div className="smart-stack">
      <div className="smart-card smart-player">
        <button type="button" className="smart-play" onClick={play} data-testid="smart-play" aria-label={playing ? 'Stop' : 'Play'}>
          {playing ? <Square size={18} /> : <Play size={20} />}
        </button>
        <div className="smart-player-text">
          <strong>Listen to a short brief</strong>
          <span>{plays === 0 ? 'Play it, then answer. You can replay it.' : `Played ${plays} time${plays > 1 ? 's' : ''}`}</span>
          <span className={`smart-voice ${voice}`} data-testid="smart-voice">
            {voice === 'checking'
              ? 'Preparing a natural voice…'
              : voice === 'ai'
                ? 'Natural AI voice'
                : 'Browser voice · add a Gemini or OpenAI key in Settings for a natural AI voice'}
          </span>
        </div>
        <label className="smart-toggle">
          <input type="checkbox" checked={slow} onChange={(e) => setSlow(e.target.checked)} /> Slower
        </label>
      </div>

      <QuestionDeck
        {...deck}
        count={data.questions.length}
        states={data.questions.map((_, i) => answers[`listening:${i}`])}
        render={(i) => {
          const q = data.questions[i];
          const given = answers[`listening:${i}`];
          return (
            <QuestionCard
              key={i}
              testId={`smart-l-${i}`}
              tag="Listening"
              prompt={q.question}
              options={q.options}
              correctIndex={q.answer}
              chosen={given ? Number(given.choice) : null}
              onChoose={(c) => onAnswer(i, c, c === q.answer)}
              explanation={q.explanation}
            />
          );
        }}
      />

      {allAnswered && (
        <div className="smart-card">
          <button type="button" className="smart-link" onClick={() => setShowScript((s) => !s)} data-testid="smart-show-script">
            <Eye size={13} /> {showScript ? 'Hide' : 'Show'} what was said
          </button>
          {showScript && <p className="smart-script">{data.script}</p>}
        </div>
      )}
    </div>
  );
};

/** Sends an answer for AI feedback. `task` describes what was asked; the article is context. */
function useFeedback(onLevel: (level: string) => void) {
  const [state, setState] = useState<{
    loading: boolean;
    data: SmartItem<'smart_feedback'> | null;
    error: string | null;
    saved: number;
  }>({ loading: false, data: null, error: null, saved: 0 });
  const run = (task: string, article: string, answerText: string, mode: 'writing' | 'speaking') => {
    setState({ loading: true, data: null, error: null, saved: 0 });
    const sent = answerText.slice(0, 1000);
    requestExamItem('smart_feedback', `${task}\n\nARTICLE (context):\n${article.slice(0, 5000)}`, sent)
      .then((data) => {
        // Verified mistakes go to the Mistakes page so they can be practised later
        let saved = 0;
        for (const m of mistakesFromFeedback(data.fixes, sent, (c) => TaxonomyService.isValidCode(c))) {
          try {
            MistakeMemoryClient.recordOccurrence(m.code, `smart_practice_${mode}`, m.evidence, m.better);
            saved++;
          } catch {
            /* an unknown code is skipped */
          }
        }
        setState({ loading: false, data, error: null, saved });
        onLevel(data.level);
      })
      .catch((err: Error) => setState({ loading: false, data: null, error: friendlyError(err.message), saved: 0 }));
  };
  return { ...state, run, reset: () => setState({ loading: false, data: null, error: null, saved: 0 }) };
}

const WritingSection: React.FC<{
  task: SmartItem<'smart_tasks'>['writing'];
  article: string;
  onLevel: (level: string) => void;
}> = ({ task, article, onLevel }) => {
  const [text, setText] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const feedback = useFeedback(onLevel);
  const words = countWords(text);
  const range = words < task.minWords ? 'under' : words > task.maxWords ? 'over' : 'ok';

  const submit = () => {
    const found = answerProblems(text, task.minWords);
    setProblems(found);
    if (found.length) return;
    const brief = [
      `TASK (written ${task.kind}): ${task.prompt}`,
      `CHECKLIST:\n${task.checklist.map((c) => `- ${c}`).join('\n')}`,
      `LENGTH: ${words} words (asked for ${task.minWords}-${task.maxWords}).`
    ].join('\n');
    feedback.run(brief, article, text, 'writing');
  };

  return (
    <div className="smart-stack">
      <div className="smart-card">
        <span className="smart-tag">Write · {task.kind}</span>
        <p className="smart-task-prompt">{task.prompt}</p>
        <ul className="smart-checklist">
          {task.checklist.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
        <textarea
          className="smart-textarea"
          rows={8}
          maxLength={1000}
          placeholder="Write your answer here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-testid="smart-writing-input"
        />
        <div className="smart-actions spread">
          <span className={`smart-count ${range}`} data-testid="smart-word-count">
            {words} words · aim for {task.minWords}–{task.maxWords}
          </span>
          <button type="button" className="btn-primary" onClick={submit} disabled={feedback.loading} data-testid="smart-writing-submit">
            {feedback.loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} Get feedback
          </button>
        </div>
        {problems.map((p) => (
          <p key={p} className="smart-inline-error">
            <AlertTriangle size={13} /> {p}
          </p>
        ))}
      </div>
      <FeedbackResult feedback={feedback} />
    </div>
  );
};

const SpeakingSection: React.FC<{
  task: SmartItem<'smart_tasks'>['speaking'];
  article: string;
  onLevel: (level: string) => void;
}> = ({ task, article, onLevel }) => {
  const [prompt, setPrompt] = useState(task.prompt);
  const [transcript, setTranscript] = useState('');
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [micStatus, setMicStatus] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<SpeechMetrics | null>(null);
  const session = useRef<SpeechToTextSession | null>(null);
  const started = useRef(0);
  const feedback = useFeedback(onLevel);
  const supported = isSpeechToTextSupported();

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => () => session.current?.stop(), []);

  const start = () => {
    setMicError(null);
    setMicStatus(null);
    setTranscript('');
    setMetrics(null);
    feedback.reset();
    started.current = Date.now();
    setElapsed(0);
    session.current = startSpeechToText({
      onTranscript: setTranscript,
      onStatus: setMicStatus,
      onError: (m) => {
        setMicError(m);
        setMicStatus(null);
        setRecording(false);
      }
    });
    if (session.current) setRecording(true);
  };

  const stop = () => {
    session.current?.stop();
    session.current = null;
    setRecording(false);
    setDurationMs(Date.now() - started.current);
  };

  const submit = () => {
    const found = answerProblems(transcript, 20);
    setProblems(found);
    if (found.length) return;
    const ms = durationMs || task.seconds * 1000;
    const m = speechMetrics(transcript, ms);
    setMetrics(m);
    const brief = [
      `TASK (spoken answer, this is a speech-to-text transcript): ${prompt}`,
      `HELPFUL IDEAS:\n${task.ideas.map((c) => `- ${c}`).join('\n')}`,
      `DELIVERY: ${m.seconds} seconds, ${m.wordsPerMinute} words per minute, ${m.fillers} filler words. Comment briefly on fluency.`
    ].join('\n');
    feedback.run(brief, article, transcript, 'speaking');
  };

  const over = elapsed >= task.seconds;

  return (
    <div className="smart-stack">
      <div className="smart-card">
        <span className="smart-tag">Speak · about {task.seconds} seconds</span>
        <p className="smart-task-prompt" data-testid="smart-speaking-prompt">
          {prompt}
        </p>
        <div className="smart-ideas-row">
          {task.ideas.map((idea, i) => (
            <span key={i} className="smart-idea">
              <Lightbulb size={12} /> {idea}
            </span>
          ))}
        </div>

        <div className="smart-recorder">
          {supported ? (
            <button
              type="button"
              className={`smart-mic ${recording ? 'live' : ''}`}
              onClick={recording ? stop : start}
              data-testid="smart-mic"
              aria-label={recording ? 'Stop recording' : 'Start recording'}
            >
              {recording ? <Square size={18} /> : <Mic size={20} />}
            </button>
          ) : null}
          <div className="smart-recorder-text">
            <strong>{recording ? 'Listening…' : supported ? 'Press the mic and start talking' : 'Type what you would say'}</strong>
            <span className={over && recording ? 'tone-warn' : ''}>
              {recording ? `${elapsed}s / ${task.seconds}s` : supported ? 'Your words appear below. You can fix any the mic misheard.' : 'Speech recognition is not available in this browser.'}
            </span>
          </div>
        </div>
        {micStatus && recording && <p className="smart-mic-status">{micStatus}</p>}
        {micError && (
          <p className="smart-inline-error">
            <AlertTriangle size={13} /> {micError}
          </p>
        )}
        <textarea
          className="smart-textarea"
          rows={5}
          maxLength={1000}
          placeholder="Your spoken answer appears here…"
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          readOnly={recording}
          data-testid="smart-speaking-input"
        />
        <div className="smart-actions spread">
          <span className="smart-count">{countWords(transcript)} words</span>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={recording || feedback.loading}
            data-testid="smart-speaking-submit"
          >
            {feedback.loading ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />} Get feedback
          </button>
        </div>
        {problems.map((p) => (
          <p key={p} className="smart-inline-error">
            <AlertTriangle size={13} /> {p}
          </p>
        ))}
      </div>

      {metrics && (
        <div className="smart-metrics" data-testid="smart-speech-metrics">
          <Metric label="Speaking time" value={`${metrics.seconds}s`} />
          <Metric label="Pace" value={`${metrics.wordsPerMinute} wpm`} note={metrics.pace === 'good' ? 'Natural' : metrics.pace === 'slow' ? 'A bit slow' : 'A bit fast'} />
          <Metric label="Filler words" value={String(metrics.fillers)} note={metrics.fillers <= 2 ? 'Smooth' : 'Try pausing instead'} />
        </div>
      )}

      <FeedbackResult feedback={feedback} />

      {feedback.data && (
        <div className="smart-card">
          <span className="smart-tag">Keep talking</span>
          <div className="smart-followups">
            {task.followUps.map((f, i) => (
              <button
                key={i}
                type="button"
                className="smart-followup"
                onClick={() => {
                  setPrompt(f);
                  setTranscript('');
                  setMetrics(null);
                  feedback.reset();
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Metric: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <div className="smart-metric">
    <span className="smart-metric-label">{label}</span>
    <strong>{value}</strong>
    {note && <span className="smart-metric-note">{note}</span>}
  </div>
);

const FeedbackResult: React.FC<{
  feedback: { loading: boolean; data: SmartItem<'smart_feedback'> | null; error: string | null; saved?: number };
}> = ({ feedback }) => {
  const [showImproved, setShowImproved] = useState(false);
  if (feedback.loading) {
    return (
      <div className="smart-card smart-loading">
        <Loader2 size={18} className="spin" />
        <div>
          <strong>Reading your answer…</strong>
          <span>Checking grammar, word choice and how well it answers the task.</span>
        </div>
      </div>
    );
  }
  if (feedback.error) {
    return (
      <div className="smart-card smart-error">
        <p>
          <AlertTriangle size={15} /> {feedback.error}
        </p>
      </div>
    );
  }
  const d = feedback.data;
  if (!d) return null;
  const tone = d.score >= 80 ? 'good' : d.score >= 60 ? 'ok' : 'low';
  return (
    <div className="smart-card smart-feedback" data-testid="smart-feedback">
      <div className="smart-fb-head">
        <div className={`smart-score ${tone}`} style={{ ['--pct' as string]: `${d.score}%` }}>
          <span>{d.score}</span>
        </div>
        <div className="smart-fb-summary">
          <span className="smart-estimate">LexiFlow estimate · level {d.level}</span>
          <p>{d.verdict}</p>
        </div>
      </div>

      <div className="smart-fb-grid">
        <div>
          <h4>What worked</h4>
          <ul className="smart-good">
            {d.strengths.map((s, i) => (
              <li key={i}>
                <Check size={14} /> {s}
              </li>
            ))}
          </ul>
        </div>
        {d.coverage.length > 0 && (
          <div>
            <h4>Task checklist</h4>
            <ul className="smart-coverage">
              {d.coverage.map((c, i) => (
                <li key={i} className={c.covered ? 'yes' : 'no'}>
                  {c.covered ? <Check size={14} /> : <X size={14} />} {c.point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {d.fixes.length > 0 && (
        <div>
          <h4>Fix these</h4>
          <ul className="smart-fixes">
            {d.fixes.map((f, i) => (
              <li key={i}>
                <div className="smart-fix-line">
                  <del>{f.original}</del>
                  <span className="smart-arrow">→</span>
                  <ins>{f.better}</ins>
                </div>
                <span className="smart-fix-why">{f.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(feedback.saved ?? 0) > 0 && (
        <p className="smart-saved" data-testid="smart-mistakes-saved">
          <Check size={13} /> {feedback.saved} mistake{feedback.saved === 1 ? '' : 's'} saved to Mistakes for practice.
        </p>
      )}

      <button type="button" className="smart-link" onClick={() => setShowImproved((s) => !s)} data-testid="smart-show-improved">
        <Sparkles size={13} /> {showImproved ? 'Hide' : 'Show'} a stronger version of your answer
      </button>
      {showImproved && <p className="smart-improved">{d.improved}</p>}
    </div>
  );
};

/** The article, in a reader that slides in from the right. "Show in article" opens it at the proof. */
const ArticleReader: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  url: string | null;
  level?: string;
  text: string;
  highlight: Span | null;
  onClear: () => void;
}> = ({ open, onClose, title, url, level, text, highlight, onClear }) => {
  const markRef = useRef<HTMLElement | null>(null);
  const paragraphs = useMemo(() => paragraphsWithOffsets(text), [text]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    if (highlight) requestAnimationFrame(() => markRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' }));
    return () => window.removeEventListener('keydown', onKey);
  }, [open, highlight]);

  const renderParagraph = (p: { text: string; start: number }) => {
    const end = p.start + p.text.length;
    if (!highlight || highlight.end <= p.start || highlight.start >= end) return p.text;
    const from = Math.max(highlight.start, p.start) - p.start;
    const to = Math.min(highlight.end, end) - p.start;
    return (
      <>
        {p.text.slice(0, from)}
        <mark ref={markRef} className="smart-evidence" data-testid="smart-evidence">
          {p.text.slice(from, to)}
        </mark>
        {p.text.slice(to)}
      </>
    );
  };

  return (
    <>
      <div className={`smart-scrim ${open ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`smart-reader ${open ? 'open' : ''}`} aria-label="Article" aria-hidden={!open} data-testid="smart-reader">
        <div className="smart-reader-head">
          <BookOpen size={15} />
          <span className="smart-reader-label">Article</span>
          {level && <span className="smart-level">Level {level}</span>}
          {url && (
            <a className="smart-icon-btn" href={url} target="_blank" rel="noreferrer" title="Open the original page" aria-label="Open the original page">
              <ExternalLink size={15} />
            </a>
          )}
          <button type="button" className="smart-icon-btn" onClick={onClose} aria-label="Close article">
            <X size={16} />
          </button>
        </div>
        <div className="smart-reader-body">
          <h3 className="smart-reader-title">{title}</h3>
          {highlight && (
            <button type="button" className="smart-link smart-clear" onClick={onClear}>
              <X size={12} /> Clear highlight
            </button>
          )}
          {paragraphs.map((p) => (
            <p key={p.start}>{renderParagraph(p)}</p>
          ))}
        </div>
      </aside>
    </>
  );
};
