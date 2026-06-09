# מדריך חיבור Google Ads API — סטודיו פיקסל

מדריך מאפיין מלא להבאת כל המפתחות שצריך כדי שמודול "דוחות Google Ads" יעבוד עם נתוני אמת.
עד שתסיים — המערכת ממילא מפיקה דוח דמו מעוצב לכל לקוח, אז שום דבר לא "שבור" בינתיים.

> צריך להשיג 4 דברים: **Developer Token**, **Client ID**, **Client Secret**, ו-**Refresh Token** (לכל לקוח). בנוסף ה-**Customer ID** של חשבון הלקוח.

---

## שלב 0 — דרישת מקדם: חשבון מנהל (MCC)
ל-Developer Token חייבים **חשבון מנהל (Manager / MCC)** ב-Google Ads, לא חשבון פרסום רגיל.
- אם אין לך: צור חשבון מנהל בכתובת https://ads.google.com/home/tools/manager-accounts
- קשר אליו את חשבונות הלקוחות (Sub-accounts) — כך תוכל למשוך נתונים לכל הלקוחות ממקום אחד.

---

## שלב 1 — Developer Token (מפתח מפתחים)
1. היכנס לחשבון ה-**מנהל (MCC)** ופתח את ה-API Center:
   **https://ads.google.com/aw/apicenter**
2. מלא את טופס הגישה (אימייל ליצירת קשר, שם החברה, סוג שימוש, מדינה) ואשר את התנאים.
3. תקבל **Developer Token** מיידית — אבל ברמת **Test Account** בלבד (עובד רק על חשבונות בדיקה).
4. כדי למשוך נתוני אמת: לחץ על החץ ליד רמת הגישה → **Apply for Basic Access**, ומלא את הבקשה.

> ⚠️ עדכון 2026: לגוגל יש כרגע עומס ובדיקות מחמירות על בקשות Basic Access (כולל אימות מפרסם לאחד מהחשבונות תחת ה-MCC). האישור עשוי לקחת כמה ימים. עד אז אפשר לבדוק מול חשבון בדיקה.

➡️ זה ה-`GOOGLE_ADS_DEVELOPER_TOKEN`.

---

## שלב 2 — Client ID + Client Secret (OAuth ב-Google Cloud)
1. היכנס ל-**Google Cloud Console**: https://console.cloud.google.com
2. צור פרויקט חדש (או בחר קיים) — למעלה, "New Project".
3. בתפריט → **APIs & Services → Library** → חפש **"Google Ads API"** → לחץ **Enable**.
4. עבור ל-**APIs & Services → OAuth consent screen**:
   - בחר **External**, מלא שם אפליקציה + אימייל תמיכה.
   - תחת Scopes אפשר להשאיר ריק כרגע.
   - תחת **Test users** — הוסף את כתובת ה-Gmail שאיתה תתחבר (חשוב!).
5. עבור ל-**APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - תחת **Authorized redirect URIs** הוסף:
     `https://developers.google.com/oauthplayground`
   - לחץ Create.
6. תקבל חלון עם **Client ID** ו-**Client Secret** — שמור את שניהם.

➡️ אלו ה-`GOOGLE_ADS_CLIENT_ID` וה-`GOOGLE_ADS_CLIENT_SECRET`.

---

## שלב 3 — Refresh Token (דרך OAuth Playground)
זה ה"מפתח" שמאשר למערכת לגשת לנתונים בשם החשבון. עושים אותו **פעם אחת לכל חשבון לקוח** (או לחשבון ה-MCC אם הוא מושך את כל הלקוחות).

1. פתח: **https://developers.google.com/oauthplayground**
2. למעלה מימין → ⚙️ (Settings) → סמן **"Use your own OAuth credentials"** → הדבק את ה-**Client ID** וה-**Client Secret** משלב 2.
3. בצד שמאל, בשדה "Input your own scopes" הדבק:
   `https://www.googleapis.com/auth/adwords`
   ולחץ **Authorize APIs**.
4. התחבר עם חשבון ה-Google שיש לו גישה לחשבון ה-Google Ads, ואשר.
5. לחץ **Exchange authorization code for tokens**.
6. העתק את ה-**Refresh token** שמופיע (מתחיל ב-`1//...`).

➡️ זה ה-Refresh Token של הלקוח.

---

## שלב 4 — Customer ID (מזהה חשבון הלקוח)
- ב-Google Ads, למעלה מימין ליד שם החשבון יש מספר בפורמט `123-456-7890`.
- זה ה-**Customer ID**. במערכת מזינים אותו **בלי המקפים**: `1234567890`.
- אם אתה עובד דרך MCC, תזדקק גם ל-**Login Customer ID** = ה-Customer ID של חשבון המנהל.

---

## שלב 5 — הזנת המפתחות ב-Vercel
המפתחות הכלליים (משותפים לכל הלקוחות) נכנסים כ-Environment Variables:

1. Vercel → הפרויקט → **Settings → Environment Variables**.
2. הוסף את המשתנים הבאים (Production + Preview):

| שם המשתנה | הערך |
|---|---|
| `GOOGLE_ADS_DEVELOPER_TOKEN` | ה-Developer Token משלב 1 |
| `GOOGLE_ADS_CLIENT_ID` | ה-Client ID משלב 2 |
| `GOOGLE_ADS_CLIENT_SECRET` | ה-Client Secret משלב 2 |
| `GOOGLE_ADS_LOGIN_CUSTOMER_ID` | (אופציונלי) ה-Customer ID של ה-MCC, בלי מקפים |

3. אחרי הוספה — **Redeploy** לפרויקט כדי שהמשתנים ייטענו.

> 🔒 לעולם אל תדביק מפתחות בצ'אט או בקוד — רק ב-Environment Variables של Vercel.

---

## שלב 6 — חיבור כל לקוח (Customer ID + Refresh Token)
ה-Customer ID וה-Refresh Token הם **פר-לקוח** ונשמרים במסד הנתונים (לא ב-env).
שולחים אותם למערכת דרך ה-API:

```
POST /api/google-ads/connect
Content-Type: application/json

{
  "clientId":     "<מזהה הלקוח במערכת>",
  "customerId":   "1234567890",
  "refreshToken": "1//0g....(מה-Playground)"
}
```

(אם תרצה — אוסיף בכרטיס הלקוח, בטאב "Google Ads", כפתור "חבר חשבון" עם טופס קטן שעושה בדיוק את הקריאה הזו, כדי שלא תצטרך להריץ ידנית.)

---

## בדיקה שהכול עובד
1. אחרי הזנת ה-env וה-Redeploy — היכנס לכרטיס לקוח → טאב **Google Ads**.
2. אם החיבור נשמר, הסטטוס יהפוך ל-"● מחובר ל-Google Ads".
3. לחץ **"הפק דוח Google Ads"** → הדוח ייפתח ב-2 עמודים.
4. ללא חיבור — תקבל **דוח דמו** מלא ומעוצב (זה תקין, לא שגיאה).

## מה קורה אם משהו לא תקין?
- לקוח בלי חיבור תקין **מדולג אוטומטית** בריצות ה-cron, והאירוע נרשם **בלוג פנימי בלבד** — הלקוח לעולם לא רואה הודעת שגיאה.

---

## סיכום — 4 המפתחות שצריך
1. **Developer Token** — מ-API Center (חשבון MCC).
2. **Client ID** — מ-Google Cloud (OAuth).
3. **Client Secret** — מ-Google Cloud (OAuth).
4. **Refresh Token** — מ-OAuth Playground (פר לקוח).
\+ **Customer ID** של כל לקוח.
