/**
 * Playbook System
 *
 * Structured playbooks per industry with:
 * - Pain points, hooks, angles, CTAs
 * - Audience strategy, campaign structure
 * - Content ideas, what to avoid
 *
 * 4 default playbooks: נדל"ן, מסעדות, עורכי דין, אסתטיקה
 */

import { createClient } from '@supabase/supabase-js';
import type { AgencyPlaybook, PlaybookHook, PlaybookCTA } from './types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
);

// ── Default Playbooks ──

export const DEFAULT_PLAYBOOKS: AgencyPlaybook[] = [
  {
    id: 'pb_real_estate',
    industry: 'real_estate',
    name: 'נדל״ן',
    description: 'אסטרטגיית פרסום לנדל"ן — דירות, פרויקטים, השקעות',
    painPoints: ['פחד מהחלטה כלכלית גדולה', 'חוסר אמון בקבלנים', 'חוסר ידע בתהליך', 'פחד לפספס הזדמנות'],
    hooks: [
      { text: 'כמה עולה לחכות עוד שנה?', type: 'fear', notes: 'מדגיש עליית מחירים' },
      { text: 'לפני שאתה קונה דירה — תקרא את זה', type: 'curiosity' },
      { text: '3 טעויות שרוכשי דירות עושים', type: 'fear', notes: 'ליסט מבוסס פחד' },
      { text: 'איך משפחת כהן חסכה ₪200,000 ברכישת דירה', type: 'social_proof' },
      { text: 'הפרויקט שכולם מדברים עליו — ועכשיו הוא פתוח', type: 'urgency' },
    ],
    angles: ['חיסכון כלכלי', 'ביטחון משפחתי', 'השקעה חכמה', 'מחיר למשתכן', 'איכות חיים'],
    ctas: [
      { text: 'בדקו זכאות', type: 'soft' },
      { text: 'קבלו פרטים על הפרויקט', type: 'soft' },
      { text: 'השאירו פרטים — יועץ יחזור אליכם', type: 'direct' },
      { text: 'המקומות האחרונים — הירשמו עכשיו', type: 'urgency' },
    ],
    audienceStrategy: 'זוגות צעירים 25-40, משפחות עם ילדים, משקיעים 35-55. טרגטינג לפי אזור + עניין בנדל"ן + אירועי חיים (חתונה, הריון)',
    campaignStructure: 'קמפיין ראשי leads + קמפיין retargeting. 3 אד-סטים: זוגות צעירים, משפחות, משקיעים. 2-3 מודעות לכל אד-סט.',
    contentIdeas: ['סיור וירטואלי בפרויקט', 'המלצת רוכש אמיתי', 'השוואת מחירים באזור', 'מדריך רכישת דירה ראשונה', 'אינפוגרפיקה: תהליך הרכישה'],
    whatToAvoid: ['הבטחות תשואה ספציפיות', 'מחירים לא מעודכנים', 'לחץ מכירות אגרסיבי', 'תמונות סטוק גנריות'],
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pb_restaurants',
    industry: 'restaurants',
    name: 'מסעדות',
    description: 'אסטרטגיית פרסום למסעדות, קייטרינג, שפים',
    painPoints: ['רעב ורצון', 'חיפוש חוויה מיוחדת', 'בחירת מקום לאירוע', 'FOMO על מקום חדש'],
    hooks: [
      { text: 'זה לא עוד ארוחה — זו חוויה', type: 'emotion' },
      { text: 'המנה שגורמת לאנשים לחזור שוב ושוב', type: 'social_proof' },
      { text: 'מה יש לאכול הערב?', type: 'curiosity', notes: 'פשוט וישיר' },
      { text: 'ביקורת אמיתית: "הסטייק הכי טוב שאכלתי"', type: 'social_proof' },
    ],
    angles: ['חוויה קולינרית', 'ערב מושלם', 'אוכל אמיתי', 'מקומי ואותנטי', 'אירוע מיוחד'],
    ctas: [
      { text: 'הזמינו שולחן', type: 'direct' },
      { text: 'צפו בתפריט', type: 'soft' },
      { text: 'הזמינו עכשיו — מקומות מוגבלים', type: 'urgency' },
    ],
    audienceStrategy: 'גילאי 25-55, חובבי אוכל, אזור גיאוגרפי 15 ק"מ. שימוש ב-lookalike מלקוחות קיימים.',
    campaignStructure: 'קמפיין engagement + קמפיין reach. 2 אד-סטים: חובבי אוכל, תושבי אזור. וידאו + תמונות.',
    contentIdeas: ['וידאו הכנת מנה', 'ביקורות לקוחות', 'מאחורי הקלעים', 'תפריט עונתי חדש', 'אירוע מיוחד'],
    whatToAvoid: ['תמונות לא מזמינות', 'טקסט ארוך מדי', 'מחירים ללא הקשר', 'הנחות מוגזמות שפוגעות במותג'],
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pb_lawyers',
    industry: 'lawyers',
    name: 'עורכי דין',
    description: 'אסטרטגיית פרסום לעורכי דין ומשרדי עריכת דין',
    painPoints: ['פחד מהליך משפטי', 'חוסר ידע בזכויות', 'סיכון כלכלי', 'ביטחון ואמון'],
    hooks: [
      { text: 'אל תחתום לפני שתקרא את זה', type: 'fear' },
      { text: '5 זכויות שלא ידעת שמגיעות לך', type: 'curiosity' },
      { text: 'הטעות שעולה לישראלים מיליונים בשנה', type: 'fear' },
      { text: 'עו"ד מסביר: מה לעשות אם...', type: 'benefit', notes: 'ערך + מומחיות' },
    ],
    angles: ['הגנה על זכויות', 'ביטחון משפטי', 'חיסכון כלכלי', 'ניסיון ומומחיות', 'ייעוץ ללא התחייבות'],
    ctas: [
      { text: 'לייעוץ ראשוני חינם', type: 'value' },
      { text: 'בדקו את הזכויות שלכם', type: 'soft' },
      { text: 'דברו עם עורך דין עכשיו', type: 'direct' },
    ],
    audienceStrategy: 'גילאי 30-60, בעלי עסקים, אנשים עם אירועי חיים (גירושין, תאונה, עסקה). עניין במשפטים/זכויות.',
    campaignStructure: 'קמפיין leads. 3 אד-סטים לפי תחום: נדל"ן, משפחה, פלילי/אזרחי. תוכן ערך + CTA.',
    contentIdeas: ['מדריך זכויות', 'סיפורי הצלחה (אנונימי)', 'טיפים משפטיים', 'Q&A', 'שינויי חקיקה'],
    whatToAvoid: ['הבטחות תוצאה', 'שפה משפטית כבדה', 'פחד מוגזם', 'השוואה לעורכי דין אחרים'],
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
  {
    id: 'pb_aesthetics',
    industry: 'aesthetics',
    name: 'אסתטיקה',
    description: 'אסטרטגיית פרסום לקליניקות אסתטיקה, קוסמטיקה, טיפולי יופי',
    painPoints: ['חוסר ביטחון עצמי', 'רצון לשינוי', 'פחד מטיפול', 'תוצאות לא טבעיות'],
    hooks: [
      { text: 'השינוי מתחיל כאן', type: 'emotion' },
      { text: 'לפני ואחרי — התוצאות מדברות', type: 'social_proof' },
      { text: 'הטיפול שנותן תוצאות מהיום הראשון', type: 'benefit' },
      { text: 'איך להיראות רענן/ה ב-30 דקות', type: 'curiosity' },
    ],
    angles: ['תוצאה טבעית', 'ביטחון עצמי', 'טכנולוגיה מתקדמת', 'ניסיון מוכח', 'טיפול בלי כאב'],
    ctas: [
      { text: 'בדיקת התאמה חינם', type: 'value' },
      { text: 'קבעו ייעוץ', type: 'soft' },
      { text: 'הזמינו טיפול ראשון בהנחה', type: 'urgency' },
    ],
    audienceStrategy: 'נשים 25-55, עניין ביופי/טיפוח/בריאות. lookalike מלקוחות קיימים. Instagram + Facebook.',
    campaignStructure: 'קמפיין leads + awareness. 2 אד-סטים: טיפולי פנים, טיפולי גוף. וידאו before/after + reviews.',
    contentIdeas: ['לפני ואחרי (באישור)', 'הסבר על טיפול', 'ביקורת לקוחה', 'יום בקליניקה', 'מיתוסים על טיפולים'],
    whatToAvoid: ['הבטחות לא ריאליות', 'תמונות מפחידות', 'לחץ מכירות', 'מחירים בלי הקשר', 'השוואה ישירה למתחרים'],
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  },
];

// ── Get Playbooks ──

export async function getPlaybooks(industry?: string): Promise<AgencyPlaybook[]> {
  try {
    let query = supabase.from('agency_playbooks').select('*').order('created_at', { ascending: false });
    if (industry) query = query.eq('industry', industry);
    const { data } = await query;
    if (!data || data.length === 0) {
      return industry ? DEFAULT_PLAYBOOKS.filter(p => p.industry === industry) : DEFAULT_PLAYBOOKS;
    }
    return data.map(mapPlaybookRow);
  } catch {
    return industry ? DEFAULT_PLAYBOOKS.filter(p => p.industry === industry) : DEFAULT_PLAYBOOKS;
  }
}

// ── Get Single Playbook ──

export async function getPlaybook(industry: string): Promise<AgencyPlaybook | null> {
  try {
    const { data } = await supabase.from('agency_playbooks').select('*').eq('industry', industry).single();
    if (data) return mapPlaybookRow(data);
  } catch { /* fall through */ }
  return DEFAULT_PLAYBOOKS.find(p => p.industry === industry) || null;
}

// ── Save Playbook ──

export async function savePlaybook(playbook: Partial<AgencyPlaybook> & { industry: string }): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    const existing = await getPlaybook(playbook.industry);
    const id = existing?.id || `pb_${playbook.industry}`;

    await supabase.from('agency_playbooks').upsert({
      id,
      industry: playbook.industry,
      name: playbook.name || existing?.name || playbook.industry,
      description: playbook.description || existing?.description || '',
      pain_points: playbook.painPoints || existing?.painPoints || [],
      hooks: playbook.hooks || existing?.hooks || [],
      angles: playbook.angles || existing?.angles || [],
      ctas: playbook.ctas || existing?.ctas || [],
      audience_strategy: playbook.audienceStrategy || existing?.audienceStrategy || '',
      campaign_structure: playbook.campaignStructure || existing?.campaignStructure || '',
      content_ideas: playbook.contentIdeas || existing?.contentIdeas || [],
      what_to_avoid: playbook.whatToAvoid || existing?.whatToAvoid || [],
      updated_at: now,
      created_at: existing?.createdAt || now,
    });
    return true;
  } catch {
    return false;
  }
}

// ── Seed Default Playbooks ──

export async function seedDefaultPlaybooks(): Promise<number> {
  let count = 0;
  for (const pb of DEFAULT_PLAYBOOKS) {
    try {
      const { data: existing } = await supabase.from('agency_playbooks').select('id').eq('id', pb.id).single();
      if (!existing) {
        await supabase.from('agency_playbooks').insert({
          id: pb.id,
          industry: pb.industry,
          name: pb.name,
          description: pb.description,
          pain_points: pb.painPoints,
          hooks: pb.hooks,
          angles: pb.angles,
          ctas: pb.ctas,
          audience_strategy: pb.audienceStrategy,
          campaign_structure: pb.campaignStructure,
          content_ideas: pb.contentIdeas,
          what_to_avoid: pb.whatToAvoid,
          updated_at: pb.updatedAt,
          created_at: pb.createdAt,
        });
        count++;
      }
    } catch { /* skip */ }
  }
  return count;
}

// ── Row Mapper ──

function mapPlaybookRow(row: any): AgencyPlaybook {
  const parseJSON = (v: any, fallback: any) => {
    if (!v) return fallback;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return fallback; }
  };

  return {
    id: row.id,
    industry: row.industry || '',
    name: row.name || '',
    description: row.description || '',
    painPoints: parseJSON(row.pain_points, []),
    hooks: parseJSON(row.hooks, []),
    angles: parseJSON(row.angles, []),
    ctas: parseJSON(row.ctas, []),
    audienceStrategy: row.audience_strategy || '',
    campaignStructure: row.campaign_structure || '',
    contentIdeas: parseJSON(row.content_ideas, []),
    whatToAvoid: parseJSON(row.what_to_avoid, []),
    updatedAt: row.updated_at || '',
    createdAt: row.created_at || '',
  };
}
