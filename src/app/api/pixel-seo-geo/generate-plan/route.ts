import { NextRequest, NextResponse } from 'next/server';
import { generatePlan, validatePlanInput } from '@/lib/seo/plan-generator';
import { validateScanData } from '@/lib/seo/validation-gate';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json({ error: 'Missing planId' }, { status: 400 });
    }

    // Load plan
    const { data: plan } = await supabase.from('data_store').select('*').eq('id', planId).single();
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

    const planData = plan.data || {};
    const scan = planData.websiteScan;

    if (!scan) {
      return NextResponse.json({
        error: 'no_scan',
        message: 'לא בוצעה סריקה — נדרשת סריקה מלאה לפני יצירת תוכנית 60 יום',
      }, { status: 400 });
    }

    // Validate data sufficiency
    const validation = validateScanData({
      websiteFacts: scan.websiteFacts,
      pagesScanned: scan.totalPages || 0,
      scanDurationMs: scan.durationMs || 0,
      evidenceCount: scan.scanLog?.metrics?.evidenceCollected || 0,
    });

    if (!validation.canProceed) {
      return NextResponse.json({
        error: 'insufficient_data',
        message: validation.message,
        missingData: validation.missingData,
        checks: validation.checks,
      }, { status: 400 });
    }

    // Validate plan-specific input
    const planInput = {
      websiteFacts: scan.websiteFacts,
      gapAnalysis: scan.gapAnalysis || { domain: '', analyzedAt: '', dataCompleteness: { hasGSC: false, hasSERP: false, hasCrawl: true, overallConfidence: 30 }, keywordGaps: [], contentGaps: [], technicalGaps: [], summary: { totalGaps: 0, criticalGaps: 0, highOpportunityKeywords: 0, estimatedTrafficPotential: null }, limitations: [] },
      gscData: scan.gscData || null,
      crawlResult: scan.crawlResult || null,
      businessGoals: planData.goals?.filter((g: any) => g.selected).map((g: any) => g.label) || [],
    };

    const planValidation = validatePlanInput(planInput);
    if (!planValidation.isValid && !planValidation.canGeneratePartial) {
      return NextResponse.json({
        error: 'cannot_generate',
        message: 'אין מספיק נתונים ליצירת תוכנית — בצע סריקה מלאה תחילה',
        missingData: planValidation.missingData,
      }, { status: 400 });
    }

    // Generate the plan
    const generatedPlan = generatePlan(planInput);

    // Convert to storage format
    const phases = generatedPlan.phases.map(p => ({
      number: p.number,
      name: p.name,
      nameEn: p.nameEn,
      days: p.days,
      focus: p.focus,
      taskCount: p.taskCount,
    }));

    const days = generatedPlan.tasks.reduce((acc: any[], task) => {
      let day = acc.find(d => d.day === task.day);
      if (!day) {
        day = { day: task.day, date: '', phase: task.phase, theme: '', tasks: [] };
        acc.push(day);
      }
      day.tasks.push({
        id: task.id,
        title: task.title,
        category: task.category,
        priority: task.priority,
        estimatedHours: task.estimatedHours,
        deliverable: task.deliverable,
        kpiTarget: task.impact.expectedImprovement,
        status: 'todo',
        reason: task.reason,
        impact: task.impact,
        relatedUrl: task.relatedUrl,
        relatedKeywords: task.relatedKeywords,
      });
      return acc;
    }, []);

    // Save to plan
    const updateData = {
      ...planData,
      phases,
      days,
      totalTasks: generatedPlan.totalTasks,
      completedTasks: 0,
      planGenerated: true,
      planGeneratedAt: generatedPlan.generatedAt,
      planDataCompleteness: generatedPlan.dataCompleteness,
      planLimitations: generatedPlan.limitations,
      status: 'plan_generated',
    };

    await supabase.from('data_store').update({ data: updateData }).eq('id', planId);

    return NextResponse.json({
      success: true,
      plan: {
        id: generatedPlan.id,
        phases,
        totalTasks: generatedPlan.totalTasks,
        dataCompleteness: generatedPlan.dataCompleteness,
        limitations: generatedPlan.limitations,
        summary: generatedPlan.summary,
      },
    });
  } catch (err: any) {
    console.error('[PIXEL-SEO-GEO] Plan generation failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
