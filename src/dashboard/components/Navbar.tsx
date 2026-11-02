import React from 'react';
import {
  BookOpen,
  Target,
  RotateCw,
  Scale,
  PenTool,
  BarChart3,
  Settings as SettingsIcon,
  PanelRight,
  BookmarkCheck,
  PenLine,
  Mic,
  BrainCircuit,
  Headphones,
  GraduationCap
} from 'lucide-react';

export type DashboardTab =
  | 'overview'
  | 'vocabulary'
  | 'targeted_practice'
  | 'review'
  | 'reading_list'
  | 'summary_practice'
  | 'reading_practice'
  | 'listening_practice'
  | 'writing_practice'
  | 'speaking_practice'
  | 'full_mock_exam'
  | 'mistake_memory'
  | 'word_difference'
  | 'usage_coach'
  | 'analytics'
  | 'settings';

interface NavbarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  dueCount: number;
  totalVocab: number;
  weakCount?: number;
  onOpenSidePanel?: () => void;
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  dueCount,
  totalVocab,
  weakCount = 0,
  onOpenSidePanel,
  theme = 'dark',
  onToggleTheme
}) => {
  return (
    <aside className="sidebar">
      {/* Brand & App Title */}
      <div className="brand">
        <div className="brand-icon-wrapper">
          <div className="brand-glow"></div>
          <div className="brand-icon">L</div>
        </div>
        <div className="brand-text">
          <h1>LexiFlow</h1>
          <p>Language Mastery AI</p>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="nav-menu">
        {/* Section: Study & Memory */}
        <div className="nav-section">
          <div className="nav-section-title">Study &amp; Memory</div>

          <button
            className={`nav-item ${activeTab === 'vocabulary' ? 'active' : ''}`}
            onClick={() => onTabChange('vocabulary')}
          >
            <span className="nav-icon-box">
              <BookOpen size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Vocabulary</span>
            <span className="badge-neutral">{totalVocab}</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'review' ? 'active' : ''}`}
            onClick={() => onTabChange('review')}
          >
            <span className="nav-icon-box">
              <RotateCw size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Spaced Review</span>
            {dueCount > 0 && <span className="badge-count">{dueCount}</span>}
          </button>

          <button
            className={`nav-item ${activeTab === 'targeted_practice' ? 'active' : ''}`}
            onClick={() => onTabChange('targeted_practice')}
          >
            <span className="nav-icon-box">
              <Target size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Targeted Practice</span>
            {weakCount > 0 && <span className="badge-count badge-warning">{weakCount}</span>}
          </button>

          <button
            className={`nav-item ${activeTab === 'reading_list' ? 'active' : ''}`}
            onClick={() => onTabChange('reading_list')}
          >
            <span className="nav-icon-box">
              <BookmarkCheck size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Reading List</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'summary_practice' ? 'active' : ''}`}
            onClick={() => onTabChange('summary_practice')}
          >
            <span className="nav-icon-box">
              <PenLine size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Summary Practice</span>
          </button>
        </div>

        {/* Section: Exam Prep */}
        <div className="nav-section">
          <div className="nav-section-title">Exam Prep</div>

          <button
            data-testid="nav-reading-practice"
            className={`nav-item ${activeTab === 'reading_practice' ? 'active' : ''}`}
            onClick={() => onTabChange('reading_practice')}
          >
            <span className="nav-icon-box">
              <BookOpen size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Reading</span>
          </button>

          <button
            data-testid="nav-listening-practice"
            className={`nav-item ${activeTab === 'listening_practice' ? 'active' : ''}`}
            onClick={() => onTabChange('listening_practice')}
          >
            <span className="nav-icon-box">
              <Headphones size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Listening</span>
          </button>

          <button
            data-testid="nav-writing-practice"
            className={`nav-item ${activeTab === 'writing_practice' ? 'active' : ''}`}
            onClick={() => onTabChange('writing_practice')}
          >
            <span className="nav-icon-box">
              <PenTool size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Writing</span>
          </button>

          <button
            data-testid="nav-speaking-practice"
            className={`nav-item ${activeTab === 'speaking_practice' ? 'active' : ''}`}
            onClick={() => onTabChange('speaking_practice')}
          >
            <span className="nav-icon-box">
              <Mic size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Speaking</span>
          </button>

          <button
            data-testid="nav-full-mock-exam"
            className={`nav-item ${activeTab === 'full_mock_exam' ? 'active' : ''}`}
            onClick={() => onTabChange('full_mock_exam')}
          >
            <span className="nav-icon-box">
              <GraduationCap size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Full Mock Exam</span>
          </button>

          <button
            data-testid="nav-mistake-memory"
            className={`nav-item ${activeTab === 'mistake_memory' ? 'active' : ''}`}
            onClick={() => onTabChange('mistake_memory')}
          >
            <span className="nav-icon-box">
              <BrainCircuit size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Mistake Memory</span>
          </button>
        </div>

        {/* Section: AI Studio */}
        <div className="nav-section">
          <div className="nav-section-title">AI Studio &amp; Tools</div>

          <button
            className={`nav-item ${activeTab === 'word_difference' ? 'active' : ''}`}
            onClick={() => onTabChange('word_difference')}
          >
            <span className="nav-icon-box">
              <Scale size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Word Difference</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'usage_coach' ? 'active' : ''}`}
            onClick={() => onTabChange('usage_coach')}
          >
            <span className="nav-icon-box">
              <PenTool size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Usage Coach</span>
          </button>
        </div>

        {/* Section: Insights & System */}
        <div className="nav-section">
          <div className="nav-section-title">Insights &amp; System</div>

          <button
            className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => onTabChange('analytics')}
          >
            <span className="nav-icon-box">
              <BarChart3 size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Analytics</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => onTabChange('settings')}
          >
            <span className="nav-icon-box">
              <SettingsIcon size={16} strokeWidth={2} />
            </span>
            <span className="nav-item-label">Settings</span>
          </button>
        </div>
      </nav>

      {/* Sidebar Footer Controls */}
      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>


        {onOpenSidePanel && (
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center', fontSize: '12px', padding: '6px 12px' }}
            onClick={onOpenSidePanel}
            title="Open LexiFlow in native Chrome Side Panel"
          >
            <PanelRight size={14} />
            <span>Side Panel</span>
          </button>
        )}
      </div>
    </aside>
  );
};
