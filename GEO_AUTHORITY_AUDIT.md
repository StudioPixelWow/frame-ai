# SEO GEO Authority — Audit & Upgrade Report

תאריך: 2026-06-07 · מודול: **SEO GEO Authority Center**

---

## 1. תקציר מנהלים

המערכת כבר כללה תשתית SEO/GEO ענפה (כ‑65 מנועים תחת `src/lib/seo`, ~80 API routes, וכמה מסכי UI). רובם של 15 מודולי הסמכות שביקשת **כבר היו קיימים כמנועים**, אך היו **מפוזרים, ללא שכבת איחוד, ללא ציון סמכות אחיד, ללא טבלאות `geo_*` ייעודיות, וללא מנגנון טיוטה‑לפני‑פרסום מרוכז**.

בסבב זה נבנתה שכבת האיחוד החסרה: **SEO GEO Authority Center** — מסך מרכזי עם ציון סמכות 0–100 (8 ממדים), 15 מודולים כרטיסיים עם סטטוס חי, המלצות → משימות, וטיוטות עם שער אישור ידני. כן נבנו שלושת המנועים הייעודיים שבאמת חסרו: **AI Citation Builder, Brand Mention Agent, Schema Automation Agent**.

---

## 2. Audit — מצב 15 המודולים (מה היה קיים)

| # | מודול | מנוע/קובץ קיים | מצב לפני | פעולה בסבב זה |
|---|-------|----------------|----------|----------------|
| 1 | GEO Content Authority Manager | `authority-reinforcement-engine.ts`, `geo-content-generator.ts`, `content-refresh-engine.ts` | קיים (מפוזר) | אוחד לכרטיס + ניקוד Content Depth |
| 2 | Internal Linking Authority Agent | `internal-linking-engine.ts` | קיים | אוחד + ניקוד Internal Linking |
| 3 | AI Citation Builder | — | **חסר** | **נבנה** `engines.ts → runCitationBuilder` (draft) |
| 4 | Brand Mention Agent | `authority-reinforcement-engine.ts` (חלקי) | **חלקי** | **נבנה** `runBrandMention` ייעודי (draft) |
| 5 | GEO FAQ Generator | `faq-schema-engine.ts`, `generate-questions` | קיים | אוחד + ניקוד AI Readiness |
| 6 | Entity Expansion Agent | `semantic-entity-graph.ts`, `semantic-intelligence.ts` | קיים | אוחד + ניקוד Entity |
| 7 | Competitor Authority Hunter | `competitor-engine.ts`, `competitors/route.ts` | קיים | אוחד + ניקוד Topical |
| 8 | GEO Content Gap Finder | `gap-analysis.ts`, `content-gaps/route.ts` | קיים | אוחד + ניקוד Topical |
| 9 | Semantic SEO Optimizer | `semantic-intelligence.ts`, `hebrew-nlp.ts` | קיים | אוחד + ניקוד Content Depth |
| 10 | Knowledge Graph Builder | `semantic-entity-graph.ts` | חלקי | אוחד (גרף ישויות → Schema) |
| 11 | Schema Automation Agent | `faq-schema-engine.ts` (FAQ בלבד) | **חלקי** | **נבנה** `runSchemaAutomation` כללי (Org/LocalBusiness/Service/FAQ/Breadcrumb, draft) |
| 12 | AI Answer Optimizer | `geo-visibility-optimizer.ts`, `geo-booster.ts` | קיים | אוחד + ניקוד AI Readiness |
| 13 | Topical Authority Manager | `topic-cluster-builder.ts` | קיים | אוחד + ניקוד Topical |
| 14 | GEO Monitoring Agent | `visibility-engine.ts`, `serp-movement-monitor.ts`, `gsc-intelligence-engine.ts` | קיים | אוחד + ניקוד AI Readiness |
| 15 | AI Authority Score Agent | `strategic-scoring.ts` (חלקי) | **חלקי** | **נבנה** מנוע ניקוד אחיד 8 ממדים → 0–100 |

מסקנה: 9 מודולים היו קיימים ופועלים, 4 חלקיים, 2 חסרים. כולם כעת מאוחדים תחת ה‑Authority Center עם ניקוד, סטטוס, המלצות וטיוטות.

---

## 3. מה נבנה בסבב זה (קבצים חדשים)

- `src/lib/seo/geo-authority/db.ts` — שכבת persistence: יצירת כל טבלאות `geo_*` (ensureTable) + CRUD לציונים, המלצות, משימות, טיוטות, תוצאות מודול.
- `src/lib/seo/geo-authority/modules.ts` — רישום 15 המודולים (מטא‑דאטה, מיפוי למנוע קיים, פותר סטטוס חי).
- `src/lib/seo/geo-authority/authority-score.ts` — מנוע ה‑Authority Score: 8 ממדים משוקללים → 0–100, בעיות + המלצות, דטרמיניסטי וללא תלות במכסת AI.
- `src/lib/seo/geo-authority/engines.ts` — שלושת המנועים החדשים (Citation / Brand Mention / Schema), כולם מייצרים **טיוטות בלבד**.
- `src/app/api/seo-geo-plans/[planId]/authority/route.ts` — GET (חשב+שמור), POST (recompute / rec→task / run_module / task_status / draft_status).
- `src/app/(dashboard)/seo-geo/[planId]/authority/page.tsx` — מסך ה‑Authority Center (עיצוב תואם למערכת).
- `add-geo-authority-tables.sql` — מיגרציה ידנית (גיבוי ל‑exec_sql).

קובץ ששונה:
- `src/app/(dashboard)/seo-geo/[planId]/page.tsx` — נוסף כפתור **🏆 Authority Center** בכותרת התוכנית.

---

## 4. טבלאות שנוצרו (geo_*)

פעילות בקוד: `geo_authority_scores`, `geo_recommendations`, `geo_tasks`, `geo_generated_drafts`, `geo_module_results`, `geo_logs`.
נוצרו לשלמות/עתיד: `geo_entities`, `geo_faqs`, `geo_internal_links`, `geo_citations`, `geo_content_gaps`, `geo_schema_markup`, `geo_topic_clusters`, `geo_competitors`, `geo_ai_monitoring_queries`, `geo_ai_monitoring_results`.

נוצרות אוטומטית ב‑runtime (exec_sql RPC). אם זה נכשל — הרץ ידנית את `add-geo-authority-tables.sql` ב‑Supabase.

---

## 5. מערכת הניקוד (8 ממדים → 0–100)

משקלים: Topical 16%, AI Readiness 16%, Content Depth 14%, Entity 12%, Internal Linking 10%, Citation 8%, Brand 8%, Schema 8%, E‑E‑A‑T 8%.

כל ממד מחושב מנתוני הסריקה האמיתיים של התוכנית (websiteScan/scannedPages/competitors/contentGaps/visibilityResults/keywords/websiteFacts). כל ממד חלש מייצר **בעיה + המלצה משויכת למודול** עם עדיפות והשפעה משוערת.

---

## 6. שער טיוטה‑לפני‑פרסום (חשוב)

אף שינוי באתר אינו מתפרסם אוטומטית. המנועים מייצרים `geo_generated_drafts` בסטטוס `draft` בלבד. הזרימה: **draft → approved → applied** (כל מעבר ידני, מאושר ע״י המשתמש). זה עומד בדרישה שאסור Apply ללא אישור.

---

## 7. איך להשתמש

1. היכנס לתוכנית SEO/GEO קיימת (`/seo-geo/[planId]`).
2. לחץ **🏆 Authority Center**.
3. המסך מחשב ציון אוטומטית. לחץ **↻ חשב מחדש** לרענון.
4. הפעל מודול בכרטיס (Citation/Brand/Schema מייצרים טיוטות מיד; שאר המודולים מפנים ללשונית הקיימת שלהם).
5. בהמלצות — לחץ **+ משימה** להפיכת המלצה למשימה.
6. בטיוטות — **אשר** ואז **סמן כהוחל** (החלה ידנית).

---

## 8. מה דורש חיבור/פעולה ידנית

- **OpenAI billing**: המנועים החדשים (Citation/Brand/Schema) משתמשים ב‑`generateWithAI`. נדרשת יתרת OpenAI פעילה. ללא יתרה הם יחזירו 0 טיוטות.
- **מיגרציית DB**: בדרך כלל אוטומטית; אם לא — הרץ `add-geo-authority-tables.sql`.
- **ENV**: לא נדרשים משתני סביבה חדשים. (קיימים בשימוש: `OPENAI_API_KEY`, וקרדנציאלי Supabase.)
- **החלת שינויים באתר בפועל** (WordPress apply): כרגע הטיוטות נשמרות ומסומנות `applied` ידנית; חיבור ה‑apply בפועל לוורדפרס משתמש בתשתית `wordpress-client.ts` הקיימת ויחובר בהמשך פר‑סוג טיוטה.

---

## 9. מה נותר להעמקה (סבב הבא מומלץ)

- חיבור פעולת **Apply** אמיתית של טיוטות (Schema/FAQ/Internal Link) דרך `wordpress-client.ts`.
- ניקוד **פר‑עמוד** (כרגע ניקוד אתר; ה‑schema תומך ב‑scope='page').
- כתיבת תוצאות המודולים הקיימים (entities/clusters/gaps) גם לטבלאות `geo_*` הייעודיות (כרגע נשמרות ב‑JSONB של התוכנית).
- ניטור GEO מתוזמן (cron) שכותב ל‑`geo_ai_monitoring_results` לאורך זמן.

---

## 10. בדיקה שהכול עובד

1. `git push origin main` → המתן לדפלוי Vercel.
2. פתח תוכנית → **Authority Center** → ודא שמופיע ציון + 8 ממדים + 15 כרטיסים.
3. לחץ **הפעל מודול** על "AI Citation Builder" → אמורות להופיע טיוטות (אם יש יתרת OpenAI).
4. אשר המלצה → ודא שנוצרה משימה.
5. ב‑Supabase ודא שנוצרו הטבלאות `geo_*` (או הרץ את ה‑SQL).
