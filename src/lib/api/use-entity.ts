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
  AdSet,
  Ad,
  AutomationRule,
  AutomationRun,
  ApprovalQueueItem,
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
  PodcastStrategy,
  ClientNotification,
} from '@/lib/db/schema';

// Core entities — relaxed polling (3 min) + no refetch on focus to avoid jankiness
export const useClients = () => useData<Client>('clients', { pollInterval: 180000, refetchOnFocus: false });
export const useProjects = () => useData<Project>('projects', { refetchOnFocus: false });
export const useTasks = () => useData<Task>('tasks', { pollInterval: 180000, refetchOnFocus: false });
export const usePayments = () => useData<Payment>('payments', { pollInterval: 180000, refetchOnFocus: false });
export const useLeads = () => useData<Lead>('leads', { pollInterval: 300000, refetchOnFocus: false });
export const useEmployees = () => useData<Employee>('employees', { refetchOnFocus: false });
export const useCampaigns = () => useData<Campaign>('campaigns', { refetchOnFocus: false });
export const useAdSets = () => useData<AdSet>('ad-sets', { refetchOnFocus: false });
export const useAds = () => useData<Ad>('ads', { refetchOnFocus: false });
export const useUsers = () => useData<User>('users', { refetchOnFocus: false });
export const useApprovals = () => useData<Approval>('approvals', { pollInterval: 180000, refetchOnFocus: false });
export const useActivities = () => useData<ActivityEntry>('activities', { refetchOnFocus: false });
export const useClientGanttItems = () => useData<ClientGanttItem>('client-gantt-items', { refetchOnFocus: false });
export const useClientTasks = () => useData<ClientTask>('client-tasks', { refetchOnFocus: false });
export const useClientFiles = () => useData<ClientFile>('client-files', { refetchOnFocus: false });
export const usePortalUsers = () => useData<PortalUser>('portal-users', { refetchOnFocus: false });
export const useSocialPosts = () => useData<SocialPost>('social-posts', { refetchOnFocus: false });
export const useClientEmailLogs = () => useData<ClientEmailLog>('client-email-logs', { refetchOnFocus: false });
export const useBusinessProjects = () => useData<BusinessProject>('business-projects', { refetchOnFocus: false });
export const useProjectMilestones = () => useData<ProjectMilestone>('project-milestones', { refetchOnFocus: false });
export const useProjectPayments = () => useData<ProjectPayment>('project-payments', { refetchOnFocus: false });
export const useHostingRecords = () => useData<HostingRecord>('hosting-records', { refetchOnFocus: false });
export const useAccountantDocuments = () => useData<AccountantDocument>('accountant-documents', { refetchOnFocus: false });
export const usePodcastSessions = () => useData<PodcastSession>('podcast-sessions', { refetchOnFocus: false });
export const usePodcastStrategies = () => useData<PodcastStrategy>('podcast-strategies', { refetchOnFocus: false });
export const useAISettings = () => useData<AISettings>('ai-settings', { refetchOnFocus: false });
export const useClientKnowledge = () => useData<ClientKnowledge>('client-knowledge', { refetchOnFocus: false });
export const useEmployeeTasks = () => useData<EmployeeTask>('employee-tasks', { refetchOnFocus: false });
export const useFollowUpReminders = () => useData<FollowUpReminder>('follow-up-reminders', { refetchOnFocus: false });
export const usePortalComments = () => useData<PortalComment>('portal-comments', { refetchOnFocus: false });
export const useAutomationRules = () => useData<AutomationRule>('automation-rules', { refetchOnFocus: false });
export const useWhatsAppMessages = () => useData<WhatsAppMessage>('whatsapp-messages', { refetchOnFocus: false });
export const useEmailTemplates = () => useData<EmailTemplate>('email-templates', { refetchOnFocus: false });
export const useMailings = () => useData<Mailing>('mailings', { refetchOnFocus: false });
export const useGmailSettings = () => useData<GmailSettings>('gmail-settings', { refetchOnFocus: false });
export const useMeetings = () => useData<Meeting>('meetings', { refetchOnFocus: false });
export const useMilestoneFiles = () => useData<MilestoneFile>('milestone-files', { refetchOnFocus: false });
export const useProjectTimeline = () => useData<ProjectTimelineEvent>('project-timeline', { refetchOnFocus: false });
export const useProjectNotifications = () => useData<ProjectNotification>('project-notifications', { refetchOnFocus: false });
export const useSystemEvents = () => useData<SystemEvent>('system-events', { pollInterval: 180000, refetchOnFocus: false });
export const useAuditLog = () => useData<AuditLog>('audit-log', { pollInterval: 180000, refetchOnFocus: false });
export const useAutomationRuns = () => useData<AutomationRun>('automation-runs', { pollInterval: 300000, refetchOnFocus: false });
export const useApprovalQueue = () => useData<ApprovalQueueItem>('approval-queue', { pollInterval: 300000, refetchOnFocus: false });
export const useClientNotifications = () => useData<ClientNotification>('client-notifications', { pollInterval: 300000, refetchOnFocus: false });
