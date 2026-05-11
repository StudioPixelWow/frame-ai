/**
 * PIXEL SEO/GEO — Platform API Integration Layer
 *
 * Real API calls to check AI visibility across platforms.
 * Each platform checks its env var — if missing, returns null (unavailable).
 *
 * Env vars:
 *   SERPER_API_KEY                               — Serper.dev (real Google SERP results)
 *   GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_CX  — Google Custom Search (fallback)
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
  responseText?: string;       // Full AI response text (not truncated)
  sources?: { url: string; domain: string; title?: string }[];  // Extracted URLs from response
  mentionType?: 'in_text' | 'in_sources' | 'both' | 'none';    // Where business was mentioned
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function hasEnv(key: string): boolean {
  return !!(process.env[key] && process.env[key]!.trim().length > 5);
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
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

/**
 * Smart matching — checks if a business is mentioned in an AI response.
 * Handles Hebrew names, domain names, partial matches, and HTML entities.
 */
/**
 * ANTI-FAKE: Checks if the query itself contains the business name.
 * If the query contains the name, the AI will naturally echo it back — that's NOT real visibility.
 * Real visibility = AI independently recommends the business for a GENERIC query.
 */
function queryContainsBusinessName(query: string, businessName: string, targetDomain?: string): boolean {
  const qLower = query.toLowerCase().replace(/["""''׳״]/g, '');
  const nameLower = businessName.toLowerCase().replace(/["""''׳״]/g, '');

  // Direct name match in query
  if (nameLower.length > 3 && qLower.includes(nameLower)) return true;

  // Domain name match in query
  if (targetDomain) {
    const domainName = targetDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0].toLowerCase();
    if (domainName.length > 3 && qLower.includes(domainName)) return true;
  }

  // Major words of business name appear in query (skip common Hebrew words)
  const commonWords = new Set(['של', 'את', 'על', 'עם', 'או', 'גם', 'לא', 'כל', 'זה', 'הוא', 'היא', 'אני', 'and', 'the', 'for', 'in', 'to', 'of', 'is', 'a', 'an']);
  const nameWords = nameLower.split(/[\s\-_]+/).filter(w => w.length > 2 && !commonWords.has(w));
  if (nameWords.length >= 2) {
    const matchedWords = nameWords.filter(w => qLower.includes(w));
    if (matchedWords.length >= Math.ceil(nameWords.length * 0.5)) return true;
  }

  return false;
}

function isBusinessMentioned(answer: string, businessName: string, targetDomain?: string, queryText?: string): { found: boolean; confidence: number } {
  const answerLower = answer.toLowerCase().replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const cleanName = businessName.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/"/g, '"');
  const nameLower = cleanName.toLowerCase();

  // Check if query contains the business name — but DON'T auto-reject.
  // Only use this as a signal to require slightly stronger evidence.
  const queryHasName = queryText ? queryContainsBusinessName(queryText, businessName, targetDomain) : false;

  // Domain match — strongest signal, always counts
  if (targetDomain) {
    const domain = targetDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    const domainNoWww = domain.replace(/^www\./, '');
    if (answerLower.includes(domain) || answerLower.includes(domainNoWww)) {
      console.log(`[AI-MATCH] Domain found in response: ${domainNoWww}`);
      return { found: true, confidence: 90 };
    }
    // Check just the domain name part (e.g., "alram" from "alram.co.il")
    const domainName = domainNoWww.split('.')[0];
    if (domainName.length > 3 && answerLower.includes(domainName)) {
      console.log(`[AI-MATCH] Domain name "${domainName}" found in response`);
      return { found: true, confidence: 75 };
    }
  }

  // Exact name match
  if (answerLower.includes(nameLower)) {
    console.log(`[AI-MATCH] Exact business name found: "${nameLower}"`);
    if (queryHasName) {
      // Query contained the name — check for knowledge signals to raise confidence
      const hasUrl = targetDomain && answerLower.includes(targetDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase());
      const hasContact = /\d{2,3}[-\s]?\d{7}/.test(answer) || /phone|טלפון|כתובת|address/.test(answerLower);
      const hasRecommendation = /recommend|ממליץ|מומלץ|מובי[לל]|מוביל|quality|איכות|professional|מקצועי/.test(answerLower);
      if (hasUrl || hasContact) return { found: true, confidence: 85 };
      if (hasRecommendation) return { found: true, confidence: 70 };
      // Name mentioned but query had it — still count but lower confidence
      return { found: true, confidence: 45 };
    }
    return { found: true, confidence: 90 };
  }

  // Try without quotes (Hebrew abbreviation marks like נדל"ן → נדלן)
  const nameNoQuotes = nameLower.replace(/["""''׳״]/g, '');
  const answerNoQuotes = answerLower.replace(/["""''׳״]/g, '');
  if (nameNoQuotes.length > 3 && answerNoQuotes.includes(nameNoQuotes)) {
    console.log(`[AI-MATCH] Name without quotes found: "${nameNoQuotes}"`);
    return { found: true, confidence: queryHasName ? 50 : 85 };
  }

  // Partial match — try each word of the business name (skip short/common words)
  const nameWords = nameLower.split(/[\s\-_]+/).filter(w => w.length > 2);
  if (nameWords.length >= 2) {
    const matchedWords = nameWords.filter(w => answerLower.includes(w));
    if (matchedWords.length >= Math.ceil(nameWords.length * 0.6)) {
      console.log(`[AI-MATCH] Partial match: ${matchedWords.length}/${nameWords.length} words`);
      return { found: true, confidence: queryHasName ? 35 : 60 };
    }
  }

  console.log(`[AI-MATCH] NOT found. Business: "${nameLower}", Domain: ${targetDomain || 'none'}`);
  return { found: false, confidence: 0 };
}

/**
 * Extract source URLs from AI response text
 */
function extractSourceUrls(text: string): { url: string; domain: string; title?: string }[] {
  const urls: { url: string; domain: string; title?: string }[] = [];
  const seen = new Set<string>();
  // Match URLs in text
  const urlRegex = /https?:\/\/[^\s\)\]\},<>"]+/gi;
  const matches = text.match(urlRegex) || [];
  for (const rawUrl of matches) {
    const url = rawUrl.replace(/[.\,;:]+$/, ''); // trim trailing punctuation
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname.replace(/^www\./, '');
      if (!seen.has(domain)) {
        seen.add(domain);
        urls.push({ url, domain });
      }
    } catch {}
  }
  // Also match domain patterns without protocol (e.g., "playit.org.il")
  const domainRegex = /\b([a-z0-9][-a-z0-9]*\.(?:com|co\.il|org\.il|net\.il|ac\.il|org|net|io|ai|dev|app|info|biz|me))\b/gi;
  const domainMatches = text.match(domainRegex) || [];
  for (const domain of domainMatches) {
    const clean = domain.toLowerCase();
    if (!seen.has(clean)) {
      seen.add(clean);
      urls.push({ url: `https://${clean}`, domain: clean });
    }
  }
  return urls;
}

/**
 * Determine where the business was mentioned in the response
 */
function determineMentionType(
  responseText: string,
  sources: { url: string; domain: string }[],
  businessName: string,
  targetDomain?: string
): 'in_text' | 'in_sources' | 'both' | 'none' {
  const textLower = responseText.toLowerCase();
  const nameLower = businessName.toLowerCase();
  const domainClean = targetDomain?.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase() || '';
  const domainShort = domainClean.replace(/^www\./, '').split('.')[0];

  // Check if mentioned in the body text (name or domain)
  const inText = textLower.includes(nameLower) ||
    (domainShort.length > 3 && textLower.includes(domainShort)) ||
    (domainClean && textLower.includes(domainClean));

  // Check if mentioned in extracted source URLs
  const inSources = sources.some(s => {
    const sDomain = s.domain.toLowerCase();
    return (domainClean && sDomain.includes(domainClean.replace(/^www\./, ''))) ||
           (domainShort.length > 3 && sDomain.includes(domainShort));
  });

  if (inText && inSources) return 'both';
  if (inText) return 'in_text';
  if (inSources) return 'in_sources';
  return 'none';
}

// ── Google Search (SEO + AI Overview) ──────────────────────────────────────────

export function isGoogleAvailable(): boolean {
  return hasEnv('SERPER_API_KEY') || (hasEnv('GOOGLE_SEARCH_API_KEY') && hasEnv('GOOGLE_SEARCH_CX'));
}

/**
 * Serper.dev — returns REAL Google organic search results as JSON.
 * Unlike Custom Search API (different index) or SERP scraping (blocked by Google from cloud IPs),
 * Serper gives actual organic rankings.
 */
async function querySerper(query: string, targetDomain: string): Promise<PlatformQueryResult> {
  if (!hasEnv('SERPER_API_KEY')) return { found: false, confidence: 0, scanMode: 'unavailable' };

  try {
    const res = await fetchWithTimeout('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'il',
        hl: 'he',
        num: 20,
      }),
    }, 12000);

    if (!res.ok) {
      console.error(`[SERPER] HTTP ${res.status} for "${query}"`);
      return { found: false, confidence: 0, scanMode: 'real' };
    }

    const data = await res.json();
    const organic = data.organic || [];

    const domain = targetDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    const domainNoWww = domain.replace(/^www\./, '');

    console.log(`[SERPER] Query: "${query}" — ${organic.length} organic results, looking for domain: ${domainNoWww}`);

    for (let i = 0; i < organic.length; i++) {
      const link = (organic[i].link || '').toLowerCase();
      const resultDomain = (organic[i].domain || '').toLowerCase();
      if (link.includes(domainNoWww) || resultDomain.includes(domainNoWww)) {
        const position = typeof organic[i].position === 'number' ? organic[i].position : (i + 1);
        console.log(`[SERPER] FOUND at position ${position}: ${link}`);
        return {
          found: true,
          position,
          snippet: organic[i].snippet || organic[i].title || '',
          confidence: Math.max(100 - (position - 1) * 5, 30),
          scanMode: 'real',
        };
      }
    }

    // Also check knowledge graph and answer box
    const knowledgeGraph = data.knowledgeGraph;
    if (knowledgeGraph) {
      const kgStr = JSON.stringify(knowledgeGraph).toLowerCase();
      if (kgStr.includes(domainNoWww)) {
        console.log(`[SERPER] Found in Knowledge Graph for "${query}"`);
        return { found: true, position: 1, snippet: 'Knowledge Graph', confidence: 95, scanMode: 'real' };
      }
    }

    console.log(`[SERPER] NOT found for "${query}" in ${organic.length} results`);
    return { found: false, confidence: 0, scanMode: 'real' };
  } catch (err) {
    console.error('[SERPER] Error:', err);
    return { found: false, confidence: 0, scanMode: 'real' };
  }
}

/**
 * Extract domain from a URL link
 */
function extractDomainFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname || url;
  } catch {
    return url;
  }
}

/**
 * Direct Google SERP scraping — fetches google.co.il and parses HTML results
 * This gives REAL organic rankings, unlike Custom Search API which is a different engine.
 */
async function scrapeGoogleSerp(query: string, targetDomain: string): Promise<PlatformQueryResult> {
  try {
    const searchUrl = `https://www.google.co.il/search?q=${encodeURIComponent(query)}&num=20&hl=he&gl=il`;
    const res = await fetchWithTimeout(searchUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    }, 10000);

    if (!res.ok) {
      console.log(`[GOOGLE-SERP] HTTP ${res.status} for query: ${query}`);
      return { found: false, confidence: 0, scanMode: 'real' };
    }

    const html = await res.text();

    // Clean the target domain for matching
    const domain = targetDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    const domainNoWww = domain.replace(/^www\./, '');

    // Extract all result links from Google SERP HTML
    // Google results are in <a href="..."> tags, we look for ones containing our domain
    const linkRegex = /href="(https?:\/\/[^"]+)"/gi;
    const allLinks: string[] = [];
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const link = match[1].toLowerCase();
      // Skip Google's own links
      if (link.includes('google.') || link.includes('gstatic.') || link.includes('youtube.com/results') || link.includes('accounts.google')) continue;
      // Skip duplicate tracking URLs
      if (link.startsWith('https://www.google.co.il/url?') || link.startsWith('/url?')) continue;
      allLinks.push(link);
    }

    // Also check <cite> tags which contain displayed URLs
    const citeRegex = /<cite[^>]*>([^<]+)<\/cite>/gi;
    const citeUrls: string[] = [];
    while ((match = citeRegex.exec(html)) !== null) {
      citeUrls.push(match[1].toLowerCase().replace(/<[^>]+>/g, '').trim());
    }

    // Find position of our domain
    let position = -1;
    let snippet = '';
    let posCounter = 0;

    // Method 1: Check organic result divs - look for data-header-feature="0" or class="g"
    const resultDivRegex = /<div class="[^"]*\bg\b[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;
    const resultBlocks = html.match(resultDivRegex) || [];

    for (const block of resultBlocks) {
      posCounter++;
      const blockLower = block.toLowerCase();
      if (blockLower.includes(domain) || blockLower.includes(domainNoWww)) {
        position = posCounter;
        // Try to extract snippet
        const snippetMatch = block.match(/<span[^>]*class="[^"]*"[^>]*>([^<]{20,})/i);
        snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim().slice(0, 200) : '';
        break;
      }
    }

    // Method 2: If method 1 didn't find it, check all links
    if (position === -1) {
      const uniqueLinks = [...new Set(allLinks)];
      for (let i = 0; i < uniqueLinks.length; i++) {
        if (uniqueLinks[i].includes(domain) || uniqueLinks[i].includes(domainNoWww)) {
          position = i + 1; // approximate position
          break;
        }
      }
    }

    // Method 3: Check cite tags
    if (position === -1) {
      for (let i = 0; i < citeUrls.length; i++) {
        if (citeUrls[i].includes(domainNoWww)) {
          position = i + 1;
          break;
        }
      }
    }

    // Method 4: Simple text check — does the domain appear anywhere in the SERP?
    const htmlLower = html.toLowerCase();
    const domainInSerp = htmlLower.includes(domainNoWww);

    if (position > 0) {
      return {
        found: true,
        position,
        snippet: snippet || undefined,
        confidence: Math.max(100 - (position - 1) * 5, 30),
        scanMode: 'real',
      };
    } else if (domainInSerp) {
      // Domain appears somewhere but we couldn't determine exact position
      return {
        found: true,
        position: undefined,
        snippet: `הדומיין ${domainNoWww} מופיע בתוצאות`,
        confidence: 50,
        scanMode: 'real',
      };
    }

    return { found: false, confidence: 0, scanMode: 'real' };
  } catch (err) {
    console.error('[GOOGLE-SERP] Scrape error:', err);
    return { found: false, confidence: 0, scanMode: 'real' };
  }
}

export async function queryGoogle(query: string, targetDomain: string): Promise<PlatformQueryResult> {
  console.log(`[GOOGLE-CHECK] Starting for "${query}" | domain: ${targetDomain}`);

  // Priority 1: Serper.dev — real Google organic results
  if (hasEnv('SERPER_API_KEY')) {
    const serperResult = await querySerper(query, targetDomain);
    if (serperResult.scanMode !== 'unavailable') {
      console.log(`[GOOGLE-CHECK] Serper result: found=${serperResult.found}, pos=${serperResult.position}`);
      return serperResult;
    }
  }

  // Priority 2: Google Custom Search API (different index, less accurate)
  if (hasEnv('GOOGLE_SEARCH_API_KEY') && hasEnv('GOOGLE_SEARCH_CX')) {
    try {
      const apiKey = process.env.GOOGLE_SEARCH_API_KEY!;
      const cx = process.env.GOOGLE_SEARCH_CX!;
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=10&gl=il&hl=he`;

      const res = await fetchWithTimeout(url, { method: 'GET' });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];

        const domain = targetDomain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
        let position = -1;
        let snippet = '';

        for (let i = 0; i < items.length; i++) {
          const link = (items[i].link || '').toLowerCase();
          if (link.includes(domain) || link.includes(domain.replace(/^www\./, ''))) {
            position = i + 1;
            snippet = items[i].snippet || items[i].title || '';
            break;
          }
        }

        if (position > 0) {
          console.log(`[GOOGLE-CHECK] CSE found at position ${position}`);
          return {
            found: true,
            position,
            snippet: snippet || undefined,
            confidence: Math.max(100 - (position - 1) * 10, 30),
            scanMode: 'real',
          };
        }
      }
    } catch (e) {
      console.log('[GOOGLE-CHECK] Custom Search failed, trying SERP scrape');
    }
  }

  // Priority 3: Direct SERP scraping (often blocked from cloud IPs)
  console.log('[GOOGLE-CHECK] Falling back to SERP scraping (may fail from cloud)');
  return scrapeGoogleSerp(query, targetDomain);
}

// ── OpenAI / ChatGPT ──────────────────────────────────────────────────────────

export function isChatGPTAvailable(): boolean {
  return hasEnv('OPENAI_API_KEY');
}

export async function queryChatGPT(query: string, businessName: string, targetDomain?: string, _queryText?: string): Promise<PlatformQueryResult> {
  if (!isChatGPTAvailable()) return { found: false, confidence: 0, scanMode: 'unavailable' };

  console.log(`[CHATGPT] Querying: "${query}" | business: "${businessName}" | domain: ${targetDomain}`);
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
          { role: 'system', content: 'You are a helpful assistant. Answer concisely. When recommending businesses or services, mention specific names.' },
          { role: 'user', content: query },
        ],
        max_tokens: 400,
        temperature: 0.3,
      }),
    }, 15000);

    if (!res.ok) return { found: false, confidence: 0, scanMode: 'real' };

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || '';
    console.log(`[CHATGPT] Response (${answer.length} chars): ${answer.slice(0, 150)}...`);
    const match = isBusinessMentioned(answer, businessName, targetDomain, query);
    const sources = extractSourceUrls(answer);
    const mentionType = determineMentionType(answer, sources, businessName, targetDomain);
    console.log(`[CHATGPT] Result: found=${match.found}, confidence=${match.confidence}, mentionType=${mentionType}`);

    return {
      found: match.found,
      snippet: answer.slice(0, 300),
      responseText: answer,
      sources,
      mentionType,
      confidence: match.confidence,
      scanMode: 'real',
    };
  } catch (e) {
    console.error('[CHATGPT] Error:', e);
    return { found: false, confidence: 0, scanMode: 'real' };
  }
}

// ── Anthropic / Claude ────────────────────────────────────────────────────────

export function isClaudeAvailable(): boolean {
  return hasEnv('ANTHROPIC_API_KEY');
}

export async function queryClaude(query: string, businessName: string, targetDomain?: string): Promise<PlatformQueryResult> {
  if (!isClaudeAvailable()) return { found: false, confidence: 0, scanMode: 'unavailable' };

  console.log(`[CLAUDE] Querying: "${query}" | business: "${businessName}"`);
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
        max_tokens: 400,
        messages: [{ role: 'user', content: query }],
      }),
    }, 15000);

    if (!res.ok) return { found: false, confidence: 0, scanMode: 'real' };

    const data = await res.json();
    const answer = data.content?.[0]?.text || '';
    console.log(`[CLAUDE] Response (${answer.length} chars): ${answer.slice(0, 150)}...`);
    const match = isBusinessMentioned(answer, businessName, targetDomain, query);
    const sources = extractSourceUrls(answer);
    const mentionType = determineMentionType(answer, sources, businessName, targetDomain);
    console.log(`[CLAUDE] Result: found=${match.found}, confidence=${match.confidence}`);

    return {
      found: match.found,
      snippet: answer.slice(0, 300),
      responseText: answer,
      sources,
      mentionType,
      confidence: match.confidence,
      scanMode: 'real',
    };
  } catch (e) {
    console.error('[CLAUDE] Error:', e);
    return { found: false, confidence: 0, scanMode: 'real' };
  }
}

// ── Perplexity ────────────────────────────────────────────────────────────────

export function isPerplexityAvailable(): boolean {
  return hasEnv('PERPLEXITY_API_KEY');
}

export async function queryPerplexity(query: string, businessName: string, targetDomain?: string): Promise<PlatformQueryResult> {
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
        max_tokens: 400,
      }),
    }, 15000);

    if (!res.ok) return { found: false, confidence: 0, scanMode: 'real' };

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || '';
    const citations = Array.isArray(data.citations) ? data.citations : [];
    const match = isBusinessMentioned(answer, businessName, targetDomain, query);
    const sources = extractSourceUrls(answer);
    // Add Perplexity citations that aren't already in sources
    for (const citUrl of citations) {
      try {
        const parsed = new URL(citUrl);
        const domain = parsed.hostname.replace(/^www\./, '');
        if (!sources.find(s => s.domain === domain)) {
          sources.push({ url: citUrl, domain });
        }
      } catch {}
    }
    const mentionType = determineMentionType(answer, sources, businessName, targetDomain);

    return {
      found: match.found,
      snippet: answer.slice(0, 300),
      responseText: answer,
      sources,
      mentionType,
      confidence: match.confidence,
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

export async function queryGemini(query: string, businessName: string, targetDomain?: string): Promise<PlatformQueryResult> {
  if (!isGeminiAvailable()) return { found: false, confidence: 0, scanMode: 'unavailable' };

  try {
    const apiKey = process.env.GEMINI_API_KEY!;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: query }] }],
        generationConfig: { maxOutputTokens: 400, temperature: 0.3 },
      }),
    }, 15000);

    if (!res.ok) return { found: false, confidence: 0, scanMode: 'real' };

    const data = await res.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const match = isBusinessMentioned(answer, businessName, targetDomain, query);
    const sources = extractSourceUrls(answer);
    const mentionType = determineMentionType(answer, sources, businessName, targetDomain);

    return {
      found: match.found,
      snippet: answer.slice(0, 300),
      responseText: answer,
      sources,
      mentionType,
      confidence: match.confidence,
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
    case 'gemini': return queryGemini(query, businessName, targetDomain);
    case 'chatgpt': return queryChatGPT(query, businessName, targetDomain);
    case 'claude': return queryClaude(query, businessName, targetDomain);
    case 'perplexity': return queryPerplexity(query, businessName, targetDomain);
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
