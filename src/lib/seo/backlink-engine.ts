/**
 * Backlink Intelligence & Outreach Engine
 * AI-powered backlink prospecting, pitch generation, and campaign management
 * All user-facing text in Hebrew
 */

import OpenAI from 'openai';
import { backlinkCampaigns, backlinkTargets } from '@/lib/db/collections';

// ── Interfaces ────────────────────────────────────────────────────────────────

export type OutreachType = 'guest_post' | 'resource_link' | 'broken_link' | 'pr' | 'directory' | 'partnership';
export type TargetStatus = 'prospect' | 'contacted' | 'responded' | 'secured' | 'rejected' | 'lost';
export type CampaignType = 'guest_post' | 'pr' | 'broken_link' | 'resource' | 'directory';
export type CampaignStatus = 'active' | 'paused' | 'completed';

export interface BacklinkTarget {
  id: string;
  campaignId: string;
  clientId: string;
  targetDomain: string;
  targetUrl?: string;
  contactEmail?: string;
  domainAuthority: number;
  relevanceScore: number;
  outreachType: OutreachType;
  status: TargetStatus;
  pitchTemplate?: string;
  notes?: string;
  createdAt: string;
  lastContactedAt?: string;
}

export interface BacklinkCampaign {
  id: string;
  clientId: string;
  name: string;
  type: CampaignType;
  targets: string[]; // target IDs
  totalProspects: number;
  contacted: number;
  secured: number;
  status: CampaignStatus;
  niche: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

export interface OutreachPitch {
  subject: string;
  body: string;
  followUp: string;
  targetDomain: string;
  angle: string;
}

// ── OpenAI Client ──────��──────────────────────────────────────────────────────

function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('חסר OPENAI_API_KEY בהגדרות הסביבה');
  }
  return new OpenAI({ apiKey });
}

// ── Core Functions ────────────────────────────────��───────────────────────────

/**
 * Generate AI-powered list of potential backlink targets
 */
export async function generateOutreachTargets(
  clientId: string,
  niche: string,
  keywords: string[]
): Promise<BacklinkTarget[]> {
  const openai = getOpenAI();

  const prompt = `אתה מומחה SEO ובניית קישורים. צור רשימה של 15 אתרים פוטנציאליים לבניית קישורים (backlinks) עבור עסק בתחום: "${niche}".
מילות מפתח: ${keywords.join(', ')}.

עבור כל אתר, ספק:
1. שם הדומיין (דומיין ישראלי או בינלאומי רלוונטי)
2. סוג הפנייה (guest_post / resource_link / broken_link / pr / directory / partnership)
3. ציון רלוונטיות (1-100)
4. DA משוער (1-100)
5. הערות קצרות

החזר JSON array בפורמט:
[{"domain": "example.co.il", "type": "guest_post", "relevance": 85, "da": 45, "notes": "בלוג טכנולוגי פעיל"}]

התמקד באתרים אמיתיים ורלוונטיים לשוק הישראלי.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{"targets":[]}';
    const parsed = JSON.parse(content);
    const rawTargets = parsed.targets || parsed || [];

    const targets: BacklinkTarget[] = [];
    for (const t of Array.isArray(rawTargets) ? rawTargets : []) {
      const target: Omit<BacklinkTarget, 'id'> = {
        campaignId: '',
        clientId,
        targetDomain: t.domain || t.targetDomain || '',
        targetUrl: t.url || undefined,
        contactEmail: t.email || undefined,
        domainAuthority: t.da || t.domainAuthority || 30,
        relevanceScore: t.relevance || t.relevanceScore || 50,
        outreachType: t.type || 'resource_link',
        status: 'prospect',
        notes: t.notes || '',
        createdAt: new Date().toISOString(),
      };
      if (target.targetDomain) {
        const created = await backlinkTargets.createAsync(target as any);
        targets.push(created as unknown as BacklinkTarget);
      }
    }

    return targets;
  } catch (error) {
    console.error('[Backlink Engine] generateOutreachTargets error:', error);
    throw new Error(`שגיאה ביצירת רשימת יעדים: ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`);
  }
}

/**
 * Generate personalized guest post pitch
 */
export async function generateGuestPostPitches(
  clientId: string,
  targetSite: string,
  topic: string
): Promise<OutreachPitch> {
  const openai = getOpenAI();

  const prompt = `אתה מומחה אאוטריץ' ובניית קישורים. צור פיץ' מקצועי לפוסט אורח.

אתר היעד: ${targetSite}
נושא מוצע: ${topic}

צור אימייל אאוטריץ' שכולל:
1. נושא (subject) - קצר ומושך
2. גוף ההודעה (body) - מקצועי, אישי, עם ערך ברור לאתר היעד
3. הודעת פולואפ (followUp) - עדינה ומכבדת
4. הזווית/ערך (angle) - למה כדאי להם לפרסם

כתוב באנגלית מקצועית (לאאוטריץ' בינלאומי).
החזר JSON: {"subject": "", "body": "", "followUp": "", "angle": ""}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      subject: parsed.subject || '',
      body: parsed.body || '',
      followUp: parsed.followUp || '',
      targetDomain: targetSite,
      angle: parsed.angle || '',
    };
  } catch (error) {
    console.error('[Backlink Engine] generateGuestPostPitches error:', error);
    throw new Error(`שגיאה ביצירת פיץ': ${error instanceof Error ? error.message : 'שגיאה לא ידועה'}`);
  }
}

/**
 * Generate PR content / press release
 */
export async function generatePRContent(
  clientId: string,
  newsAngle: string
): Promise<{ headline: string; subheadline: string; body: string; boilerplate: string }> {
  const openai = getOpenAI();

  const prompt = `צור הודעה לעיתונות (Press Release) מקצועית בעברית.

הזווית החדשותית: ${newsAngle}

החזר JSON:
{
  "headline": "כותרת ראשית חזקה",
  "subheadline": "כותרת משנה",
  "body": "גוף ההודעה - 3-4 פסקאות מקצועיות",
  "boilerplate": "פסקת 'אודות' קצרה"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    return JSON.parse(content);
  } catch (error) {
    console.error('[Backlink Engine] generatePRContent error:', error);
    throw new Error(`שגיאה ביצירת תוכן PR: ${error instanceof Error ? error.message : 'שגיאה לא יד��עה'}`);
  }
}

/**
 * Track backlinks for a domain using Serper API
 */
export async function trackBacklinks(
  domain: string
): Promise<Array<{ source: string; anchor: string; url: string }>> {
  const serperKey = process.env.SERPER_API_KEY;

  if (!serperKey) {
    // Return empty if no API key — feature degrades gracefully
    console.warn('[Backlink Engine] SERPER_API_KEY לא מוגדר — מדלג על בדיקת קישורים');
    return [];
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': serperKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: `link:${domain}`,
        num: 50,
      }),
    });

    if (!response.ok) {
      console.error('[Backlink Engine] Serper API error:', response.status);
      return [];
    }

    const data = await response.json();
    const organic = data.organic || [];

    return organic.map((result: { link: string; title: string; snippet: string }) => ({
      source: new URL(result.link).hostname,
      anchor: result.title || '',
      url: result.link,
    }));
  } catch (error) {
    console.error('[Backlink Engine] trackBacklinks error:', error);
    return [];
  }
}

/**
 * Analyze competitor backlink sources
 */
export async function analyzeCompetitorBacklinks(
  competitorDomain: string
): Promise<Array<{ source: string; anchor: string; url: string; opportunity: string }>> {
  const backlinks = await trackBacklinks(competitorDomain);

  const openai = getOpenAI();
  if (backlinks.length === 0) {
    return [];
  }

  try {
    const prompt = `אני מנתח את הקישורים הנכנסים של המתחרה ${competitorDomain}.
הנה רשימת מקורות הקישורים שמצאתי:
${backlinks.slice(0, 20).map((b) => `- ${b.source}: ${b.anchor}`).join('\n')}

עבור כל מקור, הצע הזדמנות פוטנציאלית לקבלת קישור (באנגלית קצרה).
החזר JSON array: [{"source": "", "anchor": "", "url": "", "opportunity": ""}]`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{"results":[]}';
    const parsed = JSON.parse(content);
    return parsed.results || parsed || [];
  } catch (error) {
    console.error('[Backlink Engine] analyzeCompetitorBacklinks error:', error);
    return backlinks.map((b) => ({ ...b, opportunity: 'לא זמין' }));
  }
}

/**
 * Find broken link building opportunities
 */
export async function generateBrokenLinkOpportunities(
  niche: string
): Promise<Array<{ targetPage: string; brokenUrl: string; suggestedReplacement: string; outreachNote: string }>> {
  const openai = getOpenAI();

  const prompt = `אתה מומחה בבניית קישורים דרך קישורים שבורים (Broken Link Building).
תחום: ${niche}

צור רשימה של 10 הזדמנויות פוטנציאליות לבניית קישורים דרך קישורים שבורים.
עבור כל הזדמנות ספק:
1. דף היעד (URL של דף עם קישור שבור)
2. הקישור השבור (מה שהיה שם)
3. תוכן חלופי מוצע (מה אנחנו נציע במקום)
4. הערת אאוטריץ' (איך לפנות)

החזר JSON: {"opportunities": [{"targetPage": "", "brokenUrl": "", "suggestedReplacement": "", "outreachNote": ""}]}`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{"opportunities":[]}';
    const parsed = JSON.parse(content);
    return parsed.opportunities || [];
  } catch (error) {
    console.error('[Backlink Engine] generateBrokenLinkOpportunities error:', error);
    throw new Error(`שגיאה באיתור הזדמנויות קישורים שבורים: ${error instanceof Error ? error.message : 'שגיאה'}`);
  }
}

/**
 * Estimate domain authority score
 */
export async function scoreDomainAuthority(
  domain: string
): Promise<{ domain: string; estimatedDA: number; factors: string[] }> {
  // Use Serper to check presence and estimate
  const serperKey = process.env.SERPER_API_KEY;

  let indexedPages = 0;
  if (serperKey) {
    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': serperKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: `site:${domain}`, num: 1 }),
      });

      if (response.ok) {
        const data = await response.json();
        indexedPages = data.searchInformation?.totalResults
          ? parseInt(data.searchInformation.totalResults)
          : 0;
      }
    } catch {
      // Non-fatal
    }
  }

  // Estimate DA based on indexed pages (rough heuristic)
  let estimatedDA: number;
  const factors: string[] = [];

  if (indexedPages > 100000) {
    estimatedDA = 70 + Math.min(20, Math.floor(Math.log10(indexedPages) * 5));
    factors.push('אתר גדול עם נוכחות משמעותית');
  } else if (indexedPages > 10000) {
    estimatedDA = 50 + Math.floor(Math.log10(indexedPages) * 5);
    factors.push('אתר בינוני עם תוכן נרחב');
  } else if (indexedPages > 1000) {
    estimatedDA = 30 + Math.floor(Math.log10(indexedPages) * 5);
    factors.push('אתר פעיל');
  } else if (indexedPages > 100) {
    estimatedDA = 20 + Math.floor(indexedPages / 50);
    factors.push('אתר קטן-בינוני');
  } else {
    estimatedDA = Math.max(10, Math.floor(indexedPages / 5));
    factors.push('אתר קטן או חדש');
  }

  factors.push(`~${indexedPages.toLocaleString()} דפים מאונדקסים`);

  return { domain, estimatedDA: Math.min(95, estimatedDA), factors };
}

// ── Campaign Management ───────────────────────────────────────────────────────

/**
 * Create a new outreach campaign with AI-generated targets
 */
export async function createCampaign(
  clientId: string,
  name: string,
  type: CampaignType,
  niche: string,
  keywords: string[]
): Promise<BacklinkCampaign> {
  // Generate targets
  const targets = await generateOutreachTargets(clientId, niche, keywords);

  const campaign: Omit<BacklinkCampaign, 'id'> = {
    clientId,
    name,
    type,
    targets: targets.map((t) => t.id),
    totalProspects: targets.length,
    contacted: 0,
    secured: 0,
    status: 'active',
    niche,
    keywords,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const created = await backlinkCampaigns.createAsync(campaign as any);

  // Update targets with campaign ID
  for (const target of targets) {
    await backlinkTargets.updateAsync(target.id, { campaignId: created.id } as any);
  }

  return created as unknown as BacklinkCampaign;
}

/**
 * Get all campaigns for a client
 */
export async function getCampaignsForClient(clientId: string): Promise<BacklinkCampaign[]> {
  const all = await backlinkCampaigns.getAllAsync();
  return (all as unknown as BacklinkCampaign[]).filter((c) => c.clientId === clientId);
}

/**
 * Get all targets for a campaign
 */
export async function getTargetsForCampaign(campaignId: string): Promise<BacklinkTarget[]> {
  const all = await backlinkTargets.getAllAsync();
  return (all as unknown as BacklinkTarget[]).filter((t) => t.campaignId === campaignId);
}
