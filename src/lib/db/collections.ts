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
  AccountantDocument,
  PodcastSession,
  AISettings,
  ClientKnowledge,
  CreativeDNA,
  ClientResearch,
  ClientInsight,
  AutomationRule,
  WhatsAppMessage,
  EmailTemplate,
  Mailing,
  GmailSettings,
  Meeting,
  ProjectNotification,
} from './schema';

// clients — removed from JsonStore. All client reads/writes go through Supabase
// directly (via route handlers in /api/data/clients/ and via getClientById/updateClientById helpers).
export const projects = new JsonStore<Project>('projects', 'prj');
export const tasks = new JsonStore<Task>('tasks', 'tsk');
export const payments = new SupabaseCrud<Payment>('app_payments', 'pay');
export const leads = new SupabaseCrud<Lead>('app_leads', 'led');
export const employees = new JsonStore<Employee>('employees', 'emp');
export const campaigns = new SupabaseCrud<Campaign>('app_campaigns', 'cmp');
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
export const accountantDocuments = new JsonStore<AccountantDocument>('accountant-documents', 'acd');
export const podcastSessions = new SupabaseCrud<PodcastSession>('app_podcast_sessions', 'pcs');
export const aiSettings = new JsonStore<AISettings>('ai-settings', 'ais');
export const clientKnowledge = new SupabaseCrud<ClientKnowledge>('app_client_knowledge', 'ckn');
export const clientInsights = new SupabaseCrud<ClientInsight>('app_client_insights', 'cin');
export const creativeDNA = new SupabaseCrud<CreativeDNA>('app_creative_dna', 'cdna');
export const clientResearch = new JsonStore<ClientResearch>('client-research', 'crs');
export const employeeTasks = new SupabaseCrud<EmployeeTask>('app_employee_tasks', 'etk');
export const followUpReminders = new SupabaseCrud<FollowUpReminder>('app_follow_up_reminders', 'fur');
export const portalComments = new JsonStore<PortalComment>('portal-comments', 'pcm');
export const automationRules = new JsonStore<AutomationRule>('automation-rules', 'atr');
export const whatsappMessages = new SupabaseCrud<WhatsAppMessage>('app_whatsapp_messages', 'wam');
export const emailTemplates = new JsonStore<EmailTemplate>('email-templates', 'emt');
export const mailings = new SupabaseCrud<Mailing>('app_mailings', 'mai');
export const gmailSettings = new JsonStore<GmailSettings>('gmail-settings', 'gml');
export const meetings = new SupabaseCrud<Meeting>('app_meetings', 'mtg');
export const projectNotifications = new JsonStore<ProjectNotification>('project-notifications', 'pno');
