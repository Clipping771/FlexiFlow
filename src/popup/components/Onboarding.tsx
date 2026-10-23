import React from 'react';

export type PopupTextSize = 'small' | 'medium' | 'large' | 'xlarge';

interface OnboardingProps {
  textSize: PopupTextSize;
  onChooseSize: (size: PopupTextSize) => void;
  onDone: () => void;
}

/** First-run welcome guide: how LexiFlow works, plus a reading card text size choice. */
export const Onboarding: React.FC<OnboardingProps> = ({ textSize, onChooseSize, onDone }) => (
  <div className="hub-onboarding" role="region" aria-label="Getting started">
    <div className="onboarding-head">
      <span className="onboarding-title">Welcome to LexiFlow</span>
      <span className="onboarding-sub">Understand any English text, in Bengali, right where you read.</span>
    </div>
    <ol className="onboarding-steps">
      <li>
        <span className="onboarding-num">1</span>
        <span><strong>Select</strong> any word or sentence on a web page.</span>
      </li>
      <li>
        <span className="onboarding-num">2</span>
        <span><strong>Read</strong> the easy English and Bengali meaning in the card.</span>
      </li>
      <li>
        <span className="onboarding-num">3</span>
        <span><strong>Save</strong> new words and review them in the Library.</span>
      </li>
    </ol>
    <div className="onboarding-size">
      <span className="onboarding-size-label">Text size for the reading card</span>
      <div className="onboarding-size-options" role="radiogroup" aria-label="Reading card text size">
        {(['small', 'medium', 'large', 'xlarge'] as const).map((size, i) => (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={textSize === size}
            aria-label={size === 'xlarge' ? 'Extra large' : size[0].toUpperCase() + size.slice(1)}
            className={`onboarding-size-opt ${textSize === size ? 'active' : ''}`}
            onClick={() => onChooseSize(size)}
          >
            <span style={{ fontSize: `${12 + i * 2.5}px` }}>A</span>
          </button>
        ))}
      </div>
    </div>
    <button type="button" className="btn-onboarding-done" onClick={onDone}>
      Got it
    </button>
  </div>
);
