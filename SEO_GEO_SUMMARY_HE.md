# סיכום מלא — שדרוג מערכת SEO / GEO

תאריך: 2026-06-07 · Studio Pixel / PixelManageAI

---

## בקצרה: מה עשינו היום

לקחנו מערכת SEO/GEO שהיתה בעיקר **מחוללת המלצות והערכות שרצות כשנכנסים למסך**, והפכנו אותה ל**פלטפורמת GEO אמיתית, מודדת, היסטורית ואוטומטית** שרצה לכל לקוח ברקע — עם ניטור נראות במנועי AI, ציונים, התראות, דוחות אוטומטיים ופורטל לקוח.

נבנו **4 שכבות חדשות גדולות**:
1. **SEO GEO Authority Center** — 15 מודולי סמכות מאוחדים + ציון 0–100.
2. **Advanced GEO Growth Center** — 25 מודולים מתקדמים + 19 ציונים.
3. **GEO Automation Backbone** — מנוע הרצה אוטומטי לכל לקוח (queue/retries/בקרת עלות).
4. **GEO AI Visibility Center** — ניטור אמיתי של נראות במנועי AI + Data Moat.

---

## לפני / אחרי

| נושא | לפני | אחרי |
|------|------|------|
| הרצה | ידנית / כשנכנסים למסך / cron חלקי שדילג על לקוחות | **אוטומטי לכל לקוח** דרך queue עם retries, locking, ובקרת עלות |
| מדידה | בעיקר הערכות (estimates) | **מדידה אמיתית** מול מנועי AI + סימון ברור Measured/Estimated |
| היסטוריה | כמעט אין | **היסטוריה חודשית מלאה** — ציטוטים, שינויים, מגמות לאורך זמן |
| ציון | ציון נראות בסיסי | **Authority Score (8 ממדים)** + **AI Visibility Score** + 19 ציונים מתקדמים |
| מתחרים | זיהוי בסיסי | **מעקב נראות מתחרים** + Share of AI Voice + מי עוקף את מי |
| התראות | אין | **התראות אוטומטיות** (נכנסת/יצאת מתשובת AI, ציטוט אבד, מתחרה עקף) |
| המלצות → ביצוע | רשימה סטטית | **המלצה → משימה**, וכל ממצא חמור הופך אוטומטית למשימה ב-Action Center |
| שינויים באתר | חלקי | **טיוטה→אישור→החלה** (שום פרסום אוטומטי) + Apply אמיתי לוורדפרס |
| לקוח | לא ראה כמעט כלום | **כרטיס נראות AI בפורטל** + דוחות PDF/CSV + שליחה חודשית במייל/וואטסאפ |
| Data Moat | אין | **Global Citation Index** אנונימי חוצה‑לקוחות — נכס נתונים ייחודי |

---

## מה הצטרף — לפי מודול

**1. SEO GEO Authority Center** (כפתור 🏆 בתוך תוכנית)
ציון סמכות 0–100 מ‑8 ממדים, 15 מודולים (FAQ, Internal Linking, Citations, Schema, Entities, Topical, Brand Mention ועוד), המלצות → משימות, וטיוטות עם שער אישור. נבנו גם מנועים שלא היו: Citation Builder, Brand Mention, Schema Automation.

**2. Advanced GEO Growth Center** (כפתור 🚀)
25 מודולים מתקדמים + 19 ציונים: Answer Simulation, Citation Opportunity, Reputation Monitor, Opportunity Engine, Roadmap 30/60/90/180, Content Brief, Content Validator, Forecast, Conversation Paths ועוד.

**3. GEO Automation Backbone** (בסרגל הצד: "GEO Automation")
מנוע queue שרץ ברקע, רושם אוטומטית כל לקוח פעיל, מריץ לפי תדירות, עם retries, idempotency (בלי כפילויות), בקרת תקציב, ומסך Control Center: מי רץ, מתי לאחרונה, מתי הבא, מה נכשל, כמה עלה.

**4. GEO AI Visibility Center** (כפתור 📡)
ניטור מבוקר: סטים של שאילתות + prompts → ריצה מול ChatGPT/Claude/Gemini/Perplexity/Google AI → אזכורים, ציטוטים (מסווגים primary/featured/supporting), מתחרים, Share of AI Voice, ציון נראות, אומדן חשיפה. בנוסף: Citation Timeline, Change Log, Diffs, התראות, Global Index, פורטל לקוח, ודוחות.

---

## האם הכל רץ אוטומטית?

**כן — אחרי 3 פעולות חד‑פעמיות שלך.** עד שתעשה אותן, חלקים ירוצו במצב מוגבל/דמו.

### מה אתה חייב לעשות (פעם אחת)
1. **Deploy:** `git push origin main` — בלי זה השינויים לא עולים ל‑Vercel.
2. **טבלאות Supabase:** הרץ את `SUPABASE_SETUP.txt` (כל ה‑SQL) ב‑Supabase → SQL Editor → Run. (נוצרות גם אוטומטית, אבל ההרצה הידנית מבטיחה שלא תהיה תקלת "טבלה חסרה").
3. **Storage bucket:** ודא שקיים bucket בשם `project-files` עם Public=ON (ל‑תצוגת קבצים בפורטל).

### מה ירוץ אוטומטית אחרי זה (בלי מגע יד)
- **כל 30 דקות** ה‑tick (`/api/cron/geo-automation`) רושם כל לקוח פעיל ומריץ עבורו `geo_refresh` — חישוב Authority + 19 ציונים + רענון המלצות. **זה חינמי לחלוטין** (לא משתמש ב‑AI) ולכן רץ לכולם תמיד.
- **כל לילה (04:00)** ניטור GEO צובר היסטוריה.
- לקוח חדש שתיצור — **נכנס אוטומטית** לריצה בלי הגדרה.

### מה דורש הפעלה ידנית קטנה / מפתחות
- **ריצת AI Visibility אמיתית** (אזכורים/ציטוטים מ‑ChatGPT וכו') — דורשת **מפתחות API** למנועים. בלי מפתחות זה רץ ב**מצב דמו** (מסומן ב‑UI). מפתחות נדרשים לפי הצורך: `OPENAI_API_KEY` (קיים), `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `SERP_API_KEY`.
- **הפעלת ניטור שבועי + דוח חודשי ללקוח** — לחיצה אחת על "🔁 אוטומציה" בתוך מסך ה‑AI Visibility של הלקוח (מוסיף ai_visibility + visibility_report למודולים שלו). מאז זה אוטומטי.
- **שליחת דוח במייל/וואטסאפ** — דורש שהמייל (Gmail) וה‑WhatsApp יהיו מחוברים בהגדרות; אחרת מקבלים הודעה ברורה והדוח עדיין זמין לצפייה/הורדה.
- **החלת טיוטות באתר (Schema/FAQ/קישורים)** — דורשת חיבור WordPress לתוכנית; וגם אז זה רק אחרי אישור ידני שלך.

### מה לעולם לא אוטומטי (בכוונה)
שום שינוי באתר הלקוח לא מתפרסם לבד. כל שדרוג תוכן/Schema/קישור נוצר כ**טיוטה/המלצה** ומחכה לאישור שלך.

---

## איפה לבדוק שהכל עובד

- **GEO Automation** (סרגל צד): רואים את כל הלקוחות, סטטוס, ריצה אחרונה/הבאה, כשלים, עלות. כפתור "▶ הרץ עכשיו (Tick)" לבדיקה מיידית.
- **בתוך תוכנית לקוח:** 🏆 Authority Center → 🚀 Advanced Growth → 📡 AI Visibility. ב‑AI Visibility: "⚡ הרץ בדיקה" (פעמיים כדי לראות diffs/התראות), ואז הטאבים מתמלאים.
- **פורטל הלקוח:** כרטיס "📡 הנראות שלך במנועי AI" מופיע כשיש נתונים.

---

## ENV (סיכום)

קיים בשימוש: `OPENAI_API_KEY`, קרדנציאלי Supabase, (אופציונלי `CRON_SECRET`).
אופציונליים לשדרוג מ‑דמו ל‑מדידה אמיתית: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `PERPLEXITY_API_KEY`, `SERP_API_KEY`, `GEO_VISIBILITY_MAX_RUN_QUERIES`.
**אין ENV חובה חדש.**

---

## מסמכים שנוצרו (לעיון)

`GEO_AUTHORITY_AUDIT.md`, `GEO_ADVANCED_AUDIT.md`, `GEO_AUTOMATION_REPORT.md`, `GEO_AI_VISIBILITY_REPORT.md`, `GEO_VISIBILITY_HISTORY_REPORT.md`, `STRATEGIC_REVIEW_2026.md`, `SUPABASE_SETUP.txt` (כל ה‑SQL).

---

## הצעד הבא המומלץ (ROI גבוה)

לחבר מפתחות API למנועי AI → הופך את כל הניטור מ‑דמו ל**מדידה אמיתית**, וזה מה שמפעיל את ה‑Data Moat (Global Citation Index) — היתרון התחרותי הגדול ביותר.
