import React, { useEffect, useState } from 'react';
import { TargetExam, LearnerProfile } from '../../types';
import { ArrowRight, ArrowLeft, CheckCircle2, GraduationCap, X } from 'lucide-react';

interface OnboardingWizardProps {
  onComplete: (profile: LearnerProfile) => void;
  /** Closes without saving ("Skip for now", the close button, Escape or a backdrop click). */
  onDismiss?: () => void;
  initialProfile?: LearnerProfile | null;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ onComplete, onDismiss, initialProfile }) => {
  const [step, setStep] = useState<number>(1);
  const [targetExam, setTargetExam] = useState<TargetExam>(initialProfile?.targetExam || 'pte_academic');
  const [targetScore, setTargetScore] = useState<string>(initialProfile?.targetScore || (initialProfile?.targetExam === 'ielts_academic' ? '7.5' : '79'));
  const [targetDate, setTargetDate] = useState<string>(initialProfile?.targetExamDate || '');
  const [motherTongue, setMotherTongue] = useState<string>(initialProfile?.motherTongue || 'bn');
  const [studyHours, setStudyHours] = useState<number>(initialProfile?.studyHoursWeekly || 10);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!onDismiss) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const handleExamChange = (exam: TargetExam) => {
    setTargetExam(exam);
    if (exam === 'pte_academic' && (targetScore === '6.5' || targetScore === '7.0' || targetScore === '7.5' || targetScore === '8.0')) {
      setTargetScore('79');
    } else if (exam === 'ielts_academic' && (targetScore === '58' || targetScore === '65' || targetScore === '79' || targetScore === '85')) {
      setTargetScore('7.5');
    }
  };

  // Deterministic range check for the custom score box
  const scoreNum = Number(targetScore);
  const scoreIsValid =
    targetScore.trim() !== '' &&
    Number.isFinite(scoreNum) &&
    (targetExam === 'pte_academic'
      ? Number.isInteger(scoreNum) && scoreNum >= 10 && scoreNum <= 90
      : scoreNum >= 1 && scoreNum <= 9 && Number.isInteger(scoreNum * 2));

  const handleFinish = async () => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const profileData: LearnerProfile = {
      userId: initialProfile?.userId || 'usr_local',
      targetExam,
      targetScore,
      targetExamDate: targetDate ? targetDate : null,
      motherTongue,
      studyHoursWeekly: studyHours,
      createdAt: initialProfile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // Persist locally for immediate reactive dashboard rendering
      localStorage.setItem('lexiflow_learner_profile', JSON.stringify(profileData));
      onComplete(profileData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="sheet-backdrop onboarding-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDismiss?.();
      }}
    >
      <div className="onboarding-sheet onboarding-card" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        {/* Progress Header */}
        <div className="onboarding-header">
          <div className="onboarding-brand">
            <div className="onboarding-icon">
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="onboarding-title" id="onboarding-title">
                {initialProfile ? 'Your exam target' : 'Set up exam practice'}
              </h2>
              <p className="onboarding-subtitle">
                Optional. Tailors the exam screens to your test and goal.
              </p>
            </div>
          </div>
          <div className="onboarding-header-right">
            <div className="onboarding-step-badge">Step {step} of 4</div>
            {onDismiss && (
              <button type="button" className="onboarding-close" onClick={onDismiss} aria-label="Close" data-testid="wizard-close-btn">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="onboarding-progress-bar">
          <div
            className="onboarding-progress-fill"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '13px',
            color: 'var(--danger)',
            marginBottom: '16px'
          }}>
            {errorMsg}
          </div>
        )}

        {/* Step 1: Select Exam */}
        {step === 1 && (
          <div>
            <h3 className="onboarding-prompt">
              Which English proficiency exam are you preparing for?
            </h3>
            <p className="onboarding-prompt-desc">
              LexiFlow will tailor your rubric scoring, timing constraints, and tasks to this test.
            </p>

            <div style={{ marginBottom: '20px' }}>
              {/* PTE Option */}
              <div
                data-testid="exam-option-pte"
                onClick={() => handleExamChange('pte_academic')}
                className={`onboarding-card-option ${targetExam === 'pte_academic' ? 'active' : ''}`}
              >
                <div className="onboarding-card-indicator">
                  {targetExam === 'pte_academic' && <CheckCircle2 size={14} style={{ color: '#ffffff' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="onboarding-card-heading">
                    <span className="onboarding-card-name">PTE Academic</span>
                    <span className="onboarding-card-badge">
                      Pearson 10–90 Scale
                    </span>
                  </div>
                  <p className="onboarding-card-desc">
                    Automated scoring, strict timing, Read Aloud, Write from Dictation, Summarize Written Text, and Essay.
                  </p>
                </div>
              </div>

              {/* IELTS Option */}
              <div
                data-testid="exam-option-ielts"
                onClick={() => handleExamChange('ielts_academic')}
                className={`onboarding-card-option ${targetExam === 'ielts_academic' ? 'active' : ''}`}
              >
                <div className="onboarding-card-indicator">
                  {targetExam === 'ielts_academic' && <CheckCircle2 size={14} style={{ color: '#ffffff' }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="onboarding-card-heading">
                    <span className="onboarding-card-name">IELTS Academic</span>
                    <span className="onboarding-card-badge">
                      0.0–9.0 Band Scale
                    </span>
                  </div>
                  <p className="onboarding-card-desc">
                    Official 4-criteria rubrics: Task Achievement (TR/TA), Coherence & Cohesion (CC), Lexical Resource (LR), and Grammatical Accuracy (GRA).
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Target Score */}
        {step === 2 && (
          <div>
            <h3 className="onboarding-prompt">
              What is your target score?
            </h3>
            <p className="onboarding-prompt-desc">
              Your mistake diagnostics and feedback benchmarks will adjust according to this goal.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                Select Target Milestone:
              </label>
              <div className="onboarding-chips-grid">
                {targetExam === 'pte_academic'
                  ? ['58', '65', '79', '85'].map((score) => (
                      <button
                        key={score}
                        type="button"
                        data-testid={`score-btn-${score}`}
                        onClick={() => setTargetScore(score)}
                        className={`onboarding-chip-btn ${targetScore === score ? 'active' : ''}`}
                      >
                        {score}
                      </button>
                    ))
                  : ['6.5', '7.0', '7.5', '8.0'].map((band) => (
                      <button
                        key={band}
                        type="button"
                        data-testid={`score-btn-${band}`}
                        onClick={() => setTargetScore(band)}
                        className={`onboarding-chip-btn ${targetScore === band ? 'active' : ''}`}
                      >
                        Band {band}
                      </button>
                    ))}
              </div>

              <div>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Custom Target Score:
                </label>
                <input
                  type="text"
                  data-testid="custom-score-input"
                  value={targetScore}
                  onChange={(e) => setTargetScore(e.target.value)}
                  placeholder={targetExam === 'pte_academic' ? 'e.g. 79' : 'e.g. 7.5'}
                  className="input-search"
                  style={{ width: '100%', height: '40px' }}
                  aria-invalid={!scoreIsValid}
                />
                {!scoreIsValid && (
                  <span className="onboarding-field-error">
                    {targetExam === 'pte_academic' ? 'Enter a whole number from 10 to 90.' : 'Enter a band from 1 to 9 in half steps, e.g. 6.5.'}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Exam Date */}
        {step === 3 && (
          <div>
            <h3 className="onboarding-prompt">
              When do you plan to take your exam?
            </h3>
            <p className="onboarding-prompt-desc">
              Optional. We will schedule your FSRS mistake review intervals to peak right before test day.
            </p>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Target Test Date (YYYY-MM-DD):
              </label>
              <input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                data-testid="target-date-input"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="input-search"
                style={{ width: '100%', height: '42px', marginBottom: '12px' }}
              />
              <button
                type="button"
                onClick={() => setTargetDate('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--blue)',
                  fontSize: '12.5px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  padding: 0
                }}
              >
                Clear date (I haven't booked yet)
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Mother Tongue & Study Hours */}
        {step === 4 && (
          <div>
            <h3 className="onboarding-prompt">
              Language &amp; Study Rhythm
            </h3>
            <p className="onboarding-prompt-desc">
              Choose your native language for bilingual grammar breakdowns and set your weekly study pace.
            </p>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Mother Tongue (L1 for Nuance Explanations):
              </label>
              <select
                value={motherTongue}
                data-testid="mother-tongue-select"
                onChange={(e) => setMotherTongue(e.target.value)}
                className="select-filter"
                style={{ width: '100%', height: '42px', fontSize: '13.5px' }}
              >
                <option value="bn">বাংলা (Bengali) — Recommended for Bangladesh &amp; West Bengal</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="en">English Only (No L1 translation)</option>
              </select>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Weekly Study Commitment:
                </label>
                <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--blue)' }}>
                  {studyHours} hours / week
                </span>
              </div>
              <input
                type="range"
                data-testid="study-hours-input"
                min={5}
                max={40}
                step={5}
                value={studyHours}
                onChange={(e) => setStudyHours(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--blue)', cursor: 'pointer', height: '6px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-subtle)', marginTop: '4px' }}>
                <span>5h (Light)</span>
                <span>15h (Standard)</span>
                <span>40h (Intensive)</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="onboarding-footer-actions">
          {step > 1 ? (
            <button
              type="button"
              data-testid="wizard-back-btn"
              onClick={() => setStep((s) => s - 1)}
              className="btn-secondary"
            >
              <ArrowLeft size={14} /> Back
            </button>
          ) : onDismiss ? (
            <button type="button" data-testid="wizard-skip-btn" onClick={onDismiss} className="btn-secondary onboarding-skip">
              Skip for now
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button
              type="button"
              data-testid="wizard-continue-btn"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 2 && !scoreIsValid}
              className="btn-primary"
            >
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              data-testid="wizard-finish-btn"
              onClick={handleFinish}
              disabled={isSubmitting}
              className="btn-primary"
              style={{ background: 'var(--green)', borderColor: 'rgba(255, 255, 255, 0.15)' }}
            >
              <CheckCircle2 size={15} />
              {isSubmitting ? 'Saving...' : 'Start Preparation'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
