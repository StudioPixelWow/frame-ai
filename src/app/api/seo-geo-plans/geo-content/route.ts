/**
 * POST /api/seo-geo-plans/geo-content   { planId, keyword?, publish? }
 *
 * Generates a NEW AI-citable article (TL;DR + direct answer + claim/evidence/stat
 * + FAQ + FAQPage/Article schema) for a target keyword. If the plan has a
 * WordPress connection and publish=true, it publishes (as draft by default);
 * otherwise it returns the HTML for manual use. Admin/employee only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seoPlans } from '@/lib/db';
import { getRequestRole } from '@/lib/auth/api-guard';
import { generateGeoArticle } from '@/lib/seo/geo-content-generator';
import { createPost } from '@/lib/seo/wordpress-client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (getRequestRole(req) === 'client') {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  }
  try {
    const { planId, keyword, publish } = await req.json().catch(() => ({}));
    if (!planId) return NextResponse.json({ error: 'planId נדרש' }, { status: 400 });
    const plan: any = await seoPlans.getByIdAsync(planId);
    if (!plan) return NextResponse.json({ error: 'התוכנית לא נמצאה' }, { status: 404 });

    // Pick the keyword: explicit → first client/target keyword.
    const kwList = (Array.isArray(plan.clientKeywords) && plan.clientKeywords.length ? plan.clientKeywords : plan.targetKeywords) || [];
    const firstKw = kwList[0];
    const kw = (keyword || (typeof firstKw === 'string' ? firstKw : firstKw?.keyword) || '').trim();
    if (!kw) return NextResponse.json({ error: 'אין ביטוי מטרה — הוסף מילת מפתח או ציין keyword' }, { status: 400 });

    const businessName = plan.businessName || plan.clientName || '';
    const siteUrl = plan.websiteUrl || '';
    const facts = plan.websiteScan?.websiteFacts || {};
    const article = await generateGeoArticle(kw, businessName, {
      siteUrl,
      author: businessName,
      industry: facts.detected_industry?.value || facts.industry || plan.businessProfile?.industry,
      location: facts.detected_location?.value || facts.location || plan.businessProfile?.location,
    });

    // Publish to WordPress if connected + requested.
    const wp = plan.wpConnection;
    let published: any = null;
    if (publish && wp?.siteUrl) {
      try {
        // Respect the account's publish mode: 'auto' → publish live, else draft.
        const { getGeoPublishMode } = await import('@/lib/seo/geo-authority/settings');
        const wpStatus = (await getGeoPublishMode()) === 'auto' ? 'publish' : 'draft';
        published = await createPost(wp, {
          title: article.title,
          content: article.html,
          status: wpStatus,
          metaTitle: article.metaTitle,
          metaDescription: article.metaDescription,
          focusKeyword: article.focusKeyword,
        });
      } catch (e) {
        return NextResponse.json({ success: true, article, publishError: e instanceof Error ? e.message : 'פרסום נכשל' });
      }
    }

    return NextResponse.json({ success: true, article, published, wpConnected: !!wp?.siteUrl });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'יצירת התוכן נכשלה' }, { status: 500 });
  }
}
