// ============================================================
// Israeli Holidays — comprehensive, year-specific Gregorian dates
// Covers 2025-2035 based on the Hebrew lunisolar calendar.
// All dates are the EVE (erev) / first day of the holiday.
// ============================================================

export interface IsraeliHoliday {
  name: string;
  hebrewName: string;
  month: number; // 1-12 Gregorian
  approximateDay: number; // Gregorian day of month
  type: 'religious' | 'national' | 'commercial' | 'seasonal' | 'memorial';
  relevantBusinessTypes: string[]; // which client types benefit most
  contentIdeas: string[];
}

// ---------------------------------------------------------------------------
// Raw year-specific date table:  [month, day]
// Each holiday has entries keyed by Gregorian year.
// ---------------------------------------------------------------------------

interface HolidayDateEntry {
  name: string;
  hebrewName: string;
  type: IsraeliHoliday['type'];
  relevantBusinessTypes: string[];
  contentIdeas: string[];
  /** Map of Gregorian year → [month, day] */
  dates: Record<number, [number, number]>;
}

const HOLIDAY_DATABASE: HolidayDateEntry[] = [
  // ── ראש השנה ──
  {
    name: 'Rosh Hashana',
    hebrewName: 'ראש השנה',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'hosting', 'websites', 'ecommerce', 'food', 'retail', 'services'],
    contentIdeas: [
      'ברכת שנה טובה ממותגת עם ערך ללקוח',
      'סיכום שנה עסקית — מה למדנו, מה השגנו',
      'מבצעי ראש השנה / תחילת שנה חדשה',
      'פוסט השראה — מטרות לשנה החדשה',
    ],
    dates: {
      2025: [9, 22], 2026: [9, 11], 2027: [10, 2], 2028: [9, 20],
      2029: [9, 10], 2030: [9, 28], 2031: [9, 17], 2032: [9, 6],
      2033: [9, 24], 2034: [9, 14], 2035: [10, 3],
    },
  },
  // ── צום גדליה ──
  {
    name: 'Tzom Gedaliah',
    hebrewName: 'צום גדליה',
    type: 'religious',
    relevantBusinessTypes: ['marketing'],
    contentIdeas: [
      'תוכן מעורר מחשבה',
      'יום של חשבון נפש עסקי',
    ],
    dates: {
      2025: [9, 24], 2026: [9, 14], 2027: [10, 4], 2028: [9, 22],
      2029: [9, 12], 2030: [9, 30], 2031: [9, 19], 2032: [9, 8],
      2033: [9, 26], 2034: [9, 17], 2035: [10, 6],
    },
  },
  // ── יום כיפור ──
  {
    name: 'Yom Kippur',
    hebrewName: 'יום כיפור',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'services', 'retail'],
    contentIdeas: [
      'ברכת גמר חתימה טובה ממותגת',
      'תוכן מעורר השראה — סליחה, חידוש, התחלה חדשה',
      'הפסקה ממותגת — "גם אנחנו עוצרים לרגע"',
    ],
    dates: {
      2025: [10, 1], 2026: [9, 20], 2027: [10, 11], 2028: [9, 29],
      2029: [9, 19], 2030: [10, 7], 2031: [9, 26], 2032: [9, 15],
      2033: [10, 3], 2034: [9, 23], 2035: [10, 12],
    },
  },
  // ── סוכות ──
  {
    name: 'Sukkot',
    hebrewName: 'סוכות',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'ecommerce', 'food', 'retail', 'services'],
    contentIdeas: [
      'סוכה ממותגת — הזמנה ללקוחות',
      'מבצעי חול המועד',
      'תוכן משפחתי — ארוחה, אירוח, טבע',
      'חג שמח — פוסט אווירה',
    ],
    dates: {
      2025: [10, 6], 2026: [9, 25], 2027: [10, 16], 2028: [10, 4],
      2029: [9, 24], 2030: [10, 12], 2031: [10, 1], 2032: [9, 20],
      2033: [10, 8], 2034: [9, 28], 2035: [10, 17],
    },
  },
  // ── הושענא רבה ──
  {
    name: 'Hoshana Raba',
    hebrewName: 'הושענא רבה',
    type: 'religious',
    relevantBusinessTypes: ['marketing'],
    contentIdeas: [
      'תוכן רוחני — יום של תפילה ובקשה',
      'ברכה ייחודית ללקוחות',
    ],
    dates: {
      2025: [10, 12], 2026: [10, 1], 2027: [10, 22], 2028: [10, 10],
      2029: [9, 30], 2030: [10, 18], 2031: [10, 7], 2032: [9, 26],
      2033: [10, 14], 2034: [10, 4], 2035: [10, 23],
    },
  },
  // ── שמיני עצרת / שמחת תורה ──
  {
    name: 'Simchat Torah',
    hebrewName: 'שמחת תורה',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'services'],
    contentIdeas: [
      'סיום וחגיגה — סיום מחזור וחידוש',
      'תוכן שמחה ואנרגיה',
      'ריקוד עם הלקוחות — מטאפורה למעורבות',
    ],
    dates: {
      2025: [10, 13], 2026: [10, 2], 2027: [10, 23], 2028: [10, 11],
      2029: [10, 1], 2030: [10, 19], 2031: [10, 8], 2032: [9, 27],
      2033: [10, 15], 2034: [10, 5], 2035: [10, 24],
    },
  },
  // ── חנוכה (יום ראשון) ──
  {
    name: 'Hanukkah',
    hebrewName: 'חנוכה',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'websites', 'hosting', 'ecommerce', 'food', 'retail', 'services'],
    contentIdeas: [
      '8 ימים של תוכן — נר אחד כל יום',
      'מבצעי חנוכה — "אור" על המוצר שלך',
      'סופגנייה ויצירתיות — תוכן קליל',
      'חנוכה בעסק — סדרת סטוריז',
    ],
    dates: {
      2025: [12, 14], 2026: [12, 4], 2027: [12, 24], 2028: [12, 12],
      2029: [12, 1], 2030: [12, 20], 2031: [12, 9], 2032: [11, 28],
      2033: [12, 16], 2034: [12, 6], 2035: [12, 25],
    },
  },
  // ── י׳ בטבת ──
  {
    name: 'Tenth of Tevet',
    hebrewName: 'צום עשרה בטבת',
    type: 'religious',
    relevantBusinessTypes: ['marketing'],
    contentIdeas: [
      'יום זיכרון — תוכן מכבד',
      'מסר של זיכרון ותקווה',
    ],
    dates: {
      2025: [1, 10], 2026: [12, 31], 2027: [1, 1], 2028: [12, 22],
      2029: [1, 9], 2030: [12, 30], 2031: [12, 19], 2032: [1, 7],
      2033: [12, 27], 2034: [12, 16], 2035: [1, 5],
    },
  },
  // ── ט״ו בשבט ──
  {
    name: 'Tu BiShvat',
    hebrewName: 'ט״ו בשבט',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'food', 'services'],
    contentIdeas: [
      'תוכן ירוק / סביבתי — אחריות חברתית',
      'נטיעות והתחדשות — "גם אנחנו נוטעים שורשים"',
      'קשר לטבע — פוסט אווירה',
      'מבצע ירוק — הנחה על מוצרים ירוקים',
    ],
    dates: {
      2025: [2, 12], 2026: [2, 1], 2027: [1, 22], 2028: [2, 10],
      2029: [1, 30], 2030: [1, 19], 2031: [2, 7], 2032: [1, 28],
      2033: [1, 17], 2034: [2, 4], 2035: [1, 24],
    },
  },
  // ── תענית אסתר ──
  {
    name: 'Taanit Esther',
    hebrewName: 'תענית אסתר',
    type: 'religious',
    relevantBusinessTypes: ['marketing'],
    contentIdeas: [
      'ערב פורים — ספירה לאחור',
      'תוכן על אומץ ומנהיגות',
    ],
    dates: {
      2025: [3, 13], 2026: [3, 3], 2027: [3, 22], 2028: [3, 9],
      2029: [2, 27], 2030: [3, 18], 2031: [3, 6], 2032: [2, 24],
      2033: [3, 14], 2034: [3, 2], 2035: [3, 22],
    },
  },
  // ── פורים ──
  {
    name: 'Purim',
    hebrewName: 'פורים',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'ecommerce', 'food', 'retail', 'services'],
    contentIdeas: [
      'תוכן הומוריסטי / פרודיה על המותג',
      'מבצעי פורים — "ונהפוך הוא"',
      'תחפושת ממותגת — הצוות מתחפש',
      'משלוח מנות ללקוחות — פוסט תודה',
    ],
    dates: {
      2025: [3, 14], 2026: [3, 4], 2027: [3, 23], 2028: [3, 10],
      2029: [2, 28], 2030: [3, 19], 2031: [3, 7], 2032: [2, 25],
      2033: [3, 15], 2034: [3, 3], 2035: [3, 23],
    },
  },
  // ── שושן פורים ──
  {
    name: 'Shushan Purim',
    hebrewName: 'שושן פורים',
    type: 'religious',
    relevantBusinessTypes: ['marketing'],
    contentIdeas: [
      'המשך חגיגה — "עוד יום של שמחה"',
      'תוכן ירושלמי / עירוני',
    ],
    dates: {
      2025: [3, 15], 2026: [3, 5], 2027: [3, 24], 2028: [3, 11],
      2029: [3, 1], 2030: [3, 20], 2031: [3, 8], 2032: [2, 26],
      2033: [3, 16], 2034: [3, 4], 2035: [3, 24],
    },
  },
  // ── פסח ──
  {
    name: 'Passover',
    hebrewName: 'פסח',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'websites', 'hosting', 'ecommerce', 'food', 'retail', 'services'],
    contentIdeas: [
      'חג חירות שמח — חופש ממותג',
      'מבצעי אביב / ניקיון אביב',
      'ניקיון אביב — שדרוג שירות / מוצר',
      'תוכן משפחתי — ליל סדר, מסורת',
    ],
    dates: {
      2025: [4, 12], 2026: [4, 1], 2027: [4, 21], 2028: [4, 10],
      2029: [3, 30], 2030: [4, 17], 2031: [4, 7], 2032: [3, 26],
      2033: [4, 13], 2034: [4, 3], 2035: [4, 22],
    },
  },
  // ── שביעי של פסח ──
  {
    name: 'Seventh of Passover',
    hebrewName: 'שביעי של פסח',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding'],
    contentIdeas: [
      'סיום חג — חזרה לשגרה',
      'תוכן השראה — מעבר ים סוף',
    ],
    dates: {
      2025: [4, 18], 2026: [4, 7], 2027: [4, 27], 2028: [4, 16],
      2029: [4, 5], 2030: [4, 23], 2031: [4, 13], 2032: [4, 1],
      2033: [4, 19], 2034: [4, 9], 2035: [4, 28],
    },
  },
  // ── יום השואה ──
  {
    name: 'Yom HaShoah',
    hebrewName: 'יום השואה',
    type: 'memorial',
    relevantBusinessTypes: ['marketing', 'branding', 'services'],
    contentIdeas: [
      'תוכן מכבד — עצירה לרגע זיכרון',
      'הפסקת פרסום / הנמכת טון',
      '"לזכור ולא לשכוח" — מסר ערכי',
    ],
    dates: {
      2025: [4, 24], 2026: [4, 13], 2027: [5, 3], 2028: [4, 20],
      2029: [4, 11], 2030: [4, 29], 2031: [4, 17], 2032: [4, 7],
      2033: [4, 25], 2034: [4, 16], 2035: [5, 4],
    },
  },
  // ── יום הזיכרון ──
  {
    name: 'Yom HaZikaron',
    hebrewName: 'יום הזיכרון',
    type: 'memorial',
    relevantBusinessTypes: ['marketing', 'branding', 'services'],
    contentIdeas: [
      'תוכן מכבד ורגיש — "אנחנו זוכרים"',
      'הפסקת פרסום מלאה',
      'ערכים לאומיים — אחדות, מסירות',
    ],
    dates: {
      2025: [4, 30], 2026: [4, 21], 2027: [5, 11], 2028: [4, 26],
      2029: [4, 17], 2030: [5, 7], 2031: [4, 23], 2032: [4, 13],
      2033: [5, 3], 2034: [4, 20], 2035: [5, 8],
    },
  },
  // ── יום העצמאות ──
  {
    name: 'Yom HaAtzmaut',
    hebrewName: 'יום העצמאות',
    type: 'national',
    relevantBusinessTypes: ['marketing', 'branding', 'websites', 'ecommerce', 'retail', 'food', 'services'],
    contentIdeas: [
      'חגיגת עצמאות — גאווה ישראלית',
      'מבצעי עצמאות — "חוגגים עם הנחה"',
      'תוכן פטריוטי — כחול לבן',
      'אירוע / על האש — פוסט אווירה',
    ],
    dates: {
      2025: [5, 1], 2026: [4, 22], 2027: [5, 12], 2028: [4, 27],
      2029: [4, 18], 2030: [5, 8], 2031: [4, 24], 2032: [4, 14],
      2033: [5, 4], 2034: [4, 21], 2035: [5, 9],
    },
  },
  // ── פסח שני ──
  {
    name: 'Pesach Sheni',
    hebrewName: 'פסח שני',
    type: 'religious',
    relevantBusinessTypes: ['marketing'],
    contentIdeas: [
      '"הזדמנות שנייה" — מסר ממותג',
      'תוכן על חידוש, התחלה מחדש',
    ],
    dates: {
      2025: [5, 12], 2026: [5, 1], 2027: [5, 21], 2028: [5, 10],
      2029: [4, 29], 2030: [5, 17], 2031: [5, 7], 2032: [4, 25],
      2033: [5, 13], 2034: [5, 3], 2035: [5, 22],
    },
  },
  // ── ל״ג בעומר ──
  {
    name: 'Lag BaOmer',
    hebrewName: 'ל״ג בעומר',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'food', 'retail'],
    contentIdeas: [
      'מדורה ואווירת חוץ — פוסט אווירה',
      'תוכן קיצי — שמש, טבע, חברים',
      'אירועי חוץ — "נפגשים בטבע"',
    ],
    dates: {
      2025: [5, 15], 2026: [5, 5], 2027: [5, 25], 2028: [5, 13],
      2029: [5, 2], 2030: [5, 21], 2031: [5, 10], 2032: [4, 29],
      2033: [5, 17], 2034: [5, 7], 2035: [5, 26],
    },
  },
  // ── יום ירושלים ──
  {
    name: 'Yom Yerushalayim',
    hebrewName: 'יום ירושלים',
    type: 'national',
    relevantBusinessTypes: ['marketing', 'branding'],
    contentIdeas: [
      'תוכן על ירושלים — השראה, שורשים',
      'גאווה ואחדות — "לב העם"',
    ],
    dates: {
      2025: [5, 28], 2026: [5, 18], 2027: [6, 7], 2028: [5, 25],
      2029: [5, 15], 2030: [6, 3], 2031: [5, 22], 2032: [5, 12],
      2033: [5, 30], 2034: [5, 19], 2035: [6, 8],
    },
  },
  // ── שבועות ──
  {
    name: 'Shavuot',
    hebrewName: 'שבועות',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'food', 'retail', 'services'],
    contentIdeas: [
      'חג מתן תורה — ערך של ידע ולמידה',
      'תוכן חלבי / קולינרי — "הצ׳יזקייק שלנו"',
      'חגיגה לבנה — אווירה נקייה ורעננה',
      'פוסט קציר — "הפירות של העבודה שלנו"',
    ],
    dates: {
      2025: [6, 1], 2026: [5, 21], 2027: [6, 10], 2028: [5, 29],
      2029: [5, 19], 2030: [6, 6], 2031: [5, 27], 2032: [5, 15],
      2033: [6, 2], 2034: [5, 23], 2035: [6, 11],
    },
  },
  // ── צום י״ז בתמוז ──
  {
    name: 'Seventeenth of Tammuz',
    hebrewName: 'צום י״ז בתמוז',
    type: 'religious',
    relevantBusinessTypes: ['marketing'],
    contentIdeas: [
      'תוכן מחשבתי — ימים של כוונה',
    ],
    dates: {
      2025: [7, 13], 2026: [7, 2], 2027: [7, 22], 2028: [7, 11],
      2029: [7, 1], 2030: [7, 18], 2031: [7, 8], 2032: [6, 27],
      2033: [7, 14], 2034: [7, 4], 2035: [7, 24],
    },
  },
  // ── תשעה באב ──
  {
    name: 'Tisha BAv',
    hebrewName: 'תשעה באב',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding'],
    contentIdeas: [
      'יום אבל ותקומה — מסר מכבד',
      'הפסקת פרסום או הנמכת טון',
      'תוכן על תקווה ובנייה מחדש',
    ],
    dates: {
      2025: [8, 3], 2026: [7, 23], 2027: [8, 12], 2028: [8, 1],
      2029: [7, 22], 2030: [8, 8], 2031: [7, 29], 2032: [7, 18],
      2033: [8, 4], 2034: [7, 25], 2035: [8, 14],
    },
  },
  // ── ט״ו באב ──
  {
    name: 'Tu BAv',
    hebrewName: 'ט״ו באב',
    type: 'religious',
    relevantBusinessTypes: ['marketing', 'branding', 'ecommerce', 'retail', 'services'],
    contentIdeas: [
      'חג האהבה הישראלי — "אנחנו אוהבים את הלקוחות שלנו"',
      'מבצע רומנטי / זוגי',
      'תוכן לבבי — הכרת תודה',
    ],
    dates: {
      2025: [8, 8], 2026: [7, 28], 2027: [8, 17], 2028: [8, 6],
      2029: [7, 27], 2030: [8, 13], 2031: [8, 3], 2032: [7, 23],
      2033: [8, 9], 2034: [7, 30], 2035: [8, 19],
    },
  },

  // ══════════════════════════════════════════
  //  NATIONAL / MEMORIAL DAYS
  // ══════════════════════════════════════════

  // ── יום הרצל ──
  {
    name: 'Herzl Day',
    hebrewName: 'יום הרצל',
    type: 'national',
    relevantBusinessTypes: ['marketing'],
    contentIdeas: [
      'חזון ויזמות — "אם תרצו אין זו אגדה"',
      'מנהיגות וחדשנות',
    ],
    dates: {
      2025: [7, 16], 2026: [7, 5], 2027: [7, 25], 2028: [7, 14],
      2029: [7, 4], 2030: [7, 21], 2031: [7, 11], 2032: [6, 30],
      2033: [7, 17], 2034: [7, 7], 2035: [7, 27],
    },
  },
  // ── יום רבין ──
  {
    name: 'Yitzhak Rabin Memorial Day',
    hebrewName: 'יום הזיכרון ליצחק רבין',
    type: 'memorial',
    relevantBusinessTypes: ['marketing'],
    contentIdeas: [
      'מסר שלום ואחדות',
      'ערכי דמוקרטיה ודו-שיח',
    ],
    dates: {
      2025: [11, 5], 2026: [10, 25], 2027: [11, 13], 2028: [11, 2],
      2029: [10, 22], 2030: [11, 9], 2031: [10, 30], 2032: [10, 18],
      2033: [11, 6], 2034: [10, 26], 2035: [11, 15],
    },
  },

  // ══════════════════════════════════════════
  //  COMMERCIAL / SEASONAL
  // ══════════════════════════════════════════

  // ── ולנטיין / יום האהבה הבינלאומי ──
  {
    name: 'Valentines Day',
    hebrewName: 'יום האהבה (ולנטיין)',
    type: 'commercial',
    relevantBusinessTypes: ['marketing', 'branding', 'ecommerce', 'food', 'retail', 'services'],
    contentIdeas: [
      'מבצע ולנטיין — מתנות לזוג',
      'אהבה ללקוחות — "אנחנו אוהבים אתכם"',
      'תוכן רומנטי / לבבי',
    ],
    // Fixed date every year
    dates: {
      2025: [2, 14], 2026: [2, 14], 2027: [2, 14], 2028: [2, 14],
      2029: [2, 14], 2030: [2, 14], 2031: [2, 14], 2032: [2, 14],
      2033: [2, 14], 2034: [2, 14], 2035: [2, 14],
    },
  },
  // ── יום המשפחה (ישראל) ──
  {
    name: 'Family Day',
    hebrewName: 'יום המשפחה',
    type: 'national',
    relevantBusinessTypes: ['marketing', 'branding', 'services', 'retail'],
    contentIdeas: [
      'משפחה היא הכל — פוסט צוות / ערכי חברה',
      'מבצע משפחתי',
      'הכרת תודה למשפחה',
    ],
    // 30 Shvat — variable
    dates: {
      2025: [2, 27], 2026: [2, 16], 2027: [2, 5], 2028: [2, 24],
      2029: [2, 13], 2030: [2, 3], 2031: [2, 20], 2032: [2, 10],
      2033: [1, 30], 2034: [2, 17], 2035: [2, 6],
    },
  },
  // ── יום האישה הבינלאומי ──
  {
    name: 'International Womens Day',
    hebrewName: 'יום האישה הבינלאומי',
    type: 'commercial',
    relevantBusinessTypes: ['marketing', 'branding', 'services', 'retail'],
    contentIdeas: [
      'נשים חזקות בעסק שלנו — סיפור אישי',
      'מבצע לנשים — הנחה / מתנה',
      'השראה — נשים שמובילות',
    ],
    dates: {
      2025: [3, 8], 2026: [3, 8], 2027: [3, 8], 2028: [3, 8],
      2029: [3, 8], 2030: [3, 8], 2031: [3, 8], 2032: [3, 8],
      2033: [3, 8], 2034: [3, 8], 2035: [3, 8],
    },
  },
  // ── יום כדור הארץ ──
  {
    name: 'Earth Day',
    hebrewName: 'יום כדור הארץ',
    type: 'commercial',
    relevantBusinessTypes: ['marketing', 'branding', 'services'],
    contentIdeas: [
      'אחריות סביבתית — מה אנחנו עושים',
      'תוכן ירוק — שמירה על הסביבה',
    ],
    dates: {
      2025: [4, 22], 2026: [4, 22], 2027: [4, 22], 2028: [4, 22],
      2029: [4, 22], 2030: [4, 22], 2031: [4, 22], 2032: [4, 22],
      2033: [4, 22], 2034: [4, 22], 2035: [4, 22],
    },
  },
  // ── חופש גדול ──
  {
    name: 'Summer Break',
    hebrewName: 'חופש גדול',
    type: 'seasonal',
    relevantBusinessTypes: ['marketing', 'branding', 'websites', 'hosting', 'ecommerce', 'food', 'retail', 'services'],
    contentIdeas: [
      'קמפיין קיץ — אווירה, שמש, חוף',
      'מבצעי חופש — "הקיץ הגיע!"',
      'תוכן משפחתי — טיולים וחוויות',
      'מבצעי סוף עונה',
    ],
    dates: {
      2025: [7, 1], 2026: [7, 1], 2027: [7, 1], 2028: [7, 1],
      2029: [7, 1], 2030: [7, 1], 2031: [7, 1], 2032: [7, 1],
      2033: [7, 1], 2034: [7, 1], 2035: [7, 1],
    },
  },
  // ── חזרה ללימודים ──
  {
    name: 'Back to School',
    hebrewName: 'חזרה ללימודים',
    type: 'commercial',
    relevantBusinessTypes: ['marketing', 'branding', 'websites', 'ecommerce', 'retail', 'services'],
    contentIdeas: [
      'מבצעי חזרה ללימודים — ציוד, מוצרים',
      'התחלה חדשה — "גם אנחנו מתחילים שנה חדשה"',
      'סדר וארגון — טיפים רלוונטיים לעסק',
    ],
    dates: {
      2025: [9, 1], 2026: [9, 1], 2027: [9, 1], 2028: [9, 1],
      2029: [9, 1], 2030: [9, 1], 2031: [9, 1], 2032: [9, 1],
      2033: [9, 1], 2034: [9, 1], 2035: [9, 1],
    },
  },
  // ── בלאק פריידיי ──
  {
    name: 'Black Friday',
    hebrewName: 'בלאק פריידיי',
    type: 'commercial',
    relevantBusinessTypes: ['marketing', 'websites', 'hosting', 'ecommerce', 'retail', 'services'],
    contentIdeas: [
      'מבצעי סוף שנה — הנחות מיוחדות',
      'קמפיין מכירות — "הכי שווה בשנה"',
      'ספירה לאחור למבצע',
    ],
    // Last Friday of November
    dates: {
      2025: [11, 28], 2026: [11, 27], 2027: [11, 26], 2028: [11, 24],
      2029: [11, 23], 2030: [11, 29], 2031: [11, 28], 2032: [11, 26],
      2033: [11, 25], 2034: [11, 24], 2035: [11, 30],
    },
  },
  // ── סייבר מאנדיי ──
  {
    name: 'Cyber Monday',
    hebrewName: 'סייבר מאנדיי',
    type: 'commercial',
    relevantBusinessTypes: ['marketing', 'websites', 'hosting', 'ecommerce', 'retail'],
    contentIdeas: [
      'מבצעי אונליין — "היום באינטרנט"',
      'הנחות דיגיטליות',
    ],
    dates: {
      2025: [12, 1], 2026: [11, 30], 2027: [11, 29], 2028: [11, 27],
      2029: [11, 26], 2030: [12, 2], 2031: [12, 1], 2032: [11, 29],
      2033: [11, 28], 2034: [11, 27], 2035: [12, 2],
    },
  },
  // ── יום העולה ──
  {
    name: 'Aliyah Day',
    hebrewName: 'יום העלייה',
    type: 'national',
    relevantBusinessTypes: ['marketing'],
    contentIdeas: [
      'סיפורי עלייה — גיוון ושילוב',
      'תוכן על התחלות חדשות',
    ],
    // 7 Cheshvan
    dates: {
      2025: [11, 9], 2026: [10, 29], 2027: [11, 17], 2028: [11, 6],
      2029: [10, 26], 2030: [11, 13], 2031: [11, 3], 2032: [10, 22],
      2033: [11, 10], 2034: [10, 30], 2035: [11, 19],
    },
  },
  // ── סילבסטר / ראש השנה האזרחי ──
  {
    name: 'New Years Eve',
    hebrewName: 'סילבסטר',
    type: 'commercial',
    relevantBusinessTypes: ['marketing', 'branding', 'ecommerce', 'food', 'retail', 'services'],
    contentIdeas: [
      'סיכום שנה אזרחי — מבט לאחור',
      'יעדים לשנה החדשה',
      'מבצעי סוף שנה',
    ],
    dates: {
      2025: [12, 31], 2026: [12, 31], 2027: [12, 31], 2028: [12, 31],
      2029: [12, 31], 2030: [12, 31], 2031: [12, 31], 2032: [12, 31],
      2033: [12, 31], 2034: [12, 31], 2035: [12, 31],
    },
  },
  // ── יום העבודה הבינלאומי ──
  {
    name: 'International Workers Day',
    hebrewName: 'יום העבודה',
    type: 'commercial',
    relevantBusinessTypes: ['marketing', 'branding', 'services'],
    contentIdeas: [
      'הוקרה לצוות — "הצוות שעושה את זה"',
      'תוכן על ערך העבודה',
    ],
    dates: {
      2025: [5, 1], 2026: [5, 1], 2027: [5, 1], 2028: [5, 1],
      2029: [5, 1], 2030: [5, 1], 2031: [5, 1], 2032: [5, 1],
      2033: [5, 1], 2034: [5, 1], 2035: [5, 1],
    },
  },
];

// ── Flat list for backward compatibility (uses current year or fallback) ──

function resolveForYear(entry: HolidayDateEntry, year: number): IsraeliHoliday | null {
  const dateInfo = entry.dates[year];
  if (!dateInfo) return null;
  return {
    name: entry.name,
    hebrewName: entry.hebrewName,
    month: dateInfo[0],
    approximateDay: dateInfo[1],
    type: entry.type,
    relevantBusinessTypes: entry.relevantBusinessTypes,
    contentIdeas: entry.contentIdeas,
  };
}

/**
 * Get all holidays for a specific Gregorian month and year.
 * If year is omitted, uses the current year.
 */
export function getHolidaysForMonth(month: number, year?: number): IsraeliHoliday[] {
  const y = year ?? new Date().getFullYear();
  const results: IsraeliHoliday[] = [];
  for (const entry of HOLIDAY_DATABASE) {
    const resolved = resolveForYear(entry, y);
    if (resolved && resolved.month === month) {
      results.push(resolved);
    }
  }
  // Sort by day within the month
  results.sort((a, b) => a.approximateDay - b.approximateDay);
  return results;
}

/**
 * Get holidays relevant to a specific business type for a given month/year.
 */
export function getRelevantHolidays(
  month: number,
  clientType: string,
  year?: number
): IsraeliHoliday[] {
  const all = getHolidaysForMonth(month, year);
  return all.filter((h) => h.relevantBusinessTypes.includes(clientType));
}

/**
 * Get ALL holidays for a given year, sorted chronologically.
 */
export function getAllHolidaysForYear(year: number): IsraeliHoliday[] {
  const results: IsraeliHoliday[] = [];
  for (const entry of HOLIDAY_DATABASE) {
    const resolved = resolveForYear(entry, year);
    if (resolved) {
      results.push(resolved);
    }
  }
  results.sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return a.approximateDay - b.approximateDay;
  });
  return results;
}

// Legacy flat export (uses approximate dates for backward compat)
export const ISRAELI_HOLIDAYS: IsraeliHoliday[] = getAllHolidaysForYear(new Date().getFullYear());
