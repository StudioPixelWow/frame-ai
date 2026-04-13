/**
 * PixelFrameAI — Hebrew Locale Dictionary
 *
 * Complete Hebrew translations for the entire UI. This is the single
 * source of truth — components import from here rather than hardcoding
 * Hebrew strings inline.
 *
 * Phase 7.1: Hebrew Localization
 *
 * Convention:
 *   - Keys use dot-separated namespaces (flat object for simplicity)
 *   - Brand names (Pixel Premium, Remotion, etc.) stay in English
 *   - Technical terms (B-roll, MP4, H.264) stay in English
 *   - Format IDs (9:16, 16:9, etc.) stay in English
 */

// ── Core Concepts ─────────────────────────────────────────────────────────

export const core = {
  project: "פרויקט",
  projects: "פרויקטים",
  newProject: "פרויקט חדש",
  subtitles: "כתוביות",
  transcript: "תמלול",
  segments: "קטעים",
  clip: "קליפ",
  format: "פורמט",
  brandPreset: "תבנית עיצוב",
  render: "עיבוד",
  export: "ייצוא",
  upload: "העלאה",
  download: "הורדה",
  preview: "תצוגה מקדימה",
  draft: "טיוטה",
  analysis: "ניתוח",
} as const;

// ── Segment / Content Roles ───────────────────────────────────────────────

export const roles = {
  hook: "פתיח",
  cta: "קריאה לפעולה",
  variation: "וריאציה",
  moments: "רגעים",
  highlights: "הדגשות",
} as const;

// ── Wizard Step Names ─────────────────────────────────────────────────────

export const wizardSteps = {
  projectInfo: "פרטי פרויקט",
  sourceVideo: "וידאו מקור",
  clipSelection: "בחירת קליפ",
  brandPreset: "תבנית עיצוב",
  outputFormat: "פורמט פלט",
  subtitles: "כתוביות",
  speechLanguage: "שפת דיבור",
  transcriptReview: "עריכת תמלול",
  exportPreview: "תצוגה מקדימה לייצוא",
  review: "סקירה",
} as const;

// ── Project / Render Status Labels ────────────────────────────────────────

export const status = {
  complete: "הושלם",
  inProgress: "בתהליך",
  readyForRender: "מוכן לעיבוד",
  renderComplete: "עיבוד הושלם",
  renderFailed: "עיבוד נכשל",
  renderError: "שגיאת עיבוד",
  draft: "טיוטה",
  analysing: "מנתח...",
  analysisFailed: "ניתוח נכשל",
  approved: "מאושר",
  rendering: "מעבד...",
  failed: "נכשל",
} as const;

// ── Navigation Labels ─────────────────────────────────────────────────────

export const nav = {
  projects: "פרויקטים",
  interactivePreview: "תצוגה אינטראקטיבית",
  livePreview: "תצוגה חיה",
  overview: "סקירה",
  transcript: "תמלול",
  highlights: "הדגשות",
  hooks: "פתיחים",
  ctas: "קריאות לפעולה",
  variations: "וריאציות",
  trimPlans: "תוכניות עיבוד",
} as const;

// ── Button / Action Labels ────────────────────────────────────────────────

export const actions = {
  continue: "המשך",
  back: "חזרה",
  cancel: "ביטול",
  saveDraft: "שמירה כטיוטה",
  saveAsDraft: "שמירה כטיוטה",
  backToEdit: "חזרה לעריכה",
  retry: "ניסיון חוזר",
  approve: "אישור",
  approveAndCreate: "אשר וצור",
  createProject: "צור פרויקט",
  openProjects: "פתח פרויקטים",
  viewDocs: "תיעוד",
  regenerate: "יצירה מחדש",
  cleanTranscript: "ניקוי תמלול",
  autoSplitLines: "פיצול שורות אוטומטי",
} as const;

// ── Subtitle Modes ────────────────────────────────────────────────────────

export const subtitleModes = {
  automatic: "כתוביות אוטומטיות",
  manual: "כתוביות ידניות",
  autoDetect: "זיהוי אוטומטי",
  autoSynced: "⚡ אוטומטי",
  manualMode: "✏️ ידני",
} as const;

// ── Subtitle Style Panel ──────────────────────────────────────────────────

export const subtitleStyle = {
  typography: "טיפוגרפיה",
  style: "סגנון",
  motion: "תנועה",
  styleMode: "מצב סגנון",
  clean: "נקי",
  classic: "קלאסי",
  stroke: "קונטור",
  full: "מלא",
  fontFamily: "משפחת גופן",
  weight: "עובי",
  size: "גודל",
  textColor: "צבע טקסט",
  highlightAccent: "הדגשה / אקסנט",
  positionOnScreen: "מיקום על המסך",
  enterAnimation: "אנימציית כניסה",
  lineBreakStyle: "סגנון ירידת שורה",
  backgroundBox: "תיבת רקע",
  textStroke: "קו מתאר",
  dropShadow: "צל",
  opacity: "שקיפות",
  shape: "צורה",
  width: "רוחב",
  intensity: "עוצמה",
} as const;

// ── Review / Export Preview Panel ─────────────────────────────────────────

export const reviewPanel = {
  studioPixelPreset: "תבנית Studio Pixel",
  creativeInstructions: "הנחיות יצירתיות",
  subtitleStyle: "סגנון כתוביות",
  output: "פלט",
  pacing: "קצב",
  cuts: "חיתוכים",
  bRoll: "B-roll",
  hookStyle: "סגנון פתיח",
  ctaStyle: "סגנון קריאה לפעולה",
  colourGrade: "גרייד צבע",
  finalCheck: "בדיקה סופית — זה מה שיישלח לעיבוד",
  preset: "תבנית",
  source: "מקור",
  targetCut: "יעד עריכה",
  music: "מוזיקה",
  direction: "כיוון",
  target: "יעד",
  language: "שפה",
  font: "גופן",
  accent: "אקסנט",
} as const;

// ── Transcript Editor ─────────────────────────────────────────────────────

export const transcriptEditor = {
  generatedSubtitles: "כתוביות שנוצרו",
  subtitlePreview: "תצוגה מקדימה של כתוביות",
  subtitleText: "טקסט כתוביות",
  confidence: "דיוק",
  approved: "מאושר",
  edited: "נערך",
  generated: "נוצר",
  approveLine: "אשר שורה זו",
  approvedClickToUnapprove: "מאושר — לחץ לביטול אישור",
} as const;

// ── Project Review Step ───────────────────────────────────────────────────

export const projectReview = {
  projectDetails: "פרטי פרויקט",
  creatingProject: "יצירת פרויקט",
  studioPixelPreset: "תבנית Studio Pixel",
  clipSelection: "בחירת קליפ",
  trimmed: "מקוצר",
  fullVideo: "וידאו מלא",
  sourceVideo: "וידאו מקור",
  outputFormat: "פורמט פלט",
  speechLanguage: "שפת דיבור",
  subtitleStyle: "סגנון כתוביות",
  targetDuration: "משך יעד",
  tags: "תגיות",
  noCreativeInstructions: "אין הנחיות יצירתיות",
  noKeywordsDetected: "לא זוהו מילות מפתח ספציפיות",
} as const;

// ── Analysis / Processing Steps ───────────────────────────────────────────

export const processing = {
  detectingAudio: "זיהוי ערוצי שמע",
  runningSpeechToText: "המרת דיבור לטקסט",
  segmentingTranscript: "פילוח תמלול",
  buildingTimeline: "בניית ציר עריכה",
  savingSettings: "שמירת הגדרות פרויקט",
  interpretingCreative: "פרשנות הנחיות יצירתיות",
  buildingEditConfig: "בניית תצורת עריכה",
  configuringPreset: "הגדרת תבנית עיצוב",
  composingSegmentPlan: "בניית תוכנית עדיפות קטעים",
  buildingComposition: "בניית קומפוזיציה",
} as const;

// ── Toast / Notification Messages ─────────────────────────────────────────

export const toasts = {
  docComingSoon: "תיעוד בקרוב",
  noVideoAttached: "לא צורף וידאו לפרויקט זה",
  projectApprovedSetupSubtitles: "הפרויקט אושר — הגדר כתוביות",
  projectApprovedRenderReady: "✅ הפרויקט אושר — מוכן לעיבוד",
  draftSaved: "טיוטה נשמרה — תמצא אותה ברשימת הפרויקטים",
  enterProjectTitle: "יש להזין כותרת פרויקט",
  endAfterStart: "נקודת הסיום חייבת להיות לאחר נקודת ההתחלה",
  clipMinLength: "הקליפ חייב להיות לפחות שנייה אחת",
  selectSpeechLanguage: "יש לבחור שפת דיבור — או לבחור זיהוי אוטומטי",
  noFillerWords: "לא נמצאו מילות מילוי",
  noLongLines: "אין שורות מעל 76 תווים",
  noVideoCannotRegenerate: "לא נטען וידאו — לא ניתן ליצור מחדש",
  transcriptRegenerated: "התמלול נוצר מחדש",
  projectCreatedSetupSubtitles: "הפרויקט נוצר — הגדר כתוביות",
  projectReadyOpening: "הפרויקט מוכן — פותח תצוגת פרויקט",
  hookSelected: "פתיח נבחר",
  ctaSelected: "קריאה לפעולה נבחרה",
  variationSelected: "וריאציה נבחרה",
  projectNotFound: "הפרויקט לא נמצא",
  noVideoCreateFirst: "לא צורף וידאו — צור את הפרויקט עם וידאו תחילה",
  renderInProgress: "עיבוד כבר מתבצע…",
  uploadingVideo: "מעלה וידאו לשרת העיבוד…",
  renderStarted: "עיבוד החל — זה עשוי לקחת דקה…",
  renderComplete: "עיבוד הושלם — הוידאו מוכן",
} as const;

// ── Preserved English Terms (documented for reference) ────────────────────

/**
 * These terms are intentionally NOT translated:
 *   - Pixel Premium, Pixel Performance, Pixel Social (brand presets)
 *   - 9:16, 16:9, 1:1, 4:5 (format IDs)
 *   - B-roll (universal film term)
 *   - Remotion (software name)
 *   - MP4, H.264, WebP (codec/format names)
 *   - RTL, LTR (direction codes)
 */
