import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/store';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/cleanup-test-data
 *
 * מוחק את כל נתוני הבדיקה:
 * - כל תוכניות SEO/GEO (app_seo_plans, app_seo_websites, app_seo_growth_tasks)
 * - כל הלקוחות (clients)
 *
 * ⚠️ פעולה בלתי הפיכה! מיועד לשימוש חד-פעמי לניקוי נתוני בדיקה.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const results: Record<string, { deleted: number; error?: string }> = {};

    // 1. Delete all SEO plans
    try {
      const { data: plans } = await supabase.from('app_seo_plans').select('id');
      const count = plans?.length || 0;
      if (count > 0) {
        const { error } = await supabase.from('app_seo_plans').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        results['app_seo_plans'] = error ? { deleted: 0, error: error.message } : { deleted: count };
      } else {
        results['app_seo_plans'] = { deleted: 0 };
      }
    } catch (e: any) {
      results['app_seo_plans'] = { deleted: 0, error: e.message };
    }

    // 2. Delete all SEO websites
    try {
      const { data: websites } = await supabase.from('app_seo_websites').select('id');
      const count = websites?.length || 0;
      if (count > 0) {
        const { error } = await supabase.from('app_seo_websites').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        results['app_seo_websites'] = error ? { deleted: 0, error: error.message } : { deleted: count };
      } else {
        results['app_seo_websites'] = { deleted: 0 };
      }
    } catch (e: any) {
      results['app_seo_websites'] = { deleted: 0, error: e.message };
    }

    // 3. Delete all SEO growth tasks
    try {
      const { data: tasks } = await supabase.from('app_seo_growth_tasks').select('id');
      const count = tasks?.length || 0;
      if (count > 0) {
        const { error } = await supabase.from('app_seo_growth_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        results['app_seo_growth_tasks'] = error ? { deleted: 0, error: error.message } : { deleted: count };
      } else {
        results['app_seo_growth_tasks'] = { deleted: 0 };
      }
    } catch (e: any) {
      results['app_seo_growth_tasks'] = { deleted: 0, error: e.message };
    }

    // 4. Delete all clients
    try {
      const { data: clients } = await supabase.from('clients').select('id');
      const count = clients?.length || 0;
      if (count > 0) {
        const { error } = await supabase.from('clients').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        results['clients'] = error ? { deleted: 0, error: error.message } : { deleted: count };
      } else {
        results['clients'] = { deleted: 0 };
      }
    } catch (e: any) {
      results['clients'] = { deleted: 0, error: e.message };
    }

    const totalDeleted = Object.values(results).reduce((sum, r) => sum + r.deleted, 0);
    const hasErrors = Object.values(results).some(r => r.error);

    console.log('[CLEANUP] Results:', JSON.stringify(results, null, 2));

    return NextResponse.json({
      success: !hasErrors,
      message: hasErrors ? 'חלק מהמחיקות נכשלו — ראה פרטים' : `נמחקו ${totalDeleted} רשומות בהצלחה`,
      results,
      totalDeleted,
    });
  } catch (error: any) {
    console.error('[CLEANUP] Error:', error);
    return NextResponse.json({ error: error.message || 'שגיאה בניקוי נתונים' }, { status: 500 });
  }
}
