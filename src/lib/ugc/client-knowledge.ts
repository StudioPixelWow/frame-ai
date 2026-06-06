/**
 * Gathers everything we know about a client into a compact Hebrew "knowledge"
 * blob, so generators (UGC etc.) can ground their output in the client's real
 * positioning, audience, tone, brand and research — not generic content.
 *
 * Sources: clients table + client_research (client_brain JSON) + creative DNA.
 */

import { getSupabase } from '@/lib/db/store';
import { getClientById } from '@/lib/db/client-helpers';

export interface ClientKnowledge {
  text: string;                 // compact blob for the AI prompt
  prefill: {                    // sensible defaults for the UGC brief form
    businessName?: string;
    businessType?: string;
    targetAudience?: string;
    sellingPoints?: string;
    tone?: string;
    location?: string;
    brandColors?: string;
    logoUrl?: string;
  };
}

const TYPE_MAP: Record<string, string> = {
  'נדל"ן': 'נדל״ן', 'נדלן': 'נדל״ן', 'real estate': 'נדל״ן',
  restaurant: 'מסעדה', 'מסעדה': 'מסעדה', shop: 'חנות', 'חנות': 'חנות',
  clinic: 'קליניקה', 'קליניקה': 'קליניקה', service: 'שירות', 'שירות': 'שירות',
};

export async function buildClientKnowledge(clientId: string): Promise<ClientKnowledge | null> {
  let client: any = null;
  try { client = await getClientById(clientId); } catch { /* ignore */ }
  if (!client) return null;

  // Research brain
  let research: any = null;
  try {
    const sb = getSupabase();
    const { data } = await sb.from('client_research').select('client_brain').eq('client_id', clientId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if ((data as any)?.client_brain) research = typeof (data as any).client_brain === 'string' ? JSON.parse((data as any).client_brain) : (data as any).client_brain;
  } catch { /* optional */ }

  // Creative DNA
  let dna: any = null;
  try {
    const { creativeDNA } = await import('@/lib/db/collections');
    const all = await creativeDNA.getAllAsync();
    dna = (all as any[]).find((d) => d.clientId === clientId) || null;
  } catch { /* optional */ }

  const id = research?.identity || {};
  const aud = research?.audience || {};
  const parts: string[] = [];
  parts.push(`עסק: ${client.name}${client.businessField ? ` · תחום: ${client.businessField}` : ''}`);
  if (id.whatTheySell) parts.push(`מה מוכרים: ${id.whatTheySell}`);
  if (id.positioning) parts.push(`מיצוב: ${id.positioning}`);
  if (id.uniqueValue) parts.push(`בידול/USP: ${id.uniqueValue}`);
  if (client.keyMarketingMessages) parts.push(`מסרים מרכזיים: ${client.keyMarketingMessages}`);
  if (aud.primary || id.targetAudience) parts.push(`קהל יעד: ${aud.primary || id.targetAudience}`);
  if (Array.isArray(aud.painPoints) && aud.painPoints.length) parts.push(`כאבי קהל: ${aud.painPoints.slice(0, 4).join(', ')}`);
  if (dna?.toneOfVoice || id.tone) parts.push(`טון: ${dna?.toneOfVoice || id.tone}`);
  if (dna?.visualStyle) parts.push(`סגנון ויזואלי: ${dna.visualStyle}`);
  if (Array.isArray(dna?.doNotUsePatterns) && dna.doNotUsePatterns.length) parts.push(`להימנע מ: ${dna.doNotUsePatterns.slice(0, 5).join(', ')}`);
  if (Array.isArray(research?.recommendedContentAngles) && research.recommendedContentAngles.length) parts.push(`זוויות תוכן מומלצות: ${research.recommendedContentAngles.slice(0, 4).join(' · ')}`);
  if (client.websiteUrl) parts.push(`אתר: ${client.websiteUrl}`);

  const businessType = TYPE_MAP[(client.businessField || '').toLowerCase()] || TYPE_MAP[client.businessField] || (client.businessField || 'אחר');

  return {
    text: parts.join('\n'),
    prefill: {
      businessName: client.name || '',
      businessType,
      targetAudience: aud.primary || id.targetAudience || '',
      sellingPoints: client.keyMarketingMessages || id.uniqueValue || (Array.isArray(research?.recommendedContentAngles) ? research.recommendedContentAngles.slice(0, 3).join(', ') : ''),
      tone: dna?.toneOfVoice || id.tone || '',
      location: '',
      brandColors: Array.isArray(dna?.colorPalette) ? dna.colorPalette.join(', ') : (client.color || ''),
      logoUrl: client.logoUrl || '',
    },
  };
}
