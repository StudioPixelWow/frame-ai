/**
 * PixelManageAI — Pipeline Validator
 * מנוע אימות הצינור — מוודא שכל שלב הושלם לפני מעבר לשלב הבא,
 * וחוסם שימוש בוידאו המקורי לאחר יצירת הקובץ הסופי לפני עריכה.
 */

import type {
  VideoPipelineState,
  PipelineStatus,
  SourceValidationResult,
  AuditEntry,
} from './types';

/* ═══════════════════════════════════════════════════════════════════════════
   Pipeline Step Order
   ═══════════════════════════════════════════════════════════════════════════ */

/** סדר השלבים בצינור */
const PIPELINE_STEP_ORDER: PipelineStatus[] = [
  'uploaded',
  'validating',
  'proxy_generating',
  'ready_for_hook_selection',
  'hook_selected',
  'hook_generating',
  'hook_ready',
  'ready_for_trim_crop',
  'trim_crop_selected',
  'pre_edit_generating',
  'pre_edit_ready',
  'source_locked',
  'ai_analysis_running',
  'editing_ready',
  'editing',
  'rendering',
  'exporting',
  'completed',
];

/**
 * אימות מקור וידאו — מוודא שהמקור המבוקש הוא ה-final_pre_edit
 * וכל שלבי הצינור הושלמו.
 *
 * @param state - מצב הצינור הנוכחי
 * @param requestedSourceId - מזהה המקור המבוקש
 * @returns תוצאת אימות מפורטת
 */
export function validateSource(
  state: VideoPipelineState,
  requestedSourceId: string,
): SourceValidationResult {
  const expectedVideoId = state.finalPreEditVideoId ?? '';

  const hookCompleted =
    state.hookStatus === 'completed' || state.hookStatus === 'skipped';
  const trimCropCompleted =
    state.trimCropStatus === 'completed' || state.trimCropStatus === 'skipped';
  const preEditCompleted = state.preEditStatus === 'completed';
  const sourceMatchesFinalPreEdit =
    !!state.finalPreEditVideoId && requestedSourceId === state.finalPreEditVideoId;

  const checks = {
    sourceMatchesFinalPreEdit,
    hookCompleted,
    trimCropCompleted,
    preEditCompleted,
    sourceLocked: state.sourceLocked,
  };

  // --- חסימה: שימוש בוידאו המקורי לאחר יצירת final_pre_edit ---
  if (
    state.finalPreEditVideoId &&
    requestedSourceId === state.originalVideoId
  ) {
    return {
      valid: false,
      sourceVideoId: requestedSourceId,
      expectedVideoId,
      versionType: 'original',
      checks,
      blockedReason:
        'שימוש בוידאו המקורי חסום — יש להשתמש בקובץ הסופי לפני עריכה (final_pre_edit)',
    };
  }

  // --- חסימה: מקור לא תואם ל-final_pre_edit ---
  if (!sourceMatchesFinalPreEdit) {
    return {
      valid: false,
      sourceVideoId: requestedSourceId,
      expectedVideoId,
      versionType: 'original',
      checks,
      blockedReason: state.finalPreEditVideoId
        ? 'המקור המבוקש אינו תואם לקובץ הסופי לפני עריכה'
        : 'הקובץ הסופי לפני עריכה עדיין לא נוצר',
    };
  }

  // --- חסימה: שלבים לא הושלמו ---
  if (!hookCompleted) {
    return {
      valid: false,
      sourceVideoId: requestedSourceId,
      expectedVideoId,
      versionType: 'final_pre_edit',
      checks,
      blockedReason: 'שלב בחירת ההוק עדיין לא הושלם',
    };
  }

  if (!trimCropCompleted) {
    return {
      valid: false,
      sourceVideoId: requestedSourceId,
      expectedVideoId,
      versionType: 'final_pre_edit',
      checks,
      blockedReason: 'שלב החיתוך והמיקוד עדיין לא הושלם',
    };
  }

  if (!preEditCompleted) {
    return {
      valid: false,
      sourceVideoId: requestedSourceId,
      expectedVideoId,
      versionType: 'final_pre_edit',
      checks,
      blockedReason: 'הכנת הקובץ לפני עריכה עדיין לא הושלמה',
    };
  }

  if (!state.sourceLocked) {
    return {
      valid: false,
      sourceVideoId: requestedSourceId,
      expectedVideoId,
      versionType: 'final_pre_edit',
      checks,
      blockedReason: 'המקור עדיין לא ננעל — יש לנעול לפני המשך',
    };
  }

  return {
    valid: true,
    sourceVideoId: requestedSourceId,
    expectedVideoId,
    versionType: 'final_pre_edit',
    checks,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   Step Transition Validation
   ═══════════════════════════════════════════════════════════════════════════ */

/** מפת דרישות קדם לכל שלב */
const STEP_PREREQUISITES: Record<string, (state: VideoPipelineState) => { allowed: boolean; reason?: string }> = {
  validating: (state) => ({
    allowed: state.pipelineStatus === 'uploaded',
    reason: state.pipelineStatus !== 'uploaded' ? 'ניתן לאמת רק לאחר העלאה' : undefined,
  }),
  proxy_generating: (state) => ({
    allowed: state.pipelineStatus === 'validating',
    reason: state.pipelineStatus !== 'validating' ? 'יש להשלים אימות לפני יצירת פרוקסי' : undefined,
  }),
  ready_for_hook_selection: (state) => ({
    allowed: state.pipelineStatus === 'proxy_generating',
    reason: state.pipelineStatus !== 'proxy_generating' ? 'יש להשלים יצירת פרוקסי לפני בחירת הוק' : undefined,
  }),
  hook_selected: (state) => ({
    allowed: state.pipelineStatus === 'ready_for_hook_selection',
    reason: state.pipelineStatus !== 'ready_for_hook_selection' ? 'הצינור לא מוכן לבחירת הוק' : undefined,
  }),
  hook_generating: (state) => ({
    allowed: state.pipelineStatus === 'hook_selected',
    reason: state.pipelineStatus !== 'hook_selected' ? 'יש לבחור הוק לפני יצירתו' : undefined,
  }),
  hook_ready: (state) => ({
    allowed: state.pipelineStatus === 'hook_generating',
    reason: state.pipelineStatus !== 'hook_generating' ? 'יצירת ההוק עדיין לא החלה' : undefined,
  }),
  ready_for_trim_crop: (state) => ({
    allowed: state.pipelineStatus === 'hook_ready' || state.hookStatus === 'skipped',
    reason: 'יש להשלים את שלב ההוק לפני חיתוך ומיקוד',
  }),
  trim_crop_selected: (state) => ({
    allowed: state.pipelineStatus === 'ready_for_trim_crop',
    reason: state.pipelineStatus !== 'ready_for_trim_crop' ? 'הצינור לא מוכן לחיתוך ומיקוד' : undefined,
  }),
  pre_edit_generating: (state) => ({
    allowed: state.pipelineStatus === 'trim_crop_selected' || state.trimCropStatus === 'skipped',
    reason: 'יש להשלים חיתוך ומיקוד לפני הכנת הקובץ',
  }),
  pre_edit_ready: (state) => ({
    allowed: state.pipelineStatus === 'pre_edit_generating',
    reason: state.pipelineStatus !== 'pre_edit_generating' ? 'הכנת הקובץ עדיין לא החלה' : undefined,
  }),
  source_locked: (state) => ({
    allowed: state.pipelineStatus === 'pre_edit_ready' && state.preEditStatus === 'completed',
    reason: 'יש להשלים הכנת הקובץ לפני נעילת המקור',
  }),
  ai_analysis_running: (state) => ({
    allowed: state.pipelineStatus === 'source_locked' && state.sourceLocked,
    reason: !state.sourceLocked ? 'יש לנעול את המקור לפני ניתוח AI' : 'הצינור לא בסטטוס נעול',
  }),
  editing_ready: (state) => ({
    allowed:
      state.pipelineStatus === 'ai_analysis_running' &&
      (state.aiAnalysisStatus === 'completed' || state.aiAnalysisStatus === 'skipped'),
    reason: 'יש להשלים ניתוח AI לפני כניסה לעריכה',
  }),
  editing: (state) => ({
    allowed: state.pipelineStatus === 'editing_ready',
    reason: state.pipelineStatus !== 'editing_ready' ? 'הצינור לא מוכן לעריכה' : undefined,
  }),
  rendering: (state) => ({
    allowed: state.pipelineStatus === 'editing',
    reason: state.pipelineStatus !== 'editing' ? 'יש להיות במצב עריכה לפני רינדור' : undefined,
  }),
  exporting: (state) => ({
    allowed: state.pipelineStatus === 'rendering',
    reason: state.pipelineStatus !== 'rendering' ? 'יש להשלים רינדור לפני ייצוא' : undefined,
  }),
  completed: (state) => ({
    allowed: state.pipelineStatus === 'exporting',
    reason: state.pipelineStatus !== 'exporting' ? 'יש להשלים ייצוא לפני סיום' : undefined,
  }),
};

/**
 * בדיקה האם ניתן להתקדם לשלב מבוקש בצינור.
 *
 * @param state - מצב הצינור הנוכחי
 * @param step - השלב המבוקש
 * @returns האם ההתקדמות מותרת, ואם לא — הסיבה
 */
export function canProceedToStep(
  state: VideoPipelineState,
  step: string,
): { allowed: boolean; reason?: string } {
  // סטטוסים סופיים חוסמים כל התקדמות
  if (state.pipelineStatus === 'failed' || state.pipelineStatus === 'blocked_invalid_source') {
    return { allowed: false, reason: 'הצינור במצב כשל — לא ניתן להתקדם' };
  }

  const prerequisiteCheck = STEP_PREREQUISITES[step];
  if (!prerequisiteCheck) {
    return { allowed: false, reason: `שלב לא מוכר: ${step}` };
  }

  return prerequisiteCheck(state);
}

/**
 * מחזיר את השלב הבא בצינור על בסיס המצב הנוכחי.
 *
 * @param state - מצב הצינור הנוכחי
 * @returns השלב הבא, או null אם הצינור הושלם או נכשל
 */
export function getNextStep(state: VideoPipelineState): PipelineStatus | null {
  if (
    state.pipelineStatus === 'completed' ||
    state.pipelineStatus === 'failed' ||
    state.pipelineStatus === 'blocked_invalid_source'
  ) {
    return null;
  }

  const currentIndex = PIPELINE_STEP_ORDER.indexOf(state.pipelineStatus);
  if (currentIndex === -1) {
    return null;
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= PIPELINE_STEP_ORDER.length) {
    return null;
  }

  const nextStep = PIPELINE_STEP_ORDER[nextIndex];

  // דילוג על שלבי הוק אם הוק דולג
  if (state.hookStatus === 'skipped') {
    if (
      nextStep === 'hook_selected' ||
      nextStep === 'hook_generating' ||
      nextStep === 'hook_ready'
    ) {
      return 'ready_for_trim_crop';
    }
  }

  // דילוג על שלב חיתוך אם דולג
  if (state.trimCropStatus === 'skipped') {
    if (nextStep === 'trim_crop_selected') {
      return 'pre_edit_generating';
    }
  }

  return nextStep;
}

/**
 * הוספת רשומת ביקורת למצב הצינור.
 *
 * @param state - מצב הצינור הנוכחי
 * @param action - הפעולה שבוצעה
 * @param sourceVideoId - מזהה הוידאו המקור
 * @param details - פרטים נוספים (אופציונלי)
 * @returns מצב צינור מעודכן עם רשומת הביקורת
 */
export function addAuditEntry(
  state: VideoPipelineState,
  action: string,
  sourceVideoId: string,
  details?: Record<string, unknown>,
): VideoPipelineState {
  const entry: AuditEntry = {
    action,
    sourceVideoId,
    status: state.pipelineStatus,
    timestamp: new Date().toISOString(),
    details,
  };

  return {
    ...state,
    auditLog: [...state.auditLog, entry],
    updatedAt: new Date().toISOString(),
  };
}
