/**
 * Public data-deletion instructions page (no auth) — used for the Meta App
 * "Data Deletion Instructions URL".
 * URL: https://<your-domain>/data-deletion
 */

export const metadata = {
  title: "מחיקת נתונים — PixelManage AI",
  description: "הוראות למחיקת מידע אישי ממערכת PixelManage AI.",
};

export default function DataDeletionPage() {
  return (
    <main dir="rtl" style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.8, color: "#1a1a2e" }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>הוראות מחיקת נתונים</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>PixelManage AI</p>

      <p style={{ marginTop: 24 }}>
        מערכת PixelManage AI מכבדת את זכותך לשליטה במידע שלך. ניתן לבקש מחיקה מלאה של
        כל המידע האישי והעסקי המשויך אליך מהמערכת, כולל פרטי חשבון, נתוני לקוחות,
        ואסימוני גישה לחשבונות פרסום מחוברים.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28 }}>איך מבקשים מחיקה</h2>
      <ol>
        <li>שלחו דוא"ל לכתובת <a href="mailto:tal.pixeld@gmail.com" style={{ color: "#00B5FE" }}>tal.pixeld@gmail.com</a> עם הכותרת <strong>"בקשת מחיקת נתונים"</strong>.</li>
        <li>ציינו את כתובת הדוא"ל / שם המשתמש שאיתו אתם רשומים במערכת.</li>
        <li>נטפל בבקשה ונמחק את המידע לצמיתות תוך <strong>30 ימים</strong>, ונשלח אישור בסיום.</li>
      </ol>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28 }}>מה נמחק</h2>
      <ul>
        <li>פרטי המשתמש והחשבון.</li>
        <li>נתוני לקוחות, קמפיינים, משימות ומסמכים המשויכים אליכם.</li>
        <li>אסימוני גישה (Access Tokens) לחשבונות Meta / Facebook המחוברים — ההרשאות מנותקות מיידית.</li>
      </ul>

      <p style={{ marginTop: 24, color: "#6b7280" }}>
        ניתן גם לנתק את גישת האפליקציה ישירות דרך הגדרות הפרטיות של חשבון
        ה-Facebook שלכם: Settings → Business Integrations → הסירו את האפליקציה.
      </p>
    </main>
  );
}
