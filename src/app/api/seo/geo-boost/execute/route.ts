import { NextRequest, NextResponse } from 'next/server';
import {
  generateStructuredData,
  generateKnowledgePanelContent,
  optimizeForAIOverview,
  generateEntityLinks,
  generateWikipediaReadyContent,
  generatePressRelease,
} from '@/lib/seo/geo-booster';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// POST — ביצוע פעולת GEO ספציפית
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
    }

    switch (action) {
      case 'structuredData': {
        const { pageContent, pageType } = body;
        if (!pageContent || !pageType) {
          return NextResponse.json({ error: 'חסרים pageContent ו-pageType' }, { status: 400 });
        }
        const validTypes = ['article', 'product', 'service', 'local_business', 'faq', 'how_to', 'review'];
        if (!validTypes.includes(pageType)) {
          return NextResponse.json({ error: `pageType לא תקין. אפשרויות: ${validTypes.join(', ')}` }, { status: 400 });
        }
        const result = await generateStructuredData(pageContent, pageType);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ schema: result.schema, message: 'נתונים מובנים נוצרו בהצלחה' });
      }

      case 'knowledgePanel': {
        const { businessName, data } = body;
        if (!businessName) {
          return NextResponse.json({ error: 'חסר businessName' }, { status: 400 });
        }
        const result = await generateKnowledgePanelContent(businessName, data || {});
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ content: result.content, message: 'תוכן Knowledge Panel נוצר' });
      }

      case 'optimizeAIOverview': {
        const { query, existingContent } = body;
        if (!query || !existingContent) {
          return NextResponse.json({ error: 'חסרים query ו-existingContent' }, { status: 400 });
        }
        const result = await optimizeForAIOverview(query, existingContent);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({
          optimizedContent: result.optimizedContent,
          changes: result.changes,
          message: 'התוכן עבר אופטימיזציה ל-AI Overview',
        });
      }

      case 'entityLinks': {
        const { content, domain } = body;
        if (!content || !domain) {
          return NextResponse.json({ error: 'חסרים content ו-domain' }, { status: 400 });
        }
        const result = await generateEntityLinks(content, domain);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({
          linkedContent: result.linkedContent,
          entities: result.entities,
          message: 'קישורי ישויות נוצרו',
        });
      }

      case 'wikipediaContent': {
        const { topic, sources } = body;
        if (!topic) {
          return NextResponse.json({ error: 'חסר topic' }, { status: 400 });
        }
        const result = await generateWikipediaReadyContent(topic, sources || []);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({
          content: result.content,
          meetsCriteria: result.meetsCriteria,
          gaps: result.gaps,
          message: 'תוכן ברמת ויקיפדיה נוצר',
        });
      }

      case 'pressRelease': {
        const { businessName, angle, facts } = body;
        if (!businessName || !angle) {
          return NextResponse.json({ error: 'חסרים businessName ו-angle' }, { status: 400 });
        }
        const result = await generatePressRelease(clientId, businessName, angle, facts || {});
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({
          pressRelease: result.pressRelease,
          distributionTips: result.distributionTips,
          message: 'הודעה לעיתונות נוצרה בהצלחה',
        });
      }

      default:
        return NextResponse.json({
          error: 'action לא תקין. אפשרויות: structuredData, knowledgePanel, optimizeAIOverview, entityLinks, wikipediaContent, pressRelease',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[GEO Execute API] error:', error);
    return NextResponse.json({ error: `שגיאה: ${(error as Error).message}` }, { status: 500 });
  }
}
