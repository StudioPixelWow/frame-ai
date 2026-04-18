/**
 * POST /api/data/leads/[id]/convert - Convert a lead to a client or business project
 *
 * Takes the lead data and a convertTo field in the body:
 * - 'marketing_client' or 'podcast_client': creates a Client with clientType 'marketing' or 'podcast'
 * - 'branding_project' or 'website_project': creates a BusinessProject with projectType 'branding' or 'website'
 * Updates lead with convertedEntityType ('client' or 'project'), convertedEntityId, status 'won'
 */

import { NextRequest, NextResponse } from 'next/server';
import { leads } from '@/lib/db';
import { getSupabase } from '@/lib/db/store';
import { ensureSeeded } from '@/lib/db/seed';

type ConvertToType = 'marketing_client' | 'podcast_client' | 'branding_project' | 'website_project' | 'hosting_client';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = await context.params;
    const lead = await leads.getByIdAsync(id);
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    if (lead.status === 'won' && lead.convertedEntityId) {
      return NextResponse.json(
        { error: 'Lead already converted' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const convertTo: ConvertToType = body.convertTo;

    if (!convertTo || !['marketing_client', 'podcast_client', 'branding_project', 'website_project', 'hosting_client'].includes(convertTo)) {
      return NextResponse.json(
        { error: 'Invalid convertTo field. Must be one of: marketing_client, podcast_client, branding_project, website_project, hosting_client' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const sb = getSupabase();
    let createdEntity: Record<string, unknown>;
    let entityType: 'client' | 'project';

    if (convertTo === 'marketing_client' || convertTo === 'podcast_client' || convertTo === 'hosting_client') {
      // Create a Client — write directly to Supabase (single source of truth)
      const clientTypeMap = {
        'marketing_client': 'marketing',
        'podcast_client': 'podcast',
        'hosting_client': 'hosting',
      } as const;
      const clientType = clientTypeMap[convertTo];
      const clientId = `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      const insertRow = {
        id: clientId,
        name: lead.fullName || '',
        company: lead.company || '',
        contact_person: lead.fullName || '',
        email: lead.email || '',
        phone: lead.phone || '',
        notes: lead.notes || '',
        business_field: '',
        client_type: clientType,
        status: 'active',
        retainer_amount: 0,
        retainer_day: 1,
        color: '#8B5CF6',
        converted_from_lead: lead.id,
        created_at: now,
        updated_at: now,
      };

      const { data: inserted, error: insertErr } = await sb
        .from('clients')
        .insert(insertRow)
        .select('*')
        .single();

      if (insertErr) {
        console.error('[convert] Failed to create client in Supabase:', insertErr.message);
        return NextResponse.json({ error: `Failed to create client: ${insertErr.message}` }, { status: 500 });
      }

      createdEntity = inserted as Record<string, unknown>;
      entityType = 'client';
      console.log(`[convert] Created client ${clientId} in Supabase from lead ${id}`);
    } else {
      // Create a BusinessProject — write directly to Supabase
      const projectType = convertTo === 'branding_project' ? 'branding' : 'website';
      const projectId = `bpr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

      const insertRow = {
        id: projectId,
        project_name: `${lead.fullName} - ${projectType} Project`,
        client_id: '',
        project_type: projectType,
        description: lead.notes || '',
        agreement_signed: false,
        project_status: 'not_started',
        start_date: null,
        end_date: null,
        assigned_manager_id: null,
        created_at: now,
        updated_at: now,
      };

      const { data: inserted, error: insertErr } = await sb
        .from('business_projects')
        .insert(insertRow)
        .select('*')
        .single();

      if (insertErr) {
        console.error('[convert] Failed to create business project in Supabase:', insertErr.message);
        return NextResponse.json({ error: `Failed to create project: ${insertErr.message}` }, { status: 500 });
      }

      createdEntity = inserted as Record<string, unknown>;
      entityType = 'project';
      console.log(`[convert] Created business project ${projectId} in Supabase from lead ${id}`);
    }

    // Update the lead to mark it as converted
    const updatedLead = await leads.updateAsync(id, {
      status: 'won',
      convertedAt: now,
      convertedEntityType: entityType,
      convertedEntityId: createdEntity.id,
      // Legacy field for backwards compatibility
      convertedClientId: entityType === 'client' ? createdEntity.id : null,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        entity: createdEntity,
        entityType: entityType,
        lead: updatedLead,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to convert lead' },
      { status: 500 }
    );
  }
}
