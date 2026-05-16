import { JsonStore, SupabaseCrud } from './store';
import type {
  Project,
  Task,
  Payment,
  Lead,
  Employee,
  EmployeeTask,
  FollowUpReminder,
  Campaign,
  User,
  Approval,
  ActivityEntry,
  ClientGanttItem,
  ClientTask,
  ClientFile,
  PortalUser,
  PortalComment,
  SocialPost,
  ClientEmailLog,
  BusinessProject,
  ProjectMilestone,
  ProjectPayment,
  HostingRecord,

  PodcastSession,
  AISettings,
  ClientKnowledge,
  CreativeDNA,
  ClientResearch,
  ClientInsight,
  AutomationRule,
  AdSet,
  Ad,
  AutomationRun,
  ApprovalQueueItem,
  WhatsAppMessage,
  EmailTemplate,
  Mailing,
  GmailSettings,
  Meeting,
  ProjectNotification,
  SystemEvent,
  AuditLog,
  AdReference,
  PodcastStrategy,
  CampaignAction,
  CampaignActionApproval,
  CampaignActivityLog,
  AutoCampaignRun,
  AutoCampaignFinding,
  Report,
  ClientNotification,
  GrowthRun,
  GrowthOpportunity,
  GrowthAction,
  GrowthActionResult,
  KnowledgeItem,
  IndustryPlaybook,
  SeoPlan,
  SeoWebsite,
  SeoGrowthTask,
  Invoice,
  GreenInvoiceSettings,
  ScannedReceipt,
  EmailSequence,
  SequenceSubscriber,
  ScheduledSocialPost,
  LinkedInPost,
  Survey,
  SurveyResponse,
  BacklinkCampaign,
  BacklinkTarget,
} from './schema';

// clients — removed from JsonStore. All client reads/writes go through Supabase
// directly (via route handlers in /api/data/clients/ and via getClientById/updateClientById helpers).
export const projects = new JsonStore<Project>('projects', 'prj');
export const tasks = new JsonStore<Task>('tasks', 'tsk');
export const payments = new SupabaseCrud<Payment>('app_payments', 'pay');
export const leads = new SupabaseCrud<Lead>('app_leads', 'led');
export const employees = new JsonStore<Employee>('employees', 'emp');
export const campaigns = new SupabaseCrud<Campaign>('app_campaigns', 'cmp');
export const adSets = new SupabaseCrud<AdSet>('app_ad_sets', 'ads');
export const ads = new SupabaseCrud<Ad>('app_ads', 'ad');
export const users = new JsonStore<User>('users', 'usr');
export const approvals = new SupabaseCrud<Approval>('app_approvals', 'apr');
export const activities = new JsonStore<ActivityEntry>('activities', 'act');
export const clientGanttItems = new SupabaseCrud<ClientGanttItem>('app_client_gantt_items', 'cgi');
export const clientTasks = new SupabaseCrud<ClientTask>('app_client_tasks', 'ctk');
export const clientFiles = new SupabaseCrud<ClientFile>('app_client_files', 'cfl');
export const portalUsers = new JsonStore<PortalUser>('portal-users', 'pru');
export const socialPosts = new JsonStore<SocialPost>('social-posts', 'spo');
export const clientEmailLogs = new JsonStore<ClientEmailLog>('client-email-logs', 'cel');
export const businessProjects = new JsonStore<BusinessProject>('business-projects', 'bpr');
export const projectMilestones = new JsonStore<ProjectMilestone>('project-milestones', 'pms');
export const projectPayments = new JsonStore<ProjectPayment>('project-payments', 'ppy');
export const hostingRecords = new JsonStore<HostingRecord>('hosting-records', 'hst');
// accountantDocuments — REMOVED. Accountant docs now stored in app_client_files with category='accountant'.
// The /api/data/accountant-documents route queries clientFiles filtered by category.
export const podcastSessions = new SupabaseCrud<PodcastSession>('app_podcast_sessions', 'pcs');
export const podcastStrategies = new SupabaseCrud<PodcastStrategy>('app_podcast_strategies', 'pst');
export const aiSettings = new JsonStore<AISettings>('ai-settings', 'ais');
export const clientKnowledge = new SupabaseCrud<ClientKnowledge>('app_client_knowledge', 'ckn');
export const clientInsights = new SupabaseCrud<ClientInsight>('app_client_insights', 'cin');
export const creativeDNA = new SupabaseCrud<CreativeDNA>('app_creative_dna', 'cdna');
export const clientResearch = new JsonStore<ClientResearch>('client-research', 'crs');
export const employeeTasks = new SupabaseCrud<EmployeeTask>('app_employee_tasks', 'etk');
export const followUpReminders = new SupabaseCrud<FollowUpReminder>('app_follow_up_reminders', 'fur');
export const portalComments = new JsonStore<PortalComment>('portal-comments', 'pcm');
export const automationRules = new JsonStore<AutomationRule>('automation-rules', 'atr');
export const automationRuns = new JsonStore<AutomationRun>('automation-runs', 'arn');
export const approvalQueue = new JsonStore<ApprovalQueueItem>('approval-queue', 'apq');
export const whatsappMessages = new SupabaseCrud<WhatsAppMessage>('app_whatsapp_messages', 'wam');
export const emailTemplates = new JsonStore<EmailTemplate>('email-templates', 'emt');
export const mailings = new SupabaseCrud<Mailing>('app_mailings', 'mai');
export const gmailSettings = new SupabaseCrud<GmailSettings>('app_gmail_settings', 'gml');
export const meetings = new SupabaseCrud<Meeting>('app_meetings', 'mtg');
export const projectNotifications = new JsonStore<ProjectNotification>('project-notifications', 'pno');
export const systemEvents = new SupabaseCrud<SystemEvent>('app_system_events', 'sys');
export const auditLog = new SupabaseCrud<AuditLog>('app_audit_log', 'aud');
export const adReferences = new SupabaseCrud<AdReference>('app_ad_references', 'adr');
export const campaignActions = new SupabaseCrud<CampaignAction>('campaign_actions', 'cac');
export const campaignActionApprovals = new SupabaseCrud<CampaignActionApproval>('campaign_action_approvals', 'caa');
export const campaignActivityLog = new SupabaseCrud<CampaignActivityLog>('campaign_activity_log', 'cal');
export const autoCampaignRuns = new SupabaseCrud<AutoCampaignRun>('auto_campaign_runs', 'acr');
export const autoCampaignFindings = new SupabaseCrud<AutoCampaignFinding>('auto_campaign_findings', 'acf');
export const reports = new SupabaseCrud<Report>('app_reports', 'rpt');
export const clientNotifications = new SupabaseCrud<ClientNotification>('app_client_notifications', 'cnf');

// Auto Growth Engine
export const growthRuns = new SupabaseCrud<GrowthRun>('growth_runs', 'grn');
export const growthOpportunities = new SupabaseCrud<GrowthOpportunity>('growth_opportunities', 'gop');
export const growthActions = new SupabaseCrud<GrowthAction>('growth_actions', 'gac');
export const growthActionResults = new SupabaseCrud<GrowthActionResult>('growth_action_results', 'gar');

// Agency Knowledge Layer
export const knowledgeItems = new SupabaseCrud<KnowledgeItem>('agency_knowledge_items', 'kni');
export const industryPlaybooks = new SupabaseCrud<IndustryPlaybook>('industry_playbooks', 'ipb');

// SEO/GEO Growth Plans
export const seoPlans = new SupabaseCrud<SeoPlan>('app_seo_plans', 'seo');
export const seoWebsites = new SupabaseCrud<SeoWebsite>('app_seo_websites', 'swb');
export const seoGrowthTasks = new SupabaseCrud<SeoGrowthTask>('app_seo_growth_tasks', 'sgt');

// Green Invoice + Invoicing
export const invoices = new SupabaseCrud<Invoice>('app_invoices', 'inv');
export const greenInvoiceSettingsStore = new SupabaseCrud<GreenInvoiceSettings>('app_green_invoice_settings', 'gis');

// Receipt Scanner
export const scannedReceipts = new SupabaseCrud<ScannedReceipt>('app_scanned_receipts', 'rcpt');

// Email Sequences
export const emailSequences = new SupabaseCrud<EmailSequence>('app_email_sequences', 'esq');
export const sequenceSubscribers = new SupabaseCrud<SequenceSubscriber>('app_sequence_subscribers', 'ssb');

// Social Media / Postiz
export const scheduledSocialPosts = new SupabaseCrud<ScheduledSocialPost>('app_scheduled_posts', 'ssp');

// LinkedIn
export const linkedInPosts = new SupabaseCrud<LinkedInPost>('app_linkedin_posts', 'lip');

// Surveys
export const surveys = new SupabaseCrud<Survey>('app_surveys', 'srv');
export const surveyResponses = new SupabaseCrud<SurveyResponse>('app_survey_responses', 'srr');

// Backlink Intelligence & Outreach
export const backlinkCampaigns = new SupabaseCrud<BacklinkCampaign>('app_backlink_campaigns', 'blc');
export const backlinkTargets = new SupabaseCrud<BacklinkTarget>('app_backlink_targets', 'blt');
