/**
 * SEO/GEO Module — Hebrew Translation Dictionary
 *
 * All user-facing strings live here.
 * Technical/internal values (API routes, DB fields, variable names, logs) stay in English.
 */

export const t = {
  // ── General ──
  loading: "טוען...",
  error: "שגיאה",
  save: "שמור",
  cancel: "ביטול",
  close: "סגור",
  back: "חזרה",
  next: "הבא",
  confirm: "אישור",
  delete: "מחיקה",
  edit: "עריכה",
  details: "פרטים",
  actions: "פעולות",
  noData: "אין נתונים",

  // ── Permissions / Errors (api-helpers) ──
  forbidden: "אין הרשאה לפעולה זו",
  noAccessToPlan: "אין גישה לתוכנית זו",
  staffRequired: "פעולה זו דורשת הרשאת צוות",

  // ── Validation Gate ──
  notEnoughData: "אין מספיק נתונים מאומתים להמשך התהליך",
  missingBusinessType: "לא זוהה סוג עסק",
  missingProducts: "לא זוהו מוצרים או שירותים",
  noPagesScanned: "לא נסרקו דפים",

  // ── Wizard Steps ──
  scanWebsite: "סריקת אתר",
  confirmBusinessProfile: "אימות פרופיל עסקי",
  setGoals: "הגדרת יעדים",
  aiVisibility: "נראות AI",
  generateInsights: "הפקת תובנות",
  generate60DayPlan: "יצירת תוכנית 60 יום",
  generateReport: "הפקת דוח",

  // ── Plan Statuses ──
  status: {
    draft: "טיוטה",
    scanning: "בסריקה",
    goals_set: "יעדים הוגדרו",
    visibility_done: "נראות הושלמה",
    insights_ready: "תובנות מוכנות",
    plan_generated: "תוכנית מוכנה",
    tasks_created: "משימות נוצרו",
    active: "פעיל",
    completed: "הושלם",
  },

  // ── Tabs ──
  tabs: {
    overview: "סקירה",
    plan: "תוכנית 60 יום",
    tasks: "משימות",
    ai: "תוצאות AI",
    competitors: "מתחרים",
    gaps: "פערי תוכן",
    reports: "דוחות",
  },

  // ── Task Statuses (Kanban) ──
  taskStatus: {
    todo: "לביצוע",
    in_progress: "בעבודה",
    waiting: "ממתין ללקוח",
    done: "הושלם",
  },

  // ── Priority ──
  priority: {
    high: "גבוהה",
    medium: "בינונית",
    low: "נמוכה",
    highImpact: "השפעה גבוהה",
  },

  // ── Months ──
  months: ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"],

  // ── Plan Detail Page ──
  planNotFound: "תוכנית לא נמצאה",
  backToSeoCenter: "חזרה למרכז PIXEL SEO/GEO",
  seoPlan: "תוכנית PIXEL SEO/GEO",
  created: "נוצר",
  generating: "מייצר...",
  generatePdfReport: "הפק דוח PDF",
  viewReport: "צפה בדוח",
  sendToClient: "שלח ללקוח",
  sendToClientSoon: "בקרוב: שלח דוח ותוכנית ללקוח במייל וב-Dashboard",
  addTask: "הוסף משימה",
  addTaskSoon: "בקרוב: ממשק לייצירת משימה חדשה לתוכנית",

  // ── KPI Cards ──
  kpi: {
    geoScore: "נראות במנועי AI",
    seoScore: "ציון טכני",
    aiVisibility: "ציון כללי",
    progress: "התקדמות",
    completedTasks: "משימות שהושלמו",
    daysRemaining: "ימים שנותרו",
    of: "מתוך",
    of60Days: "מתוך 60 יום",
  },

  // ── Overview Sections ──
  goals: "יעדים",
  noGoalsDefined: "לא הוגדרו יעדים",
  technicalScan: "סריקה טכנית",
  noScanPerformed: "לא בוצעה סריקה",
  speed: "מהירות",
  mobile: "מובייל",
  pages: "דפים",
  broken: "שבורים",
  insights: "תובנות",
  noInsights: "אין תובנות",
  aiVisibilitySection: "נראות AI",
  overallVisibilityScore: "ציון נראות כולל",

  // ── Plan Tab ──
  phase: "שלב",
  day: "יום",
  week: "שבוע",
  tasks_label: "משימות",
  days: "ימים",

  // ── Empty States ──
  empty: {
    noPlan: "אין תוכנית 60 יום עדיין. חזור לאשף ליצירת תוכנית.",
    noTasks: "אין משימות בתוכנית. צור תוכנית 60 יום כדי ליצור משימות.",
    noTasksShort: "אין משימות",
    noAiResults: "אין תוצאות AI. חזור לאשף והרץ סריקת נראות.",
    aiVisibilityScore: "ציון נראות AI",
    competitorsSoon: "ניתוח מתחרים יהיה זמין בקרוב. הנתונים ייאספו מסריקות הנראות ומחקר מילות מפתח.",
    gapsSoon: "ניתוח פערי תוכן יהיה זמין בקרוב. המערכת תזהה הזדמנויות תוכן על בסיס מחקר מילות מפתח וניתוח מתחרים.",
    noReportYet: "עדיין לא הופק דוח",
    noReportDescription: "הפק דוח חדש כדי לשתף עם הלקוח את ממצאי הסריקה, תוצאות ה-AI ותוכנית הפעולה",
    generateFirstReport: "הפק דוח ראשון",
    clickGenerateReport: 'לחץ על "הפק דוח חדש" כדי לייצר דוח מעודכן',
  },

  // ── AI Results Table ──
  query: "שאילתה",
  category: "קטגוריה",
  intent: "כוונה",
  queryDetails: "פרטי שאילתה",
  mentioned: "מוזכר",
  notMentioned: "לא מוזכר",
  position: "עמדה",

  // ── Reports Tab ──
  reports: "דוחות",
  generatingReport: "מייצר דוח...",
  generateNewReport: "הפק דוח חדש",
  view: "צפה",
  send: "שלח",

  // ── Report Viewer ──
  report: {
    generating: "מייצר דוח...",
    analyzingData: "המערכת מנתחת את כל נתוני הסריקה ומייצרת המלצות מותאמות",
    generationError: "שגיאה בייצור הדוח",
    tryAgain: "נסה שוב",
    backToPlan: "חזרה לתוכנית",
    regenerate: "ייצר מחדש",
    exportPdf: "ייצוא PDF",
    comprehensiveReport: "דוח PIXEL SEO/GEO מקיף",
    overall: "ציון כללי",
    technical: "טכני",
    aiVis: "נראות AI",
    findings: "ממצאים",
    critical: "קריטיים",
    generatedOn: "הופק בתאריך:",
    toc: "תוכן עניינים",
    footer: "דוח זה הופק אוטומטית. כל הזכויות שמורות.",
    recommendation: "המלצה:",
    hebrew: "עברית",
    english: "English",
  },

  // ── Severity Labels ──
  severity: {
    critical: "קריטי",
    warning: "אזהרה",
    info: "מידע",
    success: "תקין",
  },

  // ── AI Visibility (simulated) ──
  aiVisibilityUnavailable: "נתוני נראות AI אינם זמינים",
  aiVisibilitySimulated: "תוצאות נראות AI הן סימולציה. לא מחוברים API-ים אמיתיים למנועי AI. חבר API אמיתי לקבלת נתונים.",
  noEvidenceNoClaim: "אין הוכחה — אין טענה",

  // ── Report Names ──
  reportName: (clientName: string) => `דוח PIXEL SEO/GEO — ${clientName || "ללא שם"}`,

  // ── Results & Visibility Layer ──
  resultsAndVisibility: "תוצאות ונראות",
  platformOverview: "סקירת פלטפורמות",
  allResults: "כל התוצאות",
  queriesScanned: "שאילתות שנסרקו",
  mentionsCount: "אזכורים",
  visibilityPct: "אחוז נראות",
  scanModeLabel: "מצב סריקה",
  scanMode: {
    real: "אמיתי",
    simulated: "סימולציה",
    unavailable: "לא זמין",
  },
  scanModeBadge: {
    real: "נתונים אמיתיים",
    simulated: "סימולציה — לא נתונים אמיתיים",
    unavailable: "לא זמין — אין חיבור API",
  },
  platforms: {
    google_seo: "Google SEO",
    google_ai_overview: "Google AI Overview",
    gemini: "Gemini",
    chatgpt: "ChatGPT",
    claude: "Claude",
    perplexity: "Perplexity",
  },
  platformDesc: {
    google_seo: "חיפוש אורגני",
    google_ai_overview: "סקירת AI של גוגל",
    gemini: "מנוע AI של Google",
    chatgpt: "מנוע AI של OpenAI",
    claude: "מנוע AI של Anthropic",
    perplexity: "מנוע חיפוש AI",
  },

  // ── Results Table Columns ──
  keyword: "מילת מפתח",
  searchIntent: "כוונת חיפוש",
  organicPosition: "מיקום אורגני",
  pageUrl: "כתובת דף",
  pageTitle: "כותרת דף",
  metaDesc: "תיאור מטא",
  appears: "מופיע?",
  yes: "כן",
  no: "לא",
  dateChecked: "תאריך בדיקה",
  aiOverviewExists: "קיימת סקירת AI?",
  mentionPosition: "מיקום אזכור",
  competitorsMentioned: "מתחרים שהוזכרו",
  aiSnippet: "קטע AI",
  sourceUrls: "כתובות מקור",
  question: "שאלה",
  answer: "תשובה",
  mentionContext: "הקשר אזכור",
  sources: "מקורות",
  confidenceScore: "ציון ביטחון",

  // ── Filters ──
  filters: {
    allPlatforms: "כל הפלטפורמות",
    allTopics: "כל הנושאים",
    mentionedOnly: "מוזכרים בלבד",
    notMentionedOnly: "לא מוזכרים בלבד",
    all: "הכל",
    topRanking: "דירוג גבוה",
    aiMentions: "אזכורי AI",
    opportunities: "הזדמנויות בלבד",
  },

  // ── Actions ──
  fixThis: "תקן זאת",
  generateContent: "צור תוכן",
  addTaskAction: "הוסף משימה",
  improvePage: "שפר דף",
  exportPlatform: "ייצוא לפי פלטפורמה",
  exportFullReport: "ייצוא דוח מלא",

  // ── Opportunity ──
  opportunity: "הזדמנות",
  opportunityScore: "ציון הזדמנות",
  highOpportunity: "הזדמנות גבוהה",

  // ── Scan History ──
  scanHistory: "היסטוריית סריקות",
  previousScans: "סריקות קודמות",
  compareBefore: "לפני",
  compareAfter: "אחרי",
  noScanHistory: "אין היסטוריית סריקות",

  // ── Metrics ──
  totalQueriesScanned: "סה״כ שאילתות שנסרקו",
  totalMentions: "סה״כ אזכורים",
  overallAiVisibility: "נראות AI כוללת",
  visibilityPerPlatform: "נראות לפי פלטפורמה",
  visibilityTrend: "מגמת נראות",

  // ── Keyword Clustering ──
  keywordCluster: "אשכול מילות מפתח",
  topic: "נושא",
  groupByPlatform: "קבץ לפי פלטפורמה",
  groupByTopic: "קבץ לפי נושא",
  groupByCluster: "קבץ לפי אשכול",

  // ── Competitor Compare ──
  compareVsCompetitor: "השוואה מול מתחרה",
  selectCompetitor: "בחר מתחרה",
  sideBySide: "השוואה זה מול זה",

  // ── Evidence ──
  evidenceSource: "מקור הוכחה",
  extractedSnippet: "קטע שחולץ",
  noEvidence: "אין הוכחה — אין טענה",

  // ── Empty States ──
  emptyResults: {
    noPlatformData: "אין נתוני סריקה לפלטפורמה זו",
    runScanFirst: "הרץ סריקת נראות כדי לקבל תוצאות",
    noResultsForFilter: "אין תוצאות התואמות את הסינון",
  },
};

export default t;
