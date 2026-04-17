/**
 * POST /api/data/ugc/generate-script
 *
 * Generates a Hebrew UGC video script using OpenAI, based on:
 *   - Creative prompt (free text)
 *   - Script template (sales, brand, promo, launch, testimonial)
 *   - Structured inputs (brand, offer, audience, etc.)
 *   - Reference file content (extracted text from uploaded files)
 *   - Client knowledge & research context (auto-loaded from DB)
 *
 * Modes:
 *   - Single: Returns { script: string }
 *   - Multi-version (multiVersion: true): Returns { versions: string[] } with 3 distinct scripts
 *
 * This route is used ONLY for script generation.
 * The generated script is then used in the HeyGen video generation flow
 * via /api/data/heygen/generate (which receives the final edited script).
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateWithAI, getClientKnowledgeContext, getClientResearchContext } from '@/lib/ai/openai-client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      // Core creative prompt
      creativePrompt,
      // Script template
      scriptTemplate,
      // Structured inputs
      brandName,
      mainOffer,
      targetAudience,
      keyMessage,
      callToAction,
      visualStyleNotes,
      additionalInstructions,
      // Reference text extracted from uploaded files
      referenceTexts,
      // Client context
      clientId,
      clientName,
      // Multi-version mode
      multiVersion,
    } = body as {
      creativePrompt?: string;
      scriptTemplate?: string;
      brandName?: string;
      mainOffer?: string;
      targetAudience?: string;
      keyMessage?: string;
      callToAction?: string;
      visualStyleNotes?: string;
      additionalInstructions?: string;
      referenceTexts?: string[];
      clientId?: string;
      clientName?: string;
      multiVersion?: boolean;
    };

    // Validate — at least one meaningful input must exist
    const hasPrompt = creativePrompt && creativePrompt.trim().length > 0;
    const hasStructured = [brandName, mainOffer, targetAudience, keyMessage, callToAction].some(
      (v) => v && v.trim().length > 0
    );
    const hasReferences = referenceTexts && referenceTexts.some((t) => t.trim().length > 0);

    if (!hasPrompt && !hasStructured && !hasReferences) {
      return NextResponse.json(
        { error: 'יש להזין פרומפט יצירתי, למלא שדות מובנים, או לצרף קבצי התייחסות' },
        { status: 400 }
      );
    }

    // ── Build client context from DB ──
    let clientContext = '';
    if (clientId) {
      try {
        const knowledge = getClientKnowledgeContext(clientId);
        const research = getClientResearchContext(clientId);
        if (knowledge) clientContext += knowledge + '\n';
        if (research) clientContext += research + '\n';
      } catch (e) {
        console.warn('[ugc/generate-script] Failed to load client context:', e);
      }
    }

    // ── Template-specific instructions ──
    const TEMPLATE_INSTRUCTIONS: Record<string, string> = {
      sales: `סוג התסריט: מכירות / Direct Response
- מבנה: התחל בהצגת בעיה או כאב ברור שקהל היעד חווה, ואז הצג את הפתרון (המוצר/שירות) כתשובה ישירה.
- טון: משכנע, ישיר, בטוח — כמו חבר שממליץ אחרי שניסה בעצמו. לא אגרסיבי אבל ממוקד בתוצאה.
- חובה: כלול לפחות יתרון מספרי אחד או תוצאה מדידה (למשל: "תוך שבוע", "חסכתי 50%").
- סיום: קריאה לפעולה חדה ודחופה — מה בדיוק הצופה צריך לעשות עכשיו.
- אורך: 5-7 משפטים. מהיר וממוקד.`,

      brand: `סוג התסריט: מיתוג / תדמית
- מבנה: פתח עם אמירה רגשית או תובנה על ערך המותג, בנה חיבור רגשי, סיים עם הצהרת מותג חזקה.
- טון: חם, אמין, ומעורר השראה. לא מוכר ישירות — יוצר תחושת שייכות וערך.
- חובה: שזור את שם המותג באופן טבעי, הדגש ערכים, חזון, או סיפור מותג (לא מחיר/מבצע).
- סיום: אמירת חתימה שמותירה רושם — לא CTA מכירתי, אלא הצהרה שנשארת בראש.
- אורך: 4-6 משפטים. מדוד ואיכותי.`,

      promo: `סוג התסריט: מבצע / הטבה
- מבנה: פתח ישר עם ההטבה (מבצע, הנחה, מתנה), הסבר למה זה שווה, צור דחיפות לפעולה מיידית.
- טון: אנרגטי, נלהב אבל אמין. תחושת "אסור לפספס" — בלי להישמע שקרי.
- חובה: הזכר את ההטבה הקונקרטית ואת המגבלות (זמן/כמות מוגבלים, תאריך סיום).
- סיום: CTA ישיר ודחוף עם תחושת מיידיות חזקה — "עכשיו", "רק היום", "לפני שנגמר".
- אורך: 4-6 משפטים. מהיר ומלהיב.`,

      launch: `סוג התסריט: השקה / מוצר חדש
- מבנה: בנה ציפייה עם teaser/שאלה, חשוף את המוצר החדש עם אנרגיה, הצג 2-3 יתרונות מרכזיים, סיים עם הזמנה לגלות עוד.
- טון: מלהיב, חדשני, ומלא ציפייה — כמו מישהו שגילה משהו מדהים ורץ לספר.
- חובה: השתמש במילים כמו "חדש", "סוף סוף", "לראשונה". הדגש מה ייחודי ושונה.
- סיום: הזמנה נלהבת לגלות, להצטרף, או להיות מהראשונים — לא רק "קנו עכשיו".
- אורך: 5-7 משפטים. בונה מומנטום.`,

      testimonial: `סוג התסריט: המלצה אישית / UGC Testimonial
- מבנה: פתח בהצגה עצמית קצרה ומצב ההתחלה (בעיה/צורך), ספר על הגילוי והחוויה עם המוצר, סיים בתוצאה אמיתית והמלצה.
- טון: אותנטי, אישי, ספונטני — כמו סטורי של חבר/ה שמספר/ת. לא מלוטש מדי. בגוף ראשון ("אני").
- חובה: כתוב בגוף ראשון יחיד. כלול פרט אישי אחד לפחות שיוצר אמינות. תאר תוצאה קונקרטית.
- סיום: המלצה אישית חמה — "אני ממליצ/ה", "שווה לנסות" — ולא קריאה לפעולה שיווקית.
- אורך: 5-8 משפטים. חם ואמיתי.`,
    };

    const templateInstruction = scriptTemplate && TEMPLATE_INSTRUCTIONS[scriptTemplate]
      ? TEMPLATE_INSTRUCTIONS[scriptTemplate]
      : '';

    // ── Build system prompt ──
    let systemPrompt = `אתה קופירייטר ישראלי מומחה ליצירת תסריטים לסרטוני UGC (User Generated Content).
תפקידך לכתוב תסריט קצר, ממוקד ומשכנע לסרטון UGC בעברית.

כללים:
- הפלט חייב להיות בעברית בלבד.
- כתוב טקסט שנשמע טבעי כשנאמר בקול רם על ידי אדם (לא שפה כתובה/רשמית).
- התסריט צריך להיות בין 3-8 משפטים (30-120 מילים), מתאים לסרטון של 30-90 שניות.
- התחל עם hook חזק שתופס תשומת לב מיידית.
- סיים עם קריאה לפעולה ברורה (CTA) אם צוינה.
- התאם את הטון, הסגנון והשפה לפי ההנחיות שקיבלת.
- אל תוסיף הנחיות במה, תגי זמן, תיאורי צילום, או הוראות שאינן טקסט נאמר.
- אל תוסיף סימני פיסוק מיוחדים כמו [, ], *, #.
- החזר רק את הטקסט הסופי שהאווטאר יגיד, ללא כותרת, הסבר, או מטא-דאטה.`;

    // Append template-specific instructions to the system prompt
    if (templateInstruction) {
      systemPrompt += `\n\n--- הנחיות תבנית תסריט ---\n${templateInstruction}\n\nחשוב מאוד: עקוב אחרי הנחיות התבנית לעיל. המבנה, הטון, והסגנון של התסריט חייבים לשקף את סוג התסריט שנבחר.`;
    }

    // ── Build user prompt ──
    const userParts: string[] = [];

    if (clientName) {
      userParts.push(`שם הלקוח/מותג: ${clientName}`);
    }
    if (clientContext) {
      userParts.push(`--- מידע על הלקוח מהמערכת ---\n${clientContext}`);
    }
    if (creativePrompt && creativePrompt.trim()) {
      userParts.push(`--- פרומפט יצירתי ---\n${creativePrompt.trim()}`);
    }

    // Script template label in user prompt (reinforces the system-level instruction)
    const TEMPLATE_LABELS: Record<string, string> = {
      sales: 'מכירות / Direct Response — ממוקד המרה, משכנע, עם תוצאה מדידה ו-CTA דחוף',
      brand: 'מיתוג / תדמית — רגשי, ערכי, בונה אמון וזהות מותג',
      promo: 'מבצע / הטבה — אנרגטי, דחוף, מדגיש הטבה קונקרטית ומגבלת זמן',
      launch: 'השקה / מוצר חדש — מלהיב, חדשני, בונה ציפייה',
      testimonial: 'המלצה אישית / UGC Testimonial — אותנטי, גוף ראשון, ספונטני',
    };
    if (scriptTemplate && TEMPLATE_LABELS[scriptTemplate]) {
      userParts.push(`--- תבנית תסריט שנבחרה ---\nסוג: ${TEMPLATE_LABELS[scriptTemplate]}\nכתוב את התסריט בהתאם לסוג התבנית הזו. הטון, המבנה והסגנון חייבים להתאים.`);
    }

    // Structured fields
    const structured: string[] = [];
    if (brandName?.trim()) structured.push(`מותג/מוצר: ${brandName.trim()}`);
    if (mainOffer?.trim()) structured.push(`הצעת ערך/מבצע: ${mainOffer.trim()}`);
    if (targetAudience?.trim()) structured.push(`קהל יעד: ${targetAudience.trim()}`);
    if (keyMessage?.trim()) structured.push(`מסר מרכזי: ${keyMessage.trim()}`);
    if (callToAction?.trim()) structured.push(`קריאה לפעולה (CTA): ${callToAction.trim()}`);
    if (visualStyleNotes?.trim()) structured.push(`סגנון ויזואלי (להתחשב בטון): ${visualStyleNotes.trim()}`);
    if (additionalInstructions?.trim()) structured.push(`הנחיות נוספות: ${additionalInstructions.trim()}`);

    if (structured.length > 0) {
      userParts.push(`--- פרטים מובנים ---\n${structured.join('\n')}`);
    }

    // Reference file content
    if (referenceTexts && referenceTexts.length > 0) {
      const validRefs = referenceTexts.filter((t) => t.trim().length > 0);
      if (validRefs.length > 0) {
        // Limit total reference text to ~3000 chars to keep prompt reasonable
        let combinedRef = validRefs.join('\n---\n');
        if (combinedRef.length > 3000) {
          combinedRef = combinedRef.slice(0, 3000) + '\n[...נחתך עקב אורך]';
        }
        userParts.push(`--- חומר התייחסות מקבצים שצורפו ---\n${combinedRef}`);
      }
    }

    const baseUserParts = [...userParts];

    // ── Multi-version mode: generate 3 distinct variations ──
    if (multiVersion) {
      console.log('[ugc/generate-script] Multi-version mode for client:', clientName || clientId || 'unknown');

      const VERSION_ANGLES = [
        {
          label: 'רגשי / סיפורי',
          instruction: 'כתוב גרסה רגשית וסיפורית. השתמש בשפה חמה, אנושית, שנוגעת ללב. פנה לרגש הצופה — תחושת שייכות, חלום, כאב, או שאיפה. התחל עם אמירה אישית או תובנה מפתיעה.',
        },
        {
          label: 'מכירתי / ממוקד המרה',
          instruction: 'כתוב גרסה מכירתית וממוקדת המרה. השתמש בשפה ישירה, בטוחה, עם דגש על תוצאה מוחשית ותועלת ברורה. כלול מספר, עובדה, או תוצאה מדידה. סיים עם CTA חד וברור.',
        },
        {
          label: 'אותנטי / טבעי',
          instruction: 'כתוב גרסה אותנטית וטבעית בסגנון UGC אמיתי. כתוב כמו מישהו שמדבר לחבר — שפה יומיומית, לא מלוטשת מדי. תן תחושה ספונטנית, כנה, ואמינה. הימנע משפה שיווקית מלאכותית.',
        },
      ];

      const versionPromises = VERSION_ANGLES.map(({ label, instruction }) => {
        const parts = [...baseUserParts];
        parts.push(`--- זווית כתיבה לגרסה זו ---\nסגנון: ${label}\n${instruction}`);
        parts.push('\nכתוב תסריט UGC בעברית על סמך כל המידע שלעיל. החזר רק את הטקסט שהאווטאר יגיד, ללא כותרות או הסברים.');
        const prompt = parts.join('\n\n');

        return generateWithAI(systemPrompt, prompt, {
          temperature: 0.9,
          maxTokens: 1000,
        });
      });

      const results = await Promise.all(versionPromises);
      const versions: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.success && r.data) {
          let text = typeof r.data === 'string' ? r.data : JSON.stringify(r.data);
          text = text.replace(/^["'`]+|["'`]+$/g, '').trim();
          if (text && text.length >= 5) {
            versions.push(text);
          } else {
            versions.push('');
          }
        } else {
          console.error(`[ugc/generate-script] Version ${i + 1} failed:`, r.error);
          versions.push('');
        }
      }

      const validCount = versions.filter((v) => v.length > 0).length;
      if (validCount === 0) {
        return NextResponse.json(
          { error: 'כל שלוש הגרסאות נכשלו. נסה שוב או הוסף פרטים נוספים.' },
          { status: 500 }
        );
      }

      console.log(`[ugc/generate-script] Multi-version done: ${validCount}/3 succeeded`);
      return NextResponse.json({
        versions,
        labels: VERSION_ANGLES.map((v) => v.label),
      });
    }

    // ── Single version mode ──
    userParts.push(
      '\nכתוב תסריט UGC בעברית על סמך כל המידע שלעיל. החזר רק את הטקסט שהאווטאר יגיד, ללא כותרות או הסברים.'
    );

    const userPrompt = userParts.join('\n\n');

    console.log('[ugc/generate-script] Generating script for client:', clientName || clientId || 'unknown');
    console.log('[ugc/generate-script] Prompt length:', userPrompt.length, 'chars');

    const result = await generateWithAI(systemPrompt, userPrompt, {
      temperature: 0.8,
      maxTokens: 1000,
    });

    if (!result.success) {
      console.error('[ugc/generate-script] AI generation failed:', result.error);
      return NextResponse.json(
        { error: result.error || 'שגיאה ביצירת תסריט' },
        { status: 500 }
      );
    }

    // The result.data could be a string or parsed JSON — normalize to string
    let script = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);

    // Clean up: remove any wrapping quotes or markdown artifacts
    script = script.replace(/^["'`]+|["'`]+$/g, '').trim();

    if (!script || script.length < 5) {
      return NextResponse.json(
        { error: 'התסריט שנוצר ריק מדי. נסה להוסיף יותר פרטים בפרומפט או בשדות המובנים.' },
        { status: 422 }
      );
    }

    console.log('[ugc/generate-script] Script generated successfully, length:', script.length);
    return NextResponse.json({ script });
  } catch (err: any) {
    console.error('[ugc/generate-script] error:', err?.message);
    return NextResponse.json(
      { error: err?.message || 'שגיאה ביצירת תסריט' },
      { status: 500 }
    );
  }
}
