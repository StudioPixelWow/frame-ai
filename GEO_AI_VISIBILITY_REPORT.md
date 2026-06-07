# GEO AI Visibility Center — דוח בנייה

תאריך: 2026-06-07 · מודול ניטור נראות במנועי AI, מחובר ל‑Authority Center ולתשתית האוטומציה.

---

## 1. מה היה קיים לפני

- שכבת providers אמיתית: `platform-apis.ts` — `queryPlatform(engine, query, brand, domain)` ל‑ChatGPT/Claude/Gemini/Perplexity/Google AI Overview, עם `getApiStatus()` והחזרת `{found, position, responseText, sources, mentionType}` (כולל מקורות = ציטוטים).
- `visibility-engine.ts` (סיכומי פלטפורמה, opportunity score), ו‑`visibilityResults` על ה‑SeoPlan.
- cron `geo-monitoring` ששמר snapshot בסיסי.

## 2. מה היה חסר

מנגנון ניטור **מובנה ומתמשך**: Query Sets מנוהלים, Runs תקופתיים, Brand Profile לזיהוי אזכורים, מעקב מתחרים, Citation tracking פר‑עמוד, Share of AI Voice, Topic visibility, ציון נראות, אומדן Reach, אגרגציה חודשית, דשבורד ייעודי, ובקרת עלות — כל אלה לא היו.

## 3. מה נבנה בפועל

מודול **GEO AI Visibility Center** שלם, מחובר ל‑Authority Center ולתשתית האוטומציה:
- **AIVisibilityProviderService** (`provider.ts`) — adapter מודולרי מעל `queryPlatform`, עם Mock fallback כשאין מפתחות, ופונקציות `extractMention/extractCitations/extractCompetitors`.
- **Run engine** (`run.ts`) — `runVisibilityRun`: Query Set × מנועים → תשובות, אזכורים, ציטוטים, מתחרים, ציון, אומדן Reach, אגרגציה חודשית. כולל יצירת queries אוטומטית מהאתר ו‑Brand Profile אוטומטי, ובקרת עלות (query cap + budget gate).
- **Scoring** (`scoring.ts`) — `calculateAIVisibilityScore` (Mention 25 / SoV 20 / Citation 20 / Position 10 / Recommendation 10 / Topic 10 / Sentiment 5) + `estimateAIReach` (מסומן כ**אומדן**).
- **חיבור לאוטומציה** — job type חדש `ai_visibility` ב‑worker → ריצות שבועיות אוטומטיות לכל לקוח שמפעיל אותו, דרך ה‑queue/retries/budget שכבר נבנו.
- **Dashboard מלא** עם טאבים: סקירה, שאילתות, ריצות, אזכורים, ציטוטים, מתחרים, תחומים, הגדרות (Brand Profile). כולל גרף מגמה, Share of AI Voice, leaderboard מתחרים, הזדמנויות, זמינות מנועים, וסימון **Measured/Estimated/דמו**.

## 4–5. קבצים

**נוצרו:** `src/lib/seo/geo-visibility/{db,provider,scoring,run}.ts`, `src/app/api/seo-geo-plans/[planId]/visibility/route.ts`, `src/app/(dashboard)/seo-geo/[planId]/visibility/page.tsx`, `GEO_AI_VISIBILITY_REPORT.md`.
**שונו:** `src/lib/seo/automation/worker.ts` (job type ai_visibility + cost), `src/app/(dashboard)/seo-geo/[planId]/authority/page.tsx` (כפתור 📡 AI Visibility), `SUPABASE_MANUAL_SETUP.sql` (סקשן E).

## 6. טבלאות / Migrations

11 טבלאות `geo_visibility_*`: brand_profiles, queries, runs, responses, mentions, citations, competitors, competitor_mentions, monthly_aggregations, logs (+ unique index חודשי). נוצרות אוטומטית; **הרץ `SUPABASE_MANUAL_SETUP.sql` סקשן E** כביטוח. ללא כפילות — ה"פרויקט" הוא ה‑SeoPlan הקיים (plan_id).

## 7. API / Services

`GET /api/seo-geo-plans/[planId]/visibility` (dashboard) · `POST` actions: `gen_queries`, `add_query`, `delete_query`, `update_brand`, `add_competitor`, `delete_competitor`, `cost_preview`, `run_now`, `enable_automation`.

## 8. UI

מסך AI Visibility Center עם 8 טאבים (לעיל), כרטיסי KPI, גרף מגמה, מודאל אישור עלות לפני ריצה, וסימון אמין מול אומדן.

## 9. ENV (אופציונלי — לשדרוג מהדמו לאמיתי)

קיימים בשימוש: `OPENAI_API_KEY`. להפעלת מנועים נוספים אמיתיים הוסף לפי הצורך: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `SERP_API_KEY` (ל‑Google). חדש אופציונלי: `GEO_VISIBILITY_MAX_RUN_QUERIES` (ברירת מחדל 12 לריצה אוטומטית). ללא מפתחות — המערכת רצה ב**מצב דמו** (מסומן ב‑UI) כדי שהצינור עובד מקצה לקצה.

## 10. Supabase migration ידני?

מומלץ: הרץ את `SUPABASE_MANUAL_SETUP.sql` (כולל סקשן E). אחרת נוצר אוטומטית ב‑runtime.

---

## 11. איך מפעילים

תוכנית SEO/GEO → **🏆 Authority Center** → **📡 AI Visibility**.

## 12. Project ראשון

ה"פרויקט" הוא התוכנית עצמה — כבר קיים. בטאב "הגדרות" מלא Brand Profile (שם, שמות נרדפים, דומיין, מתחרים) לדיוק זיהוי.

## 13. Query Set ראשון

טאב "שאילתות" → "✨ צור אוטומטית מהאתר" (מ‑keywords של התוכנית) או "+ הוסף" ידנית.

## 14. Run ראשון

לחץ "⚡ הרץ בדיקה" → מודאל מציג שאילתות/מנועים/קריאות/עלות משוערת ומצב (אמיתי/דמו) → "אשר והרץ". התוצאות נשמרות ומופיעות מיד.

## 15. קריאת הדוחות

טאב "סקירה" = KPIs + מגמה + הזדמנויות + מתחרים. "ריצות" = היסטוריה. "אזכורים/ציטוטים/מתחרים/תחומים" = פירוט. אגרגציה חודשית מצטברת אוטומטית.

## 16. מה נשאר לשלב הבא

- חיבור ה‑Recommendations של נראות נמוכה ישירות ל‑Authority Center (Content Gap / Citation Builder / Topical / Brand Mention) — ה‑hook קיים, צריך wiring דו‑כיווני.
- Reports מיוצאים (PDF/CSV) + שליחה ללקוח.
- ניתוח תשובה ע"י AI שני (sentiment/recommendation מדויק יותר) במקום היוריסטיקה.
- RBAC ל‑Client Viewer (צפייה בלבד, בלי הרצות יקרות).

**הערה חשובה:** המודול הוא **ניטור ומדידה בלבד** — אינו משנה אתרי לקוחות. כל שדרוג תוכן עובר דרך ה‑Approval של Authority Center.
