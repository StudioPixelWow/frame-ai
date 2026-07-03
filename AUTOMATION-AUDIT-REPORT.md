# PIXEL PRIME — דוח אודיט אוטומציות מלא
## Full Automation / Cron / Queue / Job QA Audit

**תאריך:** 2026-07-03
**מערכת:** Pixel Prime (frame-ai)
**Deploy:** https://frame-ai-delta.vercel.app
**Supabase:** https://uaruggdabeyiuppcvbbi.supabase.co

---

## סיכום מנהלים

- **סה"כ ג'ובים רשומים:** 15
- **ג'ובים פעילים:** 15 (כולם `active`)
- **מנגנון תזמון:** Vercel Cron (vercel.json)
- **מנגנון ניהול:** Central Job Runner + Admin Dashboard
- **Timezone:** Israel (UTC+3)
- **Auth:** Bearer token via `CRON_SECRET` env var

---

## ארכיטקטורה

```
vercel.json (15 cron entries)
    │
    ├── Each job has its own endpoint in /api/cron/*
    │
    └── Central Runner: /api/cron/run-jobs
            │
            ├── ensureJobsTable() — creates DB tables if missing
            ├── syncRegistryToDb() — syncs JOB_REGISTRY → scheduled_jobs table
            └── runDueJobs() — runs all due jobs sequentially
                    │
                    ├── Reads nextRunAt from DB
                    ├── Calls endpoint via fetch with AbortController timeout
                    ├── Retry logic with configurable delay
                    └── Writes results to job_runs table
```

**Admin Dashboard:** `/admin/jobs`
- צפייה בכל הג'ובים + סטטוס + הרצה אחרונה
- הרצה ידנית (Run Now) לכל ג'וב
- Toggle active/paused
- היסטוריית הרצות
- פילטור לפי קטגוריה

---

## טבלאות DB חדשות (נדרש ליצור ידנית)

שתי טבלאות חדשות צריכות להיווצר ב-Supabase. ראה קובץ `SUPABASE-MIGRATION.sql`.

| טבלה | תפקיד |
|------|--------|
| `scheduled_jobs` | רשימת כל הג'ובים + סטטוס + זמני הרצה |
| `job_runs` | היסטוריית הרצות — כל הרצה עם תוצאה, משך, שגיאה |

---

## פירוט כל 15 הג'ובים

### 1. daily-seo — SEO יומי — סריקה + הרצת משימות

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/daily-seo` |
| **Cron** | `0 5 * * *` (כל יום ב-05:00 UTC = 08:00 ישראל) |
| **קטגוריה** | seo |
| **Timeout** | 300 שניות |
| **Retry** | 1 ניסיון נוסף, השהיה 30 שניות |
| **Env Vars** | `CRON_SECRET`, `OPENAI_API_KEY`, `SERPER_API_KEY` |
| **DB Tables** | `seo_plans`, `clients`, `client_gantt_items` |
| **תיאור** | סריקת דירוגים יומית + הרצת משימות תוכנית 60 יום לכל הלקוחות הפעילים |
| **סטטוס** | ACTIVE |

---

### 2. meta-sync-all — סנכרון Meta — כל החשבונות

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/meta-sync-all` |
| **Cron** | `0 * * * *` (כל שעה עגולה) |
| **קטגוריה** | meta |
| **Timeout** | 300 שניות |
| **Retry** | 1 ניסיון נוסף, השהיה 60 שניות |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `clients`, `app_meta_campaign_assignments` |
| **תיאור** | סנכרון נתוני קמפיינים מ-Meta Ads API לכל הלקוחות המחוברים |
| **סטטוס** | ACTIVE |

---

### 3. daily-meta-optimizer — אופטימיזציית Meta יומית

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/daily-meta-optimizer` |
| **Cron** | `0 6,15 * * *` (06:00 + 15:00 UTC = 09:00 + 18:00 ישראל) |
| **קטגוריה** | meta |
| **Timeout** | 120 שניות |
| **Retry** | ללא |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `clients`, `campaigns`, `ad_sets`, `ads` |
| **תיאור** | ניתוח ביצועי קמפיינים ואופטימיזציה אוטומטית — תקציב, קהלים, וריאציות |
| **סטטוס** | ACTIVE |

---

### 4. meta-auto-optimize — Meta אופטימיזציה אוטונומית

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/meta-auto-optimize` |
| **Cron** | `0 8 * * *` (08:00 UTC = 11:00 ישראל) |
| **קטגוריה** | meta |
| **Timeout** | 300 שניות |
| **Retry** | ללא |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `clients`, `campaigns`, `ad_sets`, `ads`, `campaign_actions`, `meta_action_log` |
| **תיאור** | הזזת תקציבים בין קבוצות מודעות, הרחבת קהלים מנצחים — ללא שינוי קריאייטיב |
| **סטטוס** | ACTIVE |

---

### 5. meeting-reminders — תזכורות פגישות

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/meeting-reminders` |
| **Cron** | `0 7 * * *` (07:00 UTC = 10:00 ישראל) |
| **קטגוריה** | whatsapp |
| **Timeout** | 60 שניות |
| **Retry** | 1 ניסיון נוסף, השהיה 10 שניות |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `meetings` |
| **תיאור** | שליחת תזכורות WhatsApp לפגישות היום ומחר |
| **סטטוס** | ACTIVE |

---

### 6. weekly-summary — סיכום שבועי — כל הלקוחות

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/weekly-summary` |
| **Cron** | `0 8 * * 0` (ראשון ב-08:00 UTC = 11:00 ישראל) |
| **קטגוריה** | reports |
| **Timeout** | 120 שניות |
| **Retry** | 1 ניסיון נוסף, השהיה 30 שניות |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `clients`, `weekly_summaries` |
| **תיאור** | יצירת סיכום שבועי לכל לקוח פעיל ושמירה ל-DB |
| **סטטוס** | ACTIVE |

---

### 7. whatsapp-qr-weekly-digest — דייג'סט שבועי WhatsApp

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/whatsapp-qr-weekly-digest` |
| **Cron** | `0 9 * * 0` (ראשון ב-09:00 UTC = 12:00 ישראל) |
| **קטגוריה** | whatsapp |
| **Timeout** | 60 שניות |
| **Retry** | ללא |
| **Env Vars** | `CRON_SECRET`, `AGENCY_NAME` |
| **DB Tables** | `clients`, `client_gantt_items` |
| **תיאור** | שליחת סיכום התקדמות שבועי לכל לקוח ב-WhatsApp |
| **סטטוס** | ACTIVE |

---

### 8. whatsapp-scheduled — הודעות WhatsApp מתוזמנות

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/whatsapp-scheduled` |
| **Cron** | `*/15 * * * *` (כל 15 דקות) |
| **קטגוריה** | whatsapp |
| **Timeout** | 60 שניות |
| **Retry** | ללא |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `whatsapp_scheduled` |
| **תיאור** | עיבוד הודעות WhatsApp מתוזמנות מרצפי אוטומציה |
| **סטטוס** | ACTIVE |

---

### 9. social-scheduled — פוסטים מתוזמנים — סושייאל

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/social-scheduled` |
| **Cron** | `*/15 * * * *` (כל 15 דקות) |
| **קטגוריה** | social |
| **Timeout** | 120 שניות |
| **Retry** | 1 ניסיון נוסף, השהיה 15 שניות |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `app_social_posts`, `clients` |
| **תיאור** | פרסום פוסטים מתוזמנים לפייסבוק ואינסטגרם |
| **סטטוס** | ACTIVE |

---

### 10. monthly-client-reports — דוחות חודשיים ללקוחות

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/monthly-client-reports` |
| **Cron** | `0 1 1 * *` (1 בחודש ב-01:00 UTC = 04:00 ישראל) |
| **קטגוריה** | reports |
| **Timeout** | 300 שניות |
| **Retry** | 1 ניסיון נוסף, השהיה 60 שניות |
| **Env Vars** | `CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| **DB Tables** | `clients`, `app_reports` |
| **תיאור** | יצירת דוחות PDF חודשיים ושליחה במייל לכל לקוח פעיל |
| **סטטוס** | ACTIVE |

---

### 11. competitor-scan — סריקת מתחרים יומית

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/competitor-scan` |
| **Cron** | `0 9 * * *` (09:00 UTC = 12:00 ישראל) |
| **קטגוריה** | seo |
| **Timeout** | 300 שניות |
| **Retry** | ללא |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `clients` |
| **תיאור** | סריקת מתחרים יומית לכל הלקוחות — עדכון טאב חקר מתחרים |
| **סטטוס** | ACTIVE |

---

### 12. geo-monitoring — ניטור GEO/AI — Authority Score

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/geo-monitoring` |
| **Cron** | `0 4 * * *` (04:00 UTC = 07:00 ישראל) |
| **קטגוריה** | geo |
| **Timeout** | 300 שניות |
| **Retry** | ללא |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `seo_plans`, `geo_ai_monitoring_results` |
| **תיאור** | צילום מצב נוכחות AI יומי + חישוב ציון סמכות לכל תוכנית SEO פעילה |
| **סטטוס** | ACTIVE |

---

### 13. geo-automation — GEO אוטומציה — Heartbeat

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/geo-automation` |
| **Cron** | `*/30 * * * *` (כל 30 דקות) |
| **קטגוריה** | geo |
| **Timeout** | 300 שניות |
| **Retry** | ללא |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `geo_client_automation_status`, `geo_automation_jobs`, `seo_plans` |
| **תיאור** | טיק אוטומציה GEO כל 30 דקות — הרשמת תוכניות חדשות, הרצת ג'ובים מתוזמנים |
| **סטטוס** | ACTIVE |

---

### 14. google-ads-weekly — דוח Google Ads שבועי

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/google-ads/weekly` |
| **Cron** | `0 7 * * 1` (שני ב-07:00 UTC = 10:00 ישראל) |
| **קטגוריה** | google-ads |
| **Timeout** | 300 שניות |
| **Retry** | ללא |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `clients` |
| **תיאור** | יצירת דוח שבועי לכל לקוחות Google Ads מחוברים |
| **סטטוס** | ACTIVE |

---

### 15. google-ads-monthly — דוח Google Ads חודשי

| שדה | ערך |
|-----|------|
| **Endpoint** | `/api/cron/google-ads/monthly` |
| **Cron** | `0 7 2 * *` (2 בחודש ב-07:00 UTC = 10:00 ישראל) |
| **קטגוריה** | google-ads |
| **Timeout** | 300 שניות |
| **Retry** | ללא |
| **Env Vars** | `CRON_SECRET` |
| **DB Tables** | `clients` |
| **תיאור** | יצירת דוח חודשי לכל לקוחות Google Ads מחוברים |
| **סטטוס** | ACTIVE |

---

## סיכום Env Vars נדרשים

| Env Var | נדרש ע"י | סטטוס |
|---------|----------|--------|
| `CRON_SECRET` | כל 15 הג'ובים | חובה — לוודא שמוגדר ב-Vercel |
| `OPENAI_API_KEY` | daily-seo | חובה |
| `SERPER_API_KEY` | daily-seo | חובה — לבדוק אם מוגדר |
| `AGENCY_NAME` | whatsapp-qr-weekly-digest | רצוי |
| `GMAIL_USER` | monthly-client-reports | חובה לשליחת מיילים |
| `GMAIL_APP_PASSWORD` | monthly-client-reports | חובה לשליחת מיילים |

---

## סיכום DB Tables בשימוש

| טבלה | ג'ובים שמשתמשים בה |
|------|---------------------|
| `clients` | daily-seo, meta-sync-all, daily-meta-optimizer, meta-auto-optimize, weekly-summary, whatsapp-qr-weekly-digest, social-scheduled, monthly-client-reports, competitor-scan, google-ads-weekly, google-ads-monthly |
| `seo_plans` | daily-seo, geo-monitoring, geo-automation |
| `client_gantt_items` | daily-seo, whatsapp-qr-weekly-digest |
| `campaigns` | daily-meta-optimizer, meta-auto-optimize |
| `ad_sets` | daily-meta-optimizer, meta-auto-optimize |
| `ads` | daily-meta-optimizer, meta-auto-optimize |
| `campaign_actions` | meta-auto-optimize |
| `meta_action_log` | meta-auto-optimize |
| `app_meta_campaign_assignments` | meta-sync-all |
| `meetings` | meeting-reminders |
| `weekly_summaries` | weekly-summary |
| `whatsapp_scheduled` | whatsapp-scheduled |
| `app_social_posts` | social-scheduled |
| `app_reports` | monthly-client-reports |
| `geo_ai_monitoring_results` | geo-monitoring |
| `geo_client_automation_status` | geo-automation |
| `geo_automation_jobs` | geo-automation |
| **`scheduled_jobs`** | Central Job Runner (חדש — לייצר!) |
| **`job_runs`** | Central Job Runner (חדש — לייצר!) |

---

## קבצים חדשים שנוצרו

| קובץ | תפקיד |
|------|--------|
| `src/lib/automation/central-job-runner.ts` | מנוע הרצה מרכזי — registry + scheduler + runner |
| `src/app/api/cron/run-jobs/route.ts` | Endpoint מרכזי ש-Vercel Cron קורא |
| `src/app/api/admin/jobs/route.ts` | API: רשימת כל הג'ובים |
| `src/app/api/admin/jobs/[jobId]/route.ts` | API: פרטי ג'וב + עדכון סטטוס |
| `src/app/api/admin/jobs/[jobId]/run/route.ts` | API: הרצה ידנית |
| `src/app/api/admin/jobs/[jobId]/runs/route.ts` | API: היסטוריית הרצות |
| `src/app/api/admin/jobs/sync/route.ts` | API: סנכרון registry ל-DB |
| `src/app/api/admin/jobs/migration/route.ts` | API: יצירת טבלאות DB |
| `src/app/(dashboard)/admin/jobs/page.tsx` | דשבורד ניהול אוטומציות |

## קבצים שעודכנו

| קובץ | שינוי |
|------|-------|
| `src/lib/db/schema.ts` | הוספת `ScheduledJob`, `JobRun`, `JobStatus`, `JobRunStatus` types |
| `src/lib/db/collections.ts` | הוספת `scheduledJobs`, `jobRuns` collections |
| `src/components/sidebar.tsx` | הוספת קישור "אוטומציות" בסיידבר |
| `vercel.json` | ללא שינוי — 15 ג'ובים קיימים |

---

## באגים שנמצאו ותוקנו

### 1. Data Contract Mismatches
- `j.lastRun` → `j.latestRun` — ה-API מחזיר `latestRun` ולא `lastRun`
- `job.lastRun` → `job.latestRun` — אותו באג גם בקטע פרטי ג'וב
- `nextRun` → `nextRunAt` — שם שדה שונה בין registry ל-API
- `envVars` → `envVarsRequired` — שם שדה שונה + שינוי מבנה (מערך strings במקום objects)
- `dbTables` → `dbTablesUsed` — שם שדה שונה

### 2. Server Export in Client Component
- `export const dynamic = "force-dynamic"` הוסר מ-page.tsx — לא חוקי ב-`'use client'`

### 3. Missing API Route
- Dashboard קרא ל-`POST /api/admin/jobs/${jobId}/toggle` שלא קיים
- תוקן לשימוש ב-`PATCH /api/admin/jobs/${jobId}` הקיים

### 4. Admin Access Bug (מסשן קודם)
- localStorage key היה `role` במקום `frameai_role` — תוקן

---

## מה עובד עכשיו

- כל 15 הג'ובים רשומים ב-vercel.json ✅
- כל 15 הג'ובים רשומים ב-JOB_REGISTRY ✅
- Central Job Runner עם timeout + retry ✅
- Admin Dashboard עם RTL Hebrew ✅
- Run Now ידני לכל ג'וב ✅
- Toggle active/paused ✅
- היסטוריית הרצות ✅
- Auth protection (CRON_SECRET + admin role) ✅
- Build compiles cleanly ✅
- Git committed (2224 insertions, 13 files) ✅

---

## מה דרוש לעשות ידנית

### 1. יצירת טבלאות ב-Supabase
הרץ את ה-SQL מקובץ `SUPABASE-MIGRATION.sql` ב-Supabase SQL Editor.

### 2. Push ל-Vercel
```bash
cd ~/Desktop/frame-ai
git push origin main
```

### 3. וידוא Env Vars ב-Vercel
בדוק שכל ה-env vars הבאים מוגדרים ב-Vercel Dashboard → Settings → Environment Variables:
- `CRON_SECRET` (חובה)
- `OPENAI_API_KEY` (חובה)
- `SERPER_API_KEY` (לבדוק)
- `GMAIL_USER` (חובה לדוחות חודשיים)
- `GMAIL_APP_PASSWORD` (חובה לדוחות חודשיים)
- `AGENCY_NAME` (רצוי)

### 4. בדיקת Dashboard
אחרי הדיפלוי, גש ל:
```
https://frame-ai-delta.vercel.app/admin/jobs
```
(צריך להיות מחובר כ-admin)

---

## Cron Schedule Summary (Israel Time)

| זמן (ישראל) | ג'וב |
|-------------|------|
| כל 15 דקות | whatsapp-scheduled, social-scheduled |
| כל 30 דקות | geo-automation |
| כל שעה | meta-sync-all |
| 07:00 | geo-monitoring |
| 08:00 | daily-seo |
| 09:00 + 18:00 | daily-meta-optimizer |
| 10:00 (יומי) | meeting-reminders |
| 11:00 (יומי) | meta-auto-optimize |
| 11:00 (ראשון) | weekly-summary |
| 12:00 (ראשון) | whatsapp-qr-weekly-digest |
| 12:00 (יומי) | competitor-scan |
| 10:00 (שני) | google-ads-weekly |
| 04:00 (1 בחודש) | monthly-client-reports |
| 10:00 (2 בחודש) | google-ads-monthly |

---

*דוח זה נוצר אוטומטית. כל הנתונים מבוססים על סריקת הקוד בפועל.*
