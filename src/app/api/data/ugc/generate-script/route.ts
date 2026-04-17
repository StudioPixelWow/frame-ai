/**
 * POST /api/data/ugc/generate-script
 *
 * Generates a Hebrew UGC video script using OpenAI, based on:
 *   - Creative prompt (free text)
 *   - Structured inputs (brand, offer, audience, etc.)
 *   - Reference file content (extracted text from uploaded files)
 *   - Client knowledge & research context (auto-loaded from DB)
 *
 * Returns: { script: string }
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
    } = body as {
      creativePrompt?: string;
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

    // ── Build system prompt ──
    const systemPrompt = `אתה קופירייטר ישראלי מומחה ליצירת תסריטים לסרטוני UGC (User Generated Content).
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
