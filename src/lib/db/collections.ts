import { JsonStore } from './store';
import type {
  Client,
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
  AutomationRule,
  WhatsAppMessage,
  EmailTemplate,
  Mailing,
  GmailSettings,
  Meeting,
  ProjectNotification,
} from './schema';

export const clients = new JsonStore<Client>('clients', 'cli');
export const projects = new JsonStore<Project>('projects', 'prj');
export const tasks = new JsonStore<Task>('tasks', 'tsk');
export const payments = new JsonStore<Payment>('payments', 'pay');
export const leads = new JsonStore<Lead>('leads', 'led');
export const employees = new JsonStore<Employee>('employees', 'emp');
export const campaigns = new JsonStore<Campaign>('campaigns', 'cmp');
export const users = new JsonStore<User>('users', 'usr');
export const approvals = new JsonStore<Approval>('approvals', 'apr');
export const activities = new JsonStore<ActivityEntry>('activities', 'act');
export const clientGanttItems = new JsonStore<ClientGanttItem>('client-gantt-items', 'cgi');
export const clientTasks = new JsonStore<ClientTask>('client-tasks', 'ctk');
export const clientFiles = new JsonStore<ClientFile>('client-files', 'cfl');
export const portalUsers = new JsonStore<PortalUser>('portal-users', 'pru');
export const socialPosts = new JsonStore<SocialPost>('social-posts', 'spo');
export const clientEmailLogs = new JsonStore<ClientEmailLog>('client-email-logs', 'cel');
export const businessProjects = new JsonStore<BusinessProject>('business-projects', 'bpr');
export const projectMilestones = new JsonStore<ProjectMilestone>('project-milestones', 'pms');
export const projectPayments = new JsonStore<ProjectPayment>('project-payments', 'ppy');
export const hostingRecords = new JsonStore<HostingRecord>('hosting-records', 'hst');
export const accountantDocuments = new JsonStore<AccountantDocument>('accountant-documents', 'acd');
export const podcastSessions = new JsonStore<PodcastSession>('podcast-sessions', 'pcs');
export const aiSettings = new JsonStore<AISettings>('ai-settings', 'ais');
export const clientKnowledge = new JsonStore<ClientKnowledge>('client-knowledge', 'ckn');
export const creativeDNA = new JsonStore<CreativeDNA>('creative-dna', 'cdna');
export const clientResearch = new JsonStore<ClientResearch>('client-research', 'crs');
export const employeeTasks = new JsonStore<EmployeeTask>('employee-tasks', 'etk');
export const followUpReminders = new JsonStore<FollowUpReminder>('follow-up-reminders', 'fur');
export const portalComments = new JsonStore<PortalComment>('portal-comments', 'pcm');
export const automationRules = new JsonStore<AutomationRule>('automation-rules', 'atr');
export const whatsappMessages = new JsonStore<WhatsAppMessage>('whatsapp-messages', 'wam');
export const emailTemplates = new JsonStore<EmailTemplate>('email-templates', 'emt');
export const mailings = new JsonStore<Mailing>('mailings', 'mai');
export const gmailSettings = new JsonStore<GmailSettings>('gmail-settings', 'gml');
export const meetings = new JsonStore<Meeting>('meetings', 'mtg');
export const projectNotifications = new JsonStore<ProjectNotification>('project-notifications', 'pno');
