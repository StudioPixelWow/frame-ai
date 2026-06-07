# GEO AI Visibility — שכבת מדידה אמיתית & Data Moat (דוח)

תאריך: 2026-06-07 · שדרוג מעל GEO AI Visibility Center.

---

## 1–3. סטטוס 8 השדרוגים (היה / חלקי / לא היה)

| # | שדרוג | היה קיים? | מה נוסף |
|---|-------|-----------|----------|
| 1 | Real vs Estimated Framework | חלקי (Badge בסיסי ב‑UI) | `METRIC_META` מלא (data_source/confidence/measurement_type/method) מוחזר מה‑API + Badge+Tooltip לכל metric |
| 2 | AI Citation History | לא | `geo_citation_history` + מסך **Citation Timeline** (first/last seen, status active/lost/regained/declining/growing/new, trend, loss count, engines/topics) |
| 3 | Global AI Citation Index | לא | `geo_global_citation_index` אנונימי‑אגרגטיבי (domain/page_type/topic/engine/frequency/avg position) + מסך **Global Index** עם Badge "aggregated anonymous" |
| 4 | AI Answer Change Log | לא | `geo_ai_answer_snapshots` + `geo_ai_answer_change_events` + מסך **Change Log** (brand_entered/left, citation_added/removed, competitor_entered/left, recommendation up/down) |
| 5 | Prompt-Level Visibility | לא | טבלת `geo_visibility_prompts` (prompt/parent/conversation_depth/intent_stage) + שדה prompt_id בכל ה‑snapshots/diffs (תשתית מוכנה; UI מורחב בשלב הבא) |
| 6 | Featured Source Classification | לא | סיווג בכל ציטוט: mention/citation/supporting/featured/primary + source_weight + is_primary/is_featured + reason (עמודות חדשות ב‑citations) |
| 7 | Citation Diff Engine | לא | `geo_citation_diffs` — השוואה אוטומטית מול הריצה הקודמת (gained/lost/position changes) + מסך **Diffs** |
| 8 | AI Visibility Alerts | לא | `geo_visibility_alerts` — התראות אוטומטיות (brand dropped, citation lost, competitor overtook…) + מסך **התראות** עם acknowledge/dismiss והמלצת פעולה |

הכל מחובר ל‑**run engine הקיים** — אין כפילות; כל ריצה מייצרת אוטומטית snapshots+diffs+alerts+history+global.

## 4. מה נוסף בפועל

מנוע `recordRunHistory` שרץ בסוף כל `runVisibilityRun`: מצלם תשובות, משווה לריצה קודמת, מסווג חוזק מקור, מעדכן היסטוריית ציטוט פר‑URL, מייצר change events + citation diffs + alerts, וצובר ל‑Global Citation Index. כולל מסגרת Measured‑vs‑Estimated מלאה.

## 5. קבצים שנוצרו

`src/lib/seo/geo-visibility/history-db.ts`, `src/lib/seo/geo-visibility/history.ts`, `GEO_VISIBILITY_HISTORY_REPORT.md`.

## 6. קבצים ששונו

`src/lib/seo/geo-visibility/run.ts` (סיווג מקור + בניית perResponse + קריאת recordRunHistory),
`src/app/api/seo-geo-plans/[planId]/visibility/route.ts` (alerts/history/diffs/changelog/global + METRIC_META + alert_status),
`src/app/(dashboard)/seo-geo/[planId]/visibility/page.tsx` (5 טאבים חדשים: התראות, Timeline, Change Log, Diffs, Global Index),
`SUPABASE_MANUAL_SETUP.sql` (סקשן F).

## 7. טבלאות / Migrations שנוספו

`geo_metric_metadata`, `geo_citation_history`, `geo_global_citation_index`, `geo_ai_answer_snapshots`, `geo_ai_answer_change_events`, `geo_citation_diffs`, `geo_visibility_alerts`, `geo_visibility_prompts`.

## 8. שדות שנוספו לטבלאות קיימות

`geo_visibility_citations`: `source_classification`, `source_weight`, `is_primary_source`, `is_featured_source`, `classification_reason` (נוספים אוטומטית ב‑runtime + ALTER ב‑SQL).

## 9. מסכים שנוספו

התראות 🔔 · Citation Timeline 📈 · AI Answer Change Log 📝 · Citation Diffs 🔀 · Global Citation Index 🌐 (כולם עם empty/loading/error states וכפתורי פעולה).

## 10. איך לבדוק

1. הרץ את `SUPABASE_MANUAL_SETUP.sql` (סקשן F החדש) + `git push`.
2. תוכנית → Authority Center → 📡 AI Visibility → "⚡ הרץ בדיקה" **פעמיים** (כדי לייצר diff).
3. טאב **Change Log** → אירועי כניסה/יציאה. טאב **Diffs** → citation gained/lost. טאב **Timeline** → סטטוס ומגמה לכל URL. טאב **התראות** → התראות אוטומטיות + acknowledge/dismiss. טאב **Global Index** → אגרגציה חוצת‑לקוחות. ציטוטים מסווגים primary/featured ב‑DB.

## 11. ENV חדש

אין. (כמו קודם — מפתחות AI אופציונליים לשדרוג מ‑דמו ל‑מדידה אמיתית.)

## 12. Supabase migration?

כן — הרץ את `SUPABASE_MANUAL_SETUP.sql` סקשן F (כולל ה‑ALTER לעמודות הסיווג). נוצר גם אוטומטית ב‑runtime, אך מומלץ ידנית כביטוח.

## 13. מה נשאר לשלב הבא

- Prompt-Level UI מלא (יצירת follow‑ups + Conversation Path Visibility) — הטבלאות והשדות מוכנים.
- חישוב `total_days_visible` ו‑growth_rate מדויק לאורך זמן.
- שילוב source_weight לתוך נוסחת ה‑Visibility Score (כרגע נשמר; שקלול בשלב הבא).
- חיבור Alerts → Action Center / Client Portal / Notifications.
- Global Insights מתקדמים (Most cited schema/entity types, volatility per industry).
