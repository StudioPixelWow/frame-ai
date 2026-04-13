/**
 * POST /api/data/leads/[id]/convert - Convert a lead to a client or business project
 *
 * Takes the lead data and a convertTo field in the body:
 * - 'marketing_client' or 'podcast_client': creates a Client with clientType 'marketing' or 'podcast'
 * - 'branding_project' or 'website_project': creates a BusinessProject with projectType 'branding' or 'website'
 * Updates lead with convertedEntityType ('client' or 'project'), convertedEntityId, status 'won'
 */

import { NextRequest, NextResponse } from 'next/server';
import { leads, clients, businessProjects } from '@/lib/db';
import { ensureSeeded } from '@/lib/db/seed';

type ConvertToType = 'marketing_client' | 'podcast_client' | 'branding_project' | 'website_project' | 'hosting_client';

export async function POST(
  req: NextRequest,
  { params }: { { params }: { params: { id: string } }<{ id: string }> }
) {
  ensureSeeded();
  try {
    const { id } = params;
    const lead = leads.getById(id);
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
    let createdEntity: any;
    let entityType: 'client' | 'project';

    if (convertTo === 'marketing_client' || convertTo === 'podcast_client' || convertTo === 'hosting_client') {
      // Create a Client
      const clientTypeMap = {
        'marketing_client': 'marketing',
        'podcast_client': 'podcast',
        'hosting_client': 'hosting',
      } as const;
      const clientType = clientTypeMap[convertTo];
      createdEntity = clients.create({
        name: lead.fullName,
        company: lead.company,
        contactPerson: lead.fullName,
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes,
        businessField: '',
        status: 'active',
        retainerAmount: 0,
        retainerDay: 1,
        color: '#8B5CF6',
        convertedFromLead: lead.id,
        createdAt: now,
        updatedAt: now,
        // Required Client fields with sensible defaults
        logoUrl: '',
        clientType: clientType,
        marketingGoals: '',
        keyMarketingMessages: '',
        assignedManagerId: null,
        websiteUrl: '',
        facebookPageUrl: '',
        instagramProfileUrl: '',
        tiktokProfileUrl: '',
        paymentStatus: 'none',
        nextPaymentDate: null,
        portalEnabled: false,
        portalUserId: null,
        lastPortalLoginAt: null,
        facebookPageId: '',
        facebookPageName: '',
        instagramAccountId: '',
        instagramUsername: '',
        tiktokAccountId: '',
        tiktokUsername: '',
        monthlyGanttStatus: 'none',
        annualGanttStatus: 'none',
      });
      entityType = 'client';
    } else {
      // Create a BusinessProject
      const projectType = convertTo === 'branding_project' ? 'branding' : 'website';
      createdEntity = businessProjects.create({
        projectName: `${lead.fullName} - ${projectType} Project`,
        clientId: '', // Will be linked later
        projectType: projectType,
        description: lead.notes,
        agreementSigned: false,
        projectStatus: 'not_started',
        startDate: null,
        endDate: null,
        assignedManagerId: null,
        createdAt: now,
        updatedAt: now,
      });
      entityType = 'project';
    }

    // Update the lead to mark it as converted
    const updatedLead = leads.update(id, {
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
