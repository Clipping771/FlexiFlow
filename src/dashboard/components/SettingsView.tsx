import React, { useState, useEffect } from 'react';
import { UserSettings, CustomLanguageConfig } from '../../types';
import { fetchProviderModels, AvailableModel } from '../../services/ai/modelFetcher';
import { AccountSection } from './AccountSection';
import { MONETIZATION_ENABLED } from '../../config/features';
import {
  getAllLanguages,
  getLanguageConfig,
  createCustomLanguageConfig,
  registerCustomLanguages,
  SUPPORTED_SOURCE_LANGUAGES
} from '../../config/languages';
import {
  BookOpen,
  Sparkles,
  RotateCw,
  Check,
  Zap,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Sliders,
  Volume2,
  Sun,
  Moon,
  Monitor,
  Trash2,
  Download,
  FileText,
  Type
} from 'lucide-react';
import { playPronunciation } from '../../services/audio/voiceService';

// Mirrors the --lf-font-english / --lf-font-bengali tokens of each popup size in content/styles.ts
const TEXT_SIZE_OPTIONS: Array<{
  value: NonNullable<UserSettings['popupSize']>;
  label: string;
  short: string;
  glyph: number;
  english: number;
  bengali: number;
}> = [
  { value: 'small', label: 'Small', short: 'Small', glyph: 11, english: 15, bengali: 17 },
  { value: 'medium', label: 'Medium', short: 'Medium', glyph: 13, english: 16, bengali: 18.5 },
  { value: 'large', label: 'Large', short: 'Large', glyph: 15, english: 18, bengali: 21 },
  { value: 'xlarge', label: 'Extra Large', short: 'XL', glyph: 17, english: 20, bengali: 23.5 }
];

interface SettingsViewProps {
  settings: UserSettings;
  onSaveSettings: (updates: Partial<UserSettings>) => Promise<void>;
}

const PROVIDER_MODELS: Record<string, Array<{ id: string; name: string }>> = {
  gemini: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Fast, Recommended)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Latest)' },
    { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite (Cost-efficient)' },
    { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash (Latest Alias)' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Linguistic Reasoning)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Legacy)' }
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Cost-Efficient - Recommended)' },
    { id: 'gpt-4o', name: 'GPT-4o (Flagship Omnimodal)' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'o3-mini', name: 'o3-mini (Reasoning Model)' }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (State of the Art - Recommended)' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Ultra-Fast)' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Maximum Depth)' }
  ],
  ollama: [
    { id: 'llama3.2', name: 'Llama 3.2 (Lightweight Local - Recommended, No Sign-In)' },
    { id: 'llama3.1', name: 'Llama 3.1 (8B / 70B)' },
    { id: 'mistral', name: 'Mistral (7B)' },
    { id: 'qwen2.5', name: 'Qwen 2.5' },
    { id: 'deepseek-r1:8b', name: 'DeepSeek R1 (8B Distill)' },
    { id: 'gemma4:31b-cloud', name: 'Gemma 4 31B Cloud (-cloud model, requires ollama signin)' }
  ]
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings
}) => {
  const [form, setForm] = useState<UserSettings>({ ...settings });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const [dynamicModels, setDynamicModels] = useState<Record<string, AvailableModel[]>>({});
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchSuccessMsg, setFetchSuccessMsg] = useState<string | null>(null);
  const [fetchErrorMsg, setFetchErrorMsg] = useState<string | null>(null);

  const availableModels = dynamicModels[form.aiProvider] || PROVIDER_MODELS[form.aiProvider] || [];
  const isCustomModel = Boolean(
    form.selectedModel &&
    availableModels.length > 0 &&
    !availableModels.some((m) => m.id === form.selectedModel)
  );
  const [customModelMode, setCustomModelMode] = useState(isCustomModel);
  const [showApiKey, setShowApiKey] = useState(false);

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    provider: string;
    model: string;
    latencyMs: number;
    sampleResult?: string;
    error?: string;
    targetLabel?: string;
    flagEmoji?: string;
  } | null>(null);

  // Custom Languages Management State
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [editingLangCode, setEditingLangCode] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [customNativeName, setCustomNativeName] = useState('');
  const [customNativeHeader, setCustomNativeHeader] = useState('');
  const [customEmoji, setCustomEmoji] = useState('🌐');
  const [customTutorRole, setCustomTutorRole] = useState('');
  const [customPromptInstruction, setCustomPromptInstruction] = useState('');
  const [showAdvancedPrompt, setShowAdvancedPrompt] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [deleteConfirmCode, setDeleteConfirmCode] = useState<string | null>(null);
  const [telemetryInfo, setTelemetryInfo] = useState<{ rawCount: number; daysCount: number } | null>(null);
  const [feedbackReportsCount, setFeedbackReportsCount] = useState<number>(0);

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'GET_EVENT_LOGS' }, (res) => {
        if (res?.success && res.data) {
          setTelemetryInfo({
            rawCount: res.data.events?.length || 0,
            daysCount: Object.keys(res.data.dailyAggregates || {}).length
          });
        }
      });

      chrome.runtime.sendMessage({ type: 'GET_FEEDBACK_REPORTS' }, (res) => {
        if (res?.success && Array.isArray(res.data)) {
          setFeedbackReportsCount(res.data.length);
        }
      });
    }
  }, []);

  const handleExportTelemetry = async () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'EXPORT_EVENT_LOGS' }, (res) => {
        if (res?.success && res.data) {
          const blob = new Blob([res.data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `lexiflow_telemetry_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          setStatus('Telemetry logs exported successfully.');
          setTimeout(() => setStatus(null), 3000);
        }
      });
    }
  };

  const handleExportFeedbackReports = async () => {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'EXPORT_FEEDBACK_REPORTS' }, (res) => {
        if (res?.success && res.data) {
          const blob = new Blob([res.data], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `lexiflow_feedback_reports_${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          setStatus('Feedback reports exported successfully.');
          setTimeout(() => setStatus(null), 3000);
        }
      });
    }
  };

  const handleClearTelemetry = async () => {
    if (!window.confirm('Are you sure you want to clear all telemetry logs and aggregate counters?')) return;
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'CLEAR_EVENT_LOGS' }, (res) => {
        if (res?.success) {
          setTelemetryInfo({ rawCount: 0, daysCount: 0 });
          setStatus('Event logs cleared successfully.');
          setTimeout(() => setStatus(null), 3000);
        }
      });
    }
  };

  const allLanguages = getAllLanguages(form.customLanguages);
  const customLangs = form.customLanguages || [];
  const currentLangConfig = getLanguageConfig(form.targetLanguage || 'bn', form.customLanguages);

  const openAddCustomLanguage = () => {
    setEditingLangCode(null);
    setCustomName('');
    setCustomCode('');
    setCustomNativeName('');
    setCustomNativeHeader('');
    setCustomEmoji('🌐');
    setCustomTutorRole('');
    setCustomPromptInstruction('');
    setShowAdvancedPrompt(false);
    setModalError(null);
    setCustomModalOpen(true);
  };

  const openEditCustomLanguage = (c: CustomLanguageConfig) => {
    setEditingLangCode(c.code);
    setCustomName(c.name);
    setCustomCode(c.code);
    setCustomNativeName(c.nativeName || c.name);
    setCustomNativeHeader(c.nativeHeader || `Easy ${c.name}`);
    setCustomEmoji(c.flagEmoji || '🌐');
    setCustomTutorRole(c.promptTutorRole || '');
    setCustomPromptInstruction(c.promptTargetInstruction || '');
    setShowAdvancedPrompt(Boolean(c.promptTutorRole || c.promptTargetInstruction));
    setModalError(null);
    setCustomModalOpen(true);
  };

  const handleNameChange = (name: string) => {
    setCustomName(name);
    if (!editingLangCode) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
      setCustomCode(slug);
      setCustomNativeHeader(`Easy ${name}`);
      if (!customNativeName || customNativeName === customName) {
        setCustomNativeName(name);
      }
    }
  };

  const handleSaveCustomLanguage = async (activateImmediately: boolean) => {
    setModalError(null);
    const trimmedName = customName.trim();
    const trimmedCode = customCode.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '');

    if (!trimmedName) {
      setModalError('Please enter a language name (e.g. Turkish, Sylheti, Swahili).');
      return;
    }
    if (!trimmedCode) {
      setModalError('Please enter a valid language code (e.g. tr, syl, sw).');
      return;
    }
    if (trimmedCode === 'en') {
      setModalError('English (en) is the source language and cannot be a target language.');
      return;
    }

    const existingCustoms = form.customLanguages || [];
    if (!editingLangCode && existingCustoms.some((c) => c.code.toLowerCase() === trimmedCode)) {
      setModalError(`A custom language with code "${trimmedCode}" already exists.`);
      return;
    }

    const config = createCustomLanguageConfig({
      code: trimmedCode,
      name: trimmedName,
      nativeName: customNativeName.trim() || trimmedName,
      nativeHeader: customNativeHeader.trim() || `Easy ${trimmedName}`,
      flagEmoji: customEmoji.trim() || '🌐',
      promptTutorRole: customTutorRole.trim() || undefined,
      promptTargetInstruction: customPromptInstruction.trim() || undefined
    });

    let updatedCustoms: CustomLanguageConfig[];
    if (editingLangCode) {
      updatedCustoms = existingCustoms.map((c) => (c.code === editingLangCode ? config : c));
    } else {
      updatedCustoms = [...existingCustoms, config];
    }

    const updatedForm: UserSettings = {
      ...form,
      customLanguages: updatedCustoms,
      targetLanguage: activateImmediately ? trimmedCode : (form.targetLanguage || 'bn')
    };

    setForm(updatedForm);
    registerCustomLanguages(updatedCustoms);
    await onSaveSettings(updatedForm);

    setCustomModalOpen(false);
    setStatus(`Language "${trimmedName}" ${editingLangCode ? 'updated' : 'saved'} successfully!`);
    setTimeout(() => setStatus(null), 3000);
  };

  const handleDeleteCustomLanguage = async (code: string) => {
    const existingCustoms = form.customLanguages || [];
    const updatedCustoms = existingCustoms.filter((c) => c.code !== code);
    const fallbackTarget = form.targetLanguage === code ? 'bn' : form.targetLanguage;

    const updatedForm: UserSettings = {
      ...form,
      customLanguages: updatedCustoms,
      targetLanguage: fallbackTarget
    };

    setForm(updatedForm);
    registerCustomLanguages(updatedCustoms);
    await onSaveSettings(updatedForm);
    setDeleteConfirmCode(null);
    setStatus('Custom language removed successfully.');
    setTimeout(() => setStatus(null), 3000);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    try {
      const res = await new Promise<any>((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage(
            {
              type: 'TEST_AI_CONNECTION',
              payload: {
                aiProvider: form.aiProvider,
                apiKey: form.apiKey,
                selectedModel: form.selectedModel,
                apiEndpoint: form.apiEndpoint,
                targetLanguage: form.targetLanguage || 'bn',
                customLanguages: form.customLanguages
              }
            },
            (response) => resolve(response?.data || response)
          );
        } else {
          resolve({
            success: false,
            error: 'Extension runtime messaging unavailable.'
          });
        }
      });

      if (res && !res.success && res.error) {
        if (res.error.includes('401') || res.error.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') || res.error.includes('UNAUTHENTICATED')) {
          res.error = 'Invalid Gemini API Key (401). Please generate a standard API key from https://aistudio.google.com/app/apikey (starts with AIzaSy... or AQ...). Google Cloud OAuth tokens are not supported.';
        }
      }

      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        provider: form.aiProvider,
        model: form.selectedModel || 'default',
        latencyMs: 0,
        error: err?.message || 'Failed to trigger connection test.'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const loadModels = async (provider: string, apiKey?: string, endpoint?: string) => {
    if (provider === 'mock') return;
    if ((provider === 'gemini' || provider === 'openai') && (!apiKey || !apiKey.trim())) return;

    setFetchingModels(true);
    setFetchErrorMsg(null);
    setFetchSuccessMsg(null);

    try {
      let models: AvailableModel[] = [];

      // 1. First attempt through background runtime messaging
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        const res = await new Promise<any>((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'FETCH_MODELS', payload: { provider, apiKey, endpoint } },
            (response) => resolve(response)
          );
        });
        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
          models = res.data;
        } else if (res?.error) {
          throw new Error(res.error);
        }
      }

      // 2. Direct frontend fallback
      if (models.length === 0) {
        models = await fetchProviderModels(provider, apiKey, endpoint);
      }

      if (models.length > 0) {
        setDynamicModels((prev) => ({ ...prev, [provider]: models }));
        setFetchSuccessMsg(`Successfully loaded ${models.length} active models from your ${provider.toUpperCase()} account! Settings saved.`);
        setTimeout(() => setFetchSuccessMsg(null), 5000);

        const bestModel = models[0]?.id || 'gemini-2.0-flash';
        const updatedForm: UserSettings = {
          ...form,
          aiProvider: provider as any,
          apiKey: apiKey || form.apiKey,
          selectedModel: (!form.selectedModel || form.selectedModel === 'gemini-1.5-flash' || !models.some((m) => m.id === form.selectedModel)) ? bestModel : form.selectedModel
        };
        setForm(updatedForm);
        await onSaveSettings(updatedForm);
      }
    } catch (err: any) {
      console.warn('[LexiFlow] Model fetch error:', err);
      let msg = err?.message || 'Could not auto-fetch models for this key.';
      if (msg.includes('401') || msg.includes('ACCESS_TOKEN_TYPE_UNSUPPORTED') || msg.includes('UNAUTHENTICATED')) {
        msg = 'Invalid API key (401). Make sure you copy a key from Google AI Studio (https://aistudio.google.com/app/apikey).';
      }
      setFetchErrorMsg(msg);
      setTimeout(() => setFetchErrorMsg(null), 8000);
    } finally {
      setFetchingModels(false);
    }
  };

  // Automatically fetch on mount if key is already present
  useEffect(() => {
    if (form.apiKey && (form.aiProvider === 'gemini' || form.aiProvider === 'openai')) {
      loadModels(form.aiProvider, form.apiKey, form.apiEndpoint);
    } else if (form.aiProvider === 'ollama') {
      loadModels('ollama', undefined, form.apiEndpoint);
    }
  }, [form.aiProvider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(form);
    setStatus('Settings saved successfully!');
    setTimeout(() => setStatus(null), 2000);
  };

  return (
    <div className="settings-container">
      <div className="view-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 className="view-title">Settings &amp; AI Configuration</h2>
          <p className="view-desc">
            Configure reading interaction triggers, translation languages, and AI model parameters
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="top-kpi-pill" style={{ padding: '6px 12px', fontSize: '12px' }}>
            <span className="top-kpi-dot" style={{ background: form.aiProvider === 'lexiflow' || (form.aiProvider !== 'mock' && form.apiKey) ? '#10b981' : '#f59e0b' }}></span>
            <span className="top-kpi-label">Active Engine:</span>
            <span className="top-kpi-val">
              {form.aiProvider === 'lexiflow'
                ? 'LexiFlow Cloud'
                : form.aiProvider === 'gemini' && form.apiKey
                ? `Google Gemini (${form.selectedModel || 'gemini-2.0-flash'})`
                : form.aiProvider === 'ollama'
                ? `Local Ollama (${form.selectedModel || 'llama3.2'})`
                : form.aiProvider === 'openai' && form.apiKey
                ? `OpenAI (${form.selectedModel || 'gpt-4o-mini'})`
                : form.aiProvider === 'anthropic' && form.apiKey
                ? `Claude (${form.selectedModel || 'claude-3-5-sonnet-20241022'})`
                : 'Offline / Rule-Based'}
            </span>
          </span>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <AccountSection />
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Card 1: Reading Interaction & Triggers */}
        <div className="card">
          <div className="settings-section-header">
            <div className="settings-section-icon">
              <BookOpen size={18} />
            </div>
            <div>
              <h4 className="settings-section-title">Reading Interaction &amp; Triggers</h4>
              <p className="settings-section-subtitle">Control how LexiFlow highlights text and invokes the definition card</p>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
              Word &amp; Text Selection Trigger Mode:
            </label>
            <select
              className="select-filter"
              style={{ width: '100%', height: '40px', fontSize: '13px' }}
              value={form.triggerMode}
              onChange={(e) => {
                const mode = e.target.value as UserSettings['triggerMode'];
                setForm({
                  ...form,
                  triggerMode: mode,
                  autoAnalyzeOnSelection: mode === 'auto_selection' ? true : form.autoAnalyzeOnSelection
                });
              }}
            >
              <option value="auto_selection">Automatic on text selection (Instant)</option>
              <option value="double_click">Double-click on word</option>
              <option value="selection_icon">Show floating icon beside selection</option>
              <option value="manual_only">Manual (Context menu only)</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              className={`settings-switch-row ${form.autoAnalyzeOnSelection ? 'active' : ''}`}
              onClick={() => setForm({ ...form, autoAnalyzeOnSelection: !form.autoAnalyzeOnSelection })}
            >
              <div className="settings-switch-label">
                <div className="settings-switch-title">Auto-Analyze on Text Selection</div>
                <div className="settings-switch-desc">Instantly launch definition card when selecting words without an extra trigger click</div>
              </div>
              <div className={`ios-toggle ${form.autoAnalyzeOnSelection ? 'checked' : ''}`}>
                <div className="ios-toggle-thumb" />
              </div>
            </div>

            <div
              className={`settings-switch-row ${form.showBengaliByDefault ? 'active' : ''}`}
              onClick={() => setForm({ ...form, showBengaliByDefault: !form.showBengaliByDefault })}
            >
              <div className="settings-switch-label">
                <div className="settings-switch-title">Always Show Bengali Translations by Default</div>
                <div className="settings-switch-desc">Display rich Bengali native explanations directly alongside Easy English</div>
              </div>
              <div className={`ios-toggle ${form.showBengaliByDefault ? 'checked' : ''}`}>
                <div className="ios-toggle-thumb" />
              </div>
            </div>

            <div
              className={`settings-switch-row ${(form.sidePanelEnabled ?? true) ? 'active' : ''}`}
              onClick={() => setForm({ ...form, sidePanelEnabled: !(form.sidePanelEnabled ?? true) })}
            >
              <div className="settings-switch-label">
                <div className="settings-switch-title">Chrome Side Panel Companion Reading</div>
                <div className="settings-switch-desc">Enable side panel integration for companion deep-reading alongside complex web articles</div>
              </div>
              <div className={`ios-toggle ${(form.sidePanelEnabled ?? true) ? 'checked' : ''}`}>
                <div className="ios-toggle-thumb" />
              </div>
            </div>
          </div>

          {/* Reading Mode Segmented Control */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Reading Mode:
                </label>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Quick Mode prioritizes immediate comprehension; Learn Mode adds connector logic &amp; active recall
                </div>
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-item ${form.readingMode !== 'learn' ? 'active' : ''}`}
                  onClick={async () => {
                    const updated = { ...form, readingMode: 'quick' as const };
                    setForm(updated);
                    await onSaveSettings(updated);
                    setStatus('Reading Mode set to Quick Mode.');
                    setTimeout(() => setStatus(null), 2500);
                  }}
                >
                  Quick Mode
                </button>
                <button
                  type="button"
                  className={`segmented-item ${form.readingMode === 'learn' ? 'active' : ''}`}
                  onClick={async () => {
                    const updated = { ...form, readingMode: 'learn' as const };
                    setForm(updated);
                    await onSaveSettings(updated);
                    setStatus('Reading Mode set to Learn Mode.');
                    setTimeout(() => setStatus(null), 2500);
                  }}
                >
                  Learn Mode
                </button>
              </div>
            </div>
          </div>

          {/* Clean Inline Theme Mode Selector */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Interface Theme:
                </label>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Synchronized across dashboard, extension popup, and in-page reading card
                </div>
              </div>
              <div className="segmented-control">
                <button
                  type="button"
                  className={`segmented-item ${form.theme === 'light' ? 'active' : ''}`}
                  onClick={async () => {
                    const updated = { ...form, theme: 'light' as const };
                    setForm(updated);
                    await onSaveSettings(updated);
                    setStatus('Theme set to Light Mode.');
                    setTimeout(() => setStatus(null), 2500);
                  }}
                >
                  <Sun size={13} />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  className={`segmented-item ${form.theme === 'dark' || !form.theme ? 'active' : ''}`}
                  onClick={async () => {
                    const updated = { ...form, theme: 'dark' as const };
                    setForm(updated);
                    await onSaveSettings(updated);
                    setStatus('Theme set to Dark Mode.');
                    setTimeout(() => setStatus(null), 2500);
                  }}
                >
                  <Moon size={13} />
                  <span>Dark</span>
                </button>
                <button
                  type="button"
                  className={`segmented-item ${form.theme === 'system' ? 'active' : ''}`}
                  onClick={async () => {
                    const updated = { ...form, theme: 'system' as const };
                    setForm(updated);
                    await onSaveSettings(updated);
                    setStatus('Theme set to System Default.');
                    setTimeout(() => setStatus(null), 2500);
                  }}
                >
                  <Monitor size={13} />
                  <span>System</span>
                </button>
              </div>
            </div>
          </div>

          {/* Reading Card Text Size (low-vision friendly) */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Type size={15} style={{ color: 'var(--blue)' }} />
                  Text Size / লেখার আকার:
                </label>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Make the in-page reading card easier to read. Updates open tabs instantly.
                </div>
              </div>
              <div className="segmented-control" role="radiogroup" aria-label="Reading card text size">
                {TEXT_SIZE_OPTIONS.map((opt) => {
                  const active = (form.popupSize || 'medium') === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      aria-label={opt.label}
                      title={opt.label}
                      className={`segmented-item ${active ? 'active' : ''}`}
                      onClick={async () => {
                        const updated = { ...form, popupSize: opt.value };
                        setForm(updated);
                        await onSaveSettings(updated);
                        setStatus(`Text size set to ${opt.label}.`);
                        setTimeout(() => setStatus(null), 2500);
                      }}
                    >
                      <span style={{ fontSize: `${opt.glyph}px`, fontWeight: 700, lineHeight: 1 }}>A</span>
                      <span>{opt.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {(() => {
              const preview = TEXT_SIZE_OPTIONS.find((o) => o.value === (form.popupSize || 'medium')) || TEXT_SIZE_OPTIONS[1];
              return (
                <div
                  aria-live="polite"
                  style={{
                    marginTop: '12px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--line)',
                    background: 'var(--fill)'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Preview
                  </div>
                  <div style={{ fontSize: `${preview.english}px`, lineHeight: 1.45, color: 'var(--text-main)' }}>
                    Very careful and thorough examination of something.
                  </div>
                  <div style={{ fontSize: `${preview.bengali}px`, lineHeight: 1.45, fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                    পুঙ্খানুপুঙ্খ পরীক্ষা বা গভীর পর্যবেক্ষণ
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Clean Pronunciation Voice Row */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Volume2 size={15} style={{ color: 'var(--blue)' }} />
                  Pronunciation Voice:
                </label>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Natural studio female voice for accurate English pronunciation
                </div>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '12px', padding: '6px 14px' }}
                onClick={() => {
                  playPronunciation("Welcome to LexiFlow. Learn English vocabulary effortlessly with natural pronunciation.");
                }}
              >
                <Volume2 size={13} />
                <span>Test Voice</span>
              </button>
            </div>
          </div>


          {/* Language Pair: Source & Target Language Options */}
          <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                  🌐 Language Configuration (Source &amp; Target)
                </label>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Pair: <strong>{(form.sourceLanguage || 'en').toUpperCase()}</strong> ➔ <strong>{currentLangConfig.flagEmoji} {currentLangConfig.targetLabel} ({currentLangConfig.targetNativeLabel})</strong>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '11.5px', background: 'rgba(56, 189, 248, 0.12)', color: 'var(--blue)', padding: '3px 10px', borderRadius: 'var(--r-pill)', fontWeight: 700, border: '1px solid rgba(56, 189, 248, 0.25)' }}>
                  {currentLangConfig.flagEmoji} {currentLangConfig.targetNativeLabel}
                </span>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    fontSize: '11.5px',
                    padding: '5px 12px',
                    color: 'var(--blue)',
                    borderColor: 'var(--card-border-hover)',
                    fontWeight: 600
                  }}
                  onClick={openAddCustomLanguage}
                >
                  + Add Custom Language
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginBottom: '10px' }}>
              {/* 1. Source Language */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  📖 Source Language (Text you read / select):
                </label>
                <select
                  className="select-filter"
                  style={{ width: '100%', height: '42px', fontSize: '13.5px', padding: '0 12px' }}
                  value={form.sourceLanguage || 'en'}
                  onChange={async (e) => {
                    const newSource = e.target.value;
                    const updated = { ...form, sourceLanguage: newSource };
                    setForm(updated);
                    await onSaveSettings(updated);
                    setStatus(`Source reading language set to ${newSource.toUpperCase()}.`);
                    setTimeout(() => setStatus(null), 3000);
                  }}
                >
                  {SUPPORTED_SOURCE_LANGUAGES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.flagEmoji} {s.name} ({s.nativeName})
                    </option>
                  ))}
                </select>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  The language of the websites, articles, or books you read.
                </div>
              </div>

              {/* 2. Target Language */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  🎯 Target Language (Explanations &amp; translations):
                </label>
                <select
                  className="select-filter"
                  style={{ width: '100%', height: '42px', fontSize: '13.5px', padding: '0 12px' }}
                  value={form.targetLanguage || 'bn'}
                  onChange={async (e) => {
                    const newLang = e.target.value;
                    const updated = { ...form, targetLanguage: newLang };
                    setForm(updated);
                    await onSaveSettings(updated);
                    const foundLang = allLanguages.find((l) => l.targetLang === newLang) || customLangs.find((c) => c.code === newLang);
                    setStatus(`Target translation language set to ${foundLang?.flagEmoji || '🌐'} ${(foundLang as any)?.targetLabel || (foundLang as any)?.name || newLang}.`);
                    setTimeout(() => setStatus(null), 3000);
                  }}
                >
                  {customLangs.length > 0 && (
                    <optgroup label="🌟 My Custom Languages">
                      {customLangs.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flagEmoji || '🌐'} {c.name} ({c.nativeName || c.name}) — Custom Language
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="🌐 Supported Global Languages (30+ Languages)">
                    {allLanguages
                      .filter((l) => !l.isCustom)
                      .map((l) => (
                        <option key={l.targetLang} value={l.targetLang}>
                          {l.flagEmoji} {l.targetLabel} ({l.targetNativeLabel}) {l.targetLang === 'bn' ? '— Offline Dictionary + AI' : '— AI Contextual Translation'}
                        </option>
                      ))}
                  </optgroup>
                </select>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  All instant definitions, breakdowns, and AI responses will be in this language.
                </div>
              </div>
            </div>

            {/* Custom Languages List */}
            {customLangs.length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px dashed var(--line)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>My Custom Languages ({customLangs.length}):</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Saved locally and persisted</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {customLangs.map((c) => {
                    const isActive = (form.targetLanguage || 'bn') === c.code;
                    return (
                      <div
                        key={c.code}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: isActive ? 'rgba(56, 189, 248, 0.08)' : 'var(--fill)',
                          border: `1px solid ${isActive ? 'var(--blue)' : 'var(--line)'}`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>{c.flagEmoji || '🌐'}</span>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{c.name}</span>
                              {c.nativeName && c.nativeName !== c.name && (
                                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({c.nativeName})</span>
                              )}
                              <span style={{ fontSize: '10px', background: 'var(--fill-hover)', padding: '1px 5px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                {c.code}
                              </span>
                              {isActive && (
                                <span style={{ fontSize: '10px', background: '#10b981', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  Active
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Header: "{c.nativeHeader || `Easy ${c.name}`}"
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          {!isActive && (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                              onClick={() => setForm({ ...form, targetLanguage: c.code })}
                            >
                              Set Active
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => openEditCustomLanguage(c)}
                          >
                            ✏️ Edit
                          </button>
                          {deleteConfirmCode === c.code ? (
                            <div style={{ display: 'inline-flex', gap: '3px', alignItems: 'center' }}>
                              <button
                                type="button"
                                style={{ padding: '3px 7px', fontSize: '11px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                onClick={() => handleDeleteCustomLanguage(c.code)}
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                style={{ padding: '3px 6px', fontSize: '11px' }}
                                onClick={() => setDeleteConfirmCode(null)}
                              >
                                ✕
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '3px 8px', fontSize: '11px', color: '#ef4444' }}
                              onClick={() => setDeleteConfirmCode(c.code)}
                              title="Delete custom language"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Excluded Websites (Blacklist) */}
            <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Excluded Websites:
                  </label>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Websites where LexiFlow automatic popup and reading companion are paused
                  </div>
                </div>
              </div>

              {form.disabledSites && form.disabledSites.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                  {form.disabledSites.map((site) => (
                    <span
                      key={site}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        background: 'var(--fill)',
                        border: '1px solid var(--line)',
                        borderRadius: 'var(--r-pill)',
                        fontSize: '12px',
                        color: 'var(--text-main)',
                        fontWeight: 500
                      }}
                    >
                      🌐 {site}
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                          padding: '0 2px',
                          fontSize: '12px',
                          lineHeight: 1
                        }}
                        onClick={() => {
                          const updated = form.disabledSites!.filter((s) => s !== site);
                          setForm({ ...form, disabledSites: updated });
                        }}
                        title={`Re-enable LexiFlow on ${site}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  No websites are currently excluded. You can toggle LexiFlow on/off for any site anytime using the slider in the extension popup.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: AI Provider & Linguistic Intelligence */}
        <div className="card">
          <div className="settings-section-header">
            <div className="settings-section-icon" style={{ color: '#c084fc', background: 'rgba(192, 132, 252, 0.12)' }}>
              <Sparkles size={18} />
            </div>
            <div>
              <h4 className="settings-section-title">AI Provider & Linguistic Intelligence</h4>
              <p className="settings-section-subtitle">Manage cloud AI credentials, model selection, and latency diagnostics</p>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
              Selected AI Provider:
            </label>
            <select
              className="select-filter"
              style={{ width: '100%', height: '40px', fontSize: '13px' }}
              value={form.aiProvider}
              onChange={(e) => {
                const newProvider = e.target.value as UserSettings['aiProvider'];
                const defaultModel = PROVIDER_MODELS[newProvider]?.[0]?.id;
                setForm({
                  ...form,
                  aiProvider: newProvider,
                  selectedModel: defaultModel || form.selectedModel
                });
                setCustomModelMode(false);
              }}
            >
              <option value="lexiflow">LexiFlow Cloud (Sign in, no API key)</option>
              <option value="gemini">Google Gemini (Recommended &amp; Fast)</option>
              <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
              <option value="anthropic">Anthropic Claude (Claude 3.5 Sonnet)</option>
              <option value="ollama">Local Ollama (Self-Hosted LLM)</option>
              <option value="mock">Offline / Rule-Based (No API Key Required)</option>
            </select>
          </div>

          {/* API Key Input */}
          {form.aiProvider !== 'mock' && form.aiProvider !== 'ollama' && form.aiProvider !== 'lexiflow' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  API Key for {form.aiProvider.toUpperCase()}:
                </label>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    fontSize: '11.5px',
                    padding: '4px 12px',
                    color: 'var(--blue)',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    background: 'rgba(56, 189, 248, 0.08)',
                    fontWeight: 700
                  }}
                  disabled={fetchingModels || !form.apiKey?.trim()}
                  onClick={() => loadModels(form.aiProvider, form.apiKey, form.apiEndpoint)}
                >
                  <RefreshCw size={12} className={fetchingModels ? 'spin' : ''} />
                  {fetchingModels ? 'Fetching Models...' : 'Auto-Detect Models'}
                </button>
              </div>

              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="input-search"
                  style={{ width: '100%', height: '42px', paddingRight: form.apiKey ? '70px' : '44px', fontFamily: showApiKey ? 'inherit' : 'monospace', letterSpacing: showApiKey ? 'normal' : '0.1em' }}
                  placeholder={`Paste your ${form.aiProvider.toUpperCase()} API key here...`}
                  value={form.apiKey || ''}
                  onChange={(e) => {
                    const val = e.target.value.trim().replace(/^['"]|['"]$/g, '');
                    setForm({ ...form, apiKey: val });
                  }}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text').trim().replace(/^['"]|['"]$/g, '');
                    if (pasted) {
                      setForm((prev) => ({ ...prev, apiKey: pasted }));
                      loadModels(form.aiProvider, pasted, form.apiEndpoint);
                    }
                  }}
                />

                {form.apiKey && (
                  <button
                    type="button"
                    title="Clear key"
                    style={{
                      position: 'absolute',
                      right: '38px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      padding: '4px'
                    }}
                    onClick={() => setForm({ ...form, apiKey: '' })}
                  >
                    ✕
                  </button>
                )}

                <button
                  type="button"
                  title={showApiKey ? 'Hide key' : 'Show key'}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '7px', flexWrap: 'wrap', gap: '6px' }}>
                <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                  {form.aiProvider === 'gemini' ? (
                    <>
                      🔑 Get your free Gemini API key from{' '}
                      <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--blue)', fontWeight: 600, textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                      >
                        Google AI Studio <ExternalLink size={10} />
                      </a>{' '}
                      (starts with <code>AIzaSy...</code>).
                    </>
                  ) : (
                    '🔒 Stored locally in your Chrome browser profile. Never transmitted to third-party servers.'
                  )}
                </span>
                {fetchingModels && (
                  <span style={{ fontSize: '11px', color: 'var(--blue)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <RefreshCw size={11} className="spin" /> Querying available models...
                  </span>
                )}
              </div>

              {fetchSuccessMsg && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10b981', borderRadius: '8px', fontSize: '12px', color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={14} strokeWidth={2.5} /> {fetchSuccessMsg}
                </div>
              )}

              {fetchErrorMsg && (
                <div style={{ marginTop: '8px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', borderRadius: '8px', fontSize: '12px', color: '#f87171' }}>
                  ⚠️ {fetchErrorMsg}
                </div>
              )}
            </div>
          )}

          {form.aiProvider === 'lexiflow' && (
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {MONETIZATION_ENABLED
                ? 'Uses your LexiFlow Cloud account above: no API key needed, counted against your daily credits. Word lookups and AI chat cost 1 credit, Sentence X-Ray, Word Difference and Usage Coach 2, and paragraph analysis, writing help and page highlights 3. Article analysis runs on this device and is free.'
                : 'Uses your LexiFlow Cloud account above: free, no API key needed. There is a daily limit; longer tasks (Sentence X-Ray, Word Difference, Usage Coach, paragraphs, writing help and page highlights) count more than a word lookup. Article analysis runs on this device and does not count.'}
            </p>
          )}

          {/* Model Selection Dropdown */}
          {form.aiProvider !== 'mock' && form.aiProvider !== 'lexiflow' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    Model for {form.aiProvider.toUpperCase()}:
                  </label>
                  {dynamicModels[form.aiProvider] && dynamicModels[form.aiProvider].length > 0 && (
                    <span style={{ fontSize: '10.5px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '1px 7px', borderRadius: 'var(--r-pill)', fontWeight: 700 }}>
                      ● {dynamicModels[form.aiProvider].length} Models Detected
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--blue)',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}
                  onClick={() => setCustomModelMode(!customModelMode)}
                >
                  {customModelMode ? '← Pick from detected models' : '✎ Enter custom model ID'}
                </button>
              </div>

              {customModelMode ? (
                <div>
                  <input
                    type="text"
                    className="input-search"
                    style={{ width: '100%', height: '42px' }}
                    placeholder={`e.g. ${availableModels[0]?.id || 'custom-model-id'}`}
                    value={form.selectedModel || ''}
                    onChange={(e) => setForm({ ...form, selectedModel: e.target.value })}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Type any custom model identifier supported by your {form.aiProvider} account or endpoint.
                  </span>
                </div>
              ) : (
                <select
                  className="select-filter"
                  style={{ width: '100%', height: '42px', fontSize: '13.5px' }}
                  value={form.selectedModel || availableModels[0]?.id || ''}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCustomModelMode(true);
                    } else {
                      setForm({ ...form, selectedModel: e.target.value });
                    }
                  }}
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                  <option value="__custom__">+ Enter custom model ID...</option>
                </select>
              )}
            </div>
          )}

          {form.aiProvider === 'openai' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                OpenAI Base Endpoint (Optional - e.g. OpenRouter / Proxy):
              </label>
              <input
                type="text"
                className="input-search"
                style={{ width: '100%', height: '42px' }}
                placeholder="https://api.openai.com/v1"
                value={form.apiEndpoint || ''}
                onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
              />
            </div>
          )}

          {form.aiProvider === 'ollama' && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  Ollama Endpoint URL:
                </label>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{
                    fontSize: '11.5px',
                    padding: '3px 10px',
                    color: 'var(--blue)',
                    fontWeight: 600
                  }}
                  disabled={fetchingModels}
                  onClick={() => loadModels('ollama', undefined, form.apiEndpoint || 'http://localhost:11434')}
                >
                  <RefreshCw size={11} className={fetchingModels ? 'spin' : ''} />
                  {fetchingModels ? 'Fetching Models...' : 'Auto-Detect Models'}
                </button>
              </div>
              <input
                type="text"
                className="input-search"
                style={{ width: '100%', height: '42px' }}
                placeholder="http://localhost:11434"
                value={form.apiEndpoint || 'http://localhost:11434'}
                onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
              />
            </div>
          )}

          {/* Test AI Connection Verification */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <strong style={{ fontSize: '13.5px', color: 'var(--text-main)' }}>Verify Connection & Latency:</strong>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Send a lightweight diagnostic probe to verify credentials and response speed with {form.selectedModel || 'the selected model'}.
                </p>
              </div>

              <button
                type="button"
                className="btn-primary"
                style={{
                  padding: '9px 20px',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                disabled={testingConnection || (form.aiProvider !== 'mock' && form.aiProvider !== 'ollama' && form.aiProvider !== 'lexiflow' && !form.apiKey?.trim())}
                onClick={handleTestConnection}
              >
                <Zap size={14} className={testingConnection ? 'spin' : ''} />
                {testingConnection ? 'Testing Connection...' : 'Test AI Connection'}
              </button>
            </div>

            {testResult && (
              <div className={`diagnostic-hud ${testResult.success ? 'success' : 'error'}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontSize: '13.5px',
                      fontWeight: 700,
                      color: testResult.success ? '#34d399' : '#f87171',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      {testResult.success ? <Check size={16} strokeWidth={2.5} /> : '✕'}
                      {testResult.success ? 'Connection Verified' : 'Connection Failed'}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'var(--fill)',
                      border: '1px solid var(--line)',
                      color: 'var(--blue)',
                      fontFamily: 'monospace',
                      fontWeight: 600
                    }}>
                      {testResult.model}
                    </span>
                  </div>

                  <span className={`diagnostic-speed-pill ${testResult.latencyMs < 1000 ? 'fast' : testResult.latencyMs < 2500 ? 'medium' : 'slow'}`}>
                    <Zap size={11} /> {testResult.latencyMs}ms Latency
                  </span>
                </div>

                {testResult.success ? (
                  <div>
                    <div style={{ fontSize: '13px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>Connected successfully to <strong>{testResult.provider.toUpperCase()}</strong>.</span>
                      {testResult.targetLabel && (
                        <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.14)', color: 'var(--blue)', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          Target: {testResult.flagEmoji} {testResult.targetLabel}
                        </span>
                      )}
                    </div>
                    {testResult.sampleResult && (
                      <div className="diagnostic-probe-card">
                        <div className="diagnostic-probe-header">
                          <Sparkles size={11} /> Probe Verification Output
                        </div>
                        <div style={{ color: 'var(--text-main)', fontWeight: 500 }}>
                          {testResult.sampleResult}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: '#f87171', lineHeight: '1.5', fontWeight: 600, marginTop: '6px' }}>
                    {testResult.error || 'Connection failed.'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 3: Daily Spaced Repetition Limits */}
        <div className="card">
          <div className="settings-section-header">
            <div className="settings-section-icon" style={{ color: '#fbbf24', background: 'rgba(251, 191, 36, 0.12)' }}>
              <RotateCw size={18} />
            </div>
            <div>
              <h4 className="settings-section-title">Daily Spaced Repetition (FSRS)</h4>
              <p className="settings-section-subtitle">Configure vocabulary review pacing and daily acquisition goals</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--fill)', border: '1px solid var(--line)' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                Daily New Words Target:
              </label>
              <input
                type="number"
                min="1"
                max="100"
                className="input-search"
                style={{ width: '100%', height: '40px', fontSize: '14px' }}
                value={form.dailyNewLimit}
                onChange={(e) => setForm({ ...form, dailyNewLimit: Number(e.target.value) })}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Recommended: 10–20 new cards per day
              </span>
            </div>

            <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--fill)', border: '1px solid var(--line)' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                Daily Review Limit:
              </label>
              <input
                type="number"
                min="5"
                max="500"
                className="input-search"
                style={{ width: '100%', height: '40px', fontSize: '14px' }}
                value={form.dailyReviewLimit}
                onChange={(e) => setForm({ ...form, dailyReviewLimit: Number(e.target.value) })}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Caps pending review session size
              </span>
            </div>
          </div>
        </div>

        {/* Minimal Event Telemetry & Privacy Card */}
        <div className="card" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                Minimal Event Telemetry &amp; Privacy
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                LexiFlow tracks strictly 5 approved lifecycle events with daily aggregate counters. No URLs, page text, words, or personal content are ever stored.
              </p>
            </div>
            {telemetryInfo && (
              <div style={{ textAlign: 'right', fontSize: '12px', color: 'var(--text-muted)' }}>
                <div><strong>{telemetryInfo.rawCount}</strong> events recorded</div>
                <div style={{ fontSize: '11px' }}><strong>{telemetryInfo.daysCount}</strong> active pilot days</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={handleExportTelemetry}
            >
              <Download size={13} />
              <span>Export Telemetry Logs</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={handleExportFeedbackReports}
            >
              <FileText size={13} />
              <span>Export Feedback Reports</span>
              {feedbackReportsCount > 0 && (
                <span style={{ fontSize: '11px', background: 'rgba(0, 113, 227, 0.12)', color: 'var(--blue)', padding: '1px 6px', borderRadius: '10px' }}>
                  {feedbackReportsCount}
                </span>
              )}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={handleClearTelemetry}
            >
              <Trash2 size={13} />
              <span>Clear Event Logs</span>
            </button>
            <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
              Exported as clean JSON blobs without tracking page URLs.
            </span>
          </div>
        </div>

        {/* Floating / Sticky Save Bar */}
        <div className="sticky-save-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="submit" className="btn-primary" style={{ padding: '9px 26px', fontSize: '13.5px' }}>
              <Check size={16} strokeWidth={2.5} /> Save All Changes
            </button>
            {status && (
              <span style={{ color: '#10b981', fontSize: '13px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <Check size={14} strokeWidth={3} /> {status}
              </span>
            )}
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Instant auto-sync with extension background service
          </span>
        </div>
      </form>

      {/* Add / Edit Custom Language Modal */}
      {customModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{
            width: '560px',
            maxWidth: '92vw',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.22)',
            padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
                  {editingLangCode ? '✏️ Edit Custom Language' : '➕ Add Custom Language'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Define any language or dialect. LexiFlow AI will adapt all prompts to generate explanations in this language.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '12px' }}
                onClick={() => setCustomModalOpen(false)}
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div style={{ marginBottom: '14px', padding: '8px 12px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '6px', color: '#b91c1c', fontSize: '12.5px' }}>
                ⚠️ {modalError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Row 1: Language Name & Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Language Name (English) *
                  </label>
                  <input
                    type="text"
                    className="input-search"
                    style={{ width: '100%' }}
                    placeholder="e.g. Turkish, Sylheti, Swahili"
                    value={customName}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Language Code (ISO/Short) *
                  </label>
                  <input
                    type="text"
                    className="input-search"
                    style={{ width: '100%' }}
                    placeholder="e.g. tr, syl, sw"
                    disabled={Boolean(editingLangCode)}
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  />
                </div>
              </div>

              {/* Row 2: Native Script & Header Label */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Native Name / Script
                  </label>
                  <input
                    type="text"
                    className="input-search"
                    style={{ width: '100%' }}
                    placeholder="e.g. Türkçe, Kiswahili"
                    value={customNativeName}
                    onChange={(e) => setCustomNativeName(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                    Popup Header Label
                  </label>
                  <input
                    type="text"
                    className="input-search"
                    style={{ width: '100%' }}
                    placeholder="e.g. Kolay Türkçe, Easy Swahili"
                    value={customNativeHeader}
                    onChange={(e) => setCustomNativeHeader(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 3: Flag Emoji / Icon */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' }}>
                  Flag Emoji or Icon
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input-search"
                    style={{ width: '70px', textAlign: 'center', fontSize: '18px' }}
                    value={customEmoji}
                    onChange={(e) => setCustomEmoji(e.target.value)}
                  />
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {['🌐', '🇹🇷', '🇧🇷', '🇷🇺', '🇰🇷', '🇮🇹', '🇻🇳', '🇮🇩', '🇵🇱', '🇳🇱', '🇸🇪', '🇬🇷', '🇹🇭', '🇺🇦', '🇰🇪', '🇵🇭', '🇮🇳', '🇵🇰', '🏛️'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        style={{
                          background: customEmoji === emoji ? 'rgba(0, 113, 227, 0.2)' : 'rgba(0, 0, 0, 0.04)',
                          border: `1px solid ${customEmoji === emoji ? '#0071e3' : 'transparent'}`,
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '14px',
                          cursor: 'pointer'
                        }}
                        onClick={() => setCustomEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Live Preview Box */}
              <div style={{ padding: '12px', background: 'rgba(0, 0, 0, 0.03)', borderRadius: '8px', border: '1px dashed rgba(0, 113, 227, 0.35)' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                  Live Preview in LexiFlow Popup:
                </div>
                <div style={{ padding: '8px 12px', background: 'rgba(0, 113, 227, 0.08)', borderLeft: '3px solid #0071e3', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#0071e3', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ background: 'rgba(0, 113, 227, 0.18)', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>
                      {customEmoji || '🌐'} {customNativeName || customName || 'Language'}
                    </span>
                    <span>{customNativeHeader || `Easy ${customName || 'Language'}`}:</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-main)', marginTop: '4px', fontStyle: 'italic' }}>
                    "{customName ? `Natural, easy explanation written in ${customName}...` : 'Explanation in your target language...'}"
                  </div>
                </div>
              </div>

              {/* Advanced Prompt Guidance (Collapsible) */}
              <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '10px' }}>
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0071e3',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  onClick={() => setShowAdvancedPrompt(!showAdvancedPrompt)}
                >
                  <span>{showAdvancedPrompt ? '▼' : '▶'}</span>
                  <span>Advanced AI Tutor Prompt Guidance (Optional)</span>
                </button>

                {showAdvancedPrompt && (
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Tutor Persona / Role:
                      </label>
                      <input
                        type="text"
                        className="input-search"
                        style={{ width: '100%', fontSize: '12px' }}
                        placeholder={`elite bilingual linguistic tutor specializing in immediate reading comprehension for ESL ${customName || 'speakers'}`}
                        value={customTutorRole}
                        onChange={(e) => setCustomTutorRole(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Target Instruction for AI:
                      </label>
                      <textarea
                        className="input-search"
                        style={{ width: '100%', height: '60px', fontSize: '12px', lineHeight: '1.4' }}
                        placeholder={`Natural, clear everyday ${customName || 'Language'} explanation written in ${customNativeName || customName || 'native script'}.`}
                        value={customPromptInstruction}
                        onChange={(e) => setCustomPromptInstruction(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid rgba(0, 0, 0, 0.08)' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setCustomModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontWeight: 600 }}
                onClick={() => handleSaveCustomLanguage(false)}
              >
                Save Language
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ fontWeight: 600 }}
                onClick={() => handleSaveCustomLanguage(true)}
              >
                Save & Set as Active
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
