// מנוע קישור פנימי חכם — AI-Powered Internal Linking Engine
// מזהה הזדמנויות קישור, בונה גרף קשרים, ומבצע קישור אוטומטי

import { WPConnection, updatePageContent, getPages } from './wordpress-client';
import {
  ContentItem,
  ContentInventory,
  buildContentInventory,
  stripHtml,
  extractLinksFromContent,
} from './wp-content-inventory';
import { generateWithAI } from '@/lib/ai/openai-client';
import { SEOActionEntry } from './seo-action-log';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface LinkRecommendation {
  sourcePageId: number;
  sourcePageUrl: string;
  sourcePageTitle: string;
  targetPageId: number;
  targetPageUrl: string;
  targetPageTitle: string;
  anchorText: string;
  reason: string;                // עברית: למה הקישור הזה עוזר
  semanticRelationship: string;  // סוג הקשר הסמנטי
  impactPriority: 'critical' | 'high' | 'medium' | 'low';
  insertionPoint: string;        // תיאור מיקום ההכנסה
  contextSentence: string;       // המשפט או הפסקה שבה הקישור ייכנס
}

export interface LinkingResult {
  recommendations: LinkRecommendation[];
  applied: LinkApplication[];
  orphanPagesFixed: number;
  deadEndPagesFixed: number;
  pillarPagesStrengthened: number;
  totalLinksAdded: number;
  actions: SEOActionEntry[];
}

export interface LinkApplication {
  sourcePageId: number;
  targetPageId: number;
  anchorText: string;
  applied: boolean;
  error?: string;
}

// ============================================================================
// גרף קישורים פנימיים — Internal Link Graph
// ============================================================================

interface LinkGraphNode {
  pageId: number;
  url: string;
  title: string;
  slug: string;
  inboundLinks: number[];   // מזהי עמודים שמקשרים לעמוד הזה
  outboundLinks: number[];  // מזהי עמודים שהעמוד הזה מקשר אליהם
  keywords: string[];       // מילות מפתח מזוהות מהעמוד
  headings: string[];       // כותרות העמוד
  contentLength: number;
  pageType: 'pillar' | 'supporting' | 'orphan' | 'dead_end' | 'normal';
}

interface LinkGraphAnalysis {
  nodes: Map<number, LinkGraphNode>;
  orphanPages: number[];      // עמודים ללא קישורים נכנסים
  deadEndPages: number[];     // עמודים ללא קישורים יוצאים
  pillarPages: number[];      // עמודי תוכן מרכזיים (הרבה קישורים נכנסים)
  clusters: PageCluster[];    // אשכולות תוכן קשור
  totalInternalLinks: number;
  avgLinksPerPage: number;
  maxInbound: number;
  maxOutbound: number;
}

interface PageCluster {
  pillarPageId: number | null;
  pageIds: number[];
  commonKeywords: string[];
  topic: string;
}

// ============================================================================
// AutomationContext (ייבוא מהמודול המרכזי)
// ============================================================================

interface AutomationContext {
  connection: WPConnection;
  businessName: string;
  businessType: string;
  industry: string;
  products: string[];
  location: string;
  targetKeywords: string[];
  planId?: string;
}

// ============================================================================
// ניתוח גרף קישורים — Link Graph Analysis
// ============================================================================

/**
 * בנייה וניתוח גרף הקישורים הפנימיים של האתר
 * סורק את כל העמודים, מזהה קשרים קיימים, ומסווג עמודים לפי תפקידם
 */
export function analyzeInternalLinkGraph(inventory: ContentInventory): LinkGraphAnalysis {
  const nodes = new Map<number, LinkGraphNode>();
  const siteUrl = extractSiteUrl(inventory);

  // שלב 1: יצירת צמתים עבור כל עמוד
  for (const item of inventory.items) {
    const keywords = extractKeywordsFromContent(item);
    const headingTexts = item.headings.map(h => h.text);

    nodes.set(item.id, {
      pageId: item.id,
      url: item.url,
      title: item.title,
      slug: item.slug,
      inboundLinks: [],
      outboundLinks: [],
      keywords,
      headings: headingTexts,
      contentLength: stripHtml(item.content).length,
      pageType: 'normal',
    });
  }

  // שלב 2: מיפוי קישורים קיימים בין עמודים
  const urlToId = new Map<string, number>();
  for (const item of inventory.items) {
    urlToId.set(normalizeUrl(item.url), item.id);
    // גם לפי slug למקרה שיש קישורים יחסיים
    if (item.slug) {
      urlToId.set(normalizeUrl(`/${item.slug}`), item.id);
      urlToId.set(normalizeUrl(`/${item.slug}/`), item.id);
    }
  }

  let totalInternalLinks = 0;

  for (const item of inventory.items) {
    const links = extractLinksFromContent(item.content, siteUrl);
    const node = nodes.get(item.id);
    if (!node) continue;

    for (const link of links) {
      if (!link.isInternal) continue;

      const normalizedHref = normalizeUrl(link.href);
      let targetId = urlToId.get(normalizedHref);

      // ניסיון התאמה חלקית — לפי slug
      if (!targetId) {
        const slug = extractSlugFromUrl(link.href);
        if (slug) {
          for (const [, id] of urlToId) {
            const targetNode = nodes.get(id);
            if (targetNode && targetNode.slug === slug && id !== item.id) {
              targetId = id;
              break;
            }
          }
        }
      }

      if (targetId && targetId !== item.id) {
        if (!node.outboundLinks.includes(targetId)) {
          node.outboundLinks.push(targetId);
          totalInternalLinks++;
        }
        const targetNode = nodes.get(targetId);
        if (targetNode && !targetNode.inboundLinks.includes(item.id)) {
          targetNode.inboundLinks.push(item.id);
        }
      }
    }
  }

  // שלב 3: סיווג עמודים
  const orphanPages: number[] = [];
  const deadEndPages: number[] = [];
  const pillarPages: number[] = [];
  const pageCount = nodes.size;
  let maxInbound = 0;
  let maxOutbound = 0;

  // חישוב סף לעמודי pillar — לפחות 3 קישורים נכנסים או top 10%
  const inboundCounts = Array.from(nodes.values()).map(n => n.inboundLinks.length);
  inboundCounts.sort((a, b) => b - a);
  const pillarThreshold = Math.max(3, inboundCounts[Math.floor(pageCount * 0.1)] || 3);

  for (const [pageId, node] of nodes) {
    maxInbound = Math.max(maxInbound, node.inboundLinks.length);
    maxOutbound = Math.max(maxOutbound, node.outboundLinks.length);

    if (node.inboundLinks.length === 0) {
      node.pageType = 'orphan';
      orphanPages.push(pageId);
    } else if (node.outboundLinks.length === 0) {
      node.pageType = 'dead_end';
      deadEndPages.push(pageId);
    } else if (
      node.inboundLinks.length >= pillarThreshold &&
      node.contentLength > 1000
    ) {
      node.pageType = 'pillar';
      pillarPages.push(pageId);
    }
  }

  // שלב 4: זיהוי אשכולות תוכן — לפי דמיון מילות מפתח
  const clusters = identifyContentClusters(nodes, pillarPages);

  const avgLinksPerPage = pageCount > 0 ? totalInternalLinks / pageCount : 0;

  return {
    nodes,
    orphanPages,
    deadEndPages,
    pillarPages,
    clusters,
    totalInternalLinks,
    avgLinksPerPage,
    maxInbound,
    maxOutbound,
  };
}

/**
 * זיהוי אשכולות תוכן קשור — קיבוץ עמודים לפי דמיון סמנטי
 */
function identifyContentClusters(
  nodes: Map<number, LinkGraphNode>,
  pillarPages: number[]
): PageCluster[] {
  const clusters: PageCluster[] = [];
  const assigned = new Set<number>();

  // עבור כל עמוד pillar — מצא עמודים תומכים קשורים
  for (const pillarId of pillarPages) {
    const pillarNode = nodes.get(pillarId);
    if (!pillarNode) continue;

    const cluster: PageCluster = {
      pillarPageId: pillarId,
      pageIds: [pillarId],
      commonKeywords: [...pillarNode.keywords],
      topic: pillarNode.title,
    };
    assigned.add(pillarId);

    // חפש עמודים עם חפיפת מילות מפתח גבוהה
    for (const [pageId, node] of nodes) {
      if (assigned.has(pageId)) continue;
      const overlap = calculateKeywordOverlap(pillarNode.keywords, node.keywords);
      if (overlap >= 0.2) {
        cluster.pageIds.push(pageId);
        assigned.add(pageId);
      }
    }

    if (cluster.pageIds.length > 1) {
      clusters.push(cluster);
    }
  }

  // עמודים שלא שויכו — בדוק אם יש דמיון ביניהם
  const unassigned = Array.from(nodes.keys()).filter(id => !assigned.has(id));
  if (unassigned.length >= 2) {
    // קיבוץ פשוט לפי דמיון
    const miscCluster: PageCluster = {
      pillarPageId: null,
      pageIds: unassigned,
      commonKeywords: [],
      topic: 'עמודים לא מסווגים',
    };
    clusters.push(miscCluster);
  }

  return clusters;
}

// ============================================================================
// יצירת המלצות קישור — Link Recommendation Generation
// ============================================================================

/**
 * מייצר המלצות קישור חכמות בהתבסס על ניתוח הגרף והדמיון הסמנטי
 */
export async function generateLinkRecommendations(
  inventory: ContentInventory,
  context: AutomationContext
): Promise<LinkRecommendation[]> {
  const graph = analyzeInternalLinkGraph(inventory);
  const recommendations: LinkRecommendation[] = [];
  const siteUrl = extractSiteUrl(inventory);

  // מעקב אחרי מספר קישורים חדשים לכל עמוד
  const newLinksPerPage = new Map<number, number>();

  // כלל 1: תיקון עמודי orphan — כל עמוד ללא קישורים נכנסים חייב לקבל לפחות 1
  for (const orphanId of graph.orphanPages) {
    const orphanNode = graph.nodes.get(orphanId);
    if (!orphanNode) continue;

    const bestSource = findBestLinkSource(orphanNode, graph.nodes, newLinksPerPage, 'inbound');
    if (bestSource) {
      recommendations.push(
        createRecommendation(
          bestSource, orphanNode,
          `עמוד זה לא מקבל אף קישור פנימי — חיוני לקדם אותו דרך קישור מעמוד קשור`,
          'related_topic',
          'critical',
          graph,
        )
      );
      incrementLinkCount(newLinksPerPage, bestSource.pageId);
    }
  }

  // כלל 2: תיקון עמודי dead-end — כל עמוד ללא קישורים יוצאים חייב לקשר ללפחות עמוד 1
  for (const deadEndId of graph.deadEndPages) {
    const deadEndNode = graph.nodes.get(deadEndId);
    if (!deadEndNode) continue;

    const bestTarget = findBestLinkTarget(deadEndNode, graph.nodes, newLinksPerPage);
    if (bestTarget) {
      recommendations.push(
        createRecommendation(
          deadEndNode, bestTarget,
          `עמוד זה לא מכיל אף קישור פנימי — הוספת קישור תשפר את חוויית המשתמש והסריקה`,
          'related_topic',
          'high',
          graph,
        )
      );
      incrementLinkCount(newLinksPerPage, deadEndId);
    }
  }

  // כלל 3: חיזוק עמודי pillar — לינק מכל עמוד תומך באשכול
  for (const cluster of graph.clusters) {
    if (!cluster.pillarPageId) continue;
    const pillarNode = graph.nodes.get(cluster.pillarPageId);
    if (!pillarNode) continue;

    for (const supportingId of cluster.pageIds) {
      if (supportingId === cluster.pillarPageId) continue;
      const supportingNode = graph.nodes.get(supportingId);
      if (!supportingNode) continue;

      // Pillar → Supporting: ודא שעמוד ה-pillar מקשר לכל עמוד תומך
      if (!pillarNode.outboundLinks.includes(supportingId)) {
        if (getNewLinkCount(newLinksPerPage, pillarNode.pageId) < 5) {
          recommendations.push(
            createRecommendation(
              pillarNode, supportingNode,
              `עמוד Pillar צריך לקשר לכל עמוד תומך באשכול שלו`,
              'pillar_to_supporting',
              'high',
              graph,
            )
          );
          incrementLinkCount(newLinksPerPage, pillarNode.pageId);
        }
      }

      // Supporting → Pillar: ודא שכל עמוד תומך מקשר בחזרה ל-pillar
      if (!supportingNode.outboundLinks.includes(cluster.pillarPageId)) {
        if (getNewLinkCount(newLinksPerPage, supportingId) < 5) {
          recommendations.push(
            createRecommendation(
              supportingNode, pillarNode,
              `עמוד תומך צריך לקשר בחזרה לעמוד ה-Pillar המרכזי`,
              'supporting_to_pillar',
              'medium',
              graph,
            )
          );
          incrementLinkCount(newLinksPerPage, supportingId);
        }
      }
    }
  }

  // כלל 4: קישורים צולבים בין עמודים קשורים
  const allNodes = Array.from(graph.nodes.values());
  for (let i = 0; i < allNodes.length; i++) {
    const nodeA = allNodes[i];
    if (getNewLinkCount(newLinksPerPage, nodeA.pageId) >= 5) continue;

    for (let j = i + 1; j < allNodes.length; j++) {
      const nodeB = allNodes[j];
      if (nodeA.outboundLinks.includes(nodeB.pageId)) continue;
      if (getNewLinkCount(newLinksPerPage, nodeA.pageId) >= 5) break;

      const overlap = calculateKeywordOverlap(nodeA.keywords, nodeB.keywords);
      const headingOverlap = calculateKeywordOverlap(nodeA.headings, nodeB.headings);
      const combinedScore = overlap * 0.6 + headingOverlap * 0.4;

      if (combinedScore >= 0.25) {
        const relationship = determineRelationship(nodeA, nodeB);
        recommendations.push(
          createRecommendation(
            nodeA, nodeB,
            `דמיון סמנטי גבוה (${Math.round(combinedScore * 100)}%) — קישור צולב ישפר SEO`,
            relationship,
            combinedScore >= 0.5 ? 'high' : 'medium',
            graph,
          )
        );
        incrementLinkCount(newLinksPerPage, nodeA.pageId);
      }
    }
  }

  // מיון לפי עדיפות
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.impactPriority] - priorityOrder[b.impactPriority]);

  return recommendations;
}

// ============================================================================
// החלת קישורים — Link Application
// ============================================================================

/**
 * מחיל את המלצות הקישור על תוכן העמודים
 * מוצא נקודת הכנסה טבעית, עוטף את טקסט העוגן בקישור, ושומר
 */
export async function applyInternalLinks(
  recommendations: LinkRecommendation[],
  connection: WPConnection,
  dryRun: boolean = false
): Promise<LinkApplication[]> {
  const results: LinkApplication[] = [];

  // קיבוץ לפי עמוד מקור — כדי לבצע עדכון אחד לכל עמוד
  const bySourcePage = new Map<number, LinkRecommendation[]>();
  for (const rec of recommendations) {
    const existing = bySourcePage.get(rec.sourcePageId) || [];
    existing.push(rec);
    bySourcePage.set(rec.sourcePageId, existing);
  }

  // טעינת תוכן עדכני של כל העמודים
  const pages = await getPages(connection);
  const pageContentMap = new Map<number, string>();
  for (const page of pages) {
    pageContentMap.set(page.id, page.content);
  }

  for (const [sourcePageId, recs] of bySourcePage) {
    let content = pageContentMap.get(sourcePageId);
    if (!content) {
      for (const rec of recs) {
        results.push({
          sourcePageId,
          targetPageId: rec.targetPageId,
          anchorText: rec.anchorText,
          applied: false,
          error: 'עמוד מקור לא נמצא',
        });
      }
      continue;
    }

    let contentModified = false;

    for (const rec of recs) {
      // ודא שהקישור לא קיים כבר
      if (content.includes(`href="${rec.targetPageUrl}"`) ||
          content.includes(`href='${rec.targetPageUrl}'`)) {
        results.push({
          sourcePageId,
          targetPageId: rec.targetPageId,
          anchorText: rec.anchorText,
          applied: false,
          error: 'קישור כבר קיים בעמוד',
        });
        continue;
      }

      // ניסיון 1: חפש את טקסט העוגן בתוכן ועטוף אותו בקישור
      const insertResult = insertLinkInContent(content, rec);
      if (insertResult.success && insertResult.newContent) {
        content = insertResult.newContent;
        contentModified = true;
        results.push({
          sourcePageId,
          targetPageId: rec.targetPageId,
          anchorText: rec.anchorText,
          applied: true,
        });
      } else {
        // ניסיון 2: הוסף קטע "קרא עוד" בסוף פסקה קשורה
        const fallbackResult = insertReadMoreLink(content, rec);
        if (fallbackResult.success && fallbackResult.newContent) {
          content = fallbackResult.newContent;
          contentModified = true;
          results.push({
            sourcePageId,
            targetPageId: rec.targetPageId,
            anchorText: rec.anchorText,
            applied: true,
          });
        } else {
          results.push({
            sourcePageId,
            targetPageId: rec.targetPageId,
            anchorText: rec.anchorText,
            applied: false,
            error: 'לא נמצאה נקודת הכנסה מתאימה',
          });
        }
      }
    }

    // שמירת התוכן המעודכן
    if (contentModified && !dryRun) {
      try {
        await updatePageContent(connection, sourcePageId, content);
      } catch (err: any) {
        // סמן את כל הקישורים של העמוד הזה כנכשלים
        for (const result of results) {
          if (result.sourcePageId === sourcePageId && result.applied) {
            result.applied = false;
            result.error = `שגיאה בשמירת העמוד: ${err.message || 'Unknown error'}`;
          }
        }
      }
    }
  }

  return results;
}

// ============================================================================
// הכנסת קישור לתוך התוכן — Link Insertion Logic
// ============================================================================

interface InsertionResult {
  success: boolean;
  newContent?: string;
}

/**
 * מוצא את טקסט העוגן בתוכן ועוטף אותו בקישור
 * מוודא שהטקסט לא נמצא כבר בתוך קישור קיים
 */
function insertLinkInContent(
  content: string,
  recommendation: LinkRecommendation
): InsertionResult {
  const { anchorText, targetPageUrl } = recommendation;

  // חפש את טקסט העוגן בתוכן — לא בתוך תגית a קיימת
  const escapedAnchor = escapeRegExp(anchorText);

  // ודא שהטקסט לא נמצא בתוך <a>...</a>
  const anchorPattern = new RegExp(
    `(?<!<a[^>]*>(?:[^<]*))\\b(${escapedAnchor})\\b(?![^<]*<\\/a>)`,
    'i'
  );

  const match = anchorPattern.exec(content);
  if (!match) return { success: false };

  // בדוק שאנחנו בתוך פסקה ולא בכותרת או רכיב אחר
  const beforeMatch = content.substring(0, match.index);
  const lastOpenTag = beforeMatch.lastIndexOf('<');
  const lastCloseTag = beforeMatch.lastIndexOf('>');

  // אם התגית הפתוחה האחרונה לא נסגרה, אנחנו בתוך תגית — דלג
  if (lastOpenTag > lastCloseTag) return { success: false };

  // ודא שאנחנו בתוך p, li, td — לא בתוך h1/h2/h3
  const tagContext = getEnclosingTag(content, match.index);
  if (tagContext && /^h[1-6]$/i.test(tagContext)) return { success: false };

  // עטוף את הטקסט בקישור
  const link = `<a href="${targetPageUrl}">${match[1]}</a>`;
  const newContent = content.substring(0, match.index) + link + content.substring(match.index + match[0].length);

  return { success: true, newContent };
}

/**
 * Fallback: הוספת "קרא עוד" בסוף פסקה קשורה
 */
function insertReadMoreLink(
  content: string,
  recommendation: LinkRecommendation
): InsertionResult {
  const { targetPageUrl, targetPageTitle } = recommendation;

  // מצא פסקה שמכילה מילות מפתח קשורות
  const targetKeywords = targetPageTitle.split(/\s+/).filter(w => w.length > 2);
  const paragraphs = content.match(/<p[^>]*>[\s\S]*?<\/p>/gi) || [];

  let bestParagraphIndex = -1;
  let bestScore = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const plainText = stripHtml(paragraphs[i]).toLowerCase();
    let score = 0;
    for (const keyword of targetKeywords) {
      if (plainText.includes(keyword.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestParagraphIndex = i;
    }
  }

  // אם לא נמצאה פסקה קשורה, השתמש בפסקה האחרונה
  if (bestParagraphIndex === -1 && paragraphs.length > 0) {
    bestParagraphIndex = paragraphs.length - 1;
  }

  if (bestParagraphIndex === -1) return { success: false };

  const targetParagraph = paragraphs[bestParagraphIndex];
  const readMoreLink = ` <a href="${targetPageUrl}">קרא עוד על ${targetPageTitle}</a>`;

  // הכנס לפני סגירת הפסקה
  const updatedParagraph = targetParagraph.replace(
    /<\/p>/i,
    `${readMoreLink}</p>`
  );

  const newContent = content.replace(targetParagraph, updatedParagraph);
  if (newContent === content) return { success: false };

  return { success: true, newContent };
}

// ============================================================================
// תזמור — Orchestration
// ============================================================================

export interface InternalLinkingOptions {
  maxLinksPerPage?: number;
  maxTotalLinks?: number;
  dryRun?: boolean;
}

/**
 * מנהל הרצה מלאה של מנוע הקישור הפנימי:
 * בנייה → ניתוח → המלצות → החלה
 */
export async function executeInternalLinking(
  connection: WPConnection,
  context: AutomationContext,
  options: InternalLinkingOptions = {}
): Promise<LinkingResult> {
  const {
    maxLinksPerPage = 5,
    maxTotalLinks = 50,
    dryRun = false,
  } = options;

  const actions: SEOActionEntry[] = [];

  console.log('[LINKING-ENGINE] שלב 1: בניית מלאי תוכן...');
  const inventory = await buildContentInventory(connection);

  console.log(`[LINKING-ENGINE] שלב 2: ניתוח גרף קישורים (${inventory.items.length} עמודים)...`);
  const graph = analyzeInternalLinkGraph(inventory);

  console.log(
    `[LINKING-ENGINE] גרף: ${graph.totalInternalLinks} קישורים, ` +
    `${graph.orphanPages.length} orphans, ${graph.deadEndPages.length} dead-ends, ` +
    `${graph.pillarPages.length} pillars`
  );

  console.log('[LINKING-ENGINE] שלב 3: יצירת המלצות קישור...');
  let recommendations = await generateLinkRecommendations(inventory, context);

  // הגבלת מספר קישורים לעמוד
  const linkCountPerPage = new Map<number, number>();
  recommendations = recommendations.filter(rec => {
    const count = linkCountPerPage.get(rec.sourcePageId) || 0;
    if (count >= maxLinksPerPage) return false;
    linkCountPerPage.set(rec.sourcePageId, count + 1);
    return true;
  });

  // הגבלת סה"כ קישורים
  if (recommendations.length > maxTotalLinks) {
    recommendations = recommendations.slice(0, maxTotalLinks);
  }

  console.log(`[LINKING-ENGINE] שלב 4: החלת ${recommendations.length} קישורים (dryRun=${dryRun})...`);
  const applied = await applyInternalLinks(recommendations, connection, dryRun);

  // חישוב תוצאות
  const successfulApplications = applied.filter(a => a.applied);
  const orphanPagesFixed = new Set(
    recommendations
      .filter(r => graph.orphanPages.includes(r.targetPageId))
      .filter(r => applied.some(a => a.targetPageId === r.targetPageId && a.applied))
      .map(r => r.targetPageId)
  ).size;

  const deadEndPagesFixed = new Set(
    recommendations
      .filter(r => graph.deadEndPages.includes(r.sourcePageId))
      .filter(r => applied.some(a => a.sourcePageId === r.sourcePageId && a.applied))
      .map(r => r.sourcePageId)
  ).size;

  const pillarPagesStrengthened = new Set(
    recommendations
      .filter(r =>
        r.semanticRelationship === 'supporting_to_pillar' ||
        r.semanticRelationship === 'pillar_to_supporting'
      )
      .filter(r => applied.some(
        a => a.sourcePageId === r.sourcePageId && a.targetPageId === r.targetPageId && a.applied
      ))
      .map(r => {
        if (r.semanticRelationship === 'supporting_to_pillar') return r.targetPageId;
        return r.sourcePageId;
      })
  ).size;

  // רישום פעולות ביומן
  for (const app of successfulApplications) {
    const rec = recommendations.find(
      r => r.sourcePageId === app.sourcePageId && r.targetPageId === app.targetPageId
    );
    actions.push({
      id: `link-${app.sourcePageId}-${app.targetPageId}-${Date.now()}`,
      planId: context.planId || '',
      date: new Date().toISOString(),
      actionType: 'internal_link_added',
      module: 'internal-linking-engine',
      status: 'completed',
      pageId: app.sourcePageId,
      pageUrl: rec?.sourcePageUrl || '',
      pageTitle: rec?.sourcePageTitle || '',
      description: `קישור פנימי נוסף: "${app.anchorText}" → ${rec?.targetPageTitle || ''}`,
      seoReason: rec?.reason || 'שיפור מבנה הקישורים הפנימיים באתר',
      expectedImpact: rec?.impactPriority || 'medium',
      isReversible: true,
      rollbackData: JSON.stringify({
        targetPageId: app.targetPageId,
        anchorText: app.anchorText,
        relationship: rec?.semanticRelationship,
      }),
    });
  }

  console.log(
    `[LINKING-ENGINE] סיום: ${successfulApplications.length}/${recommendations.length} קישורים הוחלו בהצלחה`
  );

  return {
    recommendations,
    applied,
    orphanPagesFixed,
    deadEndPagesFixed,
    pillarPagesStrengthened,
    totalLinksAdded: successfulApplications.length,
    actions,
  };
}

// ============================================================================
// פונקציות עזר — Helper Functions
// ============================================================================

/** חילוץ מילות מפתח מתוכן עמוד */
function extractKeywordsFromContent(item: ContentItem): string[] {
  const keywords: string[] = [];
  const plainText = stripHtml(item.content).toLowerCase();

  // מילות מפתח מכותרות
  for (const heading of item.headings) {
    const words = heading.text.split(/\s+/).filter(w => w.length > 2);
    keywords.push(...words);
  }

  // מילות מפתח מכותרת העמוד
  const titleWords = item.title.split(/\s+/).filter(w => w.length > 2);
  keywords.push(...titleWords);

  // מילות מפתח מ-slug
  if (item.slug) {
    const slugWords = item.slug.split('-').filter(w => w.length > 2);
    keywords.push(...slugWords);
  }

  // הסרת כפילויות
  return [...new Set(keywords.map(k => k.toLowerCase()))];
}

/** חישוב חפיפת מילות מפתח בין שני מערכים */
function calculateKeywordOverlap(keywordsA: string[], keywordsB: string[]): number {
  if (keywordsA.length === 0 || keywordsB.length === 0) return 0;

  const setA = new Set(keywordsA.map(k => k.toLowerCase()));
  const setB = new Set(keywordsB.map(k => k.toLowerCase()));
  let overlap = 0;

  for (const keyword of setA) {
    if (setB.has(keyword)) overlap++;
  }

  const minSize = Math.min(setA.size, setB.size);
  return minSize > 0 ? overlap / minSize : 0;
}

/** מציאת עמוד מקור הכי מתאים לקישור נכנס */
function findBestLinkSource(
  targetNode: LinkGraphNode,
  nodes: Map<number, LinkGraphNode>,
  newLinksPerPage: Map<number, number>,
  _direction: 'inbound'
): LinkGraphNode | null {
  let bestNode: LinkGraphNode | null = null;
  let bestScore = 0;

  for (const [pageId, node] of nodes) {
    if (pageId === targetNode.pageId) continue;
    if (node.outboundLinks.includes(targetNode.pageId)) continue; // קישור כבר קיים
    if (getNewLinkCount(newLinksPerPage, pageId) >= 5) continue;

    const overlap = calculateKeywordOverlap(node.keywords, targetNode.keywords);
    // עדיפות לעמודי pillar וארוכים
    const lengthBonus = node.contentLength > 2000 ? 0.1 : 0;
    const pillarBonus = node.pageType === 'pillar' ? 0.15 : 0;
    const score = overlap + lengthBonus + pillarBonus;

    if (score > bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  return bestNode;
}

/** מציאת עמוד יעד הכי מתאים לקישור יוצא */
function findBestLinkTarget(
  sourceNode: LinkGraphNode,
  nodes: Map<number, LinkGraphNode>,
  _newLinksPerPage: Map<number, number>
): LinkGraphNode | null {
  let bestNode: LinkGraphNode | null = null;
  let bestScore = 0;

  for (const [pageId, node] of nodes) {
    if (pageId === sourceNode.pageId) continue;
    if (sourceNode.outboundLinks.includes(pageId)) continue;

    const overlap = calculateKeywordOverlap(sourceNode.keywords, node.keywords);
    // עדיפות לעמודים עם הרבה תוכן ולעמודי pillar
    const pillarBonus = node.pageType === 'pillar' ? 0.2 : 0;
    const score = overlap + pillarBonus;

    if (score > bestScore) {
      bestScore = score;
      bestNode = node;
    }
  }

  return bestNode;
}

/** יצירת אובייקט המלצה */
function createRecommendation(
  sourceNode: LinkGraphNode,
  targetNode: LinkGraphNode,
  reason: string,
  relationship: string,
  priority: 'critical' | 'high' | 'medium' | 'low',
  _graph: LinkGraphAnalysis
): LinkRecommendation {
  // בחירת טקסט עוגן — העדפה לכותרת העמוד או חלק ממנה
  const anchorText = generateNaturalAnchorText(targetNode);

  return {
    sourcePageId: sourceNode.pageId,
    sourcePageUrl: sourceNode.url,
    sourcePageTitle: sourceNode.title,
    targetPageId: targetNode.pageId,
    targetPageUrl: targetNode.url,
    targetPageTitle: targetNode.title,
    anchorText,
    reason,
    semanticRelationship: relationship,
    impactPriority: priority,
    insertionPoint: `פסקה בעמוד "${sourceNode.title}" שקשורה ל-"${targetNode.title}"`,
    contextSentence: '',
  };
}

/** יצירת טקסט עוגן טבעי ומגוון */
function generateNaturalAnchorText(targetNode: LinkGraphNode): string {
  // אפשרויות: כותרת מלאה, חלק מכותרת, מילת מפתח מרכזית
  const title = targetNode.title;

  // אם הכותרת קצרה מספיק, השתמש בה
  if (title.length <= 40) return title;

  // חלק מהכותרת — עד 4 מילים ראשונות
  const words = title.split(/\s+/);
  if (words.length > 4) {
    return words.slice(0, 4).join(' ');
  }

  return title;
}

/** קביעת סוג הקשר בין שני עמודים */
function determineRelationship(nodeA: LinkGraphNode, nodeB: LinkGraphNode): string {
  if (nodeA.pageType === 'pillar') return 'pillar_to_supporting';
  if (nodeB.pageType === 'pillar') return 'supporting_to_pillar';

  // עמודי שירות מול מידע — זיהוי פשוט
  const serviceTerms = ['שירות', 'service', 'מחיר', 'pricing', 'הזמנ', 'order'];
  const infoTerms = ['מדריך', 'guide', 'בלוג', 'blog', 'מאמר', 'article', 'טיפ', 'tip'];

  const aIsService = serviceTerms.some(t =>
    nodeA.title.toLowerCase().includes(t) || nodeA.slug.includes(t)
  );
  const bIsInfo = infoTerms.some(t =>
    nodeB.title.toLowerCase().includes(t) || nodeB.slug.includes(t)
  );

  if (aIsService && bIsInfo) return 'service_to_info';
  if (!aIsService && !bIsInfo) return 'related_topic';

  const aIsInfo = infoTerms.some(t =>
    nodeA.title.toLowerCase().includes(t) || nodeA.slug.includes(t)
  );
  const bIsService = serviceTerms.some(t =>
    nodeB.title.toLowerCase().includes(t) || nodeB.slug.includes(t)
  );

  if (aIsInfo && bIsService) return 'info_to_service';

  return 'related_topic';
}

/** חילוץ URL בסיסי מהאינוונטורי */
function extractSiteUrl(inventory: ContentInventory): string {
  // ContentInventory כולל את siteUrl ישירות
  if (inventory.siteUrl) return inventory.siteUrl.replace(/\/+$/, '');

  if (inventory.items.length === 0) return '';
  const firstUrl = inventory.items[0].url;
  try {
    const parsed = new URL(firstUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return '';
  }
}

/** נרמול URL להשוואה */
function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .replace(/\/$/, '');
}

/** חילוץ slug מ-URL */
function extractSlugFromUrl(url: string): string {
  try {
    const parsed = new URL(url, 'https://placeholder.com');
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || '';
  } catch {
    return url.split('/').filter(Boolean).pop() || '';
  }
}

/** בריחה מתווים מיוחדים לשימוש ב-RegExp */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** זיהוי תגית HTML שמכילה מיקום נתון */
function getEnclosingTag(html: string, position: number): string | null {
  const before = html.substring(Math.max(0, position - 500), position);
  // חפש את תגית הפתיחה האחרונה לפני המיקום
  const tagMatch = before.match(/<(\w+)[^>]*>[^<]*$/);
  if (tagMatch) return tagMatch[1];
  return null;
}

/** ספירת קישורים חדשים לעמוד */
function getNewLinkCount(map: Map<number, number>, pageId: number): number {
  return map.get(pageId) || 0;
}

/** הגדלת ספירת קישורים חדשים לעמוד */
function incrementLinkCount(map: Map<number, number>, pageId: number): void {
  map.set(pageId, (map.get(pageId) || 0) + 1);
}
