export interface AvailableModel {
  id: string;
  name: string;
  description?: string;
}

export async function fetchProviderModels(
  provider: string,
  apiKey?: string,
  endpoint?: string
): Promise<AvailableModel[]> {
  if (provider === 'gemini') {
    if (!apiKey?.trim()) return [];
    const cleanKey = apiKey.trim().replace(/^['"]|['"]$/g, '');
    const isOAuthToken = cleanKey.startsWith('ya29.');

    const url = isOAuthToken
      ? `https://generativelanguage.googleapis.com/v1beta/models`
      : `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(cleanKey)}`;

    const headers: Record<string, string> = {};
    if (isOAuthToken) {
      headers['Authorization'] = `Bearer ${cleanKey}`;
    } else {
      headers['x-goog-api-key'] = cleanKey;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = await res.text();
      let msg = err;
      try {
        const parsed = JSON.parse(err);
        if (parsed.error?.message) msg = parsed.error.message;
      } catch {
        // ignore
      }
      throw new Error(`Failed to fetch Gemini models (${res.status}): ${msg}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.models)) return [];

    const models: AvailableModel[] = data.models
      .filter((m: any) => {
        const methods = m.supportedGenerationMethods || [];
        return methods.includes('generateContent');
      })
      .map((m: any) => {
        const cleanId = (m.name || '').replace(/^models\//, '');
        const displayName = m.displayName || cleanId;
        return {
          id: cleanId,
          name: `${displayName} (${cleanId})`,
          description: m.description
        };
      });

    // Sort to place modern flash & pro models at the top
    models.sort((a, b) => {
      const priority = (id: string) => {
        if (id === 'gemini-2.0-flash') return 1;
        if (id === 'gemini-2.5-flash') return 2;
        if (id.startsWith('gemini-2.0')) return 3;
        if (id.startsWith('gemini-2.5')) return 4;
        if (id === 'gemini-1.5-pro') return 5;
        if (id.startsWith('gemini-1.5')) return 6;
        return 10;
      };
      return priority(a.id) - priority(b.id);
    });

    return models;
  }

  if (provider === 'openai') {
    if (!apiKey?.trim()) return [];
    const baseUrl = (endpoint?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const url = `${baseUrl}/models`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`
      }
    });
    if (!res.ok) {
      const err = await res.text();
      let msg = err;
      try {
        const parsed = JSON.parse(err);
        if (parsed.error?.message) msg = parsed.error.message;
      } catch {
        // ignore
      }
      throw new Error(`Failed to fetch OpenAI models (${res.status}): ${msg}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.data)) return [];

    const models: AvailableModel[] = data.data
      .filter((m: any) => {
        const id = m.id || '';
        return (
          id.startsWith('gpt-4') ||
          id.startsWith('gpt-3.5') ||
          id.startsWith('o1') ||
          id.startsWith('o3') ||
          id.includes('chat')
        );
      })
      .map((m: any) => ({
        id: m.id,
        name: m.id
      }))
      .sort((a: AvailableModel, b: AvailableModel) => a.id.localeCompare(b.id));

    return models;
  }

  if (provider === 'ollama') {
    const baseUrl = (endpoint?.trim() || 'http://localhost:11434').replace(/\/+$/, '');
    const url = `${baseUrl}/api/tags`;
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      throw new Error('Ollama is not running. Open the Ollama app and try again.');
    }

    if (!res.ok) {
      if (res.status === 401) {
        throw new Error('Run `ollama signin` in a terminal (only needed for -cloud models).');
      }
      if (res.status === 403) {
        throw new Error('Ollama blocked the request.');
      }
      const err = await res.text().catch(() => '');
      throw new Error(`Failed to fetch Ollama models (${res.status}): ${err || res.statusText}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.models)) return [];

    return data.models.map((m: any) => ({
      id: m.name,
      name: `${m.name} (${Math.round((m.size || 0) / (1024 * 1024))} MB)`
    }));
  }

  return [];
}
