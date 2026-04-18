/**
 * CENTRAL PERSISTENCE MAP
 *
 * Documents every module's storage backend, persistence status, and risk level.
 * Used by the persistence logger, QA debug panel, and audit tooling.
 *
 * Storage backends:
 *   'supabase'  — Durable. Survives deploys, cold starts, restarts.
 *   'jsonstore' — Ephemeral on Vercel (/tmp). Data lost on cold start/deploy.
 *                 Durable only in local dev (writes to DATA_DIR).
 *
 * Risk levels:
 *   'ok'       — Persisted to Supabase. Safe.
 *   'critical' — User-facing data on JsonStore. WILL be lost in production.
 *   'low'      — Non-essential or cache-like data on JsonStore. Loss is tolerable.
 */

export type StorageBackend = 'supabase' | 'jsonstore';
export type PersistenceRisk = 'ok' | 'critical' | 'low';

export interface PersistenceEntry {
  module: string;
  description: string;
  apiRoute: string;
  storage: StorageBackend;
  table: string;                // Supabase table or JsonStore collection name
  operations: ('select' | 'insert' | 'update' | 'delete')[];
  risk: PersistenceRisk;
  notes?: string;
}

export const PERSISTENCE_MAP: PersistenceEntry[] = [
  // ═══════════════════════════════════════════════════════════════════════
  // SUPABASE-BACKED (DURABLE) — risk: ok
  // ═══════════════════════════════════════════════════════════════════════
  {
    module: 'clients',
    description: 'Client CRUD',
    apiRoute: '/api/data/clients',
    storage: 'supabase',
    table: 'clients',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
  },
  {
    module: 'employees',
    description: 'Employee/team CRUD',
    apiRoute: '/api/data/employees',
    storage: 'supabase',
    table: 'employees',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
  },
  {
    module: 'projects',
    description: 'Video projects',
    apiRoute: '/api/data/projects',
    storage: 'supabase',
    table: 'video_projects',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
  },
  {
    module: 'business_projects',
    description: 'Business/service projects',
    apiRoute: '/api/data/business-projects',
    storage: 'supabase',
    table: 'business_projects',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
  },
  {
    module: 'project_milestones',
    description: 'Business project milestones',
    apiRoute: '/api/data/project-milestones',
    storage: 'supabase',
    table: 'business_project_milestones',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
  },
  {
    module: 'project_payments',
    description: 'Business project payments',
    apiRoute: '/api/data/project-payments',
    storage: 'supabase',
    table: 'business_project_payments',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
  },
  {
    module: 'milestone_files',
    description: 'Milestone file attachments',
    apiRoute: '/api/data/milestone-files',
    storage: 'supabase',
    table: 'business_project_milestone_files',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
  },
  {
    module: 'project_timeline',
    description: 'Project activity timeline',
    apiRoute: '/api/data/project-timeline',
    storage: 'supabase',
    table: 'business_project_timeline',
    operations: ['select', 'insert'],
    risk: 'ok',
  },
  {
    module: 'tasks',
    description: 'Tasks (linked to projects/milestones)',
    apiRoute: '/api/data/tasks',
    storage: 'supabase',
    table: 'tasks',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
  },
  {
    module: 'client_research',
    description: 'AI client research (recently migrated)',
    apiRoute: '/api/ai/client-research',
    storage: 'supabase',
    table: 'client_research',
    operations: ['select', 'insert', 'update'],
    risk: 'ok',
    notes: 'Dual-writes to JsonStore + Supabase. Reads prefer Supabase.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // SUPABASE-BACKED VIA SupabaseCrud (DURABLE) — recently migrated
  // These were previously on JsonStore. Now use generic JSONB tables.
  // ═══════════════════════════════════════════════════════════════════════
  {
    module: 'leads',
    description: 'Lead management and pipeline',
    apiRoute: '/api/data/leads',
    storage: 'supabase',
    table: 'app_leads',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'campaigns',
    description: 'Marketing campaigns',
    apiRoute: '/api/data/campaigns',
    storage: 'supabase',
    table: 'app_campaigns',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'client_gantt_items',
    description: 'Client content calendar / gantt items',
    apiRoute: '/api/data/client-gantt-items',
    storage: 'supabase',
    table: 'app_client_gantt_items',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'client_tasks',
    description: 'Client-specific tasks',
    apiRoute: '/api/data/client-tasks',
    storage: 'supabase',
    table: 'app_client_tasks',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'employee_tasks',
    description: 'Employee task assignments',
    apiRoute: '/api/data/employee-tasks',
    storage: 'supabase',
    table: 'app_employee_tasks',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'approvals',
    description: 'Content approval workflows',
    apiRoute: '/api/data/approvals',
    storage: 'supabase',
    table: 'app_approvals',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'client_files',
    description: 'Client file metadata',
    apiRoute: '/api/data/client-files',
    storage: 'supabase',
    table: 'app_client_files',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. File metadata only. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'payments',
    description: 'Retainer payments',
    apiRoute: '/api/data/payments',
    storage: 'supabase',
    table: 'app_payments',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Financial data now durable.',
  },
  {
    module: 'mailings',
    description: 'Email mailing campaigns',
    apiRoute: '/api/data/mailings',
    storage: 'supabase',
    table: 'app_mailings',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'whatsapp_messages',
    description: 'WhatsApp message logs',
    apiRoute: '/api/data/whatsapp-messages',
    storage: 'supabase',
    table: 'app_whatsapp_messages',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'podcast_sessions',
    description: 'Podcast recording sessions',
    apiRoute: '/api/data/podcast-sessions',
    storage: 'supabase',
    table: 'app_podcast_sessions',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'meetings',
    description: 'Meeting scheduler',
    apiRoute: '/api/data/meetings',
    storage: 'supabase',
    table: 'app_meetings',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },
  {
    module: 'follow_up_reminders',
    description: 'Follow-up reminders for leads/clients',
    apiRoute: '/api/data/follow-up-reminders',
    storage: 'supabase',
    table: 'app_follow_up_reminders',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'ok',
    notes: 'Migrated from JsonStore. Uses SupabaseCrud JSONB pattern.',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // JSONSTORE-BACKED — risk: low (cache/config/transient data)
  // ═══════════════════════════════════════════════════════════════════════
  {
    module: 'client_knowledge',
    description: 'AI client brain analysis — persistent',
    apiRoute: '/api/ai/client-brain',
    storage: 'supabase',
    table: 'app_client_knowledge',
    operations: ['select', 'insert', 'update'],
    risk: 'ok',
    notes: 'Migrated from JsonStore to SupabaseCrud. Persists across deploys.',
  },
  {
    module: 'client_insights',
    description: 'Persisted AI insight sections (brand weakness, customer profile, etc.)',
    apiRoute: '/api/ai/client-insights',
    storage: 'supabase',
    table: 'app_client_insights',
    operations: ['select', 'insert', 'update'],
    risk: 'ok',
    notes: 'New. Uses SupabaseCrud JSONB pattern. Auto-generated when research exists.',
  },
  {
    module: 'creative_dna',
    description: 'AI creative DNA profiles',
    apiRoute: '/api/ai/creative-dna',
    storage: 'jsonstore',
    table: 'creative-dna.json',
    operations: ['select', 'insert', 'update'],
    risk: 'low',
    notes: 'Can be regenerated from AI.',
  },
  {
    module: 'ai_settings',
    description: 'AI configuration (API keys stored separately)',
    apiRoute: '/api/data/ai-settings',
    storage: 'jsonstore',
    table: 'ai-settings.json',
    operations: ['select', 'insert', 'update'],
    risk: 'low',
  },
  {
    module: 'social_posts',
    description: 'Social media post drafts',
    apiRoute: '/api/data/social-posts',
    storage: 'jsonstore',
    table: 'social-posts.json',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'low',
    notes: 'Drafts — final posts go to platform APIs.',
  },
  {
    module: 'email_templates',
    description: 'Email templates',
    apiRoute: '/api/data/email-templates',
    storage: 'jsonstore',
    table: 'email-templates.json',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'low',
  },
  {
    module: 'portal_users',
    description: 'Client portal access',
    apiRoute: '/api/data/portal-users',
    storage: 'jsonstore',
    table: 'portal-users.json',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'low',
  },
  {
    module: 'portal_comments',
    description: 'Portal approval comments',
    apiRoute: '/api/data/portal-comments',
    storage: 'jsonstore',
    table: 'portal-comments.json',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'low',
  },
  {
    module: 'activities',
    description: 'Activity feed / audit log',
    apiRoute: '/api/data/activities',
    storage: 'jsonstore',
    table: 'activities.json',
    operations: ['select', 'insert'],
    risk: 'low',
  },
  {
    module: 'users',
    description: 'Internal user accounts',
    apiRoute: '/api/data/users',
    storage: 'jsonstore',
    table: 'users.json',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'low',
    notes: 'Auth may be handled separately. Seeded on startup.',
  },
  {
    module: 'hosting_records',
    description: 'Client hosting/domain records',
    apiRoute: '/api/data/hosting-records',
    storage: 'jsonstore',
    table: 'hosting-records.json',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'low',
  },
  {
    module: 'accountant_documents',
    description: 'Accountant document references',
    apiRoute: '/api/data/accountant-documents',
    storage: 'jsonstore',
    table: 'accountant-documents.json',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'low',
  },
  {
    module: 'automation_rules',
    description: 'Automation rules config',
    apiRoute: '/api/data/automation-rules',
    storage: 'jsonstore',
    table: 'automation-rules.json',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'low',
  },
  {
    module: 'gmail_settings',
    description: 'Gmail integration settings',
    apiRoute: '/api/data/gmail-settings',
    storage: 'jsonstore',
    table: 'gmail-settings.json',
    operations: ['select', 'insert', 'update'],
    risk: 'low',
  },
  {
    module: 'client_email_logs',
    description: 'Sent email history',
    apiRoute: '/api/data/client-email-logs',
    storage: 'jsonstore',
    table: 'client-email-logs.json',
    operations: ['select', 'insert'],
    risk: 'low',
    notes: 'Historical log. Loss means missing history, not broken features.',
  },
  {
    module: 'project_notifications',
    description: 'Project notification queue',
    apiRoute: '/api/data/project-notifications',
    storage: 'jsonstore',
    table: 'project-notifications.json',
    operations: ['select', 'insert', 'update', 'delete'],
    risk: 'low',
  },
  {
    module: 'render_jobs',
    description: 'Video render job queue',
    apiRoute: '/api/render',
    storage: 'jsonstore',
    table: 'render-jobs.json',
    operations: ['select', 'insert', 'update'],
    risk: 'low',
    notes: 'Transient job state. Completed renders have output URLs.',
  },
];

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/** Get all critical (data-losing) modules */
export function getCriticalModules(): PersistenceEntry[] {
  return PERSISTENCE_MAP.filter(e => e.risk === 'critical');
}

/** Get all modules using a specific storage backend */
export function getModulesByStorage(backend: StorageBackend): PersistenceEntry[] {
  return PERSISTENCE_MAP.filter(e => e.storage === backend);
}

/** Look up persistence info by API route prefix */
export function getEntryByRoute(route: string): PersistenceEntry | undefined {
  return PERSISTENCE_MAP.find(e => route.startsWith(e.apiRoute));
}

/** Look up persistence info by module name */
export function getEntryByModule(module: string): PersistenceEntry | undefined {
  return PERSISTENCE_MAP.find(e => e.module === module);
}

/** Summary stats */
export function getPersistenceStats() {
  const total = PERSISTENCE_MAP.length;
  const supabase = PERSISTENCE_MAP.filter(e => e.storage === 'supabase').length;
  const jsonstore = PERSISTENCE_MAP.filter(e => e.storage === 'jsonstore').length;
  const critical = PERSISTENCE_MAP.filter(e => e.risk === 'critical').length;
  const ok = PERSISTENCE_MAP.filter(e => e.risk === 'ok').length;
  const low = PERSISTENCE_MAP.filter(e => e.risk === 'low').length;
  return { total, supabase, jsonstore, critical, ok, low };
}
