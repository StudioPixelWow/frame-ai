---
name: hebrew-survey-builder
description: >
  Hebrew survey design and implementation for Israeli businesses. Covers RTL survey design,
  NPS implementation, culturally appropriate question phrasing, WhatsApp-first distribution
  strategy, response rate optimization, automated follow-up based on scores, and Israeli
  cultural considerations (directness, skepticism). Use when building customer feedback,
  NPS, or research surveys for Israeli clients.
---

# Hebrew Survey Builder — Israeli Market

## Use When...

- Building an NPS (Net Promoter Score) system for an Israeli business
- Designing customer satisfaction surveys in Hebrew
- Creating market research questionnaires for the Israeli market
- Setting up automated survey distribution via WhatsApp or SMS
- Analyzing survey data from Israeli respondents
- Building post-purchase, post-service, or onboarding feedback flows

---

## 1. RTL Survey Design Considerations

### 1.1 Hebrew UI/UX Requirements

```
Direction and Layout:
  - All form elements: direction: rtl; text-align: right;
  - Progress bar: fills right-to-left
  - "Next" button: positioned on LEFT side (navigation follows reading direction)
  - "Back" button: positioned on RIGHT side
  - Question numbering: displayed on right side of question text

Scale questions (1–10 NPS):
  - Anchor labels: "לא סביר בכלל" on RIGHT (score 0), "סביר מאוד" on LEFT (score 10)
  - This is counterintuitive but correct for RTL
  - Or: use vertical layout to avoid directional confusion
  
Dropdown menus:
  - Chevron arrow on LEFT side (not right)
  - Options align right
  - Scrollbar on right side (default browser behavior)

Radio buttons and checkboxes:
  - Place control element to the RIGHT of label text
  - Standard HTML with dir="rtl" handles this automatically
```

### 1.2 Mobile Optimization (Critical for Israel)

```
Israel is extremely mobile-first. Surveys sent via WhatsApp open in mobile browser.

Mobile requirements:
  - Single-column layout only
  - Font size minimum: 16px (prevents iOS zoom on focus)
  - Touch targets: minimum 44x44px
  - No horizontal scrolling
  - Progress indicator at top (compact)
  - One question per screen (typeform-style) for mobile
  - Hebrew keyboard triggers automatically on text input (use type="text" not type="email" for Hebrew fields)

Test on:
  - iPhone (Safari) — dominant in Israel
  - Samsung Galaxy (Chrome) — high Android market share in Israel
  - WhatsApp in-app browser (very different from regular browser)
```

---

## 2. NPS Implementation for Israeli Businesses

### 2.1 Standard NPS Question in Hebrew

```
Primary NPS Question:
"עד כמה סביר שתמליץ על [COMPANY/PRODUCT] לחבר או עמית?"

Scale anchors:
  0 = "לא סביר בכלל"
  10 = "סביר מאוד"

Follow-up question (mandatory):
  For Detractors (0-6): "מה הסיבה העיקרית לציון שנתת?"
  For Passives (7-8): "מה היינו יכולים לעשות טוב יותר?"
  For Promoters (9-10): "מה אהבת הכי הרבה בחוויה שלך?"

Alternative phrasing tested well in Israel:
  "באיזו מידה היית ממליץ עלינו לחבר שמחפש [SERVICE]?"
  (More specific = better response rate in Israel)

NPS Calculation:
  NPS = % Promoters (9-10) - % Detractors (0-6)
  Israeli B2C average: 20-40
  Israeli B2B average: 30-50
  World-class Israeli service: 60+
```

### 2.2 NPS Benchmarks — Israeli Market by Industry

| Industry | Average NPS | Good NPS | Excellent |
|---|---|---|---|
| E-commerce | 25 | 45 | 60+ |
| SaaS / Software | 30 | 50 | 65+ |
| Financial Services | 10 | 25 | 40+ |
| Healthcare | 35 | 55 | 70+ |
| Legal Services | 20 | 35 | 50+ |
| Restaurants / F&B | 40 | 60 | 75+ |
| Real Estate | 15 | 30 | 50+ |
| Retail | 30 | 50 | 65+ |
| Marketing Agencies | 25 | 45 | 60+ |

### 2.3 NPS Automation Flow

```typescript
// NPS trigger logic
async function triggerNPSSurvey(event: CustomerEvent): Promise<void> {
  const triggers = {
    'purchase_completed': { delayDays: 3, channel: 'whatsapp' },
    'service_delivered': { delayDays: 1, channel: 'whatsapp' },
    'project_milestone': { delayDays: 0, channel: 'email' },
    'subscription_renewal': { delayDays: 7, channel: 'email' },
    'onboarding_complete': { delayDays: 14, channel: 'whatsapp' },
  };
  
  const config = triggers[event.type];
  if (!config) return;
  
  await scheduleMessage({
    recipientId: event.customerId,
    channel: config.channel,
    template: 'nps_hebrew',
    scheduledFor: addDays(new Date(), config.delayDays),
    language: 'he',
  });
}

// Response handler
async function handleNPSResponse(
  customerId: string,
  score: number,
  comment: string
): Promise<void> {
  if (score <= 6) {
    // Detractor — immediate follow-up
    await createTask({
      type: 'customer_recovery',
      priority: 'high',
      customerId,
      score,
      comment,
      dueWithinHours: 24,
      assignedTo: 'account_manager',
    });
    await sendWhatsAppTemplate(customerId, 'nps_detractor_recovery_he');
  } else if (score >= 9) {
    // Promoter — request review
    await sendWhatsAppTemplate(customerId, 'nps_promoter_review_request_he');
    // Hebrew review request for Google / Facebook
  }
}
```

---

## 3. Question Types and Hebrew Phrasing

### 3.1 Question Bank — Hebrew Templates

**Satisfaction Questions:**
```
Overall satisfaction:
  "בסך הכל, עד כמה אתה מרוצה מ[PRODUCT/SERVICE]?"
  Scale: מאוד לא מרוצה (1) — מאוד מרוצה (5)

Service quality:
  "כיצד היית מדרג את איכות השירות שקיבלת?"
  Scale: גרוע (1) — מצוין (5)

Speed / response time:
  "עד כמה היית מרוצה ממהירות המענה שלנו?"

Value for money:
  "עד כמה לדעתך המחיר שילמת משקף את הערך שקיבלת?"
```

**Open-ended Questions (Hebrew):**
```
Main improvement:
  "מה דבר אחד שהיינו יכולים לעשות טוב יותר?"

Best aspect:
  "מה הדבר שאהבת הכי הרבה בחוויה שלך איתנו?"

Recommendation reason:
  "אם היית ממליץ עלינו, מה היית אומר?"
  
Barrier question:
  "מה מנע אותך מלהשתמש ב[PRODUCT] יותר?"

Missing feature:
  "מה תכונה אחת שהיית רוצה שנוסיף?"
```

**Demographic Questions (Israeli context):**
```
Business size:
  "מה גודל הצוות/העסק שלך?"
  [ ] עצמאי / סולו
  [ ] 2-10 עובדים
  [ ] 11-50 עובדים
  [ ] 51-200 עובדים
  [ ] 200+ עובדים

Location:
  "איפה אתה ממוקם?"
  [ ] תל אביב ואזור המרכז
  [ ] ירושלים וסביבתה
  [ ] חיפה והצפון
  [ ] הדרום
  [ ] אחר: ______

Industry (Hebrew):
  [ ] היי-טק / תוכנה
  [ ] פיננסים / ביטוח
  [ ] בריאות / רפואה
  [ ] נדל"ן
  [ ] מסחר / קמעונאות
  [ ] שירותים מקצועיים
  [ ] תעשייה / ייצור
  [ ] חינוך
  [ ] אחר
```

### 3.2 Israeli Cultural Calibration

```
Israeli respondents are:
  1. More direct — accept blunt negative answers, don't soften scale labels too much
  2. Skeptical of extremes — Israelis rarely give 10/10 or 1/10; expect compressed distributions
  3. Opinionated — open-ended text fields will get longer responses than other markets
  4. Mobile — keep surveys under 3 minutes (5-7 questions max for WhatsApp)
  5. Impatient — get to the point; no long intro text

Adjust scale interpretation:
  Israeli 7 = Other market's 8-9
  Israeli 8 = Other market's 9-10
  (Israelis are harder graders — calibrate benchmarks accordingly)

Length guidelines:
  WhatsApp-triggered survey: 3-5 questions max
  Email survey: 7-10 questions max
  Market research: 15-20 questions (with incentive)
  NPS: 2 questions (score + open-ended)
```

---

## 4. Survey Distribution Channels — Israel

### 4.1 WhatsApp Distribution (Primary)

WhatsApp is the dominant communication channel in Israel. Survey completion rates are 3-5x higher via WhatsApp than email.

```
WhatsApp Survey Message Template:
---
שלום [שם]! 👋

[Company] כאן.
ממש לוקח דקה, ונשמח לשמוע מה חשבת על [SERVICE/PRODUCT שקיבלת]:

👉 [SURVEY LINK]

השאלון קצר (3 שאלות בלבד) ועוזר לנו להשתפר.
תודה מראש! 🙏
---

WhatsApp Business API trigger points:
  - Post-purchase (3 days after)
  - Post-support ticket resolution (24 hours after)
  - Post-project delivery (1 day after)
  - Quarterly NPS (every 90 days)

WhatsApp survey rules:
  - Use official WhatsApp Business API (not unofficial bots)
  - Must be initiated within 24h of customer interaction
    OR use pre-approved template messages for outbound
  - Opt-out link must be included: "להסרה מהרשימה — הגב 'הסר'"
```

### 4.2 SMS Distribution

```
SMS template (Hebrew — 160 char limit):
"שלום [שם], [COMPANY] כאן. נשמח לקבל ממך משוב קצר על [SERVICE]: [SHORT LINK]
להסרה הגב STOP"

SMS providers for Israel:
  - 019 Mobile
  - Inforu
  - Cellact
  - Twilio (supports Israeli numbers)

Cost: ~₪0.15-0.30 per SMS in Israel
Open rate: ~98% (but CTR to survey link: 15-25%)
```

### 4.3 Email Distribution

```
Best for: B2B clients, longer surveys, research projects

Email survey integration:
  - Embed first NPS question directly in email body (1-click rating)
  - Click takes to full survey with remaining questions
  - Pre-fill name/email from CRM to reduce friction

Subject line A/B test ideas:
  A: "[שם], דקה אחת שתעזור לנו להשתפר?"
  B: "שאלה אחת קצרה — מה חשבת על [SERVICE]?"
  C: "המשוב שלך חשוב לנו ב[COMPANY]"
```

---

## 5. Response Rate Optimization

### 5.1 Israeli Market Response Rate Benchmarks

| Channel | Average Response Rate | With Personalization | With Incentive |
|---|---|---|---|
| WhatsApp | 30–50% | 40–60% | 55–75% |
| SMS | 15–25% | 20–30% | 30–45% |
| Email | 8–15% | 12–20% | 20–35% |
| In-app | 5–10% | 10–18% | 15–25% |

### 5.2 Optimization Tactics

```
1. Timing (most important):
   Best: Within 1-24 hours of service interaction
   Worst: More than 7 days after interaction (memory fades)
   Avoid: Friday afternoon, Shabbat, Holiday eves

2. Personalization:
   Always use first name in WhatsApp/SMS
   Reference the specific service/product received
   "על [ה]שיחה שהיתה לנו ביום [DATE]" increases response rate 20%+

3. Brevity:
   State question count upfront: "(3 שאלות — דקה אחת)"
   Keep mobile survey under 2 minutes
   Progress indicator (שאלה 2 מתוך 5)

4. Incentive (תמריץ):
   For market research: ₪20-50 Amazon/HOT gift card equivalent
   For NPS: "כל משיב נרשם להגרלת [X]"
   For loyal customers: discount code as thank-you
   Note: Incentives can bias NPS — use only for research, not operational NPS

5. Follow-up reminder:
   WhatsApp reminder after 48 hours non-response
   One reminder only — Israelis don't respond well to nagging
   "שלחנו אליך לפני יומיים — רק רצינו לוודא שקיבלת [SURVEY LINK]"
```

---

## 6. Automated Follow-Up Based on Scores

### 6.1 Segmented Response Automation

```
NPS Score 0-4 (Detractors — strong):
  Trigger within: 2 hours
  Action: Alert account manager + WhatsApp from human sender
  Message: "שלום [שם], ראיתי את הציון שנתת ורציתי ליצור קשר אישית.
            מה קרה? אשמח לשמוע ולתקן."
  Goal: Recovery call within 24 hours

NPS Score 5-6 (Detractors — mild):
  Trigger: Next business day
  Action: Personalized apology + improvement offer
  Goal: Convert to passive

NPS Score 7-8 (Passives):
  Trigger: 3 days after survey
  Action: Nurture message with tip/value + ask what would make them a 9-10
  Goal: Understand gap, convert to promoter

NPS Score 9-10 (Promoters):
  Trigger: 1 day after survey
  Action: Thank you + review request (Google/Facebook) + referral ask
  Message: "תודה ענקית על הציון! היית רוצה לשתף את החוויה שלך בגוגל?
            זה עוזר לנו מאוד: [GOOGLE REVIEW LINK]"
  Goal: Capture public testimonial, referral activation
```

---

## 7. PixelManageAI Integration Points

```typescript
// Survey builder configuration
interface HebrewSurveyConfig {
  clientId: string;
  surveyType: 'nps' | 'csat' | 'ces' | 'market_research' | 'onboarding';
  language: 'hebrew' | 'arabic' | 'russian' | 'english';
  distributionChannel: 'whatsapp' | 'sms' | 'email' | 'in_app';
  triggerEvent: string;       // e.g., 'purchase_completed'
  triggerDelayHours: number;
  questionCount: number;      // 2-5 for mobile, 5-15 for email
  incentive?: {
    type: 'discount' | 'raffle' | 'gift_card';
    value: string;
  };
}

// Survey analytics dashboard
interface IsraeliSurveyAnalytics {
  surveyId: string;
  responseRate: number;
  npsScore?: number;
  csatScore?: number;
  responsesByRegion: Record<string, number>;
  responsesByDevice: { mobile: number; desktop: number };
  openEndedThemes: string[];  // Auto-categorized common themes
  detractorAlerts: CustomerAlert[];
  promoterOpportunities: CustomerOpportunity[];
}

// Customer alert for immediate action
interface CustomerAlert {
  customerId: string;
  customerName: string;
  score: number;
  comment: string;
  surveyCompletedAt: Date;
  assignedTo?: string;
  status: 'new' | 'in_progress' | 'resolved';
  resolution?: string;
}
```
