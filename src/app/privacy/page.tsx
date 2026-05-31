/**
 * Public privacy policy page (no auth) — used for the Meta App "Privacy Policy URL".
 * URL: https://<your-domain>/privacy
 */

export const metadata = {
  title: "מדיניות פרטיות — PixelManage AI",
  description: "מדיניות הפרטיות של מערכת PixelManage AI לניהול קמפיינים ולקוחות.",
};

export default function PrivacyPolicyPage() {
  const updated = "מאי 2026";
  return (
    <main dir="rtl" style={{ maxWidth: 820, margin: "0 auto", padding: "48px 24px", fontFamily: "system-ui, sans-serif", lineHeight: 1.8, color: "#1a1a2e" }}>
      <h1 style={{ fontSize: 30, fontWeight: 800, marginBottom: 8 }}>מדיניות פרטיות</h1>
      <p style={{ color: "#6b7280", marginTop: 0 }}>PixelManage AI · עודכן לאחרונה: {updated}</p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 32 }}>מי אנחנו</h2>
      <p>PixelManage AI היא מערכת לניהול קמפיינים שיווקיים, לקוחות ומשימות עבור סוכנות השיווק. המערכת מתחברת לחשבונות פרסום ודפים עסקיים (כגון Meta / Facebook ו-Instagram) לצורך ניהול ואופטימיזציה של קמפיינים.</p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28 }}>איזה מידע אנו אוספים</h2>
      <ul>
        <li>פרטי חשבון ומשתמש (שם, דוא"ל) של אנשי הצוות בסוכנות.</li>
        <li>נתוני לקוחות שהוזנו על ידי הסוכנות (פרטי קשר, יעדים שיווקיים, מסמכים).</li>
        <li>נתוני קמפיינים, מודעות וביצועים הנמשכים מ-Meta דרך ה-API הרשמי (חשיפות, קליקים, הוצאה, לידים).</li>
        <li>אסימוני גישה (Access Tokens) לחשבונות הפרסום המחוברים — נשמרים מאובטחים ומשמשים אך ורק לפעולות שהמשתמש מבצע במערכת.</li>
      </ul>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28 }}>כיצד אנו משתמשים במידע</h2>
      <ul>
        <li>הצגת נתוני קמפיינים וביצועים, וניהולם (יצירה, עדכון, אופטימיזציה) לבקשת המשתמש.</li>
        <li>הפקת דוחות וניתוחים עבור הסוכנות והלקוחות.</li>
        <li>תפעול שוטף של המערכת (משימות, יומנים, התראות).</li>
      </ul>
      <p>איננו מוכרים מידע אישי ואיננו משתפים אותו עם צדדים שלישיים מלבד ספקי תשתית הכרחיים (כגון אחסון ומסד נתונים) ושירותי Meta הרשמיים, בהתאם לתנאי השימוש שלהם.</p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28 }}>שמירת מידע ואבטחה</h2>
      <p>המידע נשמר במסד נתונים מאובטח עם הצפנה בתעבורה. הגישה מוגבלת למשתמשים מורשים בלבד. אסימוני גישה נשמרים בצורה מאובטחת ואינם נחשפים בממשק.</p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28 }}>מחיקת מידע</h2>
      <p>ניתן לבקש מחיקה של מידע בכל עת. ראו את ההוראות המלאות בעמוד <a href="/data-deletion" style={{ color: "#00B5FE" }}>מחיקת נתונים</a>.</p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 28 }}>יצירת קשר</h2>
      <p>לשאלות בנושא פרטיות ניתן לפנות לדוא"ל: <a href="mailto:tal.pixeld@gmail.com" style={{ color: "#00B5FE" }}>tal.pixeld@gmail.com</a>.</p>
    </main>
  );
}
