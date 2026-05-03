/**
 * PIXEL SEO/GEO — Platform API Integration Layer
 *
 * Real API calls to check AI visibility across platforms.
 * Each platform checks its env var — if missing, returns null (unavailable).
 *
 * Env vars:
 *   GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX  — Google Custom Search (SEO + AI Overview)
 *   OPENAI_API_KEY                              — ChatGPT
 *   ANTHROPIC_API_KEY                           — Claude
 *   PERPLEXITY_API_KEY                          — Perplexity
 *   GEMINI_API_KEY                              — Google Gemini
 */

export interface PlatformQueryResult {
  found: boolean;
  position?: number;
  snippet?: string;
  confidence: number;
  scanMode: 'real' | 'unavailable';
  raw?: any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasEnv(key: string): boolean {
  return !!(process.env[key] && process.env[key]!.trim().length > 5);
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(tid);
    return res;
  } catch (err) {
    clearTimeout(tid);
    throw err;
  }
}

// ── Google Custom Search (SEO + AI Overview) ──────────────────────────────────

export function isGoogleAvailable(): boolean {
  return hasEnv('GOOGLE_SEARCH_API_KEY') && hasEnv('GOOGLE_SEARCH_CX');
}

export async function queryGoogle(query: string, targetDomain: string): Promise<PlatformQueryResult> {
  if (!isGoogleAvailable()) return { found: false, confidence: 0, scanMode: 'unavailable' };

  try {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY!;
    const cx = process.env.GOOGLE_SEARCH_CX!;
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=10`;

    const res = await fetchWithTimeout(url, { method: 'GET' });
    if (!res.ok) return { found: false, confidence: 0, scanMode: 'real' };

    const data = await res.json();
    const items = data.items || [];

    const domain = targetDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    let position = -1;
    let snippet = '';

    for (let i = 0; i < items.length; i++) {
      const link = (items[i].link || '').toLowerCase();
      if (link.includes(domain)) {
        position = i + 1;
        snippet = items[i].snippet || items[i].title || '';
        break;
      }
    }

    return {
      found: position > 0,
      position: position > 0 ? position : undefined,
      snippet: snippet || undefined,
      confidence: position > 0 ? Math.max(100 - (position - 1) * 10, 30) : 0,
      scanMode: 'real',
      raw: { totalResults: data.searchInformation?.totalResults, itemCount: items.length },
    };
  } catch {
    return { found: false, confidence: 0, scanMode: 'real' };
  }
}

// ── OpenAI / ChatGPT ──────────────────────────────────────────────────────────

export function isChatGPTAvailable(): boolean {
  return hasEnv('OPENAI_API_KEY');
}

export async function queryChatGPT(query: string, businessName: string): Promise<PlatformQueryResult> {
  if (!isChatGPTAvailable()) return { found: false, confidence: 0, scanMode: 'unavailable' };

  try {
    const apiKey = process.env.OPENAI_API_KEY!;
    const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a helpful assistant. Answer concisely.' },
          { role: 'user', content: query },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    }, 15000);

    if (!res.ok) return { found: false, confidence: 0, scanMode: 'real' };

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || '';
    const nameLower = businessName.toLowerCase();
    const found = answer.toLowerCase().includes(nameLower);

    return {
      found,
      snippet: answer.slice(0, 200),
      confidence: found ? 80 : 10,
      scanMode: 'real',
    };
  } catch {
    return { found: false, confidence: 0, scanMode: 'real' };
  }
}

// ── Anthropic / Claude ────────────────────────────────────────────────────────

export function isClaudeAvailable(): boolean {
  return hasEnv('ANTHROPIC_API_KEY');
}

export async function queryClaude(query: string, businessName: string): Promise<PlatformQueryResult> {
  if (!isClaudeAvailable()) return { found: false, confidence: 0, scanMode: 'unavailable' };

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY!;
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: query }],
      }),
    }, 15000);

    if (!res.ok) return { found: false, confidence: 0, scanMode: 'real' };

    const data = await res.json();
    const answer = data.content?.[0]?.text || '';
    const nameLower = businessName.toLowerCase();
    const found = answer.toLowerCase().includes(nameLower);

    return {
      found,
      snippet: answer.slice(0, 200),
      confidence: found ? 80 : 10,
      scanMode: 'real',
    };
  } catch {
    return { found: false, confidence: 0, scanMode: 'real' };
  }
}

// ── Perplexity ────────────────────────────────────────────────────────────────

export function isPerplexityAvailable(): boolean {
  return hasEnv('PERPLEXITY_API_KEY');
}

export async function queryPerplexity(query: string, businessName: string): Promise<PlatformQueryResult> {
  if (!isPerplexityAvailable()) return { found: false, confidence: 0, scanMode: 'unavailable' };

  try {
    const apiKey = process.env.PERPLEXITY_API_KEY!;
    const res = await fetchWithTimeout('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [{ role: 'user', content: query }],
        max_tokens: 300,
      }),
    }, 15000);

    if (!res.ok) return { found: false, confidence: 0, scanMode: 'real' };

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || '';
    const nameLower = businessName.toLowerCase();
    const found = answer.toLowerCase().includes(nameLower);

    return {
      found,
      snippet: answer.slice(0, 200),
      confidence: found ? 85 : 10,
      scanMode: 'real',
    };
  } catch {
    return { found: false, confidence: 0, scanMode: 'real' };
  }
}

// ── Google Gemini ─────────────────────────────────────────────────────────────

export function isGeminiAvailable(): boolean {
  return hasEnv('GEMINI_API_KEY');
}

export async function queryGemini(query: string, businessName: string): Promise<PlatformQueryResult> {
  if (!isGeminiAvailable()) return { found: false, confidence: 0, scanMode: 'unavailable' };

  try {
    const apiKey = process.env.GEMINI_API_KEY!;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        generationConfig: { maxOutputTokens: 300, temperature: 0.3 },
      }),
    }, 15000);

    if (!res.ok) return { found: false, confidence: 0, scanMode: 'real' };

    const data = await res.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const nameLower = businessName.toLowerCase();
    const found = answer.toLowerCase().includes(nameLower);

    return {
      found,
      snippet: answer.slice(0, 200),
      confidence: found ? 80 : 10,
      scanMode: 'real',
    };
  } catch {
    return { found: false, confidence: 0, scanMode: 'real' };
  }
}

// ── Unified Platform Check ────────────────────────────────────────────────────

export type PlatformId = 'google_seo' | 'google_ai_overview' | 'gemini' | 'chatgpt' | 'claude' | 'perplexity';

export function isPlatformAvailable(platformId: PlatformId): boolean {
  switch (platformId) {
    case 'google_seo': return isGoogleAvailable();
    case 'google_ai_overview': return isGoogleAvailable();
    case 'gemini': return isGeminiAvailable();
    case 'chatgpt': return isChatGPTAvailable();
    case 'claude': return isClaudeAvailable();
    case 'perplexity': return isPerplexityAvailable();
    default: return false;
  }
}

export async function queryPlatform(
  platformId: PlatformId,
  query: string,
  businessName: string,
  targetDomain: string,
): Promise<PlatformQueryResult> {
  switch (platformId) {
    case 'google_seo': return queryGoogle(query, targetDomain);
    case 'google_ai_overview': return queryGoogle(query, targetDomain); // same API, different intent
    case 'gemini': return queryGemini(query, businessName);
    case 'chatgpt': return queryChatGPT(query, businessName);
    case 'claude': return queryClaude(query, businessName);
    case 'perplexity': return queryPerplexity(query, businessName);
    default: return { found: false, confidence: 0, scanMode: 'unavailable' };
  }
}

/**
 * Returns a summary of which platforms have API keys configured.
 */
export function getApiStatus(): Record<PlatformId, boolean> {
  return {
    google_seo: isGoogleAvailable(),
    google_ai_overview: isGoogleAvailable(),
    gemini: isGeminiAvailable(),
    chatgpt: isChatGPTAvailable(),
    claude: isClaudeAvailable(),
    perplexity: isPerplexityAvailable(),
  };
}
