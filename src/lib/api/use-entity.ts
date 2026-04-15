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
} from '@/lib/db/schema';

export const useClients = () => useData<Client>('clients');
export const useProjects = () => useData<Project>('projects');
export const useTasks = () => useData<Task>('tasks');
export const usePayments = () => useData<Payment>('payments');
export const useLeads = () => useData<Lead>('leads');
export const useEmployees = () => useData<Employee>('employees');
export const useCampaigns = () => useData<Campaign>('campaigns');
export const useUsers = () => useData<User>('users');
export const useApprovals = () => useData<Approval>('approvals');
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
