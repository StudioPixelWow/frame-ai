// מנוע E-E-A-T — בניית סמכות ואמינות
// E-E-A-T Authority Builder Engine

import { generateWithAI } from '@/lib/ai/openai-client';

// ============================================================================
// ממשקים — Interfaces
// ============================================================================

export interface EEATAudit {
  experience: { score: number; signals: string[]; gaps: string[]; actions: string[] };
  expertise: { score: number; signals: string[]; gaps: string[]; actions: string[] };
  authoritativeness: { score: number; signals: string[]; gaps: string[]; actions: string[] };
  trustworthiness: { score: number; signals: string[]; gaps: string[]; actions: string[] };
  overallScore: number;
  priority: string[];
  analyzedAt: string;
}

export interface AuthorData {
  name: string;
  expertise: string[];
  credentials: string[];
  bio?: string;
  socialProfiles?: Record<string, string>;
  publications?: string[];
}

export interface BusinessData {
  name: string;
  history: string;
  team: Array<{ name: string; role: string; credentials: string[] }>;
  credentials: string[];
  awards?: string[];
  certifications?: string[];
  mediaAppearances?: string[];
}

export interface TrustSignals {
  ssl: boolean;
  privacyPolicy: boolean;
  termsOfService: boolean;
  contactPage: boolean;
  aboutPage: boolean;
  physicalAddress: boolean;
  phoneNumber: boolean;
  authorPages: boolean;
  testimonials: boolean;
  certifications: boolean;
}

export interface TopicalAuthorityMap {
  niche: string;
  coveredTopics: string[];
  missingTopics: string[];
  clusterSuggestions: Array<{
    pillar: string;
    subtopics: string[];
    priority: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  competitiveGaps: string[];
}

// ============================================================================
// ביקורת E-E-A-T — E-E-A-T Audit
// ============================================================================

export async function auditEEAT(
  websiteUrl: string,
  websiteFacts: Record<string, unknown>
): Promise<{ audit: EEATAudit | null; error?: string }> {
  const systemPrompt = `אתה מומחה SEO בכיר המתמחה בניתוח E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness).
נתח את האתר ותן ציונים 0-100 לכל עמוד, איתותים קיימים, פערים, ופעולות מומלצות.
החזר JSON בפורמט:
{
  "experience": { "score": number, "signals": string[], "gaps": string[], "actions": string[] },
  "expertise": { "score": number, "signals": string[], "gaps": string[], "actions": string[] },
  "authoritativeness": { "score": number, "signals": string[], "gaps": string[], "actions": string[] },
  "trustworthiness": { "score": number, "signals": string[], "gaps": string[], "actions": string[] },
  "overallScore": number,
  "priority": string[]
}
כל הטקסט בעברית.`;

  const userPrompt = `כתובת האתר: ${websiteUrl}
עובדות על האתר:
${JSON.stringify(websiteFacts, null, 2)}

בצע ניתוח E-E-A-T מקיף.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.4, maxTokens: 2000 });
    if (!result.success || !result.data) {
      return { audit: null, error: result.error || 'שגיאה בניתוח E-E-A-T' };
    }

    const content = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { audit: null, error: 'לא התקבל פורמט JSON תקין מה-AI' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const audit: EEATAudit = {
      ...parsed,
      analyzedAt: new Date().toISOString(),
    };

    return { audit };
  } catch (error) {
    return { audit: null, error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// ביוגרפיית מחבר — Author Bio
// ============================================================================

export async function generateAuthorBio(
  authorName: string,
  expertise: string[],
  credentials: string[]
): Promise<{ bio: string; error?: string }> {
  const systemPrompt = `אתה כותב ביוגרפיות מחברים מותאמות SEO.
הביוגרפיה צריכה:
- להיות בעברית
- לכלול אותות E-E-A-T (ניסיון, מומחיות, סמכות, אמינות)
- להיות באורך 100-200 מילים
- לכלול מילות מפתח טבעיות
- להדגיש את ההסמכות והניסיון
- להתאים ל-schema markup של Person`;

  const userPrompt = `שם: ${authorName}
תחומי מומחיות: ${expertise.join(', ')}
הסמכות ותעודות: ${credentials.join(', ')}

כתוב ביוגרפיה מותאמת E-E-A-T.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.6, maxTokens: 500 });
    if (!result.success || !result.data) {
      return { bio: '', error: result.error || 'שגיאה ביצירת ביוגרפיה' };
    }
    return { bio: result.data as string };
  } catch (error) {
    return { bio: '', error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// דף אודות — About Page
// ============================================================================

export async function generateAboutPage(
  businessName: string,
  history: string,
  team: Array<{ name: string; role: string; credentials: string[] }>,
  credentials: string[]
): Promise<{ content: string; error?: string }> {
  const systemPrompt = `אתה כותב דפי "אודות" שמותאמים ל-E-E-A-T של Google.
הדף צריך לכלול:
- סיפור העסק (Experience)
- מומחיות הצוות (Expertise)
- הישגים ופרסים (Authoritativeness)
- הסמכות ואישורים (Trustworthiness)
- HTML סמנטי עם כותרות h2/h3
- אורך 400-600 מילים
כתוב בעברית.`;

  const userPrompt = `שם העסק: ${businessName}
היסטוריה: ${history}
צוות:
${team.map(t => `- ${t.name} (${t.role}): ${t.credentials.join(', ')}`).join('\n')}
הסמכות ותעודות: ${credentials.join(', ')}

צור דף אודות מותאם E-E-A-T.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.6, maxTokens: 1500 });
    if (!result.success || !result.data) {
      return { content: '', error: result.error || 'שגיאה ביצירת דף אודות' };
    }
    return { content: result.data as string };
  } catch (error) {
    return { content: '', error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// Schema Markup — Person
// ============================================================================

export function generateSchemaAuthor(author: AuthorData): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    description: author.bio || '',
    knowsAbout: author.expertise,
    hasCredential: author.credentials.map(c => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: c,
    })),
  };

  if (author.socialProfiles) {
    schema.sameAs = Object.values(author.socialProfiles);
  }

  if (author.publications && author.publications.length > 0) {
    schema.author = author.publications.map(p => ({
      '@type': 'Article',
      name: p,
    }));
  }

  return schema;
}

// ============================================================================
// Schema Markup — Organization
// ============================================================================

export function generateSchemaOrganization(business: BusinessData): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: business.name,
    description: business.history,
    foundingDate: '',
    employee: business.team.map(member => ({
      '@type': 'Person',
      name: member.name,
      jobTitle: member.role,
      hasCredential: member.credentials.map(c => ({
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: c,
      })),
    })),
  };

  if (business.awards && business.awards.length > 0) {
    schema.award = business.awards;
  }

  if (business.certifications && business.certifications.length > 0) {
    schema.hasCredential = business.certifications.map(c => ({
      '@type': 'EducationalOccupationalCredential',
      credentialCategory: c,
    }));
  }

  return schema;
}

// ============================================================================
// בדיקת אותות אמינות — Trust Signals Check
// ============================================================================

export async function checkTrustSignals(url: string): Promise<{ signals: TrustSignals; score: number; error?: string }> {
  const signals: TrustSignals = {
    ssl: false,
    privacyPolicy: false,
    termsOfService: false,
    contactPage: false,
    aboutPage: false,
    physicalAddress: false,
    phoneNumber: false,
    authorPages: false,
    testimonials: false,
    certifications: false,
  };

  try {
    // Check SSL
    signals.ssl = url.startsWith('https://');

    // Fetch main page and check for common trust signals
    const response = await fetch(url, {
      headers: { 'User-Agent': 'PixelSEO-TrustChecker/1.0' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return { signals, score: signals.ssl ? 10 : 0, error: `האתר החזיר שגיאה: ${response.status}` };
    }

    const html = await response.text();
    const htmlLower = html.toLowerCase();

    // Check for common pages
    signals.privacyPolicy = htmlLower.includes('privacy') || htmlLower.includes('פרטיות') || htmlLower.includes('מדיניות');
    signals.termsOfService = htmlLower.includes('terms') || htmlLower.includes('תנאי שימוש') || htmlLower.includes('תקנון');
    signals.contactPage = htmlLower.includes('contact') || htmlLower.includes('צור קשר') || htmlLower.includes('יצירת קשר');
    signals.aboutPage = htmlLower.includes('about') || htmlLower.includes('אודות') || htmlLower.includes('מי אנחנו');
    signals.physicalAddress = /\d{7}/.test(html) || htmlLower.includes('address') || htmlLower.includes('כתובת');
    signals.phoneNumber = /0[2-9]\d{7,8}|(\+972)/.test(html);
    signals.testimonials = htmlLower.includes('testimonial') || htmlLower.includes('המלצות') || htmlLower.includes('חוות דעת');
    signals.certifications = htmlLower.includes('certified') || htmlLower.includes('הסמכה') || htmlLower.includes('תעודה');

    // Calculate score
    const totalSignals = Object.values(signals).filter(Boolean).length;
    const score = Math.round((totalSignals / Object.keys(signals).length) * 100);

    return { signals, score };
  } catch (error) {
    return { signals, score: 0, error: `שגיאה בבדיקת אותות אמינות: ${(error as Error).message}` };
  }
}

// ============================================================================
// תוכן הסמכות — Credential Content
// ============================================================================

export async function generateCredentialContent(
  clientId: string,
  businessName: string,
  niche: string
): Promise<{ content: { caseStudies: string[]; testimonialTemplates: string[]; certificationHighlights: string[] }; error?: string }> {
  const systemPrompt = `אתה מומחה שיווק דיגיטלי שיוצר תוכן אמינות (credibility content).
צור תוכן שמחזק את ה-E-E-A-T:
1. רעיונות ל-3 מקרי בוחן (case studies) — כותרת + מבנה
2. 3 תבניות לבקשת המלצות מלקוחות
3. 3 דרכים להדגשת הסמכות ותעודות
החזר JSON:
{
  "caseStudies": ["...", "...", "..."],
  "testimonialTemplates": ["...", "...", "..."],
  "certificationHighlights": ["...", "...", "..."]
}
כתוב בעברית.`;

  const userPrompt = `עסק: ${businessName}
תחום: ${niche}
מזהה לקוח: ${clientId}

צור תוכן הסמכות.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 1500 });
    if (!result.success || !result.data) {
      return { content: { caseStudies: [], testimonialTemplates: [], certificationHighlights: [] }, error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { content: { caseStudies: [], testimonialTemplates: [], certificationHighlights: [] }, error: 'פורמט לא תקין' };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return { content: parsed };
  } catch (error) {
    return { content: { caseStudies: [], testimonialTemplates: [], certificationHighlights: [] }, error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// הצעות תוכן מומחה — Expert Content Suggestions
// ============================================================================

export async function suggestExpertContent(
  niche: string,
  existingContent: string[]
): Promise<{ suggestions: Array<{ title: string; angle: string; eeatSignals: string[] }>; error?: string }> {
  const systemPrompt = `אתה אסטרטג תוכן SEO. הצע נושאי תוכן ברמת מומחה שמחזקים E-E-A-T.
כל הצעה צריכה:
- להיות ייחודית (לא לחזור על תוכן קיים)
- להראות מומחיות אמיתית
- לכלול אותות E-E-A-T ספציפיים
החזר JSON:
{
  "suggestions": [
    { "title": "...", "angle": "...", "eeatSignals": ["..."] }
  ]
}
כתוב בעברית. הצע 5-7 נושאים.`;

  const userPrompt = `נישה: ${niche}
תוכן קיים: ${existingContent.join(', ')}

הצע נושאי תוכן מומחה.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 1500 });
    if (!result.success || !result.data) {
      return { suggestions: [], error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { suggestions: [], error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    return { suggestions: parsed.suggestions || [] };
  } catch (error) {
    return { suggestions: [], error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// מפת סמכות נושאית — Topical Authority Map
// ============================================================================

export async function buildTopicalAuthority(
  niche: string,
  existingPages: string[]
): Promise<{ map: TopicalAuthorityMap | null; error?: string }> {
  const systemPrompt = `אתה מומחה SEO שמתמחה בבניית סמכות נושאית (Topical Authority).
נתח את הנישה ומפה אילו נושאים כבר מכוסים ואילו חסרים.
הצע אשכולות תוכן (clusters) שיבנו סמכות.
החזר JSON:
{
  "niche": "...",
  "coveredTopics": ["..."],
  "missingTopics": ["..."],
  "clusterSuggestions": [
    { "pillar": "...", "subtopics": ["..."], "priority": "high|medium|low", "reason": "..." }
  ],
  "competitiveGaps": ["..."]
}
כתוב בעברית.`;

  const userPrompt = `נישה: ${niche}
דפים קיימים: ${existingPages.join(', ')}

בנה מפת סמכות נושאית.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.5, maxTokens: 2000 });
    if (!result.success || !result.data) {
      return { map: null, error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { map: null, error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    return { map: parsed };
  } catch (error) {
    return { map: null, error: `שגיאה: ${(error as Error).message}` };
  }
}

// ============================================================================
// דף שאלות נפוצות — FAQ Page with Schema
// ============================================================================

export async function generateFAQPage(
  niche: string,
  questions?: string[]
): Promise<{ html: string; schema: Record<string, unknown>; error?: string }> {
  const systemPrompt = `אתה מומחה SEO שיוצר דפי FAQ מותאמי E-E-A-T.
צור דף שאלות נפוצות עם:
- 8-12 שאלות רלוונטיות
- תשובות מפורטות שמראות מומחיות
- HTML סמנטי
- FAQPage Schema markup
החזר JSON:
{
  "questions": [{ "question": "...", "answer": "..." }]
}
כתוב בעברית.`;

  const userPrompt = `נישה: ${niche}
${questions ? `שאלות ספציפיות לכלול: ${questions.join(', ')}` : 'צור שאלות רלוונטיות לנישה.'}

צור דף FAQ.`;

  try {
    const result = await generateWithAI(systemPrompt, userPrompt, { temperature: 0.6, maxTokens: 2000 });
    if (!result.success || !result.data) {
      return { html: '', schema: {}, error: result.error || 'שגיאה' };
    }

    const raw = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { html: '', schema: {}, error: 'פורמט לא תקין' };

    const parsed = JSON.parse(jsonMatch[0]);
    const faqs: Array<{ question: string; answer: string }> = parsed.questions || [];

    // Generate HTML
    const html = `<section class="faq-page">
  <h1>שאלות נפוצות</h1>
${faqs.map(faq => `  <div class="faq-item" itemscope itemprop="mainEntity" itemtype="https://schema.org/Question">
    <h2 itemprop="name">${faq.question}</h2>
    <div itemscope itemprop="acceptedAnswer" itemtype="https://schema.org/Answer">
      <p itemprop="text">${faq.answer}</p>
    </div>
  </div>`).join('\n')}
</section>`;

    // Generate Schema
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(faq => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.answer,
        },
      })),
    };

    return { html, schema };
  } catch (error) {
    return { html: '', schema: {}, error: `שגיאה: ${(error as Error).message}` };
  }
}
