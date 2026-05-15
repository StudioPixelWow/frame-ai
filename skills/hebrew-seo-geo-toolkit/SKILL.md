---
name: hebrew-seo-geo-toolkit
description: >
  Hebrew SEO and GEO (Generative Engine Optimization) toolkit for the Israeli market.
  Handles Hebrew morphological complexity, local SEO for Israeli cities and regions,
  structured data in Hebrew, and AI visibility optimization for Hebrew-language queries.
  Use when building, auditing, or optimizing any Israeli website for search or AI engines.
---

# Hebrew SEO / GEO Toolkit — Israeli Market

## Use When...

- A client needs on-page SEO for a Hebrew or bilingual (Hebrew/English) website
- Conducting keyword research for the Israeli market
- Setting up Google Business Profile (GBP) in Hebrew
- Implementing structured data (Schema.org) for Israeli businesses
- Optimizing content to appear in AI-generated answers (Perplexity, ChatGPT, Gemini, Google SGE) for Hebrew queries
- Running a technical SEO audit on an RTL Hebrew site
- Targeting specific Israeli geographic regions (center, north, south, Jerusalem)

---

## 1. Hebrew Morphological Analysis

Hebrew is a morphologically rich, root-based, RTL language. SEO keyword selection must account for:

### 1.1 Word Form Variations (נטיות)

Every Hebrew root generates multiple surface forms. A single "keyword" may appear as dozens of valid word forms.

| Root / Concept | Absolute (נפרד) | Construct (סמיכות) | Plural | With ה' הידיעה |
|---|---|---|---|---|
| עורך דין | עורך דין | עורך דין ה... | עורכי דין | עורך הדין |
| רופא שיניים | רופא שיניים | רופא שיניי... | רופאי שיניים | רופא השיניים |
| מסעדה | מסעדה | מסעדת | מסעדות | המסעדה |
| שיפוץ | שיפוץ | שיפוץ ה... | שיפוצים | השיפוץ |
| פיתוח אפליקציות | פיתוח אפליקציות | מפתח אפליקציות | מפתחי אפליקציות | — |

**Action:** For every seed keyword, enumerate:
1. Base form (נקבה/זכר)
2. Construct state (סמיכות) — e.g., "חברת שיווק" vs "חברה לשיווק"
3. Plural form (רבים) — e.g., "שירותי קידום אתרים"
4. Definite article variants — e.g., "הקידום האורגני"
5. Preposition fusions — e.g., "בקידום", "לקידום", "מקידום"

### 1.2 Smichut (סמיכות) Patterns for Service Keywords

Israeli searchers often use construct-state noun phrases that differ from the absolute form used in headings.

```
Pattern: [שירות/מוצר] + [תחום]
Examples:
  - "חברת בניית אתרים" (construct) vs "חברה לבניית אתרים" (prepositional)
  - "משרד פרסום" vs "סוכנות פרסום" vs "חברת שיווק"
  - "קידום אתרים בגוגל" (most common search form)
  - "קידום אתרים מקצועי" (qualifier form)
```

### 1.3 Keyword Research Methodology

**Tools available in Israel:**
- Google Keyword Planner (set location: Israel, language: Hebrew)
- Semrush — supports Hebrew keywords
- Ahrefs — Hebrew keyword data available
- Google Search Console — filter by Hebrew queries
- Google Trends (trends.google.co.il) — Israeli trending searches
- Ubersuggest — limited Hebrew support

**Research Process:**
```
Step 1: Seed Collection
  - Interview client for service terms they use internally
  - Scrape competitor H1/H2 tags
  - Pull Google Search Console queries for existing pages

Step 2: Morphological Expansion
  - For each seed, generate all forms (see 1.1 above)
  - Use Google autocomplete in Hebrew for "people also search"
  - Check "חיפושים קשורים" at bottom of SERP

Step 3: Intent Classification
  - מסחרי (Commercial): "מחיר", "עלות", "כמה עולה", "השוואה"
  - אינפורמטיבי (Informational): "מה זה", "איך", "מדריך ל"
  - ניווטי (Navigational): brand name + service
  - עסקאי (Transactional): "להזמין", "לרכוש", "צור קשר"

Step 4: Volume / Difficulty Assessment
  - Israel monthly search volumes are 10-50x lower than US
  - 500+ monthly searches = significant keyword in Israel
  - 100-500 = medium opportunity
  - <100 = long tail, still valuable for GEO
```

---

## 2. GEO — Generative Engine Optimization for Hebrew

GEO optimizes content to be cited by AI engines (Google SGE, ChatGPT, Perplexity, Gemini) when users query in Hebrew.

### 2.1 Why Hebrew GEO Differs

- Hebrew training data is sparser than English — AI engines rely more on authoritative, well-structured Hebrew sources
- First-position SGE snippets in Hebrew often pull from a single dominant source
- Wikipedia Hebrew (ויקיפדיה), Ynet, מאקו, TheMarker are heavily weighted sources — link from or be cited by them

### 2.2 Content Structure for AI Visibility

```markdown
# [Primary Hebrew Keyword — Exact Match in H1]

## מה זה [TOPIC]? (Definition section — triggers AI summaries)
[2-3 sentence authoritative definition. Use structured, encyclopedic tone.]

## כיצד עובד [TOPIC]? (Process section)
[Numbered steps — AI engines favor numbered lists for how-to queries]

## יתרונות [TOPIC] (Benefits section)
[Bullet list with bolded key terms]

## שאלות נפוצות (FAQ section — critical for GEO)
**שאלה:** [Common Hebrew query in question form]
**תשובה:** [Direct 1-3 sentence answer]
```

### 2.3 FAQ Patterns for Israeli Queries

Common Hebrew question prefixes to target:
- "מה ההבדל בין X ל-Y"
- "כמה עולה [service] בישראל"
- "איך [verb] [object] בישראל"
- "מה זה [term]"
- "האם [product/service] שווה"
- "מי הכי טוב ב[service] בישראל"

### 2.4 E-E-A-T Signals for Hebrew Content

```
Author Credibility (מומחיות):
  - Author bio in Hebrew with credentials
  - LinkedIn profile link (Israeli professionals trust LinkedIn)
  - Years of experience stated explicitly: "מעל 10 שנות ניסיון"

Trustworthiness (אמינות):
  - Israeli business registration number visible (ח.פ. / ע.מ.)
  - Physical Israeli address with city
  - Israeli phone number (052/054/058 prefix)
  - Tase/government entity citations where applicable

Authority (סמכות):
  - Citations from TheMarker, Calcalist, Globes, Ynet Tech
  - Links from .ac.il domains (universities)
  - Mentions in Israeli industry associations
```

---

## 3. Local SEO for Israeli Regions

### 3.1 Geographic Targeting Structure

| Region | Hebrew Name | Major Cities to Target |
|---|---|---|
| Center | מרכז | תל אביב, רמת גן, גבעתיים, פתח תקווה, ראשון לציון, חולון, בת ים |
| Jerusalem | ירושלים | ירושלים, בית שמש, מעלה אדומים |
| North | צפון | חיפה, נצרת, עכו, נהריה, קריות, טבריה, נצרת עילית |
| South | דרום | באר שבע, אשדוד, אשקלון, אילת, דימונה |
| Shfela | שפלה | רחובות, נס ציונה, מודיעין, לוד, רמלה |
| Sharon | שרון | נתניה, הרצליה, רעננה, כפר סבא, הוד השרון, רמת השרון |

### 3.2 Local Keyword Patterns

```
[Service] + [City]:
  "רואה חשבון בתל אביב"
  "עורך דין בחיפה"
  "פיתוח אתרים ברחובות"

[Service] + [Region]:
  "קידום אתרים במרכז"
  "שיפוצניק בצפון"

[Service] + "קרוב אליי" / "באזורי":
  Growing mobile query pattern — target with GBP proximity signals

Neighborhood-level targeting (Tel Aviv example):
  "רופא שיניים בפלורנטין"
  "קפה בנווה צדק"
  "גן ילדים ברמת אביב"
```

### 3.3 Location Pages Template

```html
<!-- For each city/region, create a dedicated location page -->
<h1>[Service] ב[City] — [Company Name]</h1>

<p>מחפשים [service] ב[City]? [Company] מספקת [brief value prop]
לעסקים ותושבים ב[City] וסביבתה.</p>

<!-- Local signals to include: -->
<!-- 1. Embed Google Maps with exact business location -->
<!-- 2. Mention neighborhood landmarks -->
<!-- 3. List nearby served areas -->
<!-- 4. Include local phone number if possible -->
<!-- 5. Local client testimonials with city mentioned -->

<section class="local-areas">
  <h2>אזורים שאנו משרתים ב[City] וסביבתה</h2>
  <ul>
    <li>[Neighborhood 1]</li>
    <li>[Neighborhood 2]</li>
    <!-- ... -->
  </ul>
</section>
```

---

## 4. Google Business Profile in Hebrew

### 4.1 GBP Setup Checklist

```
Profile Completeness:
  [ ] שם עסק — exact legal name, no keyword stuffing
  [ ] קטגוריה ראשית — most specific available category
  [ ] קטגוריות משניות — up to 9 additional
  [ ] כתובת מלאה בעברית ואנגלית
  [ ] טלפון ישראלי (בינלאומי: +972-XX-XXXXXXX)
  [ ] שעות פתיחה — including Israeli holidays (mark as closed)
  [ ] אתר אינטרנט
  [ ] תיאור עסק (750 תווים) — include primary keywords naturally
  [ ] תמונות: logo, cover, interior, exterior, products/services
  [ ] שירותים/מוצרים מפורטים עם תיאורים בעברית

Posts (פרסומים ב-GBP):
  - Post frequency: minimum 1x per week
  - Include Hebrew CTA: "לפרטים נוספים", "להזמנה", "צור קשר"
  - Post holiday offers for Jewish holidays
  - Use UTM parameters to track GBP traffic

Q&A Section:
  - Pre-populate with 5-10 common questions in Hebrew
  - Answer authoritatively as the business owner
```

### 4.2 Review Strategy for Israeli Market

```
Review Request Timing:
  - WhatsApp message (most effective in Israel) — send 24-48h post service
  - SMS — secondary channel
  - Email — lower open rate in Israel

Hebrew Review Request Template (WhatsApp):
  "היי [שם], תודה שבחרת ב[עסק]!
  אשמח אם תוכל/י להשאיר לנו ביקורת קצרה בגוגל —
  זה עוזר לנו מאוד ולוקח דקה בלבד:
  [קישור ישיר לדף הביקורות]
  תודה רבה! 🙏"

Review Response Guidelines:
  - Respond in the same language the review was written (Hebrew/English/Arabic/Russian)
  - For 5-star: thank + mention service received + invite back
  - For negative: apologize, take offline ("אשמח שתצור קשר ישיר: [phone]")
  - Response time target: <24 hours
```

---

## 5. Structured Data in Hebrew

### 5.1 LocalBusiness Schema

```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "שם העסק",
  "alternateName": "Business Name in English",
  "description": "תיאור קצר של העסק בעברית",
  "url": "https://www.example.co.il",
  "telephone": "+972-XX-XXXXXXX",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "רחוב הדוגמה 1",
    "addressLocality": "תל אביב",
    "addressRegion": "תל אביב",
    "postalCode": "XXXXXXX",
    "addressCountry": "IL"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 32.0853,
    "longitude": 34.7818
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Sunday","Monday","Tuesday","Wednesday","Thursday"],
      "opens": "09:00",
      "closes": "18:00"
    }
  ],
  "priceRange": "₪₪",
  "currenciesAccepted": "ILS",
  "paymentAccepted": "Cash, Credit Card, Bit, PayBox",
  "areaServed": {
    "@type": "City",
    "name": "תל אביב"
  }
}
```

**Note:** Israeli work week is Sunday–Thursday. Friday is short day. Saturday (Shabbat) is closed.

### 5.2 FAQ Schema for Hebrew Pages

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "כמה עולה [שירות] בישראל?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "עלות [שירות] בישראל נעה בין X ל-Y ₪, בהתאם ל..."
      }
    },
    {
      "@type": "Question",
      "name": "כמה זמן לוקח [שירות]?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "בממוצע, [שירות] אורך..."
      }
    }
  ]
}
```

### 5.3 BreadcrumbList for Hebrew URLs

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "דף הבית",
      "item": "https://www.example.co.il/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "שירותים",
      "item": "https://www.example.co.il/services/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "קידום אתרים",
      "item": "https://www.example.co.il/services/seo/"
    }
  ]
}
```

---

## 6. Technical SEO for Hebrew/RTL Sites

### 6.1 HTML Direction and Language

```html
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <!-- For bilingual sites, use hreflang -->
  <link rel="alternate" hreflang="he" href="https://www.example.co.il/he/" />
  <link rel="alternate" hreflang="en" href="https://www.example.co.il/en/" />
  <link rel="alternate" hreflang="x-default" href="https://www.example.co.il/" />
</head>
```

### 6.2 URL Structure for Hebrew Sites

```
Recommended: Use English slugs (Google can index Hebrew slugs but English is cleaner)
  /seo-services/           — preferred
  /שירותי-קידום-אתרים/    — acceptable but can cause encoding issues

For location pages:
  /seo-tel-aviv/
  /seo-haifa/
  /seo-jerusalem/

Avoid: Hebrew slugs with special characters, mixed RTL/LTR URLs
```

### 6.3 Meta Tags in Hebrew

```html
<!-- Title: 50-60 characters including Hebrew chars (Hebrew chars ~1.5x width) -->
<!-- Aim for 40-50 Hebrew chars to be safe -->
<title>קידום אתרים בגוגל | [שם חברה] — תל אביב</title>

<!-- Description: 120-155 characters in Hebrew -->
<meta name="description" content="[Company] מציעה שירותי קידום אתרים מקצועיים לעסקים בישראל. ניסיון של X שנים, תוצאות מוכחות. צור קשר עוד היום לייעוץ חינם.">

<!-- Open Graph for Hebrew sharing (Facebook/WhatsApp) -->
<meta property="og:locale" content="he_IL">
<meta property="og:title" content="[Title in Hebrew]">
<meta property="og:description" content="[Description in Hebrew]">
```

---

## 7. PixelManageAI Integration Points

```typescript
// SEO Audit Task — trigger from PixelManageAI client dashboard
interface HebrewSEOAuditTask {
  clientId: string;
  websiteUrl: string;
  targetKeywords: HebrewKeyword[];
  targetCities: IsraeliCity[];
  auditType: 'technical' | 'on-page' | 'local' | 'geo' | 'full';
}

interface HebrewKeyword {
  baseForm: string;        // "קידום אתרים"
  morphologicalForms: string[]; // all variants
  monthlyVolume: number;   // IL monthly searches
  intent: 'commercial' | 'informational' | 'navigational' | 'transactional';
  difficulty: number;      // 0-100
}

type IsraeliCity =
  | 'tel-aviv' | 'haifa' | 'jerusalem' | 'beer-sheva'
  | 'ashdod' | 'netanya' | 'rishon-lezion' | 'petah-tikva'
  | 'holon' | 'ramat-gan' | 'bat-yam' | 'herzliya'
  | 'raanana' | 'kfar-saba' | 'modiin' | 'rehovot';

// GEO Score calculation
function calculateGEOScore(page: PageContent): GEOScore {
  return {
    hasDefinitionSection: /מה זה|מהו|מהי/.test(page.h2s),
    hasFAQSchema: page.schemas.includes('FAQPage'),
    hasNumberedProcess: page.hasOrderedList,
    wordCount: page.wordCount >= 800,
    hasAuthorBio: page.hasAuthorSchema,
    hasIsraeliEEAT: page.hasBusinessRegistration && page.hasIsraeliPhone,
  };
}
```

---

## 8. Quick Reference — Israeli SEO Benchmarks

| Metric | Israeli Baseline | Target |
|---|---|---|
| Avg. CPC (SEO industry keyword) | ₪8–25 | — |
| Monthly searches — major keyword | 500–5,000 | — |
| Page load target (mobile, Israel) | <2.5s | <1.8s |
| GBP review minimum (competitive) | 50+ | 100+ |
| Blog post length for ranking | 800+ words | 1,200–2,000 |
| Schema types minimum | 2 | 4+ |
| Local citation sources | Dun & Bradstreet IL, B144, Zap | 15+ citations |

### Key Israeli Citation Sites
- b144.co.il — Israeli yellow pages
- zap.co.il — price comparison + business listings
- drushim.co.il — job listings (also business visibility)
- mako.co.il — media
- ynet.co.il — media
- bizportal.co.il — business directory
- gov.il — government (high authority, use for certifications)
