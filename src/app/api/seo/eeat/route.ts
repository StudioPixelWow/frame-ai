import { NextRequest, NextResponse } from 'next/server';
import {
  auditEEAT,
  generateAuthorBio,
  generateAboutPage,
  generateSchemaAuthor,
  generateSchemaOrganization,
  checkTrustSignals,
  generateCredentialContent,
  suggestExpertContent,
  buildTopicalAuthority,
  generateFAQPage,
} from '@/lib/seo/eeat-engine';
import type { AuthorData, BusinessData } from '@/lib/seo/eeat-engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

// ============================================================================
// GET — ביקורת E-E-A-T / בדיקת אותות אמינות
// ============================================================================

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action'); // audit | trustSignals | topicalAuthority
    const clientId = searchParams.get('clientId');
    const websiteUrl = searchParams.get('websiteUrl');

    if (!clientId) {
      return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
    }

    switch (action) {
      case 'audit': {
        if (!websiteUrl) {
          return NextResponse.json({ error: 'חסר websiteUrl' }, { status: 400 });
        }
        const factsParam = searchParams.get('facts');
        const facts = factsParam ? JSON.parse(factsParam) : {};
        const result = await auditEEAT(websiteUrl, facts);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ audit: result.audit });
      }

      case 'trustSignals': {
        if (!websiteUrl) {
          return NextResponse.json({ error: 'חסר websiteUrl' }, { status: 400 });
        }
        const result = await checkTrustSignals(websiteUrl);
        return NextResponse.json({ signals: result.signals, score: result.score, error: result.error });
      }

      case 'topicalAuthority': {
        const niche = searchParams.get('niche');
        const pagesParam = searchParams.get('existingPages');
        if (!niche) {
          return NextResponse.json({ error: 'חסר niche' }, { status: 400 });
        }
        const existingPages = pagesParam ? pagesParam.split(',') : [];
        const result = await buildTopicalAuthority(niche, existingPages);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ map: result.map });
      }

      default:
        return NextResponse.json({
          error: 'action לא תקין. אפשרויות: audit, trustSignals, topicalAuthority',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[E-E-A-T API] GET error:', error);
    return NextResponse.json({ error: `שגיאה: ${(error as Error).message}` }, { status: 500 });
  }
}

// ============================================================================
// POST — יצירת תוכן E-E-A-T
// ============================================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, clientId } = body;

    if (!clientId) {
      return NextResponse.json({ error: 'חסר clientId' }, { status: 400 });
    }

    switch (action) {
      case 'authorBio': {
        const { authorName, expertise, credentials } = body;
        if (!authorName || !expertise?.length || !credentials?.length) {
          return NextResponse.json({ error: 'חסרים authorName, expertise, credentials' }, { status: 400 });
        }
        const result = await generateAuthorBio(authorName, expertise, credentials);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ bio: result.bio, message: 'ביוגרפיה נוצרה בהצלחה' });
      }

      case 'aboutPage': {
        const { businessName, history, team, credentials } = body;
        if (!businessName || !history) {
          return NextResponse.json({ error: 'חסרים businessName ו-history' }, { status: 400 });
        }
        const result = await generateAboutPage(businessName, history, team || [], credentials || []);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ content: result.content, message: 'דף אודות נוצר בהצלחה' });
      }

      case 'schemaAuthor': {
        const { author } = body;
        if (!author?.name) {
          return NextResponse.json({ error: 'חסר author.name' }, { status: 400 });
        }
        const schema = generateSchemaAuthor(author as AuthorData);
        return NextResponse.json({ schema });
      }

      case 'schemaOrganization': {
        const { business } = body;
        if (!business?.name) {
          return NextResponse.json({ error: 'חסר business.name' }, { status: 400 });
        }
        const schema = generateSchemaOrganization(business as BusinessData);
        return NextResponse.json({ schema });
      }

      case 'credentialContent': {
        const { businessName, niche } = body;
        if (!businessName || !niche) {
          return NextResponse.json({ error: 'חסרים businessName ו-niche' }, { status: 400 });
        }
        const result = await generateCredentialContent(clientId, businessName, niche);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ content: result.content, message: 'תוכן הסמכות נוצר בהצלחה' });
      }

      case 'expertContent': {
        const { niche, existingContent } = body;
        if (!niche) {
          return NextResponse.json({ error: 'חסר niche' }, { status: 400 });
        }
        const result = await suggestExpertContent(niche, existingContent || []);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ suggestions: result.suggestions });
      }

      case 'faqPage': {
        const { niche, questions } = body;
        if (!niche) {
          return NextResponse.json({ error: 'חסר niche' }, { status: 400 });
        }
        const result = await generateFAQPage(niche, questions);
        if (result.error) {
          return NextResponse.json({ error: result.error }, { status: 500 });
        }
        return NextResponse.json({ html: result.html, schema: result.schema, message: 'דף FAQ נוצר בהצלחה' });
      }

      default:
        return NextResponse.json({
          error: 'action לא תקין. אפשרויות: authorBio, aboutPage, schemaAuthor, schemaOrganization, credentialContent, expertContent, faqPage',
        }, { status: 400 });
    }
  } catch (error) {
    console.error('[E-E-A-T API] POST error:', error);
    return NextResponse.json({ error: `שגיאה: ${(error as Error).message}` }, { status: 500 });
  }
}
