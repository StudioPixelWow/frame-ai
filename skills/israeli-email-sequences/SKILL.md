---
name: israeli-email-sequences
description: >
  Israeli email marketing playbook covering תיקון 40 לחוק התקשורת anti-spam compliance,
  Hebrew email templates (welcome, nurture, re-engagement, holiday, payment reminder),
  optimal timing for Israeli audiences, Hebrew subject line optimization, platform setup,
  and opt-in/opt-out requirements. Use when building, auditing, or executing email
  sequences for Israeli clients.
---

# Israeli Email Marketing — Sequences & Compliance

## Use When...

- Building email welcome, nurture, or re-engagement sequences for an Israeli client
- Ensuring compliance with Israeli anti-spam law (תיקון 40)
- Writing Hebrew email subject lines and body copy
- Setting up Mailchimp, Brevo (Sendinblue), or ActiveCampaign for an Israeli business
- Creating holiday email campaigns for Jewish calendar events
- Building payment reminder or transactional email flows

---

## 1. Israeli Anti-Spam Law Compliance — תיקון 40 לחוק התקשורת

### 1.1 Law Overview

תיקון 40 לחוק התקשורת (בזק ושידורים) — Israel's primary anti-spam legislation (Amendment 40 to the Communications Law).

**Core requirements:**
```
Consent (הסכמה):
  - Explicit opt-in required before sending marketing emails
  - Pre-checked boxes are NOT valid consent
  - Double opt-in (אישור כפול) is best practice (not legally required but recommended)
  - Consent must be recorded with timestamp and IP address

Sender Identification (זיהוי השולח):
  - Every email must clearly identify the sender
  - Business name and address must appear in every email
  - Cannot use misleading "From" names
  - Must include a real reply-to address (no no-reply@ without alternative contact)

Opt-Out (הסרה):
  - Every marketing email must include an unsubscribe link
  - Unsubscribe must be processed within 3 business days (best practice: immediately)
  - Cannot require registration to unsubscribe
  - Cannot charge for unsubscribing
  - Cannot send any further marketing email after unsubscribe

Transactional vs Marketing:
  - Order confirmations, receipts, password resets = transactional (no opt-in needed)
  - Newsletters, promotions, drip campaigns = marketing (opt-in required)
  - Boundary case: upsell within receipt = MARKETING, requires consent

Enforcement:
  - Israel Communications Ministry (משרד התקשורת) enforces
  - Fines up to ₪500,000 for violations
  - Individual violations: ₪1,000 per unsolicited email
```

### 1.2 Opt-In Implementation

```html
<!-- CORRECT: Unchecked checkbox with clear disclosure -->
<input type="checkbox" id="emailConsent" name="emailConsent" value="yes">
<label for="emailConsent">
  אני מסכים/ה לקבל עדכונים ומבצעים מ[COMPANY NAME] בדוא"ל.
  ניתן להסיר את עצמכם בכל עת.
</label>

<!-- WRONG: Do not pre-check this box -->
<!-- <input type="checkbox" checked> -->

<!-- Double opt-in confirmation email subject -->
"אנא אשרו את הרשמתכם לניוזלטר של [COMPANY]"
```

### 1.3 Email Footer Legal Requirements (Hebrew)

```
Every marketing email footer must include:
  [שם החברה]
  [כתובת מלאה]
  [מספר ח.פ. / ע.מ.]
  [מספר טלפון]
  [כתובת אימייל ליצירת קשר]
  
  קיבלתם מייל זה מכיוון שנרשמתם ל[LIST NAME/SERVICE].
  להסרה מהרשימה ולהפסקת קבלת הודעות שיווקיות — לחצו כאן: [UNSUBSCRIBE LINK]
```

---

## 2. Hebrew Email Templates

### 2.1 Welcome Email Sequence (3 emails)

**Email 1 — Immediate Welcome (נשלח מיד לאחר הרשמה)**

```
Subject: ברוכים הבאים ל[COMPANY] — כך מתחילים 🎉
Pre-header: [One-sentence value promise]

---
שלום [שם],

ברוכים הבאים ל[COMPANY]!

שמחים שהצטרפתם אלינו. כבר עכשיו, הנה X דבר שכדאי שתדעו:

✅ [Thing 1 — most important value or resource]
✅ [Thing 2 — how to get started]
✅ [Thing 3 — where to get help]

לשאלות? אנחנו תמיד כאן:
📧 [email] | 📱 [WhatsApp link]

ל[CTA — next step]:
[BUTTON: CTA Text]

בברכה,
[Name], צוות [COMPANY]

---
[Legal footer in Hebrew — see section 1.3]
```

**Email 2 — Value Delivery (נשלח 2 ימים אחרי)**

```
Subject: [Specific tip/resource relevant to signup reason]
Pre-header: משהו שאנחנו בטוחים שיעזור לכם

---
שלום [שם],

לפני 2 ימים הצטרפתם ל[COMPANY], ואנחנו רוצים לוודא שתצאו נשכרים מהשלב הראשון.

[Educational content block — 200-300 words or short guide]

בשבוע הבא נשלח לכם [preview of email 3].

[BUTTON: לקריאה נוספת / לצפייה בסרטון]

[Signature]
```

**Email 3 — Social Proof + CTA (נשלח 5 ימים אחרי)**

```
Subject: מה אמרו לקוחות שלנו אחרי חודש?
Pre-header: תוצאות אמיתיות מעסקים כמו שלכם

---
שלום [שם],

[Client testimonial in Hebrew — name, company, specific result]

"[Quote — 1-2 sentences max in Hebrew, with specific numbers]"
— [Client Name], [Client Company]

אנחנו עובדים עם עסקים כמו שלכם ומספקים [specific value].

מוכנים להתחיל?
[BUTTON: Primary CTA]

או דברו איתנו ישירות: [WhatsApp link]
```

### 2.2 Nurture Sequence (B2B — 5 emails over 3 weeks)

```
Email 1 (Day 0): Welcome + problem acknowledgment
Email 2 (Day 3): Educational content — "המדריך ל..."
Email 3 (Day 7): Case study — "[INDUSTRY] client, [RESULT]"
Email 4 (Day 11): Objection handling — "שאלות נפוצות שאנחנו שומעים"
Email 5 (Day 14): Soft offer — ייעוץ חינם / demo / הצעת מחיר

Subject line progression:
  1. "ברוכים הבאים — כך נוכל לעזור לכם"
  2. "המדריך שהייתם רוצים לקרוא לפני [DECISION]"
  3. "איך [CLIENT TYPE] הגיע ל[RESULT] תוך [TIME]"
  4. "תשובות לשאלות שאנשים מפחדים לשאול"
  5. "[שם], מוכנים לשיחה קצרה?"
```

### 2.3 Re-Engagement Email (ללקוחות לא פעילים)

```
Subject options (A/B test):
  A: "עדיין כאן? [שם], פספסנו אתכם"
  B: "האם הכל בסדר? לא שמענו מכם בזמן מה"
  C: "לפני שנסיר אתכם מהרשימה — בדקו את זה"

---
שלום [שם],

שמנו לב שלא פתחתם את המיילים שלנו כבר [X] ימים.

זה בסדר גמור — אנשים עסוקים.

אבל לפני שנסיר אתכם מהרשימה, רצינו לשאול:
האם יש משהו שנוכל לשפר?
האם המידע שאנחנו שולחים עדיין רלוונטי לכם?

[BUTTON: כן, אני רוצה להמשיך לקבל עדכונים]
[LINK: להסרה מהרשימה — לחצו כאן]

אם לא נשמע מכם תוך 7 ימים, נסיר אתכם אוטומטית (כך נשמור על תיבת הדואר שלכם נקייה).

תמיד שמחים לשמוע מכם,
[Signature]
```

### 2.4 Holiday Email Templates

**ראש השנה (New Year):**
```
Subject: שנה טובה ומתוקה מ[COMPANY] 🍎🍯
Send timing: 2 days before Rosh Hashana eve

---
[Name/שם],

ערב חג ראש השנה, אנחנו עוצרים רגע מהשגרה
ומאחלים לכם ולבית ביתכם:

שנה טובה ומתוקה,
שנה של בריאות, הצלחה ושפע,
ושתתגשמנה כל משאלות לבכם.

[Optional: holiday offer or "gift" — free resource, discount]

חג שמח,
צוות [COMPANY]

[Note: No hard CTA on holiday greeting emails — disrespectful in Israeli culture]
```

**חנוכה (Hanukkah):**
```
Subject: חנוכה שמח — ומשהו קטן מאיתנו 🕎
Timing: Day 1 of Hanukkah

---
[Name],

בחג האורים הזה, אנחנו מאירים קצת גם אתם 💡

[PROMOTIONAL OFFER — holiday deals are expected and accepted on Hanukkah]

[Offer details]

עד [date] בלבד — חנוכה שמח!

[BUTTON: לניצול ההטבה]
```

**פסח (Passover):**
```
Subject: חג פסח כשר ושמח מ[COMPANY]
Timing: 3-4 days before Passover eve

---
[Name],

לקראת חג הפסח, אנחנו שולחים ברכות חמות
לכם ולמשפחותיכם.

[Optional gentle message about freedom/renewal — ties to brand]

חג חירות שמח,
[Signature]
```

### 2.5 Payment Reminder Email (Hebrew)

```
[REMINDER 1 — Day of due date]:
Subject: תזכורת ידידותית: חשבונית מספר [X] מגיעה לתשלום היום
---
שלום [שם],

רצינו להזכיר שחשבונית מספר [X] בסך ₪[AMOUNT] + מע"מ מגיעה לתשלום היום, [DATE].

[BUTTON: לתשלום מאובטח]

לשאלות: [phone/email]
תודה, [Signature]

[REMINDER 2 — 7 days overdue]:
Subject: חשבונית פתוחה — [X] ימים מאז מועד התשלום
---
שלום [שם],

שמנו לב שחשבונית מספר [X] בסך ₪[AMOUNT] טרם שולמה.
מועד התשלום היה [DATE].

אנחנו בטוחים שמדובר בשגגה — שמחים לעזור אם יש בעיה.
[BUTTON: לתשלום] | [LINK: ליצירת קשר לפריסת תשלומים]

[REMINDER 3 — 14+ days overdue]:
Subject: פנייה אחרונה לפני העברה לטיפול — חשבונית [X]
---
[More formal tone, mention potential consequences without threats]
```

---

## 3. Email Timing for Israeli Audience

### 3.1 Optimal Send Windows

| Day | Best Window | Notes |
|---|---|---|
| Sunday | 7:30–9:00 / 13:00–15:00 | Week-start energy, good for B2B |
| Monday | 8:00–10:00 | Second best day for opens |
| Tuesday | 8:00–10:00 / 14:00–16:00 | Consistently high open rates |
| Wednesday | 9:00–11:00 | Mid-week, good for newsletters |
| Thursday | 8:00–9:30 | Last full workday — urgency works |
| Friday | 7:30–10:00 ONLY | After 12:00 = wasted send |
| Saturday | Avoid | Shabbat — very low engagement |

**Rule:** Never schedule promotional email Friday afternoon or Saturday. Wait until Saturday night (post-Shabbat) at earliest, or Sunday morning.

### 3.2 Holiday Blackout Periods

```
Never send promotional emails ON:
  - Yom Kippur (יום כיפור) — absolute rule, zero marketing
  - Yom HaZikaron (יום הזיכרון) — Memorial Day
  - Yom HaShoah (יום השואה) — Holocaust Remembrance Day
  
Reduce or avoid on:
  - Rosh Hashana morning (people are in synagogue/family)
  - Passover Seder evening (family dinner)
  - Yom Kippur eve (Kol Nidrei)
```

---

## 4. Subject Line Optimization in Hebrew

### 4.1 High-Converting Patterns

```
Question format (שאלה):
  "האם אתם עושים את הטעות הזו?"
  "כמה כסף אתם מפסידים בלי לדעת?"
  "[שם], יש לכם שאלה שלא שאלתם?"

Number format (מספרים):
  "5 דברים שצריכים לדעת ב[YEAR]"
  "3 שינויים שיכפילו את התוצאות שלכם"

Personalization ([שם]):
  "[ שם], יש לנו משהו בשבילכם"
  "[שם] — ראיתם את זה?"

Urgency (דחיפות):
  "24 שעות אחרונות — [OFFER]"
  "נגמר הלילה: [DEAL]"
  "רק [X] מקומות נותרו"

Curiosity (סקרנות):
  "הסוד שרוב [PROFESSION] מסתירים"
  "מה שגוגל לא אומר לכם"

Benefit-led (תועלת):
  "חסכו ₪[X] השנה בלי מאמץ נוסף"
  "הגדילו את ההכנסות שלכם ב-[X]% — בלי תקציב נוסף"
```

### 4.2 Subject Line Don'ts

```
Avoid these Hebrew spam triggers:
  ✗ "חינם" / "FREE" in caps — spam filters
  ✗ "$$" / "₪₪₪" multiple currency symbols
  ✗ ALL CAPS in Hebrew
  ✗ Excessive exclamation marks !!!
  ✗ "נא לפתוח" / "חובה לקרוא" — feels manipulative
  ✗ Misleading — "Re:" or "Fwd:" when not a reply
  ✗ Overly long subjects — keep under 50 characters
```

---

## 5. Platform Setup — Israel

### 5.1 Mailchimp for Israeli Business

```
Setup checklist:
  [ ] Hebrew language support: Mailchimp supports RTL via custom CSS
  [ ] Add RTL CSS to email template:
      body { direction: rtl; text-align: right; }
  [ ] Set timezone: Asia/Jerusalem
  [ ] Currency: ILS (₪) in e-commerce integrations
  [ ] Unsubscribe page: customize to Hebrew
  [ ] Double opt-in confirmation email: translate to Hebrew
  [ ] GDPR equivalent: enable Israeli compliance features
  [ ] Sender domain: authenticate with SPF, DKIM, DMARC
```

### 5.2 Brevo (Sendinblue) for Israeli Business

```
Better RTL support than Mailchimp for Hebrew.
Setup:
  [ ] Account language: Hebrew available
  [ ] Template builder: drag-and-drop supports RTL alignment
  [ ] SMS integration: supports Israeli phone numbers (+972)
  [ ] WhatsApp integration: available for Business API
  [ ] Transactional emails: set up SMTP relay for invoices
  [ ] Automation: visual workflow builder (superior to Mailchimp)
```

---

## 6. PixelManageAI Integration Points

```typescript
// Email sequence builder
interface IsraeliEmailSequence {
  sequenceType: 'welcome' | 'nurture' | 'reengagement' | 'holiday' | 'payment';
  clientId: string;
  language: 'hebrew' | 'english' | 'bilingual';
  audience: 'b2b' | 'b2c';
  platform: 'mailchimp' | 'brevo' | 'activecampaign' | 'hubspot';
  holidayName?: string;       // For holiday sequences
  invoiceAmount?: number;     // For payment reminders
}

// Compliance checker
interface EmailComplianceCheck {
  hasUnsubscribeLink: boolean;
  hasLegalFooter: boolean;
  hasBusinessRegistration: boolean;
  hasPhysicalAddress: boolean;
  hasRealReplyTo: boolean;
  consentRecorded: boolean;
  compliantWithTikun40: boolean;
}

// Holiday email scheduler
function scheduleHolidayEmail(
  holiday: IsraeliHoliday,
  emailType: 'greeting' | 'promotional',
  daysBeforeHoliday: number
): Date {
  // Returns optimal send date/time
  // Ensures no sends during Yom Kippur, Yom HaZikaron, Yom HaShoah
  // Accounts for Friday/Shabbat timing rules
}

// A/B test subject lines
interface HebrewSubjectLineTest {
  variantA: string;
  variantB: string;
  sendTimeA: Date;
  sendTimeB: Date;
  winnerCriteria: 'open_rate' | 'click_rate';
  testSize: number;          // percentage of list for test
}
```
