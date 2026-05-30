# חיבור Meta Business Manager — מדריך הגדרה מלא

מסמך זה מסביר למה החיבור נכשל ("תכונה לא זמינה"), ואיך לחבר את Meta Business Manager
כך שהמערכת תוכל לסרוק ולנהל קמפיינים (חדשים וקיימים) עבור כל לקוח.

---

## חלק 1 — למה זה נכשל עכשיו

מה-URL בשגיאה ראינו שני דברים:

```
redirect_uri = http://localhost:3000/api/auth/meta/callback   ← בעיה 1
"תכונה לא זמינה"  (Feature not available)                      ← בעיה 2
```

**בעיה 1 — redirect_uri של localhost בפרודקשן.**
הקוד נפל ל-`http://localhost:3000` כי משתנה הסביבה `NEXT_PUBLIC_APP_URL` לא הוגדר ב-Vercel.
תוקן בקוד: ה-redirect עכשיו נגזר אוטומטית מהדומיין האמיתי של הבקשה. אבל עדיין צריך
להוסיף את כתובת ה-callback של הפרודקשן לרשימת ההיתר ב-Facebook (ראה חלק 3).

**בעיה 2 — "תכונה לא זמינה".**
זו שגיאה ברמת אפליקציית ה-Facebook עצמה, לא בקוד. כמעט תמיד אחת מאלה:

- האפליקציה במצב **Development** והמשתמש שמתחבר אינו Admin/Developer/Tester שלה.
- המוצר **Facebook Login** לא הוגדר/חסר באפליקציה.
- ההרשאות `ads_management` / `business_management` דורשות **App Review + אימות עסקי**
  כדי לעבוד עבור משתמשים שאינם בעלי תפקיד באפליקציה (במצב Live).

---

## חלק 2 — הדרך המהירה והמומלצת: System User Token (בלי OAuth בכלל)

לסוכנות שמנהלת נכסים של עצמה/לקוחות, **לא צריך את דיאלוג ה-OAuth של פייסבוק**.
הדרך הנכונה היא **System User Token** מתוך ה-Business Manager של הסוכנות. הוא עוקף
לחלוטין את שגיאת "תכונה לא זמינה" ואת ה-App Review עבור הנכסים שלך.

המערכת כבר תומכת בזה: בדף `הגדרות → Meta Business` יש שדה **"הדבק אסימון גישה"**.

### שלבים:

1. היכנס ל-**business.facebook.com** → **Business Settings** (הגדרות עסק).
2. **Users → System Users** → צור System User (סוג: Admin).
3. לחץ **Generate New Token**:
   - בחר את האפליקציה (אותה אפליקציה עם `META_APP_ID`).
   - הרשאות (scopes): `ads_management`, `ads_read`, `business_management`, `read_insights`,
     ואם תרצה ניהול עמודים: `pages_show_list`, `pages_read_engagement`.
   - מומלץ לסמן **Token never expires** (או הארך ל-60 יום).
4. **Assign Assets** ל-System User: שייך לו את כל חשבונות המודעות (Ad Accounts)
   שאתה רוצה לנהל, עם הרשאת **Manage** (ניהול מלא, לא רק צפייה).
5. העתק את הטוקן והדבק אותו בדף `הגדרות → Meta Business → הדבק אסימון גישה` → שמור.

זהו. אחרי זה דף ה-Meta Business יציג את כל חשבונות המודעות, ותוכל לשייך כל חשבון ללקוח.

---

## חלק 3 — אם בכל זאת רוצים את זרימת ה-OAuth (התחברות עצמית של לקוחות)

נדרש רק אם כל לקוח מתחבר עם הפייסבוק **שלו** כדי לתת לך הרשאה. הגדרות באפליקציה
ב-**developers.facebook.com → האפליקציה שלך**:

### א. מוצרים (Products)
- הוסף **Facebook Login** (או Facebook Login for Business).
- הוסף **Marketing API**.

### ב. Facebook Login → Settings → Valid OAuth Redirect URIs
הוסף את כתובת ה-callback של הפרודקשן (בדיוק, כולל https):
```
https://<הדומיין-שלך>/api/auth/meta/callback
```
וגם, אם בודקים מקומית: `http://localhost:3000/api/auth/meta/callback`.

### ג. App Domains (בהגדרות הבסיסיות)
הוסף את הדומיין: `<הדומיין-שלך>` (ללא https).

### ד. הרשאות ו-App Review
`ads_management`, `ads_read`, `business_management` הן הרשאות מתקדמות:
- במצב **Development**: עובדות עבור Admin/Developer/Tester של האפליקציה ללא Review.
  כדי לבדוק — הוסף את חשבון הפייסבוק שלך כ-**Tester** ב-App Roles → Roles.
- במצב **Live**: דורשות **App Review** + **Business Verification** (אימות עסקי של
  ה-Business Manager) כדי לעבוד עבור משתמשים חיצוניים.

### ה. להעביר את האפליקציה ל-Live
אחרי שהכל מוגדר ועבר Review — החלף את מתג ה-App Mode מ-Development ל-Live.

---

## חלק 4 — ניהול קמפיינים של מספר לקוחות (ארכיטקטורה)

הזרימה שהמערכת בנויה אליה:

1. **חיבור BM אחד** של הסוכנות (System User token) — חלק 2.
2. **גישה לחשבונות הלקוחות**: כל לקוח מוסיף את ה-Business שלך כ-**Partner** ומשתף את
   חשבון המודעות שלו (Business Settings → Partners → Add Partner → הזן את ה-Business ID
   שלך → תן הרשאת Manage על ה-Ad Account). לחלופין אתה שולח בקשת גישה לחשבון.
   ברגע שחשבון המודעות משויך ל-System User שלך — הטוקן יכול לנהל אותו.
3. **שיוך ללקוח במערכת**: בדף Meta Business, שייך כל Ad Account ללקוח המתאים.
4. **סריקה ואופטימיזציה**: המערכת סורקת את הקמפיינים הקיימים (sync-service),
   מציגה דוחות יומיים, ומריצה אופטימיזציה אוטומטית (cron `daily-meta-optimizer`).
   ניתן גם ליצור קמפיינים/adsets חדשים (write-service).

> חשוב: כדי לסרוק ולנהל קמפיינים **קיימים** של לקוח, חשבון המודעות שלו חייב להיות
> משויך ל-System User שלך עם הרשאת **Manage**. בלי זה הטוקן רואה רק את חשבונות הסוכנות.

---

## חלק 5 — משתני סביבה נדרשים ב-Vercel

Settings → Environment Variables (ואז Redeploy):

| משתנה | לְמה | חובה |
|---|---|---|
| `META_APP_ID` | מזהה האפליקציה ב-Meta for Developers | כן (ל-OAuth) |
| `META_APP_SECRET` | סוד האפליקציה — נדרש להחלפת ה-code בטוקן ב-callback | כן (ל-OAuth) |
| `NEXT_PUBLIC_APP_URL` | כתובת הפרודקשן, למשל `https://app.s-pixel.co.il` | מומלץ |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | כן |
| `SUPABASE_SERVICE_ROLE_KEY` | שמירת טוקנים/לקוחות בצד שרת | כן |
| `META_ACCESS_TOKEN` | נפרד — Ads Library בלבד (לא קשור לניהול קמפיינים) | אופציונלי |

> אחרי השיטה של System User Token (חלק 2) — לא חייבים `META_APP_ID`/`META_APP_SECRET`
> כדי **לחבר ולנהל**, רק כדי להשתמש בזרימת ה-OAuth.

---

## TL;DR — מה לעשות עכשיו

1. דחוף את תיקון הקוד (`git push origin main`) — מתקן את ה-redirect של localhost.
2. צור **System User Token** ב-Business Manager (חלק 2) עם ההרשאות והנכסים הנכונים.
3. הדבק אותו בדף `הגדרות → Meta Business` → שמור.
4. בקש מכל לקוח לשתף את חשבון המודעות שלו עם ה-Business שלך (Partner / Manage).
5. שייך כל חשבון ללקוח במערכת — וזהו, סריקה ואופטימיזציה יעבדו.

זה עוקף לגמרי את שגיאת "תכונה לא זמינה".
