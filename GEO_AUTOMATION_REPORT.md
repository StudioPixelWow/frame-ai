# GEO Automation Backbone — דוח (שלב 1)

תאריך: 2026-06-07 · המטרה: שכל לקוח פעיל ירוץ אוטומטית, מדיד, סקיילבילי — בלי תלות במסך.

---

## 1. למה המערכת לא רצה אוטומטית עד עכשיו (Audit)

הסיבות, מהקוד בפועל:

1. **לולאה סדרתית עם תקציב זמן.** `daily-runner` → `runActivePlans({timeBudgetMs:240000})` ב‑`daily-plan-runner.ts` רץ על התוכניות "stalest‑first" ועוצר אחרי 240 שניות (שורה 69: `if (Date.now()-start > budget) break`). עם מספיק לקוחות — חלקם **מדולגים בכל ריצה** (`skippedForTime`) ולא מובטח שיגיעו לתורם.
2. **חלון 60 יום נוקשה.** `processPlanDailyTasks` דורש `generatedAt` ורץ רק לימים 1–60; אחרי יום 60 התוכנית עוברת ל‑`completed` ו**מפסיקה לרוץ לגמרי**. ללא `generatedAt` — מדולגת.
3. **המנועים החדשים לא ב‑cron כלל.** Authority Score, Advanced Scores, Recommendations רצו **רק בכניסה למסך / קריאת API** — לא אוטומטית.
4. **אין queue אמיתי.** אין retries, אין idempotency, אין locking (שתי הפעלות cron יכלו לחפוף), אין `last_run_at/next_run_at` per‑client, אין סטטוס "למה לא רץ".
5. **גבולות קשיחים.** `daily-progress-scan` עם `MAX_PLANS_PER_RUN=5` + rotation — מטפל ב‑5 לקוחות ביום בלבד.
6. **תלות ב‑Vercel function limit.** עבודה כבדה בבקשת HTTP חיה על גבול 300s.

קבצים/crons שגרמו: `src/lib/seo/daily-plan-runner.ts`, `src/app/api/seo-geo-plans/cron/daily-runner/route.ts`, `src/app/api/seo-geo-plans/cron/daily-progress-scan/route.ts`.

---

## 2. מה תוקן — מנוע אוטומציה אמיתי

נבנתה שכבת תשתית **GeoJobQueueService** (DB‑backed, ניתן להחלפה ל‑Inngest/QStash בעתיד) + worker + tick + enrollment + Control Center.

**איך זה עובד עכשיו:**
- **Tick** (`/api/cron/geo-automation`, כל 30 דק') תופס lock גלובלי → **רושם אוטומטית כל לקוח פעיל** → מכניס לתור jobs שהגיע זמנם → מעבד batch בתוך תקציב זמן → משחרר lock.
- **כל לקוח פעיל** מקבל שורת סטטוס (`geo_client_automation_status`) עם `last_run_at/next_run_at/current_status/failure_count/usage`.
- **Idempotency:** מפתח ייחודי `plan:job:YYYY‑MM‑DD` → אין כפילויות גם אם ה‑tick רץ פעמיים.
- **Retries:** כשל → backoff מעריכי (10/20/40 דק'), עד 3 ניסיונות, ואז `failed` + רישום ב‑`geo_job_failures`.
- **Locking:** `claimJobs` עם compare‑and‑set (UPDATE … WHERE status='queued') → שני workers לא ירוצו על אותו job. ועוד lock גלובלי ל‑tick.
- **לא תלוי ב‑UI, לא נעצר אחרי N לקוחות** (העבודה בתור — מה שלא הספיק נשאר ויעובד ב‑tick הבא).
- **לקוח חדש** נכנס אוטומטית בריצה הבאה (enrollment סורק את כל ה‑plans הפעילים).

**ה‑job ברירת המחדל `geo_refresh` דטרמיניסטי וחינמי** (חישוב Authority Score + Advanced Scores + Recommendations) → רץ לכל לקוח **גם בלי תקציב OpenAI**. jobs יקרים (AI) יישאו עלות ויכבדו תקציב.

---

## 3. Queue / Schedule / Retry שנבנו

`GeoJobQueueService`: `enqueueJob` (idempotent), `scheduleRecurringJob`, `claimJobs` (atomic), `completeJob`, `failJob` (retry+backoff), `markWaitingForBudget`, `cancelJob`, `retryFailedJob`, `getJobStatus`, `getFailedJobs`, `getNextRuns`, `getClientAutomationStatus`, `acquireLock/releaseLock`.
`worker.processJob`: run record + logs + cost control + עדכון סטטוס לקוח.
`enroll.enrollActivePlans`: רישום אוטומטי.

---

## 4. טבלאות שנוצרו

`geo_client_automation_status`, `geo_automation_jobs`, `geo_automation_schedules`, `geo_automation_runs`, `geo_automation_run_logs`, `geo_job_failures`, `geo_job_locks`. (נוצרות אוטומטית; SQL ידני ב‑`SUPABASE_MANUAL_SETUP.sql` סקשן D.)

## 5. API / Services שנוצרו

- `src/lib/seo/automation/{db,queue,worker,enroll}.ts`
- `GET /api/cron/geo-automation` (tick)
- `GET/POST /api/seo-geo-plans/automation` (overview + enroll/set/run_now/retry/tick)

## 6. UI שנוסף

- `src/app/(dashboard)/seo-geo/automation/page.tsx` — **GEO Automation Control Center**: KPIs, טבלת לקוחות (סטטוס/תדירות/ריצה אחרונה/הבאה/כשלים/שימוש/הפעלה/הרץ‑עכשיו), Jobs שנכשלו (retry), ריצות אחרונות. קישור בסרגל הצד: "GEO Automation".

## 7. מודולי Must Have שהושלמו (Priority 1)

✅ Job queue + retries + idempotency · ✅ Scheduled runs לכל לקוח · ✅ סטטוס/last/next per‑client · ✅ logs/runs · ✅ cost control בסיסי (budget→waiting_for_budget) · ✅ Control Center · ✅ הרצת geo_refresh (Authority+Advanced scores+Recommendations) לכולם.

## 8. מה נשאר (Priority 1 המשך → 2/3)

טרם מומש (job types מוכנים לחיבור ל‑queue): Real AI Citation Tracker, Scheduled **AI** Visibility (מול מנועי AI אמיתיים), Citation Diff Alerts, Real SERP/GSC overlay, Measured‑vs‑Estimated badges בכל UI, AIProviderService רב‑ספק, Usage credits מלא, Audit log+RBAC, Observability. כל אלה מתחברים כ‑`job_type` חדש ב‑`worker.HANDLERS` ללא שינוי בתשתית.

---

## 9. ENV

אין חדשים. אופציונלי: `CRON_SECRET` (כבר נתמך) לאבטחת ה‑cron.

## 10. Migrations

הרץ `SUPABASE_MANUAL_SETUP.sql` (כולל סקשן D החדש). נוצר גם אוטומטית ב‑runtime.

---

## איך לבדוק (checklist)

1. **לקוח חדש נכנס אוטומטית:** צור/הפעל plan → פתח **GEO Automation** → לחץ "רישום לקוחות" → הוא מופיע עם `next_run_at`.
2. **ריצה:** לחץ "הרץ עכשיו (Tick)" → רואים processed/completed; הלקוח מקבל `last_run_at` ו‑status=active.
3. **Jobs שנכשלו:** מופיעים בכרטיס "Jobs שנכשלו" עם שגיאה + כפתור retry.
4. **למה לקוח לא רץ:** הטור "סטטוס" + "ריצה הבאה" + "כשלים" מסביר (paused/waiting_for_budget/failed).
5. **Usage/credits:** טור "שימוש (₪)" מציג usage/budget; קבע budget דרך set (monthly_budget_cents).
6. **הפעל/כבה:** checkbox "מופעל" בכל שורה.
7. **אין כפילויות:** הרץ tick פעמיים — idempotency_key מונע job כפול לאותו יום.
8. **אין תלות ב‑UI:** ה‑cron ב‑vercel.json (`*/30 * * * *`) מריץ הכל גם בלי שאף אחד פתח מסך.

## מה נשאר לשלב הבא

חיבור ה‑job types היקרים (Citation Tracker / AI Visibility / Alerts) כ‑handlers נוספים, ואז Priority 2/3 לפי הסקירה — הכל על גבי התשתית הזו.
