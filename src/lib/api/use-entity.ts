"use client";

import { useData } from './use-data';
import type {
  Client,
  Project,
  Task,
  Payment,
  Lead,
  Employee,
  EmployeeTask,
  FollowUpReminder,
  PortalComment,
  Campaign,
  User,
  Approval,
  ActivityEntry,
  ClientGanttItem,
  ClientTask,
  ClientFile,
  PortalUser,
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
  AutomationRule,
  WhatsAppMessage,
  EmailTemplate,
  Mailing,
  GmailSettings,
  Meeting,
  MilestoneFile,
  ProjectTimelineEvent,
  ProjectNotification,
  SystemEvent,
  AuditLog,
} from '@/lib/db/schema';

// Core entities — relaxed polling (3 min) + no refetch on focus to avoid jankiness
export const useClients = () => useData<Client>('clients', { pollInterval: 180000, refetchOnFocus: false });
export const useProjects = () => useData<Project>('projects', { refetchOnFocus: false });
export const useTasks = () => useData<Task>('tasks', { pollInterval: 180000, refetchOnFocus: false });
export const usePayments = () => useData<Payment>('payments', { pollInterval: 180000, refetchOnFocus: false });
export const useLeads = () => useData<Lead>('leads', { pollInterval: 300000, refetchOnFocus: false });
export const useEmployees = () => useData<Employee>('employees', { refetchOnFocus: false });
export const useCampaigns = () => useData<Campaign>('campaigns', { refetchOnFocus: false });
export const useUsers = () => useData<User>('users', { refetchOnFocus: false });
export const useApprovals = () => useData<Approval>('approvals', { pollInterval: 180000, refetchOnFocus: false });
export const useActivities = () => useData<ActivityEntry>('activities');
export const useClientGanttItems = () => useData<ClientGanttItem>('client-gantt-items');
export const useClientTasks = () => useData<ClientTask>('client-tasks');
export const useClientFiles = () => useData<ClientFile>('client-files');
export const usePortalUsers = () => useData<PortalUser>('portal-users');
export const useSocialPosts = () => useData<SocialPost>('social-posts');
export const useClientEmailLogs = () => useData<ClientEmailLog>('client-email-logs');
export const useBusinessProjects = () => useData<BusinessProject>('business-projects');
export const useProjectMilestones = () => useData<ProjectMilestone>('project-milestones');
export const useProjectPayments = () => useData<ProjectPayment>('project-payments');
export const useHostingRecords = () => useData<HostingRecord>('hosting-records');
export const useAccountantDocuments = () => useData<AccountantDocument>('accountant-documents');
export const usePodcastSessions = () => useData<PodcastSession>('podcast-sessions');
export const useAISettings = () => useData<AISettings>('ai-settings');
export const useClientKnowledge = () => useData<ClientKnowledge>('client-knowledge');
export const useEmployeeTasks = () => useData<EmployeeTask>('employee-tasks');
export const useFollowUpReminders = () => useData<FollowUpReminder>('follow-up-reminders');
export const usePortalComments = () => useData<PortalComment>('portal-comments');
export const useAutomationRules = () => useData<AutomationRule>('automation-rules');
export const useWhatsAppMessages = () => useData<WhatsAppMessage>('whatsapp-messages');
export const useEmailTemplates = () => useData<EmailTemplate>('email-templates');
export const useMailings = () => useData<Mailing>('mailings');
export const useGmailSettings = () => useData<GmailSettings>('gmail-settings');
export const useMeetings = () => useData<Meeting>('meetings');
export const useMilestoneFiles = () => useData<MilestoneFile>('milestone-files');
export const useProjectTimeline = () => useData<ProjectTimelineEvent>('project-timeline');
export const useProjectNotifications = () => useData<ProjectNotification>('project-notifications');
export const useSystemEvents = () => useData<SystemEvent>('system-events', { pollInterval: 180000, refetchOnFocus: false });
export const useAuditLog = () => useData<AuditLog>('audit-log', { pollInterval: 180000, refetchOnFocus: false });
