# Advanced GEO Growth Center — Audit & Build Report

תאריך: 2026-06-07 · בהמשך ל‑SEO GEO Authority Center

---

## סיכום

נבדקו 25 המודולים המתקדמים מול הקוד הקיים. **רוב הקונספטים המתקדמים לא היו קיימים** (simulation, reputation, roadmap, content brief, forecast, market share, query discovery, conversation path, reverse engineering, knowledge gap, featured source, influence, trust, brand memory). חלקם היו **חלקיים** דרך מנועים קיימים (opportunity‑priority‑engine, validation‑gate, plan‑generator, generate‑questions, competitor‑engine, semantic‑entity‑graph). לא נוצרה אף כפילות — מודולים חלקיים מורחבים, חדשים נבנו.

נבנה **Advanced GEO Growth Center** — שכבה מעל ה‑Authority Center: ניקוד מתקדם (19 ציונים), 25 מודולים, 10 מנועי AI חדשים (כולם מצב טיוטה/המלצה), טבלאות `geo_*` חדשות, API ו‑UI עם 13 טאבים. מקושר מכפתור 🚀 ב‑Authority Center.

---

## טבלת מודולים (1–25)

| # | מודול | היה קיים? | חלקי? | מה נוסף/שודרג | קבצים | טבלה | סטטוס |
|---|-------|-----------|-------|----------------|-------|------|--------|
| 1 | AI Query Discovery | לא | generate‑questions | מנוע מלא: 8 סוגי שאילתות + שיוך נושא/עמוד/עדיפות/מדינה/שפה/נפח | advanced-engines.ts | geo_query_discovery_sets | ✅ נבנה |
| 2 | Competitor Reverse Eng. | חלקי | competitor-engine | ציון Competitor Weakness + חיבור; ניתוח עומק = שלב הבא | scores.ts, registry | (module_results) | 🟡 הורחב |
| 3 | Citation Opportunity Finder | לא | — | מנוע מלא: gap/probability/source‑type/competitor‑cited | advanced-engines.ts | geo_citation_opportunities | ✅ נבנה |
| 4 | AI Answer Simulation | לא | — | סימולציה פר‑שאילתה: הופיע/צוטט/מי במקום/מה חסר/תשובה אידיאלית | advanced-engines.ts | geo_answer_simulations | ✅ נבנה |
| 5 | Search Console + AI Overlay | חלקי | gsc-real-service | ציון AI Influence + Overlay בסיסי; חיבור GSC מלא = שלב הבא | registry, scores.ts | (geo_scores) | 🟡 הורחב |
| 6 | AI Reputation Monitor | לא | — | מנוע: דיוק/טון/סיכון/מומחיות חסרה/מתחרים | advanced-engines.ts | geo_reputation_checks | ✅ נבנה |
| 7 | Content ROI Predictor | לא | — | ציון Content ROI נגזר; חיבור לבריפים | scores.ts | geo_scores | ✅ נבנה (ניקוד) |
| 8 | AI Knowledge Gap Detector | חלקי | semantic-entity-graph | ציון Knowledge Gap + המלצות | scores.ts | geo_scores | 🟡 הורחב |
| 9 | Brand Entity Authority | חלקי | knowledge_graph | ציון Brand‑Entity Authority | scores.ts | geo_scores | 🟡 הורחב |
| 10 | AI Recommendation Score | חלקי | visibility-engine | ציון 0–100 (mention→top) ללא כפילות | scores.ts | geo_scores | 🟡 הורחב |
| 11 | AI Trust Score | לא | — | נוסחה: E‑E‑A‑T+Schema+Citation+Brand+Entity | scores.ts | geo_scores | ✅ נבנה |
| 12 | Entity Gap Finder | חלקי | entity_expansion | ציון Entity Gap | scores.ts | geo_scores | 🟡 הורחב |
| 13 | Citation Probability Score | לא | — | נוסחה משולבת ב‑Citation Builder | scores.ts | geo_scores | ✅ נבנה |
| 14 | AI Featured Source Detector | לא | — | ציון Featured Source (mention→primary) | scores.ts | geo_scores | ✅ נבנה (ניקוד) |
| 15 | GEO Opportunity Engine | חלקי | opportunity-priority-engine | מנוע מלא: ROI/קושי/ביקוש + buckets | advanced-engines.ts | geo_opportunities | ✅ נבנה |
| 16 | GEO Action Center | קיים | geo_tasks | חיבור למשימות הקיימות (ללא כפילות) | registry | geo_tasks | 🟡 חובר |
| 17 | GEO Roadmap Generator | חלקי | plan-generator (60 יום) | מנוע 30/60/90/180 ייעודי | advanced-engines.ts | geo_roadmaps | ✅ נבנה |
| 18 | AI Market Share | לא | — | ציון + טבלת snapshots; Dashboard מורחב = שלב הבא | scores.ts | geo_market_share_snapshots | 🟡 בסיס |
| 19 | AI Source Network Map | לא | — | טבלאות nodes/edges; UI ויזואלי = שלב הבא | SQL | geo_source_network_* | 🟡 בסיס |
| 20 | AI Influence Score | לא | — | נוסחה: hit‑rate+Topical+Entity | scores.ts | geo_scores | ✅ נבנה |
| 21 | GEO Forecast Engine | לא | — | תחזית 30/60/90 + confidence + assumptions | advanced-engines.ts | geo_forecasts | ✅ נבנה |
| 22 | AI Content Brief Generator | לא | — | בריף מלא (H1/Meta/FAQ/Entities/Schema/Queries…) | advanced-engines.ts | geo_content_briefs | ✅ נבנה |
| 23 | AI Content Validator | חלקי | validation-gate | מנוע ולידציה 10 בדיקות לפני פרסום | advanced-engines.ts | geo_content_validations | ✅ נבנה |
| 24 | AI Brand Memory Tracker | לא | — | ציון + snapshots; טרנדים חודשיים מצטברים ע"י cron | scores.ts | geo_brand_memory_snapshots | 🟡 בסיס |
| 25 | AI Conversation Path Analyzer | לא | — | מנוע: מסעות/אשכולות/עמודים חסרים/קישור/פאנל | advanced-engines.ts | geo_conversation_paths | ✅ נבנה |

מקרא: ✅ נבנה מלא · 🟡 הורחב/בסיס (ללא כפילות, מחובר, עם הרחבה מתוכננת).

---

## מה היה / מה לא היה / מה הוסף

- **היה קיים (חלקי):** opportunity‑priority‑engine, validation‑gate, plan‑generator (60 יום), generate‑questions, competitor‑engine, semantic‑entity‑graph, visibility‑engine, gsc‑real‑service.
- **לא היה כלל:** simulation, reputation, roadmap (ייעודי), content brief, forecast, market share, query discovery, conversation path, reverse engineering (ייעודי), knowledge gap, featured source, influence, trust, brand memory, citation opportunity/probability.
- **הוסף:** 10 מנועי AI חדשים, 19 פונקציות ניקוד, 13 טבלאות `geo_*` חדשות, API `/geo-advanced`, מסך Growth Center עם 13 טאבים, חיבור מה‑Authority Center.

---

## קבצים

**חדשים:**
`src/lib/seo/geo-authority/advanced-db.ts`, `scores.ts`, `advanced-engines.ts`, `advanced-modules.ts`,
`src/app/api/seo-geo-plans/[planId]/geo-advanced/route.ts`,
`src/app/(dashboard)/seo-geo/[planId]/growth/page.tsx`, `GEO_ADVANCED_AUDIT.md`.

**שונים:**
`src/app/(dashboard)/seo-geo/[planId]/authority/page.tsx` (כפתור Advanced Growth),
`SUPABASE_MANUAL_SETUP.sql` (סקשן C).

---

## Migrations (Supabase)

הרץ את `SUPABASE_MANUAL_SETUP.sql` המעודכן (סקשן C מוסיף את כל טבלאות ה‑Advanced). נוצרות גם אוטומטית ב‑runtime; ההרצה הידנית = ביטוח מפני תקלה. רשימת טבלאות חדשות: `geo_scores, geo_opportunities, geo_content_briefs, geo_content_validations, geo_answer_simulations, geo_reputation_checks, geo_roadmaps, geo_forecasts, geo_query_discovery_sets, geo_conversation_paths, geo_citation_opportunities, geo_brand_memory_snapshots, geo_market_share_snapshots, geo_source_network_nodes, geo_source_network_edges`.

## ENV

אין משתני סביבה חדשים. המנועים משתמשים ב‑`OPENAI_API_KEY` הקיים (נדרשת יתרה פעילה).

---

## הפעלה ובדיקה

1. `git push origin main` → דפלוי. הרץ את ה‑SQL ב‑Supabase.
2. תוכנית SEO/GEO → **🏆 Authority Center** → **🚀 Advanced Growth**.
3. "↻ חשב ציונים" → טאב "סקירה" מציג 19 ציונים.
4. טאב "שאילתות AI" → "הפעל מודול" → אמורות להופיע שאילתות (אם יש יתרת OpenAI).
5. טאב "הזדמנויות"/"סימולציות"/"מוניטין"/"תחזית"/"Roadmap"/"בריפים" → הפעל מודול ובדוק טבלה.
6. הכל מצב טיוטה/המלצה — שום שינוי אינו נדחף לאתר.

## שלב הבא (מומלץ)

- Source Network Map ויזואלי (יש טבלאות).
- Market Share Dashboard מלא לפי מימדים.
- חיבור GSC חי ל‑Overlay (יש abstraction ב‑gsc‑real‑service).
- Reverse Engineering עמוק (סריקת עמודי מתחרים מצוטטים).
- צבירת Brand Memory חודשית דרך ה‑cron הקיים (`/api/cron/geo-monitoring`).
