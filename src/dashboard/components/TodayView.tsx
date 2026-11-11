import React, { useEffect, useState } from 'react';
import { Flame, RotateCw, BrainCircuit, Sparkles, Check, Pencil, Bell, ArrowRight } from 'lucide-react';
import {
  loadGoals,
  saveGoals,
  LearnerGoals,
  FocusSkill,
  FOCUS_SKILLS,
  FOCUS_LABELS,
  LEVELS,
  LEVEL_LABELS,
  DAILY_MINUTES
} from '../../services/learner/goals';
import { currentStreak, lastSevenDays, loadActivity, localDay, minutesFor } from '../../services/learner/activity';
import { MistakeMemoryClient } from '../../services/mistake/client';
import type { DashboardTab } from './Navbar';

export type PracticeSection = 'reading' | 'vocab' | 'listening' | 'writing' | 'speaking';

const SECTION_FOR_FOCUS: Record<FocusSkill, PracticeSection> = {
  reading: 'reading',
  listening: 'listening',
  writing: 'writing',
  speaking: 'speaking',
  vocabulary: 'vocab',
  grammar: 'writing'
};

/** Which focus skill to practise today: rotates through the learner's focus list day by day */
export function focusForDay(focus: FocusSkill[], day = localDay()): FocusSkill {
  const list = focus.length ? focus : (['reading'] as FocusSkill[]);
  const n = Number(day.replace(/-/g, '')) || 0;
  return list[n % list.length];
}

interface TodayViewProps {
  dueVocabCount: number;
  onNavigate: (tab: DashboardTab) => void;
  onPractice: (section: PracticeSection) => void;
}

const GoalsForm: React.FC<{ initial: LearnerGoals | null; onSaved: (g: LearnerGoals) => void; onCancel?: () => void }> = ({
  initial,
  onSaved,
  onCancel
}) => {
  const [level, setLevel] = useState<LearnerGoals['level']>(initial?.level ?? 'B1');
  const [focus, setFocus] = useState<FocusSkill[]>(initial?.focus ?? ['reading', 'speaking', 'vocabulary']);
  const [minutes, setMinutes] = useState<LearnerGoals['dailyMinutes']>(initial?.dailyMinutes ?? 15);
  const [reminder, setReminder] = useState<string | null>(initial ? initial.reminderTime : '20:00');

  const toggle = (s: FocusSkill) =>
    setFocus((f) => (f.includes(s) ? (f.length > 1 ? f.filter((x) => x !== s) : f) : [...f, s]));

  return (
    <form
      className="today-card today-goals"
      data-testid="goals-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSaved(saveGoals({ level, focus, dailyMinutes: minutes, reminderTime: reminder }));
      }}
    >
      <h3>{initial ? 'Your goals' : 'Set your goals'}</h3>
      <p className="today-muted">Tell LexiFlow what you want, and it plans a short session for you every day.</p>

      <label className="today-label">Your English level now</label>
      <div className="today-chips">
        {LEVELS.map((l) => (
          <button key={l} type="button" className={`mm-chip ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)} data-testid={`goal-level-${l}`}>
            {LEVEL_LABELS[l]}
          </button>
        ))}
      </div>

      <label className="today-label">What do you want to get better at?</label>
      <div className="today-chips">
        {FOCUS_SKILLS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={focus.includes(s)}
            className={`mm-chip ${focus.includes(s) ? 'active' : ''}`}
            onClick={() => toggle(s)}
            data-testid={`goal-focus-${s}`}
          >
            {FOCUS_LABELS[s]}
          </button>
        ))}
      </div>

      <label className="today-label">Time each day</label>
      <div className="today-chips">
        {DAILY_MINUTES.map((m) => (
          <button key={m} type="button" className={`mm-chip ${minutes === m ? 'active' : ''}`} onClick={() => setMinutes(m)} data-testid={`goal-min-${m}`}>
            {m} min
          </button>
        ))}
      </div>

      <label className="today-label">
        <input
          type="checkbox"
          checked={reminder !== null}
          onChange={(e) => setReminder(e.target.checked ? '20:00' : null)}
          data-testid="goal-reminder-toggle"
        />{' '}
        Remind me every day
      </label>
      {reminder !== null && (
        <input
          type="time"
          className="today-time"
          value={reminder}
          onChange={(e) => setReminder(e.target.value || '20:00')}
          data-testid="goal-reminder-time"
        />
      )}

      <div className="drill-actions">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" data-testid="goals-save">
          Save goals
        </button>
      </div>
    </form>
  );
};

/** Home screen: today's plan built from what is due, the learner's goals, streak and the week. */
export const TodayView: React.FC<TodayViewProps> = ({ dueVocabCount, onNavigate, onPractice }) => {
  const [goals, setGoals] = useState<LearnerGoals | null>(() => loadGoals());
  const [editing, setEditing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener('lexiflow_activity_updated', refresh);
    window.addEventListener('lexiflow_mistakes_updated', refresh);
    return () => {
      window.removeEventListener('lexiflow_activity_updated', refresh);
      window.removeEventListener('lexiflow_mistakes_updated', refresh);
    };
  }, []);

  const activity = loadActivity();
  const today = activity[localDay()];
  const minutesToday = minutesFor(today);
  const streak = currentStreak(new Date(), activity);
  const week = lastSevenDays(new Date(), activity);
  const dueMistakes = MistakeMemoryClient.getDueMistakes().length;
  void tick;

  if (!goals || editing) {
    return (
      <div className="view-container today-view">
        <div className="view-header">
          <div>
            <h2 className="view-title">Today</h2>
            <p className="view-desc">A short, personal English session every day.</p>
          </div>
        </div>
        <GoalsForm
          initial={goals}
          onSaved={(g) => {
            setGoals(g);
            setEditing(false);
          }}
          onCancel={goals ? () => setEditing(false) : undefined}
        />
      </div>
    );
  }

  const target = goals.dailyMinutes;
  const pct = Math.min(100, Math.round((minutesToday / target) * 100));
  const focus = focusForDay(goals.focus);

  const steps = [
    {
      key: 'review',
      icon: <RotateCw size={18} />,
      title: dueVocabCount > 0 ? `Review ${dueVocabCount} word${dueVocabCount === 1 ? '' : 's'}` : 'Word reviews',
      hint: dueVocabCount > 0 ? 'Keep your saved words in memory.' : 'Nothing due. Save new words while you read.',
      done: dueVocabCount === 0 && (today?.review ?? 0) > 0,
      empty: dueVocabCount === 0,
      action: () => onNavigate('review')
    },
    {
      key: 'mistakes',
      icon: <BrainCircuit size={18} />,
      title: dueMistakes > 0 ? `Fix ${dueMistakes} mistake${dueMistakes === 1 ? '' : 's'}` : 'Mistake drills',
      hint: dueMistakes > 0 ? 'Short drills, often with your own sentences.' : 'No mistakes due today.',
      done: dueMistakes === 0 && (today?.drill ?? 0) > 0,
      empty: dueMistakes === 0,
      action: () => onNavigate('mistake_memory')
    },
    {
      key: 'practice',
      icon: <Sparkles size={18} />,
      title: `${FOCUS_LABELS[focus]} practice`,
      hint: `Today's focus from your goals, at ${goals.level} level.`,
      done: (today?.practice ?? 0) >= 5,
      empty: false,
      action: () => onPractice(SECTION_FOR_FOCUS[focus])
    }
  ];

  return (
    <div className="view-container today-view" data-testid="today-view">
      <div className="view-header">
        <div>
          <h2 className="view-title">Today</h2>
          <p className="view-desc">Your plan for {target} minutes of English.</p>
        </div>
        <button type="button" className="btn-secondary today-edit" onClick={() => setEditing(true)} data-testid="goals-edit">
          <Pencil size={14} /> Goals
        </button>
      </div>

      <div className="today-stats">
        <div className="today-card today-stat">
          <Flame size={22} className={streak > 0 ? 'today-flame on' : 'today-flame'} />
          <div>
            <strong data-testid="today-streak">
              {streak} day{streak === 1 ? '' : 's'}
            </strong>
            <span>streak</span>
          </div>
        </div>
        <div className="today-card today-stat today-goal">
          <div className="today-goal-top">
            <strong data-testid="today-minutes">
              {minutesToday} / {target} min
            </strong>
            <span>{pct >= 100 ? 'Goal reached!' : 'today'}</span>
          </div>
          <div className="today-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="today-week" aria-label="Last 7 days">
        {week.map((d) => (
          <div key={d.day} className={`today-day ${d.active ? 'on' : ''}`} title={`${d.day}: ${d.minutes} min`}>
            <span>{new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
            <i>{d.active ? <Check size={12} /> : null}</i>
          </div>
        ))}
      </div>

      <div className="today-plan">
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={`today-card today-step ${s.done ? 'done' : ''} ${s.empty ? 'empty' : ''}`}
            onClick={s.action}
            data-testid={`today-step-${s.key}`}
          >
            <span className="today-step-num">{s.done ? <Check size={16} /> : i + 1}</span>
            <span className="today-step-icon">{s.icon}</span>
            <span className="today-step-text">
              <strong>{s.title}</strong>
              <span>{s.hint}</span>
            </span>
            <ArrowRight size={16} className="today-step-go" />
          </button>
        ))}
      </div>

      {goals.reminderTime && (
        <p className="today-muted today-reminder">
          <Bell size={13} /> Daily reminder at {goals.reminderTime}, skipped on days you have already studied.
        </p>
      )}
    </div>
  );
};
