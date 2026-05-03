import { NextRequest, NextResponse } from 'next/server';
import { generate60DayPlan, PlanInput } from '@/lib/seo/plan-engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Build PlanInput from the request body
    const input: PlanInput = {
      clientName: body.clientName || "",
      websiteUrl: body.websiteUrl || "",
      websiteScan: body.websiteScan || null,
      scannedPages: body.scannedPages || [],
      visibilityResults: body.visibilityResults || [],
      visibilityQueries: body.visibilityQueries || [],
      competitors: body.competitors || [],
      contentGaps: body.contentGaps || [],
      goals: (body.goals || []).map((g: any) => ({
        id: g.id || "",
        type: g.type || "",
        label: g.label || "",
        selected: g.selected ?? true,
        targetMetric: g.targetMetric || g.metric || "",
        currentValue: g.currentValue || 0,
        targetValue: g.targetValue || 0,
        priority: g.priority || "medium",
      })),
      targetKeywords: body.targetKeywords || [],
      targetLocation: body.targetLocation || "ישראל",
      targetLanguage: body.targetLanguage || "he",
      insights: (body.insights || []).map((ins: any) => ({
        id: ins.id || "",
        category: ins.category || "opportunity",
        title: ins.title || "",
        description: ins.description || "",
        impact: ins.impact || "medium",
        action: ins.action || "",
      })),
    };

    const plan = generate60DayPlan(input);

    // Also produce backward-compatible weeks array for the plan detail page
    const weeks = planToWeeks(plan);

    return NextResponse.json({
      ...plan,
      weeks, // backward compat
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Convert 60-day plan into weekly buckets for backward compatibility */
function planToWeeks(plan: ReturnType<typeof generate60DayPlan>) {
  const weeks: any[] = [];
  const now = new Date();

  for (let w = 0; w < 9; w++) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const dayStart = w * 7 + 1;
    const dayEnd = Math.min((w + 1) * 7, 60);

    const daysInWeek = plan.days.filter(d => d.day >= dayStart && d.day <= dayEnd);
    if (daysInWeek.length === 0) continue;

    const phase = daysInWeek[0].phase;
    const tasks = daysInWeek.flatMap(d =>
      d.tasks.map((t, i) => ({
        id: t.id,
        weekNumber: w + 1,
        dayOfWeek: ((d.day - 1) % 7) + 1,
        title: t.title,
        description: t.description,
        category: t.type,
        priority: t.impactLevel === "critical" ? "high" : t.impactLevel === "high" ? "high" : t.impactLevel === "medium" ? "medium" : "low",
        estimatedHours: t.effortHours,
        status: "pending",
        assignedTo: null,
        completedAt: null,
        deliverable: t.expectedOutcome,
        kpiTarget: t.reason,
      }))
    );

    weeks.push({
      weekNumber: w + 1,
      startDate: weekStart.toISOString().split('T')[0],
      endDate: weekEnd.toISOString().split('T')[0],
      theme: phase,
      focus: daysInWeek.map(d => d.focusTitle).slice(0, 2).join(", "),
      tasks,
    });
  }

  return weeks;
}
