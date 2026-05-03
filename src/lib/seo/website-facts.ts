/**
 * SEO/GEO Website Facts Evidence Layer
 *
 * Every fact about a website must have:
 * - A value (extracted from real scan data)
 * - Confidence score (0-100)
 * - Source URL where the fact was extracted
 * - Text snippet proving the extraction
 *
 * NEVER invents data. If confidence < 50, value remains empty/placeholder.
 * All content must be in English.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface EvidenceField<T = string> {
  value: T;
  confidence: number; // 0-100
  source_url: string;
  extracted_text_snippet: string;
}

export interface WebsiteFacts {
  business_name: EvidenceField;
  business_type: EvidenceField;
  detected_industry: EvidenceField;
  detected_location: EvidenceField | null;
  main_products_or_services: EvidenceField<string[]>;
  pages_scanned: EvidenceField<number>;
  extracted_titles: EvidenceField<string[]>;
  extracted_h1: EvidenceField<string[]>;
  extracted_h2: EvidenceField<string[]>;
  detected_menu_items: EvidenceField<string[]>;
  detected_schema: EvidenceField<string[]>; // e.g. ["Restaurant", "LocalBusiness"]
  detected_contact_details: EvidenceField<{ phone?: string; email?: string; address?: string }>;
  confidence_score: number; // overall 0-100
  evidence_urls: string[];
  scan_mode: 'real' | 'simulated' | 'manual' | 'unavailable';
}

export interface BusinessProfile {
  business_name: string;
  business_type: string;
  industry: string;
  location: string;
  main_products_or_services: string[];
  target_audience: string;
  known_competitors: string[];
  notes: string;
  confirmed: boolean;
  confirmed_at: string | null;
}

// ── Industry Keywords Mapping ──────────────────────────────────────────────────

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  'restaurant': ['restaurant', 'food', 'menu', 'burger', 'pizza', 'cafe', 'dining', 'kitchen', 'chef', 'hamburger', 'diner', 'bistro', 'takeout'],
  'law_firm': ['law', 'attorney', 'lawyer', 'legal', 'litigation', 'counsel', 'attorney at law', 'esq', 'law office'],
  'real_estate': ['real estate', 'property', 'homes', 'realty', 'housing', 'apartment', 'realtor', 'listing', 'agent'],
  'ecommerce': ['shop', 'store', 'buy', 'cart', 'product', 'price', 'purchase', 'checkout', 'online store'],
  'healthcare': ['health', 'medical', 'doctor', 'clinic', 'hospital', 'dental', 'physician', 'practice', 'wellness'],
  'technology': ['tech', 'software', 'app', 'digital', 'IT', 'cloud', 'development', 'services', 'solutions'],
  'education': ['school', 'university', 'course', 'learn', 'training', 'academy', 'college', 'education', 'student'],
  'fitness': ['gym', 'fitness', 'workout', 'training', 'yoga', 'crossfit', 'personal trainer', 'sports'],
  'automotive': ['car', 'auto', 'vehicle', 'dealer', 'repair', 'garage', 'mechanic', 'service'],
  'beauty': ['salon', 'spa', 'beauty', 'hair', 'nails', 'skincare', 'makeup', 'esthetic'],
  'hospitality': ['hotel', 'resort', 'lodging', 'accommodation', 'inn', 'motel', 'bed and breakfast'],
  'nonprofit': ['nonprofit', 'charity', 'foundation', 'donation', 'volunteer', 'mission'],
};

// ── Helper: Extract text from various sources ──────────────────────────────────

function normalizeText(text: string | undefined | null): string {
  if (!text) return '';
  return String(text).trim().toLowerCase();
}

function extractContactEmail(text: string): string | undefined {
  const emailRegex = /([a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  const match = text.match(emailRegex);
  return match ? match[1] : undefined;
}

function extractPhoneNumber(text: string): string | undefined {
  const phoneRegex = /(\+?1?\s*[-.\(]?[0-9]{3}[-.\)]?\s*[0-9]{3}[-.\s]?[0-9]{4}|\+\d{1,3}\s?\d{1,14})/;
  const match = text.match(phoneRegex);
  return match ? match[1] : undefined;
}

function detectLocationFromText(text: string): string | undefined {
  // Look for common city/country patterns
  // This is basic; in production, use a proper geocoding service
  const commonLocations = ['new york', 'los angeles', 'chicago', 'london', 'paris', 'tokyo', 'sydney', 'toronto', 'mexico', 'canada', 'usa', 'uk', 'france', 'germany', 'australia', 'california', 'florida', 'texas', 'new york city', 'san francisco'];
  const lowerText = normalizeText(text);
  for (const loc of commonLocations) {
    if (lowerText.includes(loc)) {
      return loc;
    }
  }
  return undefined;
}

function detectIndustryFromText(text: string): { industry: string; confidence: number } | null {
  const lowerText = normalizeText(text);

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    const matchCount = keywords.filter(kw => lowerText.includes(kw)).length;
    if (matchCount > 0) {
      // More matches = higher confidence
      const confidence = Math.min(100, (matchCount / keywords.length) * 100 + 20);
      return { industry, confidence };
    }
  }

  return null;
}

// ── Main Extraction Function ────────────────────────────────────────────────────

export function extractWebsiteFacts(
  scanResult: any,
  scannedPages: any[],
  websiteUrl: string
): WebsiteFacts {
  const scan = scanResult || {};
  const pages = scannedPages || [];
  const allEvidence: string[] = [];

  // Add URL to evidence set
  if (websiteUrl) {
    allEvidence.push(websiteUrl);
  }

  // Extract business name from meta title or h1
  const businessNameField: EvidenceField = extractBusinessName(scan, pages, websiteUrl, allEvidence);

  // Extract business type from schema, description, and content
  const businessTypeField: EvidenceField = extractBusinessType(scan, pages, websiteUrl, allEvidence);

  // Extract industry using keyword detection
  const industryField: EvidenceField = extractIndustry(scan, pages, websiteUrl, allEvidence);

  // Extract location from contact info and description
  const locationField: EvidenceField | null = extractLocation(scan, pages, websiteUrl, allEvidence);

  // Extract products/services from h1, h2, menu items
  const productsField: EvidenceField<string[]> = extractProducts(scan, pages, websiteUrl, allEvidence);

  // Count of pages scanned
  const pageCountField: EvidenceField<number> = {
    value: pages.length,
    confidence: pages.length > 0 ? 100 : 0,
    source_url: websiteUrl,
    extracted_text_snippet: `Scanned ${pages.length} pages`,
  };

  // Extract page titles
  const titlesField: EvidenceField<string[]> = {
    value: pages
      .filter(p => p.title && normalizeText(p.title).length > 0)
      .map(p => p.title)
      .slice(0, 10),
    confidence: pages.length > 0 ? 80 : 0,
    source_url: websiteUrl,
    extracted_text_snippet: pages.length > 0 ? `Found ${pages.length} page titles` : 'No pages scanned',
  };

  // Extract H1 tags
  const h1Field: EvidenceField<string[]> = {
    value: (scan.h1Tags || []).filter((h: string) => normalizeText(h).length > 0),
    confidence: (scan.h1Tags || []).length > 0 ? 90 : 0,
    source_url: websiteUrl,
    extracted_text_snippet: (scan.h1Tags || []).length > 0 ? `Found ${(scan.h1Tags || []).length} H1 tags` : 'No H1 tags detected',
  };

  // Extract H2 tags (approximate from pages with content)
  const h2Tags = extractH2Tags(pages);
  const h2Field: EvidenceField<string[]> = {
    value: h2Tags.slice(0, 10),
    confidence: h2Tags.length > 0 ? 75 : 0,
    source_url: websiteUrl,
    extracted_text_snippet: h2Tags.length > 0 ? `Found ${h2Tags.length} H2-like headings` : 'No H2 tags detected',
  };

  // Extract menu/navigation items
  const menuField: EvidenceField<string[]> = extractMenuItems(pages, websiteUrl);

  // Detect schema types
  const schemaField: EvidenceField<string[]> = extractSchema(scan);

  // Extract contact details
  const contactField: EvidenceField<{ phone?: string; email?: string; address?: string }> = extractContactDetails(scan, pages);

  // Calculate overall confidence
  const allConfidences = [
    businessNameField.confidence,
    businessTypeField.confidence,
    industryField.confidence,
    locationField?.confidence || 0,
    productsField.confidence,
    pageCountField.confidence,
    titlesField.confidence,
    h1Field.confidence,
    h2Field.confidence,
    menuField.confidence,
    schemaField.confidence,
    contactField.confidence,
  ];
  const confidenceScore = Math.round(allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length);

  const evidenceUrls = Array.from(new Set(allEvidence)).filter(u => u && u.length > 0);

  return {
    business_name: businessNameField,
    business_type: businessTypeField,
    detected_industry: industryField,
    detected_location: locationField,
    main_products_or_services: productsField,
    pages_scanned: pageCountField,
    extracted_titles: titlesField,
    extracted_h1: h1Field,
    extracted_h2: h2Field,
    detected_menu_items: menuField,
    detected_schema: schemaField,
    detected_contact_details: contactField,
    confidence_score: confidenceScore,
    evidence_urls: evidenceUrls,
    scan_mode: 'simulated', // No real scanner yet
  };
}

// ── Individual extraction helpers ───────────────────────────────────────────────

function extractBusinessName(scan: any, pages: any[], websiteUrl: string, allEvidence: string[]): EvidenceField {
  let name = '';
  let confidence = 0;
  let snippet = '';

  // Try meta title first
  if (scan.metaTitle && normalizeText(scan.metaTitle).length > 0) {
    allEvidence.push(websiteUrl);

    // Try to extract business name from title (often after | or -)
    const titleParts = scan.metaTitle.split(/\s*[|-]\s*/);
    if (titleParts.length > 1) {
      // Usually the part before the separator is the business name
      name = titleParts[0].trim();
      confidence = 80;
      snippet = `Meta title: "${scan.metaTitle}"`;
    } else if (titleParts.length === 1 && titleParts[0].length > 2) {
      name = titleParts[0].trim();
      confidence = 60;
      snippet = `Meta title: "${scan.metaTitle}"`;
    }
  }

  // Try H1 tags if no meta title match
  if (!name && scan.h1Tags && scan.h1Tags.length > 0) {
    const h1 = (scan.h1Tags[0] || '').trim();
    if (h1 && normalizeText(h1).length > 2) {
      name = h1;
      confidence = 75;
      snippet = `First H1 tag: "${h1}"`;
    }
  }

  // Try first page title
  if (!name && pages.length > 0 && pages[0].title) {
    const pageTitle = pages[0].title.trim();
    if (pageTitle && normalizeText(pageTitle).length > 2) {
      name = pageTitle;
      confidence = 65;
      snippet = `Homepage title: "${pageTitle}"`;
    }
  }

  return {
    value: name,
    confidence,
    source_url: websiteUrl,
    extracted_text_snippet: snippet || 'Could not extract business name',
  };
}

function extractBusinessType(scan: any, pages: any[], websiteUrl: string, allEvidence: string[]): EvidenceField {
  let type = '';
  let confidence = 0;
  let snippet = '';

  // Check for schema types
  if (scan.structuredData) {
    allEvidence.push(websiteUrl);
    // If structuredData is true or an array, it indicates schema presence
    if (Array.isArray(scan.structuredData)) {
      const schemaTypes = scan.structuredData.filter((s: any) => s && s.length > 0);
      if (schemaTypes.length > 0) {
        type = schemaTypes[0];
        confidence = 85;
        snippet = `Schema type detected: "${type}"`;
      }
    } else if (scan.structuredData === true) {
      type = 'Website';
      confidence = 50;
      snippet = 'Structured data present but type not specified';
    }
  }

  // Try to infer from industry keywords
  if (!type || confidence < 60) {
    const allText = [
      scan.metaDescription || '',
      scan.metaTitle || '',
      (scan.h1Tags || []).join(' '),
    ].join(' ');

    const industry = detectIndustryFromText(allText);
    if (industry) {
      type = industry.industry.replace(/_/g, ' ');
      confidence = Math.max(confidence, industry.confidence);
      snippet = snippet || `Inferred from content keywords`;
    }
  }

  return {
    value: type,
    confidence,
    source_url: websiteUrl,
    extracted_text_snippet: snippet || 'Could not determine business type',
  };
}

function extractIndustry(scan: any, pages: any[], websiteUrl: string, allEvidence: string[]): EvidenceField {
  allEvidence.push(websiteUrl);

  // Combine all available text
  const textSources = [
    scan.metaTitle || '',
    scan.metaDescription || '',
    (scan.h1Tags || []).join(' '),
    pages.map((p: any) => p.title).filter(Boolean).join(' '),
  ];
  const allText = textSources.join(' ');

  const industry = detectIndustryFromText(allText);

  if (industry && industry.confidence >= 50) {
    return {
      value: industry.industry.replace(/_/g, ' '),
      confidence: industry.confidence,
      source_url: websiteUrl,
      extracted_text_snippet: `Industry keywords detected in: meta title, description, and page headings`,
    };
  }

  return {
    value: '',
    confidence: 0,
    source_url: websiteUrl,
    extracted_text_snippet: 'Industry keywords not clearly detected',
  };
}

function extractLocation(scan: any, pages: any[], websiteUrl: string, allEvidence: string[]): EvidenceField | null {
  allEvidence.push(websiteUrl);

  // Try meta description
  const metaDesc = scan.metaDescription || '';
  let location = detectLocationFromText(metaDesc);
  let confidence = 0;
  let snippet = '';

  if (location) {
    confidence = 70;
    snippet = `Detected in meta description: "${metaDesc.slice(0, 100)}"`;
  }

  // Try page content
  if (!location) {
    const pageContent = pages.map((p: any) => p.title).filter(Boolean).join(' ');
    location = detectLocationFromText(pageContent);
    if (location) {
      confidence = 60;
      snippet = `Detected in page content`;
    }
  }

  if (location) {
    return {
      value: location,
      confidence,
      source_url: websiteUrl,
      extracted_text_snippet: snippet,
    };
  }

  return null;
}

function extractProducts(scan: any, pages: any[], websiteUrl: string, allEvidence: string[]): EvidenceField<string[]> {
  allEvidence.push(websiteUrl);

  const products: Set<string> = new Set();

  // From H1 tags
  if (scan.h1Tags && Array.isArray(scan.h1Tags)) {
    scan.h1Tags.forEach((h1: string) => {
      if (h1 && normalizeText(h1).length > 3) {
        products.add(h1.trim());
      }
    });
  }

  // From H2 tags extracted from pages
  const h2Tags = extractH2Tags(pages);
  h2Tags.slice(0, 5).forEach(h2 => {
    if (normalizeText(h2).length > 3) {
      products.add(h2.trim());
    }
  });

  // From page titles containing keywords like "products", "services", "menu"
  const serviceKeywords = ['product', 'service', 'menu', 'offering', 'solution'];
  pages.forEach((p: any) => {
    if (p.title && serviceKeywords.some(kw => normalizeText(p.title).includes(kw))) {
      products.add(p.title.trim());
    }
  });

  const productArray = Array.from(products).slice(0, 10);

  return {
    value: productArray,
    confidence: productArray.length > 0 ? 70 : 0,
    source_url: websiteUrl,
    extracted_text_snippet: productArray.length > 0
      ? `Found ${productArray.length} product/service references`
      : 'No products or services detected',
  };
}

function extractH2Tags(pages: any[]): string[] {
  // Since we don't have explicit H2 extraction in the scan,
  // we infer from page titles that might be secondary headings
  const h2Tags: string[] = [];

  pages.forEach((p: any) => {
    if (p.title && normalizeText(p.title).length > 5) {
      // Only include if it looks like a heading (not URL-like)
      if (!p.title.includes('/') && !p.title.includes('?')) {
        h2Tags.push(p.title.trim());
      }
    }
  });

  return h2Tags;
}

function extractMenuItems(pages: any[], websiteUrl: string): EvidenceField<string[]> {
  const menuItems: Set<string> = new Set();

  // Extract common menu items from page URLs and titles
  const commonMenuKeywords = ['about', 'services', 'products', 'contact', 'blog', 'pricing', 'team', 'portfolio', 'gallery', 'faq', 'testimonials', 'careers', 'shop'];

  pages.forEach((p: any) => {
    const pageUrl = normalizeText(p.url || '');
    const pageTitle = p.title || '';

    // Check URL for menu keywords
    commonMenuKeywords.forEach(keyword => {
      if (pageUrl.includes(keyword)) {
        menuItems.add(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    });

    // Add meaningful titles
    if (pageTitle && normalizeText(pageTitle).length > 3 && !pageTitle.includes('|') && !pageTitle.includes('-')) {
      menuItems.add(pageTitle.trim());
    }
  });

  const menuArray = Array.from(menuItems).slice(0, 10);

  return {
    value: menuArray,
    confidence: menuArray.length > 0 ? 75 : 0,
    source_url: websiteUrl,
    extracted_text_snippet: menuArray.length > 0
      ? `Detected ${menuArray.length} menu items from page structure`
      : 'Could not detect menu items',
  };
}

function extractSchema(scan: any): EvidenceField<string[]> {
  const schemas: string[] = [];

  if (!scan.structuredData) {
    return {
      value: schemas,
      confidence: 0,
      source_url: scan.url || 'unknown',
      extracted_text_snippet: 'No structured data found',
    };
  }

  if (Array.isArray(scan.structuredData)) {
    const schemaTypes = scan.structuredData.filter((s: any) => typeof s === 'string' && s.length > 0);
    schemas.push(...schemaTypes);
  } else if (scan.structuredData === true) {
    schemas.push('StructuredData');
  }

  return {
    value: schemas,
    confidence: schemas.length > 0 ? 85 : 0,
    source_url: scan.url || 'unknown',
    extracted_text_snippet: schemas.length > 0
      ? `Found ${schemas.length} schema type(s): ${schemas.join(', ')}`
      : 'No schema types detected',
  };
}

function extractContactDetails(scan: any, pages: any[]): EvidenceField<{ phone?: string; email?: string; address?: string }> {
  const contact: { phone?: string; email?: string; address?: string } = {};
  let confidence = 0;
  const sources: string[] = [];

  // Look for phone and email in all text
  const allText = [
    scan.metaDescription || '',
    (scan.h1Tags || []).join(' '),
    pages.map((p: any) => p.title).join(' '),
  ].join(' ');

  const email = extractContactEmail(allText);
  if (email) {
    contact.email = email;
    confidence = Math.max(confidence, 80);
    sources.push('email');
  }

  const phone = extractPhoneNumber(allText);
  if (phone) {
    contact.phone = phone;
    confidence = Math.max(confidence, 75);
    sources.push('phone');
  }

  if (sources.length === 0) {
    confidence = 0;
  }

  return {
    value: contact,
    confidence,
    source_url: scan.url || 'unknown',
    extracted_text_snippet: sources.length > 0
      ? `Found ${sources.join(', ')} in page content`
      : 'No contact details found',
  };
}

// ── Profile Builder ────────────────────────────────────────────────────────────

export function buildInitialProfile(facts: WebsiteFacts): BusinessProfile {
  return {
    business_name: facts.business_name.confidence >= 50 ? facts.business_name.value : '',
    business_type: facts.business_type.confidence >= 50 ? facts.business_type.value : '',
    industry: facts.detected_industry.confidence >= 50 ? facts.detected_industry.value : '',
    location: facts.detected_location?.confidence && facts.detected_location.confidence >= 50
      ? facts.detected_location.value
      : '',
    main_products_or_services: facts.main_products_or_services.confidence >= 50
      ? facts.main_products_or_services.value
      : [],
    target_audience: '',
    known_competitors: [],
    notes: '',
    confirmed: false,
    confirmed_at: null,
  };
}

// ── Confidence Validator ───────────────────────────────────────────────────────

export function isProfileSufficient(facts: WebsiteFacts): {
  sufficient: boolean;
  missing_fields: string[];
  overall_confidence: number;
} {
  const missing: string[] = [];
  const threshold = 50;

  if (facts.business_name.confidence < threshold) missing.push('business_name');
  if (facts.business_type.confidence < threshold) missing.push('business_type');
  if (facts.detected_industry.confidence < threshold) missing.push('detected_industry');
  if (!facts.detected_location || facts.detected_location.confidence < threshold) missing.push('detected_location');
  if (facts.main_products_or_services.confidence < threshold) missing.push('main_products_or_services');
  if (facts.detected_schema.confidence < threshold) missing.push('detected_schema');

  const sufficient = facts.confidence_score >= 70 && missing.length <= 2;

  return {
    sufficient,
    missing_fields: missing,
    overall_confidence: facts.confidence_score,
  };
}
