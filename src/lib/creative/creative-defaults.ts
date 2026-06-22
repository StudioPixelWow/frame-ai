/**
 * Studio Pixel Creative Defaults
 *
 * Global creative rules that apply to ALL client work at Studio Pixel.
 * These defaults are merged with each client's Brand DNA profile before
 * any creative generation prompt is built.
 *
 * Future ZONO compatibility: the CreativeEntityContext type below lets this
 * engine serve real-estate entities (agents, properties, projects, offices)
 * in addition to marketing clients — same engine, different entity context.
 */

export const STUDIO_PIXEL_CREATIVE_DEFAULTS = {
  // ── עצור — אסור בהחלט ──────────────────────────────────────────────
  banned: [
    'מראה AI גנרי ומובהק',
    'זוהר ניאון מוגזם ולא רלוונטי',
    'HUD עתידני ללא קשר לתוכן',
    'אייקונים תלת-ממדיים מזויפים בכל מקום',
    'כדורי זכוכית לא רלוונטיים',
    'גרדיאנטים מוגזמים',
    'זהב מזויף כשהלקוח לא משתמש בזהב',
    'תמונות סטוק גנריות',
    'טקסט עברית לא קריא',
    'סדר RTL שגוי',
    'לייאאוט סימטרי משעמם מדי',
    'טקסט מרחף ללא קשר לסצנה',
    'בלוקי טקסט צפופים ללא היררכיה',
    'עיצובים שמתעלמים מהתעשייה של הלקוח',
  ],

  // ── מועדף — עקרונות יצירה ──────────────────────────────────────────
  preferred: [
    'היררכיה ויזואלית חזקה',
    'קריאות mobile-first',
    'משמעת צבעי מותג',
    'הקשר תעשייתי אמיתי',
    'ריווח פרימיום',
    'CTA ברור',
    'רלוונטיות ויזואלית לפני קישוט',
    'תקינות RTL בעברית',
    'עקביות סגנונית ללקוח',
  ],
} as const;

// ── Future: ZONO compatibility ─────────────────────────────────────────────
// TODO: Support agent_id, property_id, project_id, office_id in addition to
//       clientId once the ZONO real-estate vertical is integrated.
//       The brand analysis and asset-upload services already receive an
//       entityId string — swap the clientId param for CreativeEntityContext
//       when the time comes.

export type CreativeEntityType = 'client' | 'agent' | 'property' | 'project' | 'office';

export interface CreativeEntityContext {
  entityType: CreativeEntityType;
  entityId: string;
  entityName: string;
}
