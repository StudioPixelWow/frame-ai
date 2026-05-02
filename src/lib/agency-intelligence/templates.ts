/**
 * Template System
 *
 * Reusable templates for campaigns, ads, and content.
 * Per-industry defaults + custom templates.
 *
 * Usage:
 * - Campaign Builder → suggest campaign structure
 * - Ad creation → suggest hook + body + CTA
 * - Content planning → suggest video/post ideas
 */

import { createClient } from '@supabase/supabase-js';
import type { CampaignTemplate, AdTemplate, ContentTemplate } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Default Campaign Templates ──

export const DEFAULT_CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: 'ct_real_estate_leads',
    industry: 'real_estate',
    name: 'קמפיין לידים — נדל"ן',
    objective: 'leads',
    structure: '1 קמפיין, 3 אד-סטים (זוגות צעירים / משפחות / משקיעים), 2-3 מודעות לכל אד-סט',
    adSetPresets: [
      { name: 'זוגות צעירים 25-35', targeting: 'גיל 25-35, סטטוס: זוגי/נשוי, עניין בנדל"ן', placement: 'automatic' },
      { name: 'משפחות 30-45', targeting: 'גיל 30-45, הורים, עניין בדירות/שכונות', placement: 'automatic' },
      { name: 'משקיעים 35-55', targeting: 'גיל 35-55, עניין בהשקעות/נדל"ן מניב', placement: 'automatic' },
    ],
    budgetLogic: 'תקציב יומי: ₪150-300. חלוקה שווה בין אד-סטים. העברה לאד-סט מנצח אחרי 3 ימים.',
    notes: 'טופס לידים עם 3-4 שאלות. retargeting אחרי 7 ימים.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ct_restaurants_engagement',
    industry: 'restaurants',
    name: 'קמפיין engagement — מסעדות',
    objective: 'engagement',
    structure: '1 קמפיין, 2 אד-סטים (חובבי אוכל / תושבי אזור), 2 מודעות לכל אד-סט',
    adSetPresets: [
      { name: 'חובבי אוכל', targeting: 'עניין באוכל/מסעדות/בישול, גיל 25-55', placement: 'feed_stories' },
      { name: 'תושבי אזור', targeting: 'רדיוס 15 ק"מ, גיל 25-55', placement: 'feed_stories' },
    ],
    budgetLogic: 'תקציב יומי: ₪50-150. דגש על reach בימי חמישי-שבת.',
    notes: 'וידאו מנות + תמונות איכותיות. CTA להזמנת שולחן.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ct_lawyers_leads',
    industry: 'lawyers',
    name: 'קמפיין לידים — עורכי דין',
    objective: 'leads',
    structure: '1 קמפיין, 3 אד-סטים (נדל"ן / משפחה / פלילי-אזרחי), 2 מודעות לכל אד-סט',
    adSetPresets: [
      { name: 'דיני נדל"ן', targeting: 'גיל 30-60, עניין בנדל"ן/חוזים', placement: 'automatic' },
      { name: 'דיני משפחה', targeting: 'גיל 30-55, אירועי חיים', placement: 'automatic' },
      { name: 'פלילי / אזרחי', targeting: 'גיל 25-60, עניין בזכויות/משפט', placement: 'automatic' },
    ],
    budgetLogic: 'תקציב יומי: ₪200-400. CPL יעד: ₪200. הפסקת אד-סט אחרי ₪600 ללא לידים.',
    notes: 'תוכן ערך (מדריכים, טיפים). CTA לייעוץ ראשוני חינם.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ct_aesthetics_leads',
    industry: 'aesthetics',
    name: 'קמפיין לידים — אסתטיקה',
    objective: 'leads',
    structure: '1 קמפיין, 2 אד-סטים (טיפולי פנים / טיפולי גוף), 2-3 מודעות לכל אד-סט',
    adSetPresets: [
      { name: 'טיפולי פנים', targeting: 'נשים 25-55, עניין ביופי/טיפוח/אסתטיקה', placement: 'feed_stories' },
      { name: 'טיפולי גוף', targeting: 'נשים 25-50, עניין בכושר/דיאטה/טיפוח', placement: 'feed_stories' },
    ],
    budgetLogic: 'תקציב יומי: ₪100-250. CPL יעד: ₪80. דגש על Instagram.',
    notes: 'וידאו before/after + ביקורות. lookalike מלקוחות קיימים.',
    updatedAt: new Date().toISOString(),
  },
];

// ── Default Ad Templates ──

export const DEFAULT_AD_TEMPLATES: AdTemplate[] = [
  {
    id: 'at_real_estate_fear',
    industry: 'real_estate',
    name: 'מודעת פחד מהחמצה — נדל"ן',
    hookText: 'כמה עולה לחכות עוד שנה?',
    bodyText: 'מחירי הדירות עולים כל שנה. הפרויקט החדש ב{אזור} מציע תנאים שלא יחזרו. {מספר} משפחות כבר הצטרפו.',
    ctaText: 'השאירו פרטים — יועץ יחזור אליכם',
    structure: 'image',
    notes: 'תמונת הדמיה של הפרויקט. דגש על מחיר/תנאים.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'at_real_estate_proof',
    industry: 'real_estate',
    name: 'מודעת הוכחה חברתית — נדל"ן',
    hookText: 'איך משפחת כהן חסכה ₪200,000 ברכישת דירה',
    bodyText: 'הם לא ידעו שיש דרך חכמה יותר לקנות דירה. אחרי ייעוץ אחד, הכל השתנה. גם אתם יכולים.',
    ctaText: 'בדקו זכאות',
    structure: 'video',
    notes: 'וידאו testimonial או אנימציה של הסיפור.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'at_restaurants_experience',
    industry: 'restaurants',
    name: 'מודעת חוויה — מסעדות',
    hookText: 'זה לא עוד ארוחה — זו חוויה',
    bodyText: 'המנות שלנו מוכנות מחומרי גלם טריים, עם אהבה ותשומת לב לכל פרט. בואו לגלות את הטעם האמיתי.',
    ctaText: 'הזמינו שולחן',
    structure: 'carousel',
    notes: 'קרוסלה של 3-5 מנות. תמונות מקצועיות.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'at_lawyers_rights',
    industry: 'lawyers',
    name: 'מודעת זכויות — עורכי דין',
    hookText: '5 זכויות שלא ידעת שמגיעות לך',
    bodyText: 'רוב האנשים לא מודעים לזכויות שלהם. עו"ד {שם} מסביר מה מגיע לך ואיך לממש את זה — בלי סיבוכים.',
    ctaText: 'לייעוץ ראשוני חינם',
    structure: 'video',
    notes: 'וידאו קצר של עו"ד מדבר למצלמה. אמין ומקצועי.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'at_aesthetics_before_after',
    industry: 'aesthetics',
    name: 'מודעת לפני/אחרי — אסתטיקה',
    hookText: 'לפני ואחרי — התוצאות מדברות',
    bodyText: 'הטיפול שנותן תוצאות מהיום הראשון. טכנולוגיה מתקדמת, צוות מנוסה, תוצאה טבעית. באישור המטופלת.',
    ctaText: 'בדיקת התאמה חינם',
    structure: 'carousel',
    notes: 'קרוסלה before/after (באישור!). תמונות אמיתיות בלבד.',
    updatedAt: new Date().toISOString(),
  },
];

// ── Default Content Templates ──

export const DEFAULT_CONTENT_TEMPLATES: ContentTemplate[] = [
  {
    id: 'cnt_real_estate_tour',
    industry: 'real_estate',
    name: 'סיור וירטואלי בפרויקט',
    videoIdea: 'סיור 60-90 שניות בדירה לדוגמה עם הסבר על יתרונות הפרויקט',
    hookAngle: 'בואו תראו איפה תגורו — סיור בדירת 4 חדרים ב{פרויקט}',
    format: 'vertical_video',
    notes: 'צילום מקצועי, תנועה חלקה, טקסטים על המסך.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cnt_restaurants_behind',
    industry: 'restaurants',
    name: 'מאחורי הקלעים',
    videoIdea: 'וידאו 30-45 שניות מהמטבח — הכנת המנה הפופולרית ביותר',
    hookAngle: 'איך מכינים את המנה שכולם מזמינים?',
    format: 'reel',
    notes: 'מוזיקה קצבית, קאטים מהירים, close-ups.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cnt_lawyers_tips',
    industry: 'lawyers',
    name: 'טיפ משפטי — Q&A',
    videoIdea: 'עו"ד עונה על שאלה נפוצה ב-60 שניות',
    hookAngle: 'שאלה שכולם שואלים: {שאלה}? עו"ד {שם} עונה',
    format: 'reel',
    notes: 'הוק בשנייה הראשונה. שפה פשוטה. CTA בסוף.',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'cnt_aesthetics_myth',
    industry: 'aesthetics',
    name: 'מיתוסים על טיפולים',
    videoIdea: 'סדרת "אמת או מיתוס" — 3 מיתוסים על טיפול ספציפי',
    hookAngle: '3 דברים שאמרו לך על {טיפול} — ורק אחד מהם נכון',
    format: 'reel',
    notes: 'מומחית מדברת למצלמה. טקסט על המסך. קצר וישיר.',
    updatedAt: new Date().toISOString(),
  },
];

// ── Campaign Template CRUD ──

export async function getCampaignTemplates(industry?: string): Promise<CampaignTemplate[]> {
  try {
    let query = supabase.from('agency_campaign_templates').select('*').order('created_at', { ascending: false });
    if (industry) query = query.eq('industry', industry);
    const { data } = await query;
    if (!data || data.length === 0) {
      return industry ? DEFAULT_CAMPAIGN_TEMPLATES.filter(t => t.industry === industry) : DEFAULT_CAMPAIGN_TEMPLATES;
    }
    return data.map(mapCampaignTemplateRow);
  } catch {
    return industry ? DEFAULT_CAMPAIGN_TEMPLATES.filter(t => t.industry === industry) : DEFAULT_CAMPAIGN_TEMPLATES;
  }
}

export async function saveCampaignTemplate(template: Partial<CampaignTemplate> & { industry: string }): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    await supabase.from('agency_campaign_templates').upsert({
      id: template.id || `ct_${template.industry}_${Date.now()}`,
      industry: template.industry,
      name: template.name || '',
      objective: template.objective || 'leads',
      structure: template.structure || '',
      ad_set_presets: template.adSetPresets || [],
      budget_logic: template.budgetLogic || '',
      notes: template.notes || '',
      updated_at: now,
    });
    return true;
  } catch {
    return false;
  }
}

// ── Ad Template CRUD ──

export async function getAdTemplates(industry?: string): Promise<AdTemplate[]> {
  try {
    let query = supabase.from('agency_ad_templates').select('*').order('created_at', { ascending: false });
    if (industry) query = query.eq('industry', industry);
    const { data } = await query;
    if (!data || data.length === 0) {
      return industry ? DEFAULT_AD_TEMPLATES.filter(t => t.industry === industry) : DEFAULT_AD_TEMPLATES;
    }
    return data.map(mapAdTemplateRow);
  } catch {
    return industry ? DEFAULT_AD_TEMPLATES.filter(t => t.industry === industry) : DEFAULT_AD_TEMPLATES;
  }
}

export async function saveAdTemplate(template: Partial<AdTemplate> & { industry: string }): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    await supabase.from('agency_ad_templates').upsert({
      id: template.id || `at_${template.industry}_${Date.now()}`,
      industry: template.industry,
      name: template.name || '',
      hook_text: template.hookText || '',
      body_text: template.bodyText || '',
      cta_text: template.ctaText || '',
      structure: template.structure || 'image',
      notes: template.notes || '',
      updated_at: now,
    });
    return true;
  } catch {
    return false;
  }
}

// ── Content Template CRUD ──

export async function getContentTemplates(industry?: string): Promise<ContentTemplate[]> {
  try {
    let query = supabase.from('agency_content_templates').select('*').order('created_at', { ascending: false });
    if (industry) query = query.eq('industry', industry);
    const { data } = await query;
    if (!data || data.length === 0) {
      return industry ? DEFAULT_CONTENT_TEMPLATES.filter(t => t.industry === industry) : DEFAULT_CONTENT_TEMPLATES;
    }
    return data.map(mapContentTemplateRow);
  } catch {
    return industry ? DEFAULT_CONTENT_TEMPLATES.filter(t => t.industry === industry) : DEFAULT_CONTENT_TEMPLATES;
  }
}

export async function saveContentTemplate(template: Partial<ContentTemplate> & { industry: string }): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    await supabase.from('agency_content_templates').upsert({
      id: template.id || `cnt_${template.industry}_${Date.now()}`,
      industry: template.industry,
      name: template.name || '',
      video_idea: template.videoIdea || '',
      hook_angle: template.hookAngle || '',
      format: template.format || '',
      notes: template.notes || '',
      updated_at: now,
    });
    return true;
  } catch {
    return false;
  }
}

// ── Seed All Default Templates ──

export async function seedDefaultTemplates(): Promise<{ campaigns: number; ads: number; content: number }> {
  const result = { campaigns: 0, ads: 0, content: 0 };

  for (const t of DEFAULT_CAMPAIGN_TEMPLATES) {
    try {
      const { data } = await supabase.from('agency_campaign_templates').select('id').eq('id', t.id).single();
      if (!data) {
        await supabase.from('agency_campaign_templates').insert({
          id: t.id, industry: t.industry, name: t.name, objective: t.objective,
          structure: t.structure, ad_set_presets: t.adSetPresets, budget_logic: t.budgetLogic,
          notes: t.notes, updated_at: t.updatedAt,
        });
        result.campaigns++;
      }
    } catch { /* skip */ }
  }

  for (const t of DEFAULT_AD_TEMPLATES) {
    try {
      const { data } = await supabase.from('agency_ad_templates').select('id').eq('id', t.id).single();
      if (!data) {
        await supabase.from('agency_ad_templates').insert({
          id: t.id, industry: t.industry, name: t.name, hook_text: t.hookText,
          body_text: t.bodyText, cta_text: t.ctaText, structure: t.structure,
          notes: t.notes, updated_at: t.updatedAt,
        });
        result.ads++;
      }
    } catch { /* skip */ }
  }

  for (const t of DEFAULT_CONTENT_TEMPLATES) {
    try {
      const { data } = await supabase.from('agency_content_templates').select('id').eq('id', t.id).single();
      if (!data) {
        await supabase.from('agency_content_templates').insert({
          id: t.id, industry: t.industry, name: t.name, video_idea: t.videoIdea,
          hook_angle: t.hookAngle, format: t.format, notes: t.notes, updated_at: t.updatedAt,
        });
        result.content++;
      }
    } catch { /* skip */ }
  }

  return result;
}

// ── Row Mappers ──

function mapCampaignTemplateRow(row: any): CampaignTemplate {
  const parseJSON = (v: any, fallback: any) => {
    if (!v) return fallback;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return fallback; }
  };
  return {
    id: row.id,
    industry: row.industry || '',
    name: row.name || '',
    objective: row.objective || 'leads',
    structure: row.structure || '',
    adSetPresets: parseJSON(row.ad_set_presets, []),
    budgetLogic: row.budget_logic || '',
    notes: row.notes || '',
    updatedAt: row.updated_at || '',
  };
}

function mapAdTemplateRow(row: any): AdTemplate {
  return {
    id: row.id,
    industry: row.industry || '',
    name: row.name || '',
    hookText: row.hook_text || '',
    bodyText: row.body_text || '',
    ctaText: row.cta_text || '',
    structure: row.structure || 'image',
    notes: row.notes || '',
    updatedAt: row.updated_at || '',
  };
}

function mapContentTemplateRow(row: any): ContentTemplate {
  return {
    id: row.id,
    industry: row.industry || '',
    name: row.name || '',
    videoIdea: row.video_idea || '',
    hookAngle: row.hook_angle || '',
    format: row.format || '',
    notes: row.notes || '',
    updatedAt: row.updated_at || '',
  };
}
