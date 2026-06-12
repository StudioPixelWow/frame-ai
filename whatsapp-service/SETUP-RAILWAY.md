# הקמת שירות הוואטסאפ ב-Railway — מדריך העתק-הדבק

> כל הערכים שצריך "להמציא" כבר מוכנים כאן. רק תעתיק-תדביק.

## 🔑 הערכים שלך (שמור אותם)

```
SERVICE_SECRET = 71dd8f2dbc542341fd42b063f074e34541d8d6b7cd70beef
SESSION_DIR    = /app/.wwebjs_auth
```

(זו סיסמה אקראית שיצרתי עבורך. אותה סיסמה תלך גם ל-Vercel בהמשך.)

---

## שלב 1 — Railway

1. היכנס ל-https://railway.app והתחבר עם GitHub.
2. **New Project** → **Deploy from GitHub repo** → בחר את הריפו של frame-ai.
3. אחרי שנוצר השירות, פתח אותו → **Settings**:
   - **Root Directory** → הדבק: `whatsapp-service`
   - (Railway יזהה אוטומטית את ה-Dockerfile ויבנה.)

## שלב 2 — Volume (שמירת ההתחברות)

ב-Settings של השירות → **Volumes** → **New Volume**:
- **Mount Path** → הדבק: `/app/.wwebjs_auth`

(זה מה ששומר את חיבור הוואטסאפ כך שלא תצטרך לסרוק QR בכל אתחול.)

## שלב 3 — Variables (משתני סביבה)

ב-**Variables** של השירות, הוסף שתי שורות (העתק-הדבק):

```
SERVICE_SECRET=71dd8f2dbc542341fd42b063f074e34541d8d6b7cd70beef
SESSION_DIR=/app/.wwebjs_auth
```

(את PORT אין צורך להגדיר — Railway עושה אוטומטית.)

## שלב 4 — כתובת ציבורית

ב-Settings → **Networking** → **Generate Domain**.
תקבל כתובת כמו `https://frame-ai-whatsapp.up.railway.app` — **העתק אותה**.

---

## שלב 5 — Vercel (האתר הראשי)

בפרויקט frame-ai ב-Vercel → **Settings → Environment Variables**, הוסף:

```
WHATSAPP_SERVICE_URL=<הכתובת מ-Railway, למשל https://frame-ai-whatsapp.up.railway.app>
WHATSAPP_SERVICE_SECRET=71dd8f2dbc542341fd42b063f074e34541d8d6b7cd70beef
```

ואז **Redeploy** ל-Vercel.

> אם עדיין אין לך משתנה `CRON_SECRET` ב-Vercel (לדיוור השבועי האוטומטי), הוסף גם:
> ```
> CRON_SECRET=8c1f5a9e3b7d4612a0e9f4c2d8b6a1735e0c9d24f1a3b8e6
> ```

---

## שלב 6 — חיבור

פתח את האתר → **דיוור וואטסאפ** → יופיע QR → סרוק אותו בוואטסאפ
(הגדרות ← מכשירים מקושרים ← קישור מכשיר). כשכתוב **● מחובר** — סיימת. 🎉
