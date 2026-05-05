import { NextRequest, NextResponse } from 'next/server';
import { isGSCAvailable } from '@/lib/seo/gsc-api';
import { isSerpAvailable, getSerpProvider } from '@/lib/seo/serp-api';
import { isPlatformAvailable } from '@/lib/seo/platform-apis';

const INTEGRATIONS = [
  {
    id: 'gsc',
    name: 'Google Search Console',
    nameHe: 'Google Search Console',
    description: 'נתוני חיפוש אמיתיים — שאילתות, הופעות, קליקים, מיקום',
    envVars: ['GSC_SERVICE_ACCOUNT_JSON', 'GSC_ACCESS_TOKEN'],
    category: 'search',
    impact: 'critical',
  },
  {
    id: 'serp',
    name: 'SERP API',
    nameHe: 'SERP API (DataForSEO / SerpAPI)',
    description: 'דירוגים אמיתיים בגוגל — מיקום, מתחרים, snippets',
    envVars: ['DATAFORSEO_LOGIN+DATAFORSEO_PASSWORD', 'SERPAPI_KEY'],
    category: 'search',
    impact: 'high',
  },
  {
    id: 'openai',
    name: 'OpenAI (ChatGPT)',
    nameHe: 'ChatGPT',
    description: 'בדיקת נראות ב-ChatGPT',
    envVars: ['OPENAI_API_KEY'],
    category: 'ai',
    impact: 'medium',
  },
  {
    id: 'anthropic',
    name: 'Anthropic (Claude)',
    nameHe: 'Claude',
    description: 'בדיקת נראות ב-Claude',
    envVars: ['ANTHROPIC_API_KEY'],
    category: 'ai',
    impact: 'medium',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    nameHe: 'Gemini',
    description: 'בדיקת נראות ב-Gemini',
    envVars: ['GEMINI_API_KEY'],
    category: 'ai',
    impact: 'medium',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    nameHe: 'Perplexity',
    description: 'בדיקת נראות ב-Perplexity',
    envVars: ['PERPLEXITY_API_KEY'],
    category: 'ai',
    impact: 'medium',
  },
  {
    id: 'google_search',
    name: 'Google Custom Search',
    nameHe: 'Google Custom Search',
    description: 'חיפוש גוגל מתוכנת — AI Overview ותוצאות',
    envVars: ['GOOGLE_SEARCH_API_KEY+GOOGLE_SEARCH_CX'],
    category: 'search',
    impact: 'high',
  },
] as const;

export async function GET(req: NextRequest) {
  const results = INTEGRATIONS.map(integration => {
    let connected = false;

    switch (integration.id) {
      case 'gsc':
        connected = isGSCAvailable();
        break;
      case 'serp':
        connected = isSerpAvailable();
        break;
      case 'openai':
        connected = isPlatformAvailable('chatgpt' as any);
        break;
      case 'anthropic':
        connected = isPlatformAvailable('claude' as any);
        break;
      case 'gemini':
        connected = isPlatformAvailable('gemini' as any);
        break;
      case 'perplexity':
        connected = isPlatformAvailable('perplexity' as any);
        break;
      case 'google_search':
        connected = !!(process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CX);
        break;
    }

    return {
      ...integration,
      connected,
      status: connected ? 'active' : 'not_configured',
      statusLabel: connected ? 'מחובר' : 'לא מוגדר',
    };
  });

  const connectedCount = results.filter(r => r.connected).length;
  const totalCount = results.length;
  const serpProvider = getSerpProvider();

  return NextResponse.json({
    integrations: results,
    summary: {
      connected: connectedCount,
      total: totalCount,
      percentage: Math.round((connectedCount / totalCount) * 100),
      serpProvider,
      message: connectedCount === 0
        ? 'אין חיבורים מוגדרים — הנתונים יהיו חלקיים'
        : connectedCount < 3
        ? 'חלק מהחיבורים חסרים — חלק מהנתונים לא יהיו זמינים'
        : 'רוב החיבורים פעילים — הנתונים יהיו מלאים',
    },
  });
}
