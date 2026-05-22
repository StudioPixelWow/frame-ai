/**
 * PixelManageAI — Pipeline Engine
 * מנוע מצבים של הצינור — מנהל מעברי מצב, אימות, ונעילת מקור.
 * כל פונקציה מאמתת את המצב הנוכחי לפני מעבר ומוסיפה רשומת ביקורת.
 */

import type {
  VideoPipelineState,
  HookSelection,
  TrimCropData,
  AIAnalysisResult,
} from './types';
import { addAuditEntry, canProceedToStep } from './pipeline-validator';

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

/** יוצר חותמת זמן ISO נוכחית */
function now(): string {
  return new Date().toISOString();
}

/**
 * אימות מעבר — זורק שגיאה אם המעבר לא מותר.
 * @throws Error אם המעבר חסום
 */
function assertCanProceed(state: VideoPipelineState, step: string): void {
  const result = canProceedToStep(state, step);
  if (!result.allowed) {
    throw new Error(result.reason ?? `לא ניתן לעבור לשלב: ${step}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Pipeline Initialization
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * אתחול צינור חדש לפרויקט וידאו.
 *
 * @param projectId - מזהה הפרויקט
 * @param originalVideoId - מזהה הוידאו המקורי שהועלה
 * @returns מצב צינור ראשוני
 */
export function initializePipeline(
  projectId: string,
  originalVideoId: string,
): VideoPipelineState {
  const timestamp = now();

  const state: VideoPipelineState = {
    projectId,
    originalVideoId,
    activeVideoId: undefined,

    pipelineStatus: 'uploaded',
    hookStatus: 'pending',
    trimCropStatus: 'pending',
    preEditStatus: 'pending',
    aiAnalysisStatus: 'pending',
    sourceLocked: false,

    auditLog: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return addAuditEntry(state, 'pipeline_initialized', originalVideoId, {
    projectId,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hook Selection & Generation
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * השלמת בחירת הוק.
 *
 * @param state - מצב הצינור הנוכחי
 * @param hook - נתוני ההוק שנבחר
 * @returns מצב צינור מעודכן
 * @throws Error אם המצב הנוכחי לא מאפשר בחירת הוק
 */
export function completeHookSelection(
  state: VideoPipelineState,
  hook: HookSelection,
): VideoPipelineState {
  assertCanProceed(state, 'hook_selected');

  const updated: VideoPipelineState = {
    ...state,
    hookSelection: hook,
    hookStatus: 'selected',
    pipelineStatus: 'hook_selected',
    updatedAt: now(),
  };

  return addAuditEntry(updated, 'hook_selected', state.originalVideoId, {
    startTime: hook.startTime,
    endTime: hook.endTime,
    aiRecommended: hook.aiRecommended,
  });
}

/**
 * השלמת יצירת וידאו הוק.
 *
 * @param state - מצב הצינור הנוכחי
 * @param hookVideoId - מזהה וידאו ההוק שנוצר
 * @returns מצב צינור מעודכן
 * @throws Error אם המצב הנוכחי לא מאפשר את הפעולה
 */
export function completeHookGeneration(
  state: VideoPipelineState,
  hookVideoId: string,
): VideoPipelineState {
  assertCanProceed(state, 'hook_ready');

  const updated: VideoPipelineState = {
    ...state,
    hookGeneratedVideoId: hookVideoId,
    hookStatus: 'completed',
    pipelineStatus: 'hook_ready',
    updatedAt: now(),
  };

  return addAuditEntry(
    updated,
    'hook_generation_completed',
    state.originalVideoId,
    { hookVideoId },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Trim & Crop
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * השלמת חיתוך ומיקוד.
 *
 * @param state - מצב הצינור הנוכחי
 * @param trimCrop - נתוני החיתוך והמיקוד
 * @param trimCropVideoId - מזהה הוידאו שנוצר לאחר חיתוך
 * @returns מצב צינור מעודכן
 * @throws Error אם המצב הנוכחי לא מאפשר את הפעולה
 */
export function completeTrimCrop(
  state: VideoPipelineState,
  trimCrop: TrimCropData,
  trimCropVideoId: string,
): VideoPipelineState {
  // חיתוך יכול לקרות אחרי hook_ready או אחרי דילוג על הוק
  if (
    state.pipelineStatus !== 'ready_for_trim_crop' &&
    state.pipelineStatus !== 'hook_ready'
  ) {
    throw new Error('לא ניתן לבצע חיתוך ומיקוד במצב הנוכחי');
  }

  const sourceVideoId =
    state.hookGeneratedVideoId ?? state.originalVideoId;

  const updated: VideoPipelineState = {
    ...state,
    trimCrop,
    trimCropVideoId,
    trimCropStatus: 'completed',
    pipelineStatus: 'trim_crop_selected',
    updatedAt: now(),
  };

  return addAuditEntry(updated, 'trim_crop_completed', sourceVideoId, {
    trimCropVideoId,
    targetAspectRatio: trimCrop.targetAspectRatio,
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   Final Pre-Edit — Source Locking
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * השלמת הכנת קובץ סופי לפני עריכה — נועל את המקור.
 * לאחר קריאה זו, הוידאו המקורי חסום לשימוש.
 *
 * @param state - מצב הצינור הנוכחי
 * @param finalVideoId - מזהה הקובץ הסופי לפני עריכה
 * @returns מצב צינור מעודכן עם מקור נעול
 * @throws Error אם המצב הנוכחי לא מאפשר את הפעולה
 */
export function completeFinalPreEdit(
  state: VideoPipelineState,
  finalVideoId: string,
): VideoPipelineState {
  // pre_edit יכול לקרות אחרי trim_crop_selected או אחרי דילוג
  if (
    state.pipelineStatus !== 'trim_crop_selected' &&
    state.pipelineStatus !== 'pre_edit_generating'
  ) {
    throw new Error('לא ניתן להשלים הכנת קובץ סופי במצב הנוכחי');
  }

  const lockedAt = now();
  const sourceVideoId =
    state.trimCropVideoId ?? state.hookGeneratedVideoId ?? state.originalVideoId;

  const updated: VideoPipelineState = {
    ...state,
    finalPreEditVideoId: finalVideoId,
    activeVideoId: finalVideoId,
    preEditStatus: 'completed',
    pipelineStatus: 'source_locked',
    sourceLocked: true,
    lockedAt,
    updatedAt: lockedAt,
  };

  return addAuditEntry(updated, 'source_locked', sourceVideoId, {
    finalVideoId,
    lockedAt,
    message: 'המקור ננעל — הוידאו המקורי חסום לשימוש מעתה',
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI Analysis
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * התחלת ניתוח AI על הקובץ הסופי.
 *
 * @param state - מצב הצינור הנוכחי
 * @returns מצב צינור מעודכן
 * @throws Error אם המקור לא נעול
 */
export function startAIAnalysis(state: VideoPipelineState): VideoPipelineState {
  assertCanProceed(state, 'ai_analysis_running');

  if (!state.finalPreEditVideoId) {
    throw new Error('לא קיים קובץ סופי לפני עריכה — לא ניתן להתחיל ניתוח AI');
  }

  const updated: VideoPipelineState = {
    ...state,
    aiAnalysisStatus: 'running',
    pipelineStatus: 'ai_analysis_running',
    updatedAt: now(),
  };

  return addAuditEntry(
    updated,
    'ai_analysis_started',
    state.finalPreEditVideoId,
  );
}

/**
 * השלמת ניתוח AI.
 *
 * @param state - מצב הצינור הנוכחי
 * @param analysis - תוצאות הניתוח
 * @returns מצב צינור מעודכן
 * @throws Error אם הניתוח לא רץ כרגע
 */
export function completeAIAnalysis(
  state: VideoPipelineState,
  analysis: VideoPipelineState['aiAnalysis'],
): VideoPipelineState {
  if (state.aiAnalysisStatus !== 'running') {
    throw new Error('ניתוח AI לא רץ כרגע — לא ניתן להשלים');
  }

  if (!state.finalPreEditVideoId) {
    throw new Error('לא קיים קובץ סופי לפני עריכה');
  }

  const updated: VideoPipelineState = {
    ...state,
    aiAnalysis: analysis,
    aiAnalysisStatus: 'completed',
    pipelineStatus: 'ai_analysis_running', // נשאר כאן עד markEditingReady
    updatedAt: now(),
  };

  return addAuditEntry(
    updated,
    'ai_analysis_completed',
    state.finalPreEditVideoId,
    {
      viralScore: analysis?.viralScore,
      pacingScore: analysis?.pacingScore,
      scenesCount: analysis?.scenes.length,
    },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Editing Ready
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * סימון הצינור כמוכן לעריכה.
 *
 * @param state - מצב הצינור הנוכחי
 * @returns מצב צינור מעודכן
 * @throws Error אם ניתוח AI לא הושלם
 */
export function markEditingReady(
  state: VideoPipelineState,
): VideoPipelineState {
  if (
    state.aiAnalysisStatus !== 'completed' &&
    state.aiAnalysisStatus !== 'skipped'
  ) {
    throw new Error('יש להשלים ניתוח AI (או לדלג עליו) לפני כניסה לעריכה');
  }

  if (!state.sourceLocked || !state.finalPreEditVideoId) {
    throw new Error('המקור לא נעול — לא ניתן להיכנס לעריכה');
  }

  const updated: VideoPipelineState = {
    ...state,
    pipelineStatus: 'editing_ready',
    updatedAt: now(),
  };

  return addAuditEntry(
    updated,
    'editing_ready',
    state.finalPreEditVideoId,
    { aiAnalysisStatus: state.aiAnalysisStatus },
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Active Video Resolution
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * מחזיר את מזהה הוידאו הפעיל — הקובץ הסופי לפני עריכה אם נעול.
 *
 * @param state - מצב הצינור הנוכחי
 * @returns מזהה הוידאו הפעיל, או null אם המקור עדיין לא ננעל
 */
export function getActiveVideoId(
  state: VideoPipelineState,
): string | null {
  if (state.sourceLocked && state.finalPreEditVideoId) {
    return state.finalPreEditVideoId;
  }
  return null;
}
