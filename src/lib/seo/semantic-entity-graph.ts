// גרף ישויות סמנטי — Semantic Entity Graph
// בונה מפת ישויות של האתר, מזהה קשרים חסרים ופערים סמנטיים

import { generateWithAI } from '@/lib/ai/openai-client';
import { ContentItem, ContentInventory } from './wp-content-inventory';
import { AutomationContext } from './seo-automator';
import { SEOActionEntry } from './seo-action-log';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface Entity {
  name: string;
  type: 'business' | 'product' | 'service' | 'location' | 'person' | 'concept' | 'industry' | 'brand';
  mentions: number;
  pages: string[];       // כתובות דפים שבהם הישות מוזכרת
  relationships: EntityRelationship[];
  strength: number;      // 0-100 כמה הישות מבוססת באתר
}

export interface EntityRelationship {
  targetEntity: string;
  type: 'provides' | 'located_in' | 'part_of' | 'related_to' | 'specializes_in' | 'serves' | 'competes_with';
  strength: number;
  evidence: string[];    // כתובות דפים שבהם הקשר קיים
}

export interface EntityGraphResult {
  entities: Entity[];
  missingEntities: Array<{ name: string; type: string; reason: string; suggestedPages: string[] }>;
  weakRelationships: Array<{ entity1: string; entity2: string; currentStrength: number; targetStrength: number; action: string }>;
  disconnectedTopics: string[];
  semanticGaps: Array<{ topic: string; gap: string; suggestedAction: string }>;
  overallSemanticScore: number;  // 0-100
  actions: SEOActionEntry[];
}

// ============================================================================
// חילוץ ישויות מתוכן — Entity Extraction
// ============================================================================

/**
 * מחלץ ישויות ידועות מתוך טקסט של דף
 * בודק אזכורים של שם העסק, מוצרים, מיקום, תעשייה ומונחים נוספים
 */
function extractKnownEntities(
  item: ContentItem,
  context: AutomationContext
): Array<{ name: string; type: Entity['type']; count: number }> {
  const results: Array<{ name: string; type: Entity['type']; count: number }> = [];
  const text = item.plainText.toLowerCase();

  // ישות עסק — Business entity
  if (context.businessName) {
    const businessLower = context.businessName.toLowerCase();
    const count = countOccurrences(text, businessLower);
    if (count > 0) {
      results.push({ name: context.businessName, type: 'business', count });
    }
  }

  // מוצרים ושירותים — Products & services
  for (const product of context.products) {
    const productLower = product.toLowerCase();
    const count = countOccurrences(text, productLower);
    if (count > 0) {
      results.push({ name: product, type: 'product', count });
    }
  }

  // מיקום — Location
  if (context.location) {
    const locationLower = context.location.toLowerCase();
    const count = countOccurrences(text, locationLower);
    if (count > 0) {
      results.push({ name: context.location, type: 'location', count });
    }
  }

  // תעשייה — Industry
  if (context.industry) {
    const industryLower = context.industry.toLowerCase();
    const count = countOccurrences(text, industryLower);
    if (count > 0) {
      results.push({ name: context.industry, type: 'industry', count });
    }
  }

  // מילות מפתח כקונספטים — Keywords as concepts
  for (const kw of context.targetKeywords) {
    const kwLower = kw.toLowerCase();
    const count = countOccurrences(text, kwLower);
    if (count > 0) {
      results.push({ name: kw, type: 'concept', count });
    }
  }

  return results;
}

/**
 * סופר מופעים של מחרוזת בתוך טקסט
 */
function countOccurrences(text: string, search: string): number {
  if (!search || !text) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(search, pos)) !== -1) {
    count++;
    pos += search.length;
  }
  return count;
}

// ============================================================================
// בניית גרף ישויות — Build Entity Graph
// ============================================================================

/**
 * בונה גרף ישויות מלא עבור כל האתר
 * מזהה ישויות, קשרים, פערים וחולשות סמנטיות
 */
export function buildEntityGraph(
  inventory: ContentInventory,
  context: AutomationContext
): EntityGraphResult {
  const entityMap = new Map<string, Entity>();
  const actions: SEOActionEntry[] = [];

  // שלב 1: חילוץ ישויות מכל הדפים
  for (const item of inventory.items) {
    const extracted = extractKnownEntities(item, context);
    for (const ent of extracted) {
      const existing = entityMap.get(ent.name);
      if (existing) {
        existing.mentions += ent.count;
        if (!existing.pages.includes(item.url)) {
          existing.pages.push(item.url);
        }
      } else {
        entityMap.set(ent.name, {
          name: ent.name,
          type: ent.type,
          mentions: ent.count,
          pages: [item.url],
          relationships: [],
          strength: 0,
        });
      }
    }
  }

  // שלב 2: חישוב חוזק ישות — Strength calculation
  const totalPages = inventory.items.length || 1;
  for (const entity of entityMap.values()) {
    const pageCoverage = (entity.pages.length / totalPages) * 100;
    const mentionDensity = Math.min(entity.mentions / totalPages * 20, 100);
    entity.strength = Math.round(pageCoverage * 0.6 + mentionDensity * 0.4);
  }

  // שלב 3: זיהוי קשרים — Relationship detection
  // שתי ישויות שמופיעות יחד באותו דף = קשר
  const entities = Array.from(entityMap.values());
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const e1 = entities[i];
      const e2 = entities[j];
      const sharedPages = e1.pages.filter(p => e2.pages.includes(p));
      if (sharedPages.length > 0) {
        const strength = Math.round((sharedPages.length / Math.max(e1.pages.length, e2.pages.length)) * 100);
        const relType = inferRelationshipType(e1, e2);

        e1.relationships.push({
          targetEntity: e2.name,
          type: relType,
          strength,
          evidence: sharedPages,
        });
        e2.relationships.push({
          targetEntity: e1.name,
          type: relType,
          strength,
          evidence: sharedPages,
        });
      }
    }
  }

  // שלב 4: ישויות חסרות — Missing entities
  const missingEntities: EntityGraphResult['missingEntities'] = [];

  // מוצרים שלא מוזכרים מספיק
  for (const product of context.products) {
    const entity = entityMap.get(product);
    if (!entity) {
      missingEntities.push({
        name: product,
        type: 'product',
        reason: `המוצר/שירות "${product}" לא מוזכר באף דף באתר`,
        suggestedPages: inventory.pages.slice(0, 3).map(p => p.url),
      });
    } else if (entity.pages.length < 2) {
      missingEntities.push({
        name: product,
        type: 'product',
        reason: `המוצר/שירות "${product}" מוזכר רק בדף אחד — צריך פיזור רחב יותר`,
        suggestedPages: inventory.pages.filter(p => !entity.pages.includes(p.url)).slice(0, 3).map(p => p.url),
      });
    }
  }

  // מיקום לא מוזכר מספיק
  if (context.location) {
    const locEntity = entityMap.get(context.location);
    if (!locEntity || locEntity.pages.length < Math.min(3, totalPages)) {
      missingEntities.push({
        name: context.location,
        type: 'location',
        reason: `המיקום "${context.location}" לא מוזכר מספיק — חשוב ל-Local SEO`,
        suggestedPages: inventory.pages.slice(0, 5).map(p => p.url),
      });
    }
  }

  // שלב 5: קשרים חלשים — Weak relationships
  const weakRelationships: EntityGraphResult['weakRelationships'] = [];

  // העסק צריך קשר חזק עם כל מוצר
  const businessEntity = entityMap.get(context.businessName);
  if (businessEntity) {
    for (const product of context.products) {
      const rel = businessEntity.relationships.find(r => r.targetEntity === product);
      if (!rel || rel.strength < 50) {
        weakRelationships.push({
          entity1: context.businessName,
          entity2: product,
          currentStrength: rel?.strength ?? 0,
          targetStrength: 70,
          action: `חזק את הקשר בין "${context.businessName}" ל-"${product}" — הזכר את שניהם יחד ביותר דפים`,
        });
      }
    }
  }

  // שלב 6: נושאים מנותקים — Disconnected topics
  const disconnectedTopics: string[] = [];
  for (const entity of entities) {
    if (entity.relationships.length === 0 && entity.type !== 'concept') {
      disconnectedTopics.push(entity.name);
    }
  }

  // שלב 7: פערים סמנטיים — Semantic gaps
  const semanticGaps: EntityGraphResult['semanticGaps'] = [];

  // מילות מפתח שאין להן ישות תואמת
  for (const kw of context.targetKeywords) {
    const entity = entityMap.get(kw);
    if (!entity || entity.strength < 30) {
      semanticGaps.push({
        topic: kw,
        gap: `מילת המפתח "${kw}" לא מבוססת מספיק בתוכן האתר`,
        suggestedAction: `צור תוכן ייעודי סביב "${kw}" או הוסף אזכורים בדפים קיימים`,
      });
    }
  }

  // בדיקה שיש גיוון סוגי ישויות
  const typeCounts = new Map<string, number>();
  for (const entity of entities) {
    typeCounts.set(entity.type, (typeCounts.get(entity.type) || 0) + 1);
  }
  if (!typeCounts.has('location') && context.location) {
    semanticGaps.push({
      topic: 'מיקום גיאוגרפי',
      gap: 'אין ישות מיקום מבוססת באתר',
      suggestedAction: 'הוסף תוכן מקומי עם אזכור מיקום בדפים הראשיים',
    });
  }

  // שלב 8: ציון כולל — Overall semantic score
  const entityStrengthAvg = entities.length > 0
    ? entities.reduce((sum, e) => sum + e.strength, 0) / entities.length
    : 0;
  const relationshipCoverage = entities.length > 1
    ? entities.filter(e => e.relationships.length > 0).length / entities.length * 100
    : 0;
  const missingPenalty = missingEntities.length * 5;
  const gapPenalty = semanticGaps.length * 3;

  const overallSemanticScore = Math.max(0, Math.min(100, Math.round(
    entityStrengthAvg * 0.4 +
    relationshipCoverage * 0.3 +
    (100 - missingPenalty) * 0.15 +
    (100 - gapPenalty) * 0.15
  )));

  // יצירת פעולות לוג
  if (missingEntities.length > 0) {
    actions.push({
      id: `entity-missing-${Date.now()}`,
      planId: context.planId || '',
      date: new Date().toISOString(),
      actionType: 'technical_issue_found',
      module: 'semantic-entity-graph',
      description: `נמצאו ${missingEntities.length} ישויות חסרות או חלשות בגרף הסמנטי`,
      seoReason: 'ישויות חסרות מונעות מגוגל לבנות Knowledge Graph מדויק לעסק',
      expectedImpact: missingEntities.length > 3 ? 'high' : 'medium',
      status: 'completed',
      isReversible: false,
    });
  }

  if (weakRelationships.length > 0) {
    actions.push({
      id: `entity-weak-${Date.now()}`,
      planId: context.planId || '',
      date: new Date().toISOString(),
      actionType: 'technical_issue_found',
      module: 'semantic-entity-graph',
      description: `נמצאו ${weakRelationships.length} קשרים חלשים בין ישויות — צריך חיזוק`,
      seoReason: 'קשרים חלשים בין ישויות מפחיתים את הסמכות הטופולוגית של האתר',
      expectedImpact: 'medium',
      status: 'completed',
      isReversible: false,
    });
  }

  return {
    entities,
    missingEntities,
    weakRelationships,
    disconnectedTopics,
    semanticGaps,
    overallSemanticScore,
    actions,
  };
}

// ============================================================================
// הסקת סוג קשר — Relationship Type Inference
// ============================================================================

function inferRelationshipType(e1: Entity, e2: Entity): EntityRelationship['type'] {
  // עסק + מיקום = located_in
  if ((e1.type === 'business' && e2.type === 'location') ||
      (e1.type === 'location' && e2.type === 'business')) {
    return 'located_in';
  }
  // עסק + מוצר/שירות = provides
  if ((e1.type === 'business' && (e2.type === 'product' || e2.type === 'service')) ||
      ((e1.type === 'product' || e1.type === 'service') && e2.type === 'business')) {
    return 'provides';
  }
  // עסק + תעשייה = specializes_in
  if ((e1.type === 'business' && e2.type === 'industry') ||
      (e1.type === 'industry' && e2.type === 'business')) {
    return 'specializes_in';
  }
  // מוצר + קונספט = part_of
  if ((e1.type === 'product' && e2.type === 'concept') ||
      (e1.type === 'concept' && e2.type === 'product')) {
    return 'part_of';
  }
  // ברירת מחדל
  return 'related_to';
}

// ============================================================================
// הצעות העשרת ישויות — Entity Enrichment Suggestions
// ============================================================================

/**
 * מציע העשרות לישויות קיימות — איפה להוסיף אזכורים וקשרים
 */
export function suggestEntityEnrichments(
  graph: EntityGraphResult,
  context: AutomationContext
): Array<{ pageId: number; entity: string; suggestion: string }> {
  const suggestions: Array<{ pageId: number; entity: string; suggestion: string }> = [];

  // ישויות חסרות — הצע להוסיף בדפים מתאימים
  for (const missing of graph.missingEntities) {
    for (const pageUrl of missing.suggestedPages) {
      suggestions.push({
        pageId: 0, // ייפתר לפי URL
        entity: missing.name,
        suggestion: `הוסף אזכור של "${missing.name}" בדף ${pageUrl} — ${missing.reason}`,
      });
    }
  }

  // קשרים חלשים — הצע חיזוק
  for (const weak of graph.weakRelationships) {
    suggestions.push({
      pageId: 0,
      entity: weak.entity1,
      suggestion: weak.action,
    });
  }

  // ישויות מנותקות — הצע לקשר
  for (const topic of graph.disconnectedTopics) {
    suggestions.push({
      pageId: 0,
      entity: topic,
      suggestion: `הישות "${topic}" מנותקת מהגרף הסמנטי — הוסף אזכורים שלה יחד עם ישויות מרכזיות אחרות`,
    });
  }

  return suggestions;
}

// ============================================================================
// ביצוע ניתוח גרף ישויות — Execute Entity Graph Analysis
// ============================================================================

/**
 * מריץ ניתוח גרף ישויות מלא עם AI לגילוי ישויות נוספות
 */
export async function executeEntityGraphAnalysis(
  inventory: ContentInventory,
  context: AutomationContext
): Promise<EntityGraphResult> {
  // שלב 1: בנה גרף בסיסי מהתוכן הקיים
  const graph = buildEntityGraph(inventory, context);

  // שלב 2: בקש מ-AI לזהות ישויות נוספות שלא נלכדו
  const topPages = inventory.items.slice(0, 10);
  const pagesContext = topPages.map(p => `דף: ${p.title}\nURL: ${p.url}\nתקציר: ${p.plainText.slice(0, 300)}`).join('\n---\n');

  const aiResult = await generateWithAI(
    `אתה מומחה SEO סמנטי. נתח את המידע הבא וזהה ישויות נוספות שחשוב לחזק באתר.
העסק: ${context.businessName}
תעשייה: ${context.industry}
מיקום: ${context.location}
מוצרים: ${context.products.join(', ')}`,
    `הנה הדפים באתר:
${pagesContext}

ישויות שכבר זוהו: ${graph.entities.map(e => e.name).join(', ')}

זהה עד 5 ישויות נוספות שחשוב לבנות באתר (מונחי תעשייה, שירותים משניים, מושגים חשובים).
החזר JSON בפורמט:
[{"name": "שם הישות", "type": "concept|service|industry", "reason": "למה חשוב", "suggestedPages": ["url1"]}]
החזר רק את ה-JSON, ללא טקסט נוסף.`,
    { temperature: 0.3, maxTokens: 1000 }
  );

  if (aiResult.success && aiResult.data) {
    try {
      const aiEntities = JSON.parse(aiResult.data as string);
      if (Array.isArray(aiEntities)) {
        for (const aiEnt of aiEntities) {
          if (aiEnt.name && aiEnt.reason) {
            graph.missingEntities.push({
              name: aiEnt.name,
              type: aiEnt.type || 'concept',
              reason: aiEnt.reason,
              suggestedPages: aiEnt.suggestedPages || [],
            });
          }
        }
      }
    } catch {
      // אם ה-AI לא החזיר JSON תקין — נמשיך עם הגרף הבסיסי
    }
  }

  // שלב 3: עדכן ציון כולל אחרי ההעשרה
  const missingPenalty = graph.missingEntities.length * 5;
  const gapPenalty = graph.semanticGaps.length * 3;
  const entityStrengthAvg = graph.entities.length > 0
    ? graph.entities.reduce((sum, e) => sum + e.strength, 0) / graph.entities.length
    : 0;
  const relationshipCoverage = graph.entities.length > 1
    ? graph.entities.filter(e => e.relationships.length > 0).length / graph.entities.length * 100
    : 0;

  graph.overallSemanticScore = Math.max(0, Math.min(100, Math.round(
    entityStrengthAvg * 0.4 +
    relationshipCoverage * 0.3 +
    (100 - missingPenalty) * 0.15 +
    (100 - gapPenalty) * 0.15
  )));

  return graph;
}
