import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupOllamaOriginRules, OLLAMA_RULE_IDS } from '../ollamaRules';

describe('declarativeNetRequest Ollama Origin dynamic rules', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('registers dynamic rules for localhost and 127.0.0.1 with Origin header set', async () => {
    const updateDynamicRulesMock = vi.fn().mockResolvedValue(undefined);
    (global as any).chrome = {
      declarativeNetRequest: {
        updateDynamicRules: updateDynamicRulesMock
      }
    };

    await setupOllamaOriginRules();

    expect(updateDynamicRulesMock).toHaveBeenCalledTimes(1);
    const callArgs = updateDynamicRulesMock.mock.calls[0][0];
    expect(callArgs.removeRuleIds).toEqual(OLLAMA_RULE_IDS);
    expect(callArgs.addRules).toHaveLength(2);

    const ruleLocalhost = callArgs.addRules.find((r: any) => r.id === 11434);
    expect(ruleLocalhost.condition.urlFilter).toBe('http://localhost:11434/*');
    expect(ruleLocalhost.action.type).toBe('modifyHeaders');
    expect(ruleLocalhost.action.requestHeaders[0]).toEqual({
      header: 'Origin',
      operation: 'set',
      value: 'http://localhost:11434'
    });

    const rule127 = callArgs.addRules.find((r: any) => r.id === 11435);
    expect(rule127.condition.urlFilter).toBe('http://127.0.0.1:11434/*');
    expect(rule127.action.requestHeaders[0].value).toBe('http://localhost:11434');
  });

  it('gracefully handles missing chrome.declarativeNetRequest', async () => {
    (global as any).chrome = {};
    await expect(setupOllamaOriginRules()).resolves.not.toThrow();
  });
});
