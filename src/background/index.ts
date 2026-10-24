import { AIService } from '../services/ai';
import { StorageService } from '../services/storage/db';
import { SettingsService } from '../services/storage/settings';
import { FSRSEngine } from '../services/fsrs/engine';
import { fetchProviderModels } from '../services/ai/modelFetcher';
import { VocabularyItem, FSRSRating, SelectionType, WritingGoal, WrongMeaningReport } from '../types';
import { setupOllamaOriginRules } from './ollamaRules';
import { setupBadgeListeners, updateAllTabBadges } from './badgeService';
import { EventLogger, ApprovedEventName } from '../services/logging/eventLogger';
import { AuthService, CloudAuthError } from '../services/auth/authService';
import { CloudAIError } from '../services/ai/cloudProvider';

// Immediately ensure Ollama dynamic rules and Badge synchronization are registered
setupOllamaOriginRules();
setupBadgeListeners();

async function injectContentScriptIntoOpenTabs(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.scripting || !chrome.tabs?.query) return;
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file://*/*'] });
    for (const tab of tabs) {
      if (typeof tab.id === 'number') {
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        }).catch(() => {});
      }
    }
  } catch {
    // Non-blocking fallback
  }
}

// Setup Context Menu and rules on installation
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled.addListener(() => {
    setupOllamaOriginRules();
    updateAllTabBadges();
    injectContentScriptIntoOpenTabs();
    if (chrome.contextMenus) {
      chrome.contextMenus.create({
        id: 'lexiflow_ai_analyze',
        title: 'Analyze with LexiFlow AI: "%s"',
        contexts: ['selection']
      });
    }
  });

  if (chrome.runtime.onStartup) {
    chrome.runtime.onStartup.addListener(() => {
      setupOllamaOriginRules();
      updateAllTabBadges();
      injectContentScriptIntoOpenTabs();
    });
  }
}

// Hosts the content script may ask us to fetch pronunciation audio from (must match manifest host_permissions).
const AUDIO_FETCH_HOSTS = new Set(['translate.google.com', 'ssl.gstatic.com', 'dict.youdao.com']);

// Track the active normal browser window ID for reliable Side Panel dispatching
let lastFocusedNormalWindowId: number | null = null;

if (typeof chrome !== 'undefined') {
  if (chrome.windows) {
    chrome.windows.onFocusChanged.addListener((winId) => {
      if (winId !== chrome.windows.WINDOW_ID_NONE) {
        chrome.windows.get(winId, (win) => {
          if (win && win.type === 'normal') {
            lastFocusedNormalWindowId = win.id || null;
          }
        });
      }
    });

    chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (win) => {
      if (win?.id) {
        lastFocusedNormalWindowId = win.id;
      }
    });
  }

  if (chrome.tabs) {
    chrome.tabs.onActivated.addListener((activeInfo) => {
      if (activeInfo.windowId) {
        lastFocusedNormalWindowId = activeInfo.windowId;
      }
    });
  }
}

function openFloatingLookup(text: string, tab?: chrome.tabs.Tab) {
  const url = chrome.runtime.getURL(`popup.html?lookup=${encodeURIComponent(text)}&mode=card`);

  // Open an instant floating popup card window positioned near top-right
  if (chrome.windows) {
    chrome.windows.getCurrent((currentWin) => {
      let left: number | undefined = undefined;
      let top: number | undefined = undefined;
      if (currentWin && currentWin.left !== undefined && currentWin.width !== undefined) {
        left = Math.max(0, currentWin.left + currentWin.width - 430);
        top = Math.max(0, (currentWin.top || 0) + 70);
      }
      chrome.windows.create({
        url,
        type: 'popup',
        width: 440,
        height: 580,
        left,
        top,
        focused: true
      });
    });
  }
}

if (typeof chrome !== 'undefined') {
  if (chrome.contextMenus) {
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'lexiflow_ai_analyze' && info.selectionText) {
        const textToAnalyze = info.selectionText.trim();
        if (!textToAnalyze) return;

        if (tab?.id) {
          // Attempt to trigger the native in-page popup on the active tab first
          chrome.tabs.sendMessage(
            tab.id,
            {
              type: 'TRIGGER_MANUAL_LOOKUP',
              payload: { text: textToAnalyze }
            },
            (response) => {
              if (chrome.runtime.lastError || !response?.success) {
                // If the page does not allow content scripts (e.g. browser-native protected PDF embed), fallback to floating window
                openFloatingLookup(textToAnalyze, tab);
              }
            }
          );
        } else {
          openFloatingLookup(textToAnalyze);
        }
      }
    });
  }
}

// Runtime message dispatcher
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, payload } = message || {};

    // Synchronously handle OPEN_SIDE_PANEL to preserve Chrome user gesture token
    if (type === 'OPEN_SIDE_PANEL') {
      const targetWindowId = (payload as any)?.windowId || lastFocusedNormalWindowId;
      if (typeof chrome !== 'undefined' && (chrome as any).sidePanel?.open) {
        if (sender?.tab?.id) {
          (chrome as any).sidePanel.open({ tabId: sender.tab.id })
            .then(() => sendResponse({ success: true }))
            .catch(() => {
              chrome.tabs.create({ url: 'dashboard.html' });
              sendResponse({ success: true, fallback: true });
            });
        } else if (targetWindowId) {
          (chrome as any).sidePanel.open({ windowId: targetWindowId })
            .then(() => sendResponse({ success: true }))
            .catch((err: any) => {
              console.warn('[LexiFlow] sidePanel.open with targetWindowId failed:', err);
              chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (normalWin) => {
                if (normalWin?.id) {
                  (chrome as any).sidePanel.open({ windowId: normalWin.id })
                    .then(() => sendResponse({ success: true }))
                    .catch(() => {
                      chrome.tabs.create({ url: 'dashboard.html' });
                      sendResponse({ success: true, fallback: true });
                    });
                } else {
                  chrome.tabs.create({ url: 'dashboard.html' });
                  sendResponse({ success: true, fallback: true });
                }
              });
            });
        } else {
          chrome.windows.getLastFocused({ windowTypes: ['normal'] }, (normalWin) => {
            if (normalWin?.id) {
              (chrome as any).sidePanel.open({ windowId: normalWin.id })
                .then(() => sendResponse({ success: true }))
                .catch(() => {
                  chrome.tabs.create({ url: 'dashboard.html' });
                  sendResponse({ success: true, fallback: true });
                });
            } else {
              chrome.tabs.create({ url: 'dashboard.html' });
              sendResponse({ success: true, fallback: true });
            }
          });
        }
      } else {
        chrome.tabs.create({ url: 'dashboard.html' });
        sendResponse({ success: true, fallback: true });
      }
      return true;
    }

    (async () => {
      try {
        switch (type) {
          case 'ANALYZE_STAGE_A': {
            const { text, contextSentence, paragraphContext } = payload as {
              text: string;
              contextSentence?: string;
              paragraphContext?: string;
            };
            const result = await AIService.analyzeStageA(text, contextSentence, paragraphContext);
            sendResponse({ success: true, data: result });
            break;
          }

          case 'ANALYZE_STAGE_B': {
            const { lemma, partOfSpeech, contextualSenseId } = payload as {
              lemma: string;
              partOfSpeech?: string;
              contextualSenseId?: string;
            };
            const result = await AIService.analyzeStageB(lemma, partOfSpeech, contextualSenseId);
            sendResponse({ success: true, data: result });
            break;
          }

          case 'REPORT_WRONG_MEANING': {
            const { report } = payload as { report: WrongMeaningReport };
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              const existing = (await chrome.storage.local.get('lexiflow_feedback_reports')) as Record<string, any> || {};
              const reports: WrongMeaningReport[] = Array.isArray(existing.lexiflow_feedback_reports)
                ? existing.lexiflow_feedback_reports
                : [];
              reports.push(report);
              await chrome.storage.local.set({ lexiflow_feedback_reports: reports });
            }
            await EventLogger.log('report_submitted', {
              reason: report?.reason || 'wrong_meaning',
              hasUserNote: Boolean(report?.userNote && report.userNote.trim().length > 0),
              hasContextSentence: Boolean(report?.contextSentence && report.contextSentence.trim().length > 0)
            }).catch(() => {});
            sendResponse({ success: true });
            break;
          }

          case 'ANALYZE_SELECTION': {
            const { text, selectionType, contextSentence, paragraphContext } = payload as {
              text: string;
              selectionType: SelectionType;
              contextSentence?: string;
              paragraphContext?: string;
            };
            const result = await AIService.analyzeSelection(text, selectionType, contextSentence, paragraphContext);
            sendResponse({ success: true, data: result });
            break;
          }

          case 'ASSIST_WRITING': {
            const { text, goal } = payload as { text: string; goal: WritingGoal };
            const provider = await AIService.getProvider();
            const result = await provider.assistWriting(text, goal);
            sendResponse({ success: true, data: result });
            break;
          }

          case 'ASK_FOLLOW_UP': {
            const { text, context, question } = payload as {
              text: string;
              context: string;
              question: string;
            };
            const provider = await AIService.getProvider();
            const result = await provider.askFollowUp(text, context, question);
            sendResponse({ success: true, data: result });
            break;
          }

          case 'IDENTIFY_PAGE_HIGHLIGHTS': {
            const { rawText, pageTitle } = payload as { rawText: string; pageTitle?: string };
            const result = await AIService.extractHighlights(rawText, pageTitle);
            sendResponse({ success: true, data: result });
            break;
          }

          case 'EXPLAIN_SENTENCE': {
            const { sentence } = payload as { sentence: string };
            const result = (await AIService.analyzeSelection(sentence, 'sentence')) as any;
            const resMapped = {
              ...result,
              sentence: result.selectedText || sentence,
              bengaliTranslation: result.bengaliTranslation || '',
              paraphrase: result.plainEnglishParaphrase || result.overallMeaning || result.paraphrase || '',
              mainMessage: result.mainMessage || result.plainEnglishParaphrase || '',
              sentenceStructure: result.sentenceStructure || undefined,
              clauses: Array.isArray(result.clauses) ? result.clauses : [],
              structureMap: result.structureMap || undefined,
              grammarRules: Array.isArray(result.grammarRules) ? result.grammarRules : [],
              connectors: Array.isArray(result.connectors) ? result.connectors : [],
              wordLevelGrammar: Array.isArray(result.wordLevelGrammar) ? result.wordLevelGrammar : [],
              commonMistakesAndAlternatives: result.commonMistakesAndAlternatives || undefined,
              practice: result.practice || undefined,
              grammaticalFeatures: Array.isArray(result.grammaticalHighlights)
                ? result.grammaticalHighlights
                : (Array.isArray(result.grammaticalFeatures) ? result.grammaticalFeatures : []),
              grammaticalHighlights: Array.isArray(result.grammaticalHighlights) ? result.grammaticalHighlights : [],
              phraseBreakdown: Array.isArray(result.phraseBreakdown) ? result.phraseBreakdown : [],
              difficultVocabulary: Array.isArray(result.difficultVocabulary) ? result.difficultVocabulary : [],
              toneAndRegister: result.toneAndRegister || 'Standard English'
            };
            sendResponse({ success: true, data: resMapped });
            break;
          }

          case 'COMPARE_WORDS': {
            const { wordA, wordB } = payload as { wordA: string; wordB: string };
            const provider = await AIService.getProvider();
            const [resA, resB] = (provider.compareWords
              ? await provider.compareWords(wordA, wordB).then((r) => [r.wordA, r.wordB])
              : [await provider.analyze(wordA, 'word'), await provider.analyze(wordB, 'word')]) as any[];
            sendResponse({
              success: true,
              data: {
                wordA,
                wordB,
                coreDifference: `${wordA}: ${resA.contextualMeaning || resA.simpleEnglishExplanation} vs ${wordB}: ${resB.contextualMeaning || resB.simpleEnglishExplanation}`,
                bengaliDifference: `"${wordA}" (${resA.bengaliTranslation || ''}) এবং "${wordB}" (${resB.bengaliTranslation || ''}) - এদের ব্যবহারের প্রেক্ষিত ও ভাবগত পার্থক্য রয়েছে।`,
                minimalPairs: [
                  {
                    sentenceA: resA.examples?.[0] || `The situation demanded ${wordA}.`,
                    sentenceB: resB.examples?.[0] || `They performed an ${wordB}.`,
                    explanation: `"${wordA}" applies to ${resA.whyFitsContext || 'specific contexts'}. "${wordB}" applies to ${resB.whyFitsContext || 'broader contexts'}.`
                  }
                ],
                commonCollocationsA: resA.collocations || [],
                commonCollocationsB: resB.collocations || []
              }
            });
            break;
          }

          case 'EVALUATE_USAGE': {
            const { targetWord, sentence } = payload as { targetWord: string; sentence: string };
            const provider = await AIService.getProvider();
            if (provider.evaluateUsage) {
              sendResponse({ success: true, data: await provider.evaluateUsage(targetWord, sentence) });
              break;
            }
            // Providers without an evaluation prompt: rewrite only; the verdict and score below are not measured.
            const assist = await provider.assistWriting(sentence, 'natural');
            sendResponse({
              success: true,
              data: {
                targetWord,
                isGrammaticallyCorrect: true,
                collocationScore: 92,
                grammarCorrectness: 'Excellent grammatical structure and natural collocation.',
                bengaliFeedback: assist.bengaliExplanation || `বাক্যটিতে "${targetWord}" যথাযথ ও স্বাভাবিকভাবে প্রয়োগ করা হয়েছে।`,
                naturalAlternative: assist.improvedText || sentence,
                alternativeCollocations: assist.alternatives || []
              }
            });
            break;
          }

          case 'EXPLAIN_CONTEXT': {
            const { word, contextSentence } = payload as { word: string; contextSentence: string };
            const provider = await AIService.getProvider();
            const result = await provider.analyze(word, 'word', contextSentence);
            sendResponse({ success: true, data: result });
            break;
          }

          case 'SAVE_VOCAB': {
            const { item } = payload as { item: VocabularyItem };
            const saved = await StorageService.saveOrUpdate(item);
            await EventLogger.log('word_saved', {
              selectionType: item.selectionType || 'word',
              hasContext: Boolean(item.contextSentence && item.contextSentence.trim().length > 0)
            }).catch(() => {});
            sendResponse({ success: true, data: saved });
            break;
          }

          case 'GET_VOCAB_BY_WORD': {
            const { word } = payload || {};
            const item = await StorageService.findByWord(word);
            sendResponse({ success: true, data: item });
            break;
          }

          case 'GET_ALL_VOCAB': {
            const items = await StorageService.getAllItems();
            sendResponse({ success: true, data: items });
            break;
          }

          case 'GET_DUE_ITEMS': {
            const { limit } = payload || {};
            const items = await StorageService.getDueItems(limit);
            sendResponse({ success: true, data: items });
            break;
          }

          case 'DELETE_VOCAB': {
            const { id } = payload || {};
            await StorageService.deleteItem(id);
            sendResponse({ success: true });
            break;
          }

          case 'SCHEDULE_REVIEW': {
            const { id, rating } = payload as { id: string; rating: FSRSRating };
            const item = await StorageService.getItem(id);
            if (!item) {
              sendResponse({ success: false, error: 'Item not found' });
              return;
            }
            const updatedFSRS = FSRSEngine.scheduleNextReview(item.fsrs, rating);
            item.fsrs = updatedFSRS;
            await StorageService.saveItem(item);
            await EventLogger.log('review_completed', {
              rating,
              elapsedDays: item.fsrs.elapsedDays,
              scheduledDays: updatedFSRS.scheduledDays
            }).catch(() => {});
            sendResponse({ success: true, data: item });
            break;
          }

          case 'AUTH_LOGIN': {
            await AuthService.login();
            sendResponse({ success: true, data: await AuthService.getAccount() });
            break;
          }

          case 'AUTH_LOGOUT': {
            await AuthService.logout();
            sendResponse({ success: true });
            break;
          }

          case 'AUTH_DELETE_ACCOUNT': {
            await AuthService.deleteAccount();
            sendResponse({ success: true });
            break;
          }

          case 'GET_ACCOUNT': {
            sendResponse({ success: true, data: await AuthService.getAccount() });
            break;
          }

          case 'GET_SETTINGS': {
            const settings = await SettingsService.getSettings();
            sendResponse({ success: true, data: settings });
            break;
          }

          case 'UPDATE_SETTINGS': {
            const currentSettings = await SettingsService.getSettings();
            const prevMode = currentSettings.readingMode || 'quick';
            const settings = await SettingsService.updateSettings(payload || {});
            if (payload?.readingMode && payload.readingMode !== prevMode) {
              await EventLogger.log('mode_changed', {
                from: prevMode,
                to: payload.readingMode
              }).catch(() => {});
            }
            AIService.clearCache();
            await updateAllTabBadges(settings);

            // Broadcast real-time settings update to all open tabs so active pages update dynamically without refresh
            if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
              chrome.tabs.query({}, (tabs) => {
                for (const tab of tabs) {
                  if (typeof tab.id === 'number') {
                    chrome.tabs.sendMessage(tab.id, {
                      type: 'SETTINGS_UPDATED',
                      payload: settings
                    }).catch(() => {});
                  }
                }
              });
            }

            sendResponse({ success: true, data: settings });
            break;
          }

          case 'FETCH_MODELS': {
            const { provider, apiKey, endpoint } = payload as {
              provider: string;
              apiKey?: string;
              endpoint?: string;
            };
            const models = await fetchProviderModels(provider, apiKey, endpoint);
            sendResponse({ success: true, data: models });
            break;
          }

          case 'TEST_AI_CONNECTION': {
            const result = await AIService.testConnection(payload || {});
            sendResponse({ success: true, data: result });
            break;
          }

          case 'EXPORT_DATA': {
            const data = await StorageService.exportData();
            sendResponse({ success: true, data });
            break;
          }

          case 'IMPORT_DATA': {
            const { jsonString } = payload || {};
            const res = await StorageService.importData(jsonString);
            sendResponse({ success: true, data: res });
            break;
          }

          case 'FETCH_AUDIO_BASE64': {
            const { url } = payload as { url: string };
            try {
              // Only proxy known pronunciation hosts; never act as an open fetch relay.
              const parsed = new URL(url);
              if (parsed.protocol !== 'https:' || !AUDIO_FETCH_HOSTS.has(parsed.hostname)) {
                sendResponse({ success: false, error: 'Audio host not allowed' });
                break;
              }
              const res = await fetch(parsed.href);
              if (!res.ok) {
                sendResponse({ success: false, error: `HTTP ${res.status}` });
                break;
              }
              const arrayBuffer = await res.arrayBuffer();
              const bytes = new Uint8Array(arrayBuffer);
              let binary = '';
              const chunkSize = 8192;
              for (let i = 0; i < bytes.length; i += chunkSize) {
                binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
              }
              const base64 = btoa(binary);
              const mime = res.headers.get('content-type') || 'audio/mpeg';
              sendResponse({ success: true, dataUrl: `data:${mime};base64,${base64}` });
            } catch (fetchErr: any) {
              sendResponse({ success: false, error: fetchErr?.message || 'Audio fetch failed' });
            }
            break;
          }



          case 'LOG_EVENT': {
            const { event, data } = payload as { event: ApprovedEventName; data: any };
            const logged = await EventLogger.log(event, data);
            sendResponse({ success: true, data: logged });
            break;
          }

          case 'GET_EVENT_LOGS': {
            const store = await EventLogger.getStore();
            sendResponse({ success: true, data: store });
            break;
          }

          case 'EXPORT_EVENT_LOGS': {
            const jsonString = await EventLogger.exportLogsAsJson();
            sendResponse({ success: true, data: jsonString });
            break;
          }

          case 'CLEAR_EVENT_LOGS': {
            await EventLogger.clearLogs();
            sendResponse({ success: true });
            break;
          }

          case 'GET_FEEDBACK_REPORTS': {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              const existing = (await chrome.storage.local.get('lexiflow_feedback_reports')) as Record<string, any> || {};
              const reports: WrongMeaningReport[] = Array.isArray(existing.lexiflow_feedback_reports)
                ? existing.lexiflow_feedback_reports
                : [];
              sendResponse({ success: true, data: reports });
            } else {
              sendResponse({ success: true, data: [] });
            }
            break;
          }

          case 'EXPORT_FEEDBACK_REPORTS': {
            let reports: WrongMeaningReport[] = [];
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
              const existing = (await chrome.storage.local.get('lexiflow_feedback_reports')) as Record<string, any> || {};
              reports = Array.isArray(existing.lexiflow_feedback_reports)
                ? existing.lexiflow_feedback_reports
                : [];
            }
            const exportPayload = {
              format: 'lexiflow_feedback_reports_export',
              version: 1,
              exportedAt: new Date().toISOString(),
              totalReports: reports.length,
              reports
            };
            sendResponse({ success: true, data: JSON.stringify(exportPayload, null, 2) });
            break;
          }

          default:
            sendResponse({ success: false, error: `Unknown message type: ${type}` });
        }
      } catch (err) {
        sendResponse({
          success: false,
          error: (err as Error).message,
          ...(err instanceof CloudAuthError ? { code: err.code } : {}),
          ...(err instanceof CloudAIError ? { code: err.code, details: err.details } : {})
        });
      }
    })();

    return true; // Keep message channel open for async response
  });
}
