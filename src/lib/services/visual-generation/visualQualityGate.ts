/**
 * Visual Quality Gate
 *
 * After an image is generated, this service sends it to GPT-4.1 with vision
 * capabilities to validate quality against the creative strategy and brief.
 * Returns a pass/fail assessment with detailed issues and suggestions.
 *
 * If the image fails, the caller can auto-retry with corrective instructions.
 *
 * Server-side only.
 */

import type { CreativeStrategy } from './creativeDirectorService';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface QualityAssessment {
  /** Whether the image passes quality standards */
  passed: boolean;
  /** Overall quality score (0-100) */
  score: number;
  /** Specific issues found */
  issues: string[];
  /** Suggestions for improvement */
  suggestions: string[];
  /** Whether an automatic retry should be attempted */
  shouldRetry: boolean;
  /** Corrective prompt additions for retry */
  correctivePrompt: string;
  /** Brief director assessment */
  assessment: string;
}

export interface QualityGateResult {
  success: boolean;
  assessment: QualityAssessment | null;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY environment variable');
  return key;
}

// ---------------------------------------------------------------------------
// System prompt for the Quality Gate
// ---------------------------------------------------------------------------

const QUALITY_GATE_SYSTEM_PROMPT = `You are a senior Art Director reviewing an AI-generated marketing visual for quality assurance.

Your job: Evaluate the generated image against the creative strategy and brief. Be strict but fair — this image will be used in real marketing campaigns.

EVALUATION CRITERIA (check each one):
1. BRIEF ALIGNMENT — Does the image match the intended concept and message?
2. VISUAL CONCEPT — Does it execute the creative idea effectively?
3. COMMERCIAL QUALITY — Would this pass as a professional ad? Not AI-looking?
4. COMPOSITION — Is the layout balanced, with clear focal point and hierarchy?
5. BRAND COLORS — Are the brand colors present and used correctly?
6. TEXT QUALITY — If there's text, is it readable? Is Hebrew correct and not garbled?
7. LOGO — If a logo should be present, is it there and correct?
8. ASPECT RATIO — Does it match the intended format?
9. DISTORTIONS — Any visible AI artifacts, extra fingers, warped text, impossible geometry?
10. UNWANTED ELEMENTS — Any inappropriate, irrelevant, or distracting elements?

SCORING:
- 90-100: Excellent — ready for use
- 75-89: Good — minor issues, usable with awareness
- 60-74: Fair — noticeable issues, might need refinement
- Below 60: Poor — should retry

OUTPUT FORMAT — respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "passed": true/false,
  "score": 85,
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1", "suggestion 2"],
  "shouldRetry": true/false,
  "correctivePrompt": "If shouldRetry is true, this contains specific corrections to add to the prompt for the retry attempt",
  "assessment": "Brief 2-3 sentence overall assessment"
}

A score of 75+ means passed=true. Below 75 means passed=false.
If shouldRetry is true, correctivePrompt MUST contain specific, actionable corrections.`;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function runQualityGate(
  imageBase64: string,
  strategy: CreativeStrategy,
  briefSummary: string,
): Promise<QualityGateResult> {
  try {
    const apiKey = getApiKey();

    // Build the evaluation context
    const evaluationContext = buildEvaluationContext(strategy, briefSummary);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          { role: 'system', content: QUALITY_GATE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: evaluationContext },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      // Quality gate failure should not block the image — return a default pass
      console.error('[visual-quality-gate] API error:', errBody);
      return {
        success: true,
        assessment: {
          passed: true,
          score: 70,
          issues: [],
          suggestions: ['Quality gate could not run — image shown as-is'],
          shouldRetry: false,
          correctivePrompt: '',
          assessment: 'Quality gate API unavailable — image shown without validation.',
        },
      };
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    if (!content) {
      return {
        success: true,
        assessment: {
          passed: true,
          score: 70,
          issues: [],
          suggestions: [],
          shouldRetry: false,
          correctivePrompt: '',
          assessment: 'Quality gate returned empty response — image shown as-is.',
        },
      };
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        return {
          success: true,
          assessment: {
            passed: true,
            score: 70,
            issues: [],
            suggestions: [],
            shouldRetry: false,
            correctivePrompt: '',
            assessment: 'Quality gate returned invalid JSON — image shown as-is.',
          },
        };
      }
    }

    const assessment: QualityAssessment = {
      passed: parsed.passed ?? true,
      score: parsed.score ?? 70,
      issues: parsed.issues ?? [],
      suggestions: parsed.suggestions ?? [],
      shouldRetry: parsed.shouldRetry ?? false,
      correctivePrompt: parsed.correctivePrompt ?? '',
      assessment: parsed.assessment ?? '',
    };

    return { success: true, assessment };
  } catch (err) {
    // Quality gate errors should never block image display
    console.error('[visual-quality-gate] Error:', err);
    return {
      success: true,
      assessment: {
        passed: true,
        score: 70,
        issues: [],
        suggestions: [],
        shouldRetry: false,
        correctivePrompt: '',
        assessment: 'Quality gate encountered an error — image shown as-is.',
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Evaluation context builder
// ---------------------------------------------------------------------------

function buildEvaluationContext(strategy: CreativeStrategy, briefSummary: string): string {
  const parts: string[] = [];

  parts.push('Please evaluate this generated marketing visual against the following creative strategy:\n');

  parts.push('=== BRIEF SUMMARY ===');
  parts.push(briefSummary);

  parts.push('\n=== CREATIVE STRATEGY ===');
  parts.push(`Central message: ${strategy.centralMessage}`);
  parts.push(`Creative idea: ${strategy.creativeIdea}`);
  parts.push(`Composition: ${strategy.composition}`);
  parts.push(`Style: ${strategy.style}`);
  parts.push(`Mood: ${strategy.mood}`);
  parts.push(`Visual type: ${strategy.visualType}`);
  parts.push(`Color palette: ${strategy.colorPalette.join(', ')}`);
  parts.push(`Lighting: ${strategy.lighting}`);
  parts.push(`Typography style: ${strategy.typographyStyle}`);
  parts.push(`Element placement: ${strategy.elementPlacement}`);

  if (strategy.immutableElements.length) {
    parts.push(`Immutable elements (must be present): ${strategy.immutableElements.join(', ')}`);
  }

  parts.push('\n=== THE PROMPT USED ===');
  parts.push(strategy.optimizedImagePrompt);

  parts.push('\nEvaluate the image now. Be specific about any issues.');

  return parts.join('\n');
}
