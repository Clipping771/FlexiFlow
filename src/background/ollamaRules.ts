/**
 * DeclarativeNetRequest Dynamic Rules for Local Ollama Server
 * 
 * Sets the request Origin to "http://localhost:11434" for requests to:
 * - http://localhost:11434/*
 * - http://127.0.0.1:11434/*
 * 
 * Bypasses Ollama's 403 Forbidden origin check without requiring normal users
 * to configure OLLAMA_ORIGINS or run terminal commands.
 */

export const OLLAMA_RULE_IDS = [11434, 11435];

export async function setupOllamaOriginRules(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.declarativeNetRequest) {
    return;
  }

  try {
    const rules: chrome.declarativeNetRequest.Rule[] = [
      {
        id: 11434,
        priority: 1,
        action: {
          type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
          requestHeaders: [
            {
              header: 'Origin',
              operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
              value: 'http://localhost:11434'
            }
          ]
        },
        condition: {
          urlFilter: 'http://localhost:11434/*',
          resourceTypes: ['xmlhttprequest' as chrome.declarativeNetRequest.ResourceType]
        }
      },
      {
        id: 11435,
        priority: 1,
        action: {
          type: 'modifyHeaders' as chrome.declarativeNetRequest.RuleActionType,
          requestHeaders: [
            {
              header: 'Origin',
              operation: 'set' as chrome.declarativeNetRequest.HeaderOperation,
              value: 'http://localhost:11434'
            }
          ]
        },
        condition: {
          urlFilter: 'http://127.0.0.1:11434/*',
          resourceTypes: ['xmlhttprequest' as chrome.declarativeNetRequest.ResourceType]
        }
      }
    ];

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: OLLAMA_RULE_IDS,
      addRules: rules
    });
    console.debug('[LexiFlow] Ollama Origin declarativeNetRequest rules registered successfully.');
  } catch (err) {
    console.warn('[LexiFlow] Failed to register Ollama declarativeNetRequest dynamic rules:', err);
  }
}
