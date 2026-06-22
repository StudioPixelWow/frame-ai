/**
 * ZONO Creative Concept Engine
 *
 * Server-side orchestrator that generates 4-8 marketing concepts
 * based on an entity's Marketing DNA profile.
 *
 * Flow:
 *  1. Fetch DNA profile (BrandStyleProfile) for the entity
 *  2. Fetch feedback history (CreativeFeedback)
 *  3. Build prompt parameters from DNA + feedback
 *  4. Call AI (OpenAI) or use mock mode
 *  5. Save generated concepts to DB
 *  6. Return concepts
 */

import { brandStyleProfiles, creativeFeedback, creativeConcepts } from '@/lib/db/collections';
import type { BrandStyleProfile, CreativeFeedback, CreativeConcept, ConceptType } from '@/lib/db/schema';
import { generateWithAI } from '@/lib/ai/openai-client';
import {
  buildConceptSystemPrompt,
  buildConceptUserPrompt,
  CONCEPT_TYPE_LABELS,
  type ConceptUserPromptParams,
} from './conceptPrompts';
import { generateCreativeDirection, selectBestStrategy } from './pixelCreativeDirectorEngine';
import { validateCreativeOutput, calculateValidationScore } from './pixelCreativeValidationService';

/* ── Result Interface ──────────────────────────────────────────────── */

export interface GenerateConceptsResult {
  success: boolean;
  concepts: CreativeConcept[];
  conceptCount: number;
  provider: 'openai' | 'mock';
  error?: string;
}

/* ── Raw AI Concept Shape ──────────────────────────────────────────── */

interface RawAIConcept {
  title: string;
  concept_type: string;
  description: string;
  marketing_angle: string;
  emotional_trigger: string;
  visual_hook: string;
  copy_hook: string;
  recommended_layout: string;
  recommended_cta_style: string;
  recommended_audience: string;
  confidence_score: number;
  reasoning: string;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

/**
 * Safely extract a string array from a JSONB field that might be:
 *  - string[]
 *  - { name: string }[]  or  { label: string }[]  or  { value: string }[]
 *  - null / undefined
 */
export function extractStringArray(val: any): string[] {
  if (!val) return [];
  if (!Array.isArray(val)) return [];

  return val
    .map((item: any) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        return item.name || item.label || item.value || item.title || JSON.stringify(item);
      }
      return String(item);
    })
    .filter((s: string) => s && s.length > 0);
}

/**
 * Extract a summary string from a Record<string, any> field.
 * Joins key-value pairs into a readable line, or returns '' if empty/null.
 */
export function extractRecordString(val: any): string {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val !== 'object') return String(val);

  const entries = Object.entries(val).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );
  if (entries.length === 0) return '';

  return entries
    .map(([k, v]) => {
      if (typeof v === 'object') return `${k}: ${JSON.stringify(v)}`;
      return `${k}: ${v}`;
    })
    .join(', ');
}

/* ── Valid Concept Types ───────────────────────────────────────────── */

const VALID_CONCEPT_TYPES = new Set(Object.keys(CONCEPT_TYPE_LABELS));

function isValidConceptType(type: string): type is ConceptType {
  return VALID_CONCEPT_TYPES.has(type);
}

/* ── Build Prompt Params from DNA Profile ──────────────────────────── */

function buildPromptParams(
  entityType: string,
  entityId: string,
  entityName: string,
  profile: BrandStyleProfile | null,
  feedbackSummary: string
): ConceptUserPromptParams {
  const dnaScores: Record<string, number> = {};

  if (profile) {
    const scoreFields: Array<[string, keyof BrandStyleProfile]> = [
      ['יוקרה', 'luxuryScore'],
      ['מינימליזם', 'minimalismScore'],
      ['מודרניות', 'modernScore'],
      ['אגרסיביות מכירתית', 'salesAggressivenessScore'],
      ['צפיפות ויזואלית', 'visualDensityScore'],
      ['מראה AI', 'aiGeneratedScore'],
      ['דחיפות', 'urgencyScore'],
      ['מיקוד השקעות', 'investmentFocusScore'],
      ['מיקוד לייף סטייל', 'lifestyleFocusScore'],
      ['מיקוד מוכרים', 'sellerFocusScore'],
      ['מיקוד קונים', 'buyerFocusScore'],
    ];

    for (const [label, field] of scoreFields) {
      const value = profile[field];
      if (typeof value === 'number' && !isNaN(value)) {
        dnaScores[label] = value;
      }
    }
  }

  return {
    entityType,
    entityName,
    entityId,
    dnaSummary: profile?.brandSummary || '',
    dnaScores,
    approvedPatterns: profile ? extractStringArray(profile.approvedPatterns) : [],
    rejectedPatterns: profile ? extractStringArray(profile.rejectedPatterns) : [],
    preferredAngles: profile ? extractStringArray(profile.preferredCampaignAngles) : [],
    rejectedAngles: profile ? extractStringArray(profile.rejectedCampaignAngles) : [],
    targetAudiences: profile ? extractStringArray(profile.targetAudiences) : [],
    realEstatePositioning: profile?.realEstatePositioning || '',
    propertyMarketingStyle: profile ? extractRecordString(profile.propertyMarketingStyle) : '',
    projectMarketingStyle: profile ? extractRecordString(profile.projectMarketingStyle) : '',
    agentMarketingStyle: profile ? extractRecordString(profile.agentMarketingStyle) : '',
    neighborhoodStyle: profile ? extractRecordString(profile.neighborhoodStorytellingStyle) : '',
    feedbackSummary,
  };
}

/* ── Feedback Summary Builder ──────────────────────────────────────── */

function buildFeedbackSummary(feedbackList: CreativeFeedback[]): string {
  if (feedbackList.length === 0) return '';

  const counts: Record<string, number> = {};
  for (const fb of feedbackList) {
    const key = fb.feedbackType || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }

  const lines = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `${type}: ${count}`);

  return `סה"כ ${feedbackList.length} פידבקים. ${lines.join(', ')}`;
}

/* ── Parse AI Response ─────────────────────────────────────────────── */

function parseAIResponse(data: unknown): RawAIConcept[] {
  let parsed: any = data;

  // If data is a string, try to parse it as JSON
  if (typeof parsed === 'string') {
    // Strip markdown code blocks if present
    let cleaned = parsed.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    parsed = JSON.parse(cleaned);
  }

  // Extract concepts array
  let concepts: any[];
  if (Array.isArray(parsed)) {
    concepts = parsed;
  } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.concepts)) {
    concepts = parsed.concepts;
  } else {
    throw new Error('AI response does not contain a concepts array');
  }

  // Validate each concept has minimum required fields
  return concepts.filter((c: any) => {
    if (!c || typeof c !== 'object') return false;
    if (!c.title || !c.concept_type) return false;
    return true;
  });
}

/* ── Save Concepts to DB ───────────────────────────────────────────── */

async function saveConcepts(
  rawConcepts: RawAIConcept[],
  entityType: string,
  entityId: string,
  profileId: string | null,
  provider: 'openai' | 'mock',
  creativeDirectorData?: Record<string, any> | null
): Promise<CreativeConcept[]> {
  const saved: CreativeConcept[] = [];

  for (const raw of rawConcepts) {
    try {
      const conceptType = isValidConceptType(raw.concept_type)
        ? raw.concept_type
        : 'luxury_lifestyle' as ConceptType;

      const now = new Date().toISOString();

      const conceptData: Omit<CreativeConcept, 'id'> = {
        entityType,
        entityId,
        marketingDnaProfileId: profileId,
        title: raw.title || 'קונספט ללא כותרת',
        conceptType,
        description: raw.description || '',
        marketingAngle: raw.marketing_angle || '',
        emotionalTrigger: raw.emotional_trigger || '',
        visualHook: raw.visual_hook || '',
        copyHook: raw.copy_hook || '',
        recommendedLayout: raw.recommended_layout || '',
        recommendedCtaStyle: raw.recommended_cta_style || '',
        recommendedAudience: raw.recommended_audience || '',
        confidenceScore: typeof raw.confidence_score === 'number' ? raw.confidence_score : 50,
        isFavorite: false,
        isApproved: false,
        isRejected: false,
        generationMetadata: { provider, generatedAt: now },
        reasoning: raw.reasoning || '',
        createdAt: now,
        updatedAt: now,
        // Creative Director fields (if available)
        ...(creativeDirectorData ? {
          creativeStrategy: creativeDirectorData.creativeStrategy,
          scrollStopReason: creativeDirectorData.scrollStopReason,
          industryAnchor: creativeDirectorData.industryAnchor,
          typographyRecommendation: creativeDirectorData.typographyRecommendation,
          creativeDirectorMetadata: creativeDirectorData,
          creativeDirectorScore: creativeDirectorData.scores?.overall,
          scrollStopScore: creativeDirectorData.scores?.scrollStop,
          antiAiScore: creativeDirectorData.scores?.antiAiLook,
          rtlReadabilityScore: creativeDirectorData.scores?.rtlReadability,
          contrastScore: creativeDirectorData.scores?.contrastClarity,
          brandDnaMatchScore: creativeDirectorData.scores?.brandDnaMatch,
        } : {}),
      };

      const created = await creativeConcepts.createAsync(conceptData as CreativeConcept);
      saved.push(created);
      console.log(`[ConceptEngine] Saved concept: "${raw.title}" (${conceptType})`);
    } catch (err) {
      console.error(`[ConceptEngine] Failed to save concept "${raw.title}":`, err);
    }
  }

  return saved;
}

/* ── Learning: Get Approved Concept Types ──────────────────────────── */

/**
 * Query existing concepts for this entity that are approved or favorited.
 * Returns their concept types as a Set. This helps influence future generation
 * by showing which concept types resonate with the client.
 */
export async function getApprovedConceptTypes(entityId: string): Promise<Set<ConceptType>> {
  try {
    const existing = await creativeConcepts.queryAsync(
      (c) => c.entityId === entityId && (c.isApproved === true || c.isFavorite === true)
    );
    const types = new Set<ConceptType>();
    for (const concept of existing) {
      if (concept.conceptType && isValidConceptType(concept.conceptType)) {
        types.add(concept.conceptType);
      }
    }
    console.log(
      `[ConceptEngine] Found ${types.size} approved concept types for entity ${entityId}:`,
      Array.from(types)
    );
    return types;
  } catch (err) {
    console.error(`[ConceptEngine] Failed to fetch approved concept types:`, err);
    return new Set();
  }
}

/* ── Mock Concept Generator ────────────────────────────────────────── */

function generateMockConcepts(
  entityType: string,
  entityId: string,
  entityName: string,
  profile: BrandStyleProfile | null
): RawAIConcept[] {
  // Pick concept types based on entity type
  const typeMap: Record<string, ConceptType[]> = {
    property: [
      'luxury_lifestyle',
      'investment_opportunity',
      'dream_home',
      'first_home',
      'location_advantage',
      'upgrade_your_life',
    ],
    project: [
      'project_launch',
      'pre_sale',
      'community_living',
      'future_appreciation',
      'investment_opportunity',
      'developer_prestige',
    ],
    agent: [
      'authority_agent',
      'neighborhood_expert',
      'seller_recruitment',
      'buyer_recruitment',
      'exclusive_listing',
      'neighborhood_story',
    ],
    office: [
      'authority_agent',
      'seller_recruitment',
      'buyer_recruitment',
      'developer_prestige',
      'community_living',
      'neighborhood_expert',
    ],
  };

  const defaultTypes: ConceptType[] = [
    'luxury_lifestyle',
    'investment_opportunity',
    'seller_recruitment',
    'buyer_recruitment',
    'neighborhood_story',
    'first_home',
  ];

  const selectedTypes = typeMap[entityType] || defaultTypes;
  const nameForDisplay = entityName || 'ישות לא ידועה';

  // Contextual mock data per concept type
  const mockData: Record<string, Omit<RawAIConcept, 'concept_type' | 'confidence_score' | 'reasoning'>> = {
    luxury_lifestyle: {
      title: `לייף סטייל יוקרתי — ${nameForDisplay}`,
      description: 'קונספט המציג את הנכס כחלק מאורח חיים יוקרתי. דגש על חוויה, לא על מטרים.',
      marketing_angle: 'יוקרה ובלעדיות',
      emotional_trigger: 'גאווה וסטטוס',
      visual_hook: 'צילום רחב של סלון מעוצב עם נוף עירוני',
      copy_hook: 'יש דירה. ויש דירה שמגדירה אותך.',
      recommended_layout: 'hero image',
      recommended_cta_style: 'לתיאום צפייה פרטית',
      recommended_audience: 'luxury_buyer',
    },
    investment_opportunity: {
      title: `הזדמנות השקעה — ${nameForDisplay}`,
      description: 'מיקוד בתשואה ובפוטנציאל הכלכלי. מספרים שמדברים.',
      marketing_angle: 'FOMO — הזדמנות חולפת',
      emotional_trigger: 'פחד מהפסד הזדמנות',
      visual_hook: 'גרף עליית מחירים עם תמונת הנכס',
      copy_hook: 'המספרים מדברים. השאלה אם אתה מקשיב.',
      recommended_layout: 'split',
      recommended_cta_style: 'להשאיר פרטים לקבלת ניתוח תשואה',
      recommended_audience: 'investor',
    },
    dream_home: {
      title: `בית החלומות — ${nameForDisplay}`,
      description: 'קונספט רגשי שנוגע בחלום של בית משלך. אישי ומזמין.',
      marketing_angle: 'הגשמת חלום',
      emotional_trigger: 'געגוע לבית',
      visual_hook: 'משפחה בסלון מואר, חלון גדול עם נוף ירוק',
      copy_hook: 'הבית שתמיד חלמת עליו? הוא כאן.',
      recommended_layout: 'hero image',
      recommended_cta_style: 'לתיאום סיור בנכס',
      recommended_audience: 'family',
    },
    first_home: {
      title: `דירה ראשונה — ${nameForDisplay}`,
      description: 'פנייה לזוגות צעירים ורוכשי דירה ראשונה. שפה נגישה ומעודדת.',
      marketing_angle: 'התחלה חדשה',
      emotional_trigger: 'התרגשות ועצמאות',
      visual_hook: 'זוג צעיר עם מפתח ביד, דירה חדשה ברקע',
      copy_hook: 'הצעד הראשון לעצמאות מתחיל כאן.',
      recommended_layout: 'story',
      recommended_cta_style: 'WhatsApp',
      recommended_audience: 'first_home_buyer',
    },
    location_advantage: {
      title: `יתרון מיקום — ${nameForDisplay}`,
      description: 'מיקוד בנגישות, קרבה לתחבורה, מוסדות חינוך, ומרכזי קניות.',
      marketing_angle: 'מיקום אסטרטגי',
      emotional_trigger: 'נוחות וביטחון',
      visual_hook: 'מפה אינטראקטיבית עם אייקונים של שירותים סביב הנכס',
      copy_hook: 'הכל במרחק הליכה. ממש הכל.',
      recommended_layout: 'carousel',
      recommended_cta_style: 'להשאיר פרטים',
      recommended_audience: 'family',
    },
    upgrade_your_life: {
      title: `שדרוג איכות חיים — ${nameForDisplay}`,
      description: 'פנייה למשדרגי דיור שרוצים יותר מרחב, יותר שקט, יותר איכות.',
      marketing_angle: 'שדרוג ומעבר',
      emotional_trigger: 'שאיפה לשינוי',
      visual_hook: 'השוואה בין דירה קטנה ישנה לדירה מרווחת חדשה',
      copy_hook: 'הגיע הזמן לשדרג. לא רק דירה — חיים.',
      recommended_layout: 'split',
      recommended_cta_style: 'לתיאום צפייה',
      recommended_audience: 'upgrader',
    },
    seller_recruitment: {
      title: `גיוס מוכרים — ${nameForDisplay}`,
      description: 'קונספט לגיוס בעלי נכסים שרוצים למכור. דגש על מקצועיות ותוצאות.',
      marketing_angle: 'מקצועיות ואמינות',
      emotional_trigger: 'ביטחון בהחלטה',
      visual_hook: 'סוכן מקצועי ליד שלט "נמכר" על בניין',
      copy_hook: 'רוצה למכור? יש הבדל בין לפרסם ובין למכור.',
      recommended_layout: 'hero image',
      recommended_cta_style: 'WhatsApp',
      recommended_audience: 'upgrader',
    },
    buyer_recruitment: {
      title: `גיוס קונים — ${nameForDisplay}`,
      description: 'פנייה לקונים פוטנציאליים עם מבחר נכסים ושירות אישי.',
      marketing_angle: 'שירות אישי וליווי',
      emotional_trigger: 'הקלה וביטחון',
      visual_hook: 'קולאז\' של נכסים מגוונים עם כותרת מזמינה',
      copy_hook: 'מחפש דירה? יש לנו את מה שלא תמצא בלוחות.',
      recommended_layout: 'carousel',
      recommended_cta_style: 'להשאיר פרטים',
      recommended_audience: 'first_home_buyer',
    },
    neighborhood_story: {
      title: `סיפור שכונה — ${nameForDisplay}`,
      description: 'קונספט שמספר את הסיפור של השכונה — ההיסטוריה, האופי, והקהילה.',
      marketing_angle: 'שייכות וקהילה',
      emotional_trigger: 'שייכות ונוסטלגיה',
      visual_hook: 'צילום רחוב אופייני עם אנשים, בתי קפה, ועצים',
      copy_hook: 'יש שכונות. ויש שכונה שהיא בית.',
      recommended_layout: 'story',
      recommended_cta_style: 'לקריאת המאמר המלא',
      recommended_audience: 'family',
    },
    project_launch: {
      title: `השקת פרויקט — ${nameForDisplay}`,
      description: 'קונספט להשקה רשמית של פרויקט חדש. דגש על חידוש ובלעדיות.',
      marketing_angle: 'חדשנות ובלעדיות',
      emotional_trigger: 'התרגשות מחידוש',
      visual_hook: 'רנדר 3D של הפרויקט עם לוגו בולט',
      copy_hook: 'פרויקט חדש. סטנדרט חדש.',
      recommended_layout: 'hero image',
      recommended_cta_style: 'להרשמה למועדון הרוכשים',
      recommended_audience: 'investor',
    },
    pre_sale: {
      title: `מכירה מוקדמת — ${nameForDisplay}`,
      description: 'הזדמנות לרכוש במחיר השקה לפני עליית מחירים. דחיפות ו-FOMO.',
      marketing_angle: 'FOMO — מחיר השקה',
      emotional_trigger: 'דחיפות ופחד מהפסד',
      visual_hook: 'ספירה לאחור עם תמונת הפרויקט',
      copy_hook: 'מחיר השקה. פעם אחת. עכשיו.',
      recommended_layout: 'hero image',
      recommended_cta_style: 'להשארת פרטים',
      recommended_audience: 'investor',
    },
    community_living: {
      title: `חיי קהילה — ${nameForDisplay}`,
      description: 'דגש על הקהילה, השכנים, והחיים המשותפים בפרויקט.',
      marketing_angle: 'קהילה ושייכות',
      emotional_trigger: 'חום ושייכות',
      visual_hook: 'משפחות בלובי מעוצב או בגינה משותפת',
      copy_hook: 'לא רק דירה — קהילה שבונים יחד.',
      recommended_layout: 'carousel',
      recommended_cta_style: 'להשאיר פרטים',
      recommended_audience: 'family',
    },
    future_appreciation: {
      title: `עליית ערך עתידית — ${nameForDisplay}`,
      description: 'מיקוד בפוטנציאל הכלכלי לטווח ארוך. פיתוח אזורי, תחבורה, ביקוש.',
      marketing_angle: 'השקעה לעתיד',
      emotional_trigger: 'חוכמה כלכלית',
      visual_hook: 'מפת פיתוח עירוני עם סימון הפרויקט',
      copy_hook: 'עוד 5 שנים תגיד "הלוואי שקניתי אז".',
      recommended_layout: 'split',
      recommended_cta_style: 'להשארת פרטים לניתוח השקעה',
      recommended_audience: 'investor',
    },
    developer_prestige: {
      title: `יוקרת יזם — ${nameForDisplay}`,
      description: 'בניית מותג היזם — ניסיון, איכות בנייה, ופרויקטים קודמים מוצלחים.',
      marketing_angle: 'מוניטין ואיכות',
      emotional_trigger: 'אמון וביטחון',
      visual_hook: 'קולאז\' של פרויקטים קודמים עם לוגו היזם',
      copy_hook: 'כשהיזם מדבר באיכות — הקירות מדברים בעד עצמם.',
      recommended_layout: 'carousel',
      recommended_cta_style: 'לצפייה בפרויקטים',
      recommended_audience: 'luxury_buyer',
    },
    authority_agent: {
      title: `סוכן סמכותי — ${nameForDisplay}`,
      description: 'מיצוב הסוכן כמומחה מוביל באזור. ידע, ניסיון, ותוצאות מוכחות.',
      marketing_angle: 'סמכות מקצועית',
      emotional_trigger: 'אמון ובטחון',
      visual_hook: 'פורטרט מקצועי של הסוכן עם נתוני מכירות',
      copy_hook: 'לא סתם סוכן. המומחה שמוכר הכי הרבה באזור.',
      recommended_layout: 'hero image',
      recommended_cta_style: 'WhatsApp',
      recommended_audience: 'upgrader',
    },
    neighborhood_expert: {
      title: `מומחה שכונה — ${nameForDisplay}`,
      description: 'מיצוב כמומחה לשכונה ספציפית. ידע מקומי, היכרות עם השוק.',
      marketing_angle: 'מומחיות מקומית',
      emotional_trigger: 'ביטחון בבחירה',
      visual_hook: 'הסוכן ברחובות השכונה עם שכנים מרוצים',
      copy_hook: 'אני חי פה. אני יודע כל בניין, כל רחוב, כל הזדמנות.',
      recommended_layout: 'story',
      recommended_cta_style: 'WhatsApp',
      recommended_audience: 'family',
    },
    exclusive_listing: {
      title: `נכס בלעדי — ${nameForDisplay}`,
      description: 'הדגשת בלעדיות הנכס. לא תמצאו אותו במקום אחר.',
      marketing_angle: 'בלעדיות ונדירות',
      emotional_trigger: 'FOMO — הזדמנות בלעדית',
      visual_hook: 'תמונה אלגנטית של הנכס עם תג "בלעדי"',
      copy_hook: 'בלעדי. לא בלוחות. לא אצל אחרים. רק כאן.',
      recommended_layout: 'hero image',
      recommended_cta_style: 'לתיאום צפייה',
      recommended_audience: 'luxury_buyer',
    },
  };

  return selectedTypes.map((type, index) => {
    const data = mockData[type] || {
      title: `קונספט ${CONCEPT_TYPE_LABELS[type] || type} — ${nameForDisplay}`,
      description: `קונספט מסוג ${CONCEPT_TYPE_LABELS[type] || type} עבור ${nameForDisplay}.`,
      marketing_angle: 'כללי',
      emotional_trigger: 'עניין',
      visual_hook: 'תמונה מקצועית של הנכס',
      copy_hook: `${nameForDisplay} — ההזדמנות שלך.`,
      recommended_layout: 'hero image',
      recommended_cta_style: 'להשאיר פרטים',
      recommended_audience: 'family',
    };

    return {
      ...data,
      concept_type: type,
      confidence_score: 30 + Math.floor(Math.random() * 16), // 30-45
      reasoning: `קונספט מוק — נוצר ללא AI. מבוסס על סוג ישות: ${entityType}.`,
    };
  });
}

/* ── Main Entry Point ──────────────────────────────────────────────── */

/**
 * Generate 4-8 creative marketing concepts for a given entity.
 *
 * @param entityType - 'property' | 'project' | 'agent' | 'office' | 'client'
 * @param entityId   - The entity's unique ID
 * @param entityName - Display name (Hebrew)
 */
export async function generateCreativeConcepts(
  entityType: string,
  entityId: string,
  entityName: string
): Promise<GenerateConceptsResult> {
  console.log(`[ConceptEngine] Starting concept generation for ${entityType}: "${entityName}" (${entityId})`);

  // ── Step 1: Fetch DNA profile ──
  let profile: BrandStyleProfile | null = null;
  try {
    const profiles = await brandStyleProfiles.queryAsync(
      (p) => p.entityId === entityId || p.clientId === entityId
    );
    profile = profiles.length > 0 ? profiles[0] : null;
    console.log(
      `[ConceptEngine] DNA profile: ${profile ? `found (${profile.id}, status: ${profile.profileStatus})` : 'not found'}`
    );
  } catch (err) {
    console.error('[ConceptEngine] Failed to fetch DNA profile:', err);
    // Continue without profile — we can still generate concepts
  }

  // ── Step 2: Fetch feedback history ──
  let feedbackList: CreativeFeedback[] = [];
  try {
    feedbackList = await creativeFeedback.queryAsync((f) => f.clientId === entityId);
    console.log(`[ConceptEngine] Feedback records found: ${feedbackList.length}`);
  } catch (err) {
    console.error('[ConceptEngine] Failed to fetch feedback:', err);
  }

  const feedbackSummary = buildFeedbackSummary(feedbackList);

  // ── Step 3: Build prompt params ──
  const promptParams = buildPromptParams(entityType, entityId, entityName, profile, feedbackSummary);

  // ── Step 4: Generate concepts (AI or Mock) ──
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  let rawConcepts: RawAIConcept[];
  let provider: 'openai' | 'mock';

  if (hasApiKey) {
    provider = 'openai';
    console.log('[ConceptEngine] Using OpenAI for concept generation');

    try {
      const systemPrompt = buildConceptSystemPrompt(entityType, entityName);
      const userPrompt = buildConceptUserPrompt(promptParams);

      const aiResult = await generateWithAI(systemPrompt, userPrompt, {
        temperature: 0.8,
        maxTokens: 4000,
      });

      if (!aiResult.success || !aiResult.data) {
        console.error('[ConceptEngine] AI generation failed:', aiResult.error);
        // Fallback to mock
        console.log('[ConceptEngine] Falling back to mock mode');
        rawConcepts = generateMockConcepts(entityType, entityId, entityName, profile);
        provider = 'mock';
      } else {
        try {
          rawConcepts = parseAIResponse(aiResult.data);
          console.log(`[ConceptEngine] AI returned ${rawConcepts.length} concepts`);
        } catch (parseErr) {
          console.error('[ConceptEngine] Failed to parse AI response:', parseErr);
          console.log('[ConceptEngine] Falling back to mock mode');
          rawConcepts = generateMockConcepts(entityType, entityId, entityName, profile);
          provider = 'mock';
        }
      }
    } catch (err) {
      console.error('[ConceptEngine] AI call failed:', err);
      console.log('[ConceptEngine] Falling back to mock mode');
      rawConcepts = generateMockConcepts(entityType, entityId, entityName, profile);
      provider = 'mock';
    }
  } else {
    provider = 'mock';
    console.log('[ConceptEngine] No OPENAI_API_KEY — using mock mode');
    rawConcepts = generateMockConcepts(entityType, entityId, entityName, profile);
  }

  // Clamp to 4-8 concepts
  if (rawConcepts.length > 8) {
    rawConcepts = rawConcepts.slice(0, 8);
  }

  if (rawConcepts.length === 0) {
    console.error('[ConceptEngine] No concepts generated');
    return {
      success: false,
      concepts: [],
      conceptCount: 0,
      provider,
      error: 'לא נוצרו קונספטים. נסה שוב.',
    };
  }

  // ── Step 5: Creative Director enrichment (non-blocking) ──
  let creativeDirectorData: Record<string, any> | null = null;
  try {
    const industry = (profile as any)?.data?.industry || (profile as any)?.industry || 'general';
    const cdResult = await generateCreativeDirection({
      clientName: entityName,
      industry,
      campaignGoal: rawConcepts[0]?.description || 'brand awareness',
      targetAudience: rawConcepts[0]?.recommended_audience || 'general',
      brandProfile: profile || undefined,
    });
    if (cdResult.success) {
      creativeDirectorData = {
        creativeStrategy: cdResult.strategy,
        scrollStopReason: cdResult.scrollStopElement,
        industryAnchor: cdResult.industryAnchor,
        typographyRecommendation: cdResult.typographyRules,
        scores: cdResult.scores,
        isMock: cdResult.isMock,
      };
      console.log(`[ConceptEngine] Creative Director enriched — strategy: ${cdResult.strategy}, score: ${cdResult.scores?.overall || 'N/A'}`);
    }
  } catch (cdErr) {
    console.warn('[ConceptEngine] Creative Director enrichment skipped (non-critical):', cdErr);
  }

  // ── Step 6: Save to DB ──
  let savedConcepts: CreativeConcept[];
  try {
    savedConcepts = await saveConcepts(
      rawConcepts,
      entityType,
      entityId,
      profile?.id || null,
      provider,
      creativeDirectorData
    );
    console.log(`[ConceptEngine] Saved ${savedConcepts.length}/${rawConcepts.length} concepts to DB`);
  } catch (err) {
    console.error('[ConceptEngine] Failed to save concepts:', err);
    return {
      success: false,
      concepts: [],
      conceptCount: 0,
      provider,
      error: 'נוצרו קונספטים אך השמירה נכשלה.',
    };
  }

  // ── Step 7: Return ──
  console.log(
    `[ConceptEngine] Done. ${savedConcepts.length} concepts generated via ${provider} for ${entityType}: "${entityName}"`
  );

  return {
    success: true,
    concepts: savedConcepts,
    conceptCount: savedConcepts.length,
    provider,
  };
}
