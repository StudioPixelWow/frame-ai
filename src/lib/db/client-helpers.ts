/**
 * Shared Supabase helpers for client reads/writes.
 *
 * These replace the old `clients.getById()` JsonStore pattern.
 * Every function goes directly to Supabase — no JsonStore fallback.
 */

import { getSupabase } from './store';

type ClientRow = Record<string, unknown> & { id: string };

/** Map a raw DB row → camelCase API object */
function rowToClient(r: ClientRow) {
  return {
    id:                  r.id,
    name:               (r.name as string) ?? '',
    company:            (r.company as string) ?? '',
    contactPerson:      (r.contact_person as string) ?? '',
    email:              (r.email as string) ?? '',
    phone:              (r.phone as string) ?? '',
    notes:              (r.notes as string) ?? '',
    businessField:      (r.business_field as string) ?? '',
    clientType:         (r.client_type as string) ?? 'marketing',
    status:             (r.status as string) ?? 'active',
    retainerAmount:     Number(r.retainer_amount) || 0,
    retainerDay:        Number(r.retainer_day) || 1,
    color:              (r.color as string) ?? '#00B5FE',
    convertedFromLead:  (r.converted_from_lead as string) ?? null,
    assignedManagerId:  (r.assigned_manager_id as string) ?? null,
    websiteUrl:          (r.website as string) ?? '',
    facebookPageUrl:     (r.facebook as string) ?? '',
    instagramProfileUrl: (r.instagram as string) ?? '',
    tiktokProfileUrl:    (r.tiktok as string) ?? '',
    linkedinUrl:         (r.linkedin as string) ?? '',
    youtubeUrl:          (r.youtube as string) ?? '',
    marketingGoals:      (r.marketing_goals as string) ?? '',
    keyMarketingMessages:(r.key_marketing_messages as string) ?? '',
    logoUrl:             (r.logo_url as string) ?? '',
    createdAt:           (r.created_at as string) ?? '',
    updatedAt:           (r.updated_at as string) ?? '',
  };
}

/** Fetch a single client from Supabase by ID. Returns null if not found. */
export async function getClientById(id: string) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from('clients')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error(`[client-helpers] getClientById(${id}) error:`, error.message);
    return null;
  }
  if (!data) return null;
  return rowToClient(data as ClientRow);
}

/** Update a client in Supabase. Returns updated client or null. */
export async function updateClientById(id: string, updates: Record<string, unknown>) {
  const sb = getSupabase();
  const dbUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Map camelCase to snake_case
  const map: Record<string, string> = {
    name: 'name', company: 'company', contactPerson: 'contact_person',
    email: 'email', phone: 'phone', notes: 'notes',
    businessField: 'business_field', clientType: 'client_type',
    status: 'status', retainerAmount: 'retainer_amount',
    retainerDay: 'retainer_day', color: 'color',
    convertedFromLead: 'converted_from_lead', assignedManagerId: 'assigned_manager_id',
    websiteUrl: 'website', facebookPageUrl: 'facebook',
    instagramProfileUrl: 'instagram', tiktokProfileUrl: 'tiktok',
    linkedinUrl: 'linkedin', youtubeUrl: 'youtube',
    marketingGoals: 'marketing_goals', keyMarketingMessages: 'key_marketing_messages',
    logoUrl: 'logo_url', portalEnabled: 'portal_enabled',
    portalUserId: 'portal_user_id', lastPortalLoginAt: 'last_portal_login_at',
  };

  for (const [camel, snake] of Object.entries(map)) {
    if (updates[camel] !== undefined) dbUpdates[snake] = updates[camel];
  }

  const { data, error } = await sb
    .from('clients')
    .update(dbUpdates)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) {
    console.error(`[client-helpers] updateClientById(${id}) error:`, error.message);
    return null;
  }
  if (!data) return null;
  return rowToClient(data as ClientRow);
}
