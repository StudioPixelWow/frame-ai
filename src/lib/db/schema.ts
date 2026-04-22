// Client — central business entity
export type ClientType = 'marketing' | 'branding' | 'websites' | 'hosting' | 'podcast' | 'lead';
export type PaymentStatus = 'current' | 'overdue' | 'pending' | 'none';
export type GanttStatus = 'draft' | 'approved' | 'sent_to_client' | 'client_approved' | 'none';

export interface Client {
  id: string;
  // Identity
  name: string;
  company: string;
  contactPerson: string;
  email: string;
  phone: string;
  logoUrl: string;
  color: string;
  // Business classification
  clientType: ClientType;
  // Business data
  businessField: string;
  marketingGoals: string;
  keyMarketingMessages: string;
  assignedManagerId: string | null;
  // Web & social source URLs (canonical business references / AI knowledge sources)
  websiteUrl: string;
  facebookPageUrl: string;
  instagramProfileUrl: string;
  tiktokProfileUrl: string;
  linkedinUrl: string;
  youtubeUrl: string;
  // Financial
  retainerAmount: number;
  retainerDay: number;
  paymentStatus: PaymentStatus;
  nextPaymentDate: string | null;
  // Status
  status: 'active' | 'inactive' | 'prospect';
  notes: string;
  convertedFromLead: string | null;
  createdAt: string;
  updatedAt: string;
  // Portal
  portalEnabled: boolean;
  portalUserId: string | null;
  lastPortalLoginAt: string | null;
  // Social / publishing (connected accounts)
  facebookPageId: string;
  facebookPageName: string;
  instagramAccountId: string;
  instagramUsername: string;
  tiktokAccountId: string;
  tiktokUsername: string;
  // Planning
  monthlyGanttStatus: GanttStatus;
  annualGanttStatus: GanttStatus;
}

// AI Settings
export type AIConnectionStatus = 'connected' | 'invalid_key' | 'missing_key' | 'untested';

export interface AISettings {
  id: string;
  // OpenAI / Whisper
  provider: 'openai' | 'anthropic';
  apiKey: string;
  defaultModel: string;
  connectionStatus: AIConnectionStatus;
  lastTestedAt: string | null;
  lastTestError: string;
  // AssemblyAI
  assemblyaiApiKey: string;
  assemblyaiConnectionStatus: AIConnectionStatus;
  assemblyaiLastTestedAt: string | null;
  assemblyaiLastTestError: string;
  // Transcription priority
  primaryTranscriptionProvider: 'assemblyai' | 'whisper';
  fallbackTranscriptionProvider: 'assemblyai' | 'whisper' | 'none';
  createdAt: string;
  updatedAt: string;
}

// Client Knowledge Source — aggregated AI intelligence per client
export interface ClientKnowledge {
  id: string;
  clientId: string;
  // AI-generated intelligence
  businessSummary: string;
  toneOfVoice: string;
  audienceProfile: string;
  keySellingPoints: string[];
  brandPersonality: string;
  competitiveAdvantage: string;
  // Learning data
  winningContentPatterns: string[];
  failedPatterns: string[];
  topPerformingTopics: string[];
  // Sources analyzed
  websiteUrl: string;
  facebookUrl: string;
  instagramUrl: string;
  sourcesAnalyzed: string[];
  // Weakness analysis
  weaknesses: Array<{
    description: string;
    severity: 'low' | 'medium' | 'high';
    impact: string;
    fixSuggestion: string;
  }>;
  // Ideal customer profile
  idealCustomer: {
    ageRange: string;
    interests: string[];
    behaviors: string[];
    painPoints: string[];
    primarySegment: string;
    secondarySegment: string;
  } | null;
  // Metadata
  lastAnalyzedAt: string;
  createdAt: string;
  updatedAt: string;

  // Legacy fields (for backward compatibility)
  websiteSummary?: string;
  facebookInsights?: string;
  instagramInsights?: string;
  businessContext?: string;
  toneAndStyle?: string;
  previousContentThemes?: string[];
  approvedCaptionStyles?: string[];
  topPerformingFormats?: string[];
  pastCampaigns?: string[];
  seasonalPatterns?: string;
  lastUpdatedSources?: string[];
  lastEnrichedAt?: string | null;
}

// Creative DNA — brand creative identity & patterns
export interface CreativeDNA {
  id: string;
  clientId: string;
  // Core brand identity
  toneOfVoice: string; // e.g. "מקצועי ונגיש" or "חצוף ומרגש"
  sellingStyle: string; // e.g. "soft-sell educative" or "direct-response"
  visualStyle: string; // e.g. "מינימליסטי כהה עם נגיעות ניאון"
  // Content patterns
  hookTypes: string[]; // e.g. ["שאלה", "הצהרה נועזת", "סטטיסטיקה", "סיפור"]
  contentTypes: string[]; // all allowed content types for this client
  audienceStyle: string; // how to address the audience
  // Restrictions
  doNotUsePatterns: string[]; // phrases, structures, tones to avoid
  preferredEmojis: string[]; // max 5 brand emojis
  hashtagStrategy: string; // e.g. "3-5 targeted hashtags, no generic"
  // Visual
  colorPalette: string[]; // e.g. ["#1a1a2e", "#e94560", "#0f3460"]
  photographyStyle: string; // e.g. "close-up, shallow depth, warm tones"
  graphicStyle: string; // e.g. "bold typography, geometric shapes"
  // Meta
  generatedBy: 'ai' | 'manual';
  lastGeneratedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Client Insight — persisted AI insight results per section
export type InsightSection = 'client_brain' | 'brand_weakness' | 'customer_profile' | 'trend_engine' | 'competitor_insights' | 'creative_dna';
export type InsightStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ClientInsight {
  id: string;
  clientId: string;
  section: InsightSection;
  payload: unknown; // section-specific data
  status: InsightStatus;
  error?: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Client Research — deep AI analysis of client business, competitors, opportunities
export interface ClientResearch {
  id: string;
  clientId: string;
  // 1. Client Identity
  identity: {
    whatTheySell: string;
    positioning: string;
    tone: string;
    uniqueValue: string;
    targetAudience: string;
  };
  // 2. Audience Deep Dive
  audience: {
    primary: string;
    secondary: string;
    painPoints: string[];
  };
  // 3. Weaknesses
  weaknesses: Array<{
    area: string;
    description: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    recommendation: string;
  }>;
  // 4. Competitor Insights
  competitors: Array<{
    name: string;
    whatWorks: string[];
    contentTypes: string[];
    toneDifference: string;
    weakness: string;
  }>;
  competitorSummary: {
    doMoreOf: string[];
    avoid: string[];
    contentTypesPerforming: string[];
  };
  // 5. Market Opportunities
  opportunities: Array<{
    title: string;
    description: string;
    potentialImpact: 'high' | 'medium' | 'low';
    category: 'gap' | 'underused_angle' | 'positioning' | 'trend';
  }>;
  // 6. Recommended Content Angles
  recommendedContentAngles: string[];
  // 6b. 25 Strategic Content Ideas (selectable for Gantt)
  contentIdeas25?: Array<{
    id: string;        // unique idea ID (e.g. "idea_1", "idea_2")
    title: string;     // core concept / hook
    explanation: string; // strategic angle / direction
    category: 'weakness' | 'opportunity' | 'audience' | 'competitor' | 'trend' | 'seasonal' | 'brand' | 'engagement';
  }>;
  // 7. Recommended Campaign Concepts
  recommendedCampaignConcepts: Array<{
    name: string;
    goal: string;
    platforms: string[];
    format: string;
  }>;
  // 8. Action Plan
  actionPlan: {
    thingsToDo: Array<{ action: string; priority: 'urgent' | 'high' | 'medium'; }>;
    thingsToStop: Array<{ action: string; reason: string; }>;
    contentIdeas: Array<{ idea: string; format: string; platform: string; }>;
  };
  // Sources
  sourcesAnalyzed: string[];
  // Manual strategic notes from the user
  strategicNotes?: string;
  notesAppliedAt?: string; // ISO timestamp of when notes were last used to regenerate
  // Explicit save
  savedAt?: string; // ISO timestamp of last explicit user save
  // Meta
  status: 'pending' | 'analyzing' | 'complete' | 'failed';
  error?: string;
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
}

// Project (video production)
export type ProjectStatus = 'draft' | 'analysing' | 'approved' | 'rendering' | 'complete' | 'failed' | 'sent_to_client';

export interface Project {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  status: ProjectStatus;
  format: '9:16' | '16:9' | '1:1' | '4:5';
  preset: string;
  durationSec: number;
  segments: unknown[] | Record<string, unknown> | null;
  sourceVideoKey: string | null;
  renderOutputKey: string | null;
  thumbnailKey: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number;
  wizardState: Record<string, unknown> | null;
  renderPayload: Record<string, unknown> | null;
  sentToClientAt: string | null;
  sentToClientEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

// Task
export type TaskStatus = 'new' | 'in_progress' | 'under_review' | 'returned' | 'approved' | 'completed';
export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  clientId: string | null;
  clientName: string;
  assigneeIds: string[];
  dueDate: string | null;
  tags: string[];
  files: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Payment
export interface Payment {
  id: string;
  clientId: string;
  clientName: string;
  invoiceNo: string;
  type: 'invoice' | 'retainer' | 'milestone' | 'expense';
  amount: number;
  status: 'draft' | 'pending' | 'msg_sent' | 'paid' | 'overdue' | 'write_off';
  dueDate: string;
  paidAt: string | null;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// Lead
export type LeadInterestType = 'marketing' | 'podcast' | 'branding' | 'website' | 'hosting' | 'other';
export type LeadStatus = 'new' | 'assigned' | 'contacted' | 'no_answer' | 'interested' | 'proposal_sent' | 'negotiation' | 'meeting_set' | 'won' | 'lost' | 'not_relevant' | 'duplicate';

export interface Lead {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  source: string;
  interestType: LeadInterestType;
  proposalSent: boolean;
  proposalAmount: number;
  status: LeadStatus;
  followupDone: boolean;
  notes: string;
  // Legacy compat
  name: string;       // alias for fullName
  company: string;
  value: number;       // alias for proposalAmount
  assigneeId: string | null;
  followUpAt: string | null;
  convertedAt: string | null;
  convertedClientId: string | null;
  convertedEntityType: 'client' | 'project' | null;
  convertedEntityId: string | null;
  // Campaign-client binding
  campaignId: string | null;
  campaignName: string;
  adAccountId: string;
  adSetName: string;
  adName: string;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Employee
export type EmployeeRole = 'admin' | 'manager' | 'employee' | 'viewer';

export interface Employee {
  id: string;
  name: string;
  roleId: string;
  role: EmployeeRole;
  email: string;
  phone: string;
  avatarUrl: string;
  salary: number;
  status: 'online' | 'busy' | 'offline';
  skills: string[];
  tasksCount: number;
  workload: number;
  joinDate: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Employee Task
export type EmployeeTaskStatus = 'new' | 'in_progress' | 'under_review' | 'returned' | 'approved' | 'completed';
export type EmployeeTaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface EmployeeTask {
  id: string;
  title: string;
  description: string;
  assignedEmployeeId: string;
  clientId: string | null;
  clientName: string;
  projectId: string | null;
  ganttItemId: string | null;
  dueDate: string | null;
  status: EmployeeTaskStatus;
  priority: EmployeeTaskPriority;
  files: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Follow-up Reminder
export interface FollowUpReminder {
  id: string;
  leadId: string;
  leadName: string;
  scheduledDate: string;
  reminderType: 'next_day' | 'four_day';
  emailSent: boolean;
  status: 'pending' | 'sent' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

// Meeting — standalone calendar event (not tied to a task)
export type MeetingStatus = 'scheduled' | 'completed' | 'cancelled';

export interface Meeting {
  id: string;
  title: string;
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM
  endTime: string;       // HH:MM
  description: string;
  clientId: string | null;
  clientName: string;
  location: string;      // Physical or URL
  reminderSent: boolean;
  reminderDayBefore: boolean;
  reminderSameDay: boolean;
  status: MeetingStatus;
  createdAt: string;
  updatedAt: string;
}

// Campaign
export type CampaignType = 'paid_social' | 'organic_social' | 'lead_gen' | 'awareness' | 'remarketing' | 'podcast_promo' | 'custom';
export type CampaignStatus = 'draft' | 'in_progress' | 'waiting_approval' | 'approved' | 'scheduled' | 'active' | 'completed';
export type CampaignMediaType = 'image' | 'video';
export type CampaignPlatform = 'facebook' | 'instagram' | 'tiktok' | 'multi_platform';

export interface Campaign {
  id: string;
  clientId: string;
  clientName: string;
  campaignName: string;
  campaignType: CampaignType;
  objective: string;
  platform: CampaignPlatform;
  status: CampaignStatus;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  caption: string;
  mediaType: CampaignMediaType;
  linkedVideoProjectId: string | null;
  linkedClientFileId: string | null;
  externalMediaUrl: string;
  notes: string;
  adAccountId: string;
  leadFormIds: string[];
  createdAt: string;
  updatedAt: string;
}

// User
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'editor' | 'viewer';
  avatar: string | null;
  status: 'active' | 'inactive';
  createdAt: string;
  lastSeen: string;
}

// Approval
export interface Approval {
  id: string;
  type: 'video' | 'post' | 'gantt' | 'design' | 'milestone';
  title: string;
  clientName: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'needs_changes';
  createdAt: string;
  updatedAt: string;
}

// Client Gantt Item — full content planning item
export type GanttItemType = 'social_post' | 'story' | 'reel' | 'carousel' | 'internal_task' | 'campaign_task';
export type GanttItemStatus = 'new_idea' | 'draft' | 'planned' | 'in_progress' | 'submitted_for_approval' | 'returned_for_changes' | 'approved' | 'scheduled' | 'published' | 'cancelled';
export type ContentPlatform = 'facebook' | 'instagram' | 'tiktok' | 'all';
export type ContentFormat = 'image' | 'video' | 'story' | 'reel' | 'carousel' | 'live' | 'text';

export interface ClientGanttItem {
  id: string;
  clientId: string;
  // Scope
  ganttType: 'monthly' | 'annual'; // monthly = specific item, annual = strategic theme
  month: number; // 1-12
  year: number;
  date: string; // target publish date (ISO)
  // Content
  title: string;
  ideaSummary: string; // idea description
  graphicText: string; // 2 short lines for graphic
  caption: string; // full social caption draft
  visualConcept: string; // Detailed visual/design idea for this post
  // Classification
  itemType: GanttItemType;
  platform: ContentPlatform;
  format: ContentFormat;
  // Media
  relatedVideoId: string;
  relatedFileUrl: string;
  imageUrls: string[];
  attachedFiles: string[];
  // Assignment
  assigneeId: string | null;
  assignedManagerId: string | null;
  // Status
  status: GanttItemStatus;
  // Notes
  internalNotes: string;
  clientNotes: string;
  // Holiday/campaign context
  holidayTag: string; // e.g. "חנוכה", "פסח", ""
  campaignTag: string;
  // Annual-specific (for ganttType === 'annual')
  monthTheme: string; // strategic focus for the month
  suggestedRhythm: string; // e.g. "3 posts/week"
  keyOpportunities: string; // notable holidays/opportunities
  // Research traceability
  researchSource?: 'weakness' | 'opportunity' | 'competitor' | 'audience' | 'campaign_concept' | 'content_angle' | 'action_plan' | 'manual_note' | '';
  researchReason?: string; // short explanation why this item was created based on research
  // Research snapshot metadata (set at generation time)
  researchVersionUsed?: string; // research record ID used for generation
  researchSavedAt?: string; // when the research was last saved (snapshot)
  ganttGeneratedAt?: string; // when this gantt batch was generated
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Client Task (extends base Task concept for client-specific workflows)
export interface ClientTask {
  id: string;
  clientId: string;
  title: string;
  description: string;
  taskType: 'social' | 'internal' | 'design' | 'website' | 'branding' | 'general';
  status: 'backlog' | 'todo' | 'in_progress' | 'under_review' | 'done';
  priority: 'urgent' | 'high' | 'medium' | 'low';
  assigneeId: string | null;
  dueDate: string | null;
  files: string[]; // array of file URLs
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Client File
export interface ClientFile {
  id: string;
  clientId: string;
  fileName: string;
  fileUrl: string;
  fileType: 'video' | 'image' | 'document' | 'pdf' | 'draft' | 'other';
  category: 'social_media' | 'agreements' | 'branding' | 'website' | 'accountant' | 'approved_final' | 'general';
  fileSize: number; // bytes
  linkedTaskId: string | null;
  linkedGanttItemId: string | null;
  uploadedBy: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Portal User (client portal access)
export interface PortalUser {
  id: string;
  clientId: string;
  email: string;
  passwordHash: string;
  magicLinkToken: string | null;
  magicLinkExpiresAt: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Social Post (client social media posts)
export interface SocialPost {
  id: string;
  clientId: string;
  platform: 'facebook' | 'instagram' | 'tiktok';
  postType: 'post' | 'story' | 'reel' | 'carousel' | 'live';
  content: string;
  mediaUrls: string[];
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  publishedAt: string | null;
  scheduledAt: string | null;
  likes: number;
  comments: number;
  views: number;
  shares: number;
  linkedGanttItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Client Email Log
export interface ClientEmailLog {
  id: string;
  clientId: string;
  emailType: 'gantt_approval' | 'weekly_update' | 'payment_reminder' | 'portal_login' | 'general' | 'video_send';
  subject: string;
  recipientEmail: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'pending';
  createdAt: string;
}

// Business Project service types — must match values in
// public.business_project_milestone_templates.service_type exactly so that
// milestone auto-generation on create finds matching templates.
export type BusinessProjectType =
  | 'website'
  | 'branding'
  | 'social'
  | 'campaign'
  | 'seo'
  | 'landing_page'
  | 'automation'
  | 'crm'
  | 'design'
  | 'consulting';
export type BusinessProjectStatus = 'not_started' | 'in_progress' | 'waiting_for_client' | 'completed';

export interface BusinessProject {
  id: string;
  projectName: string;
  clientId: string;
  projectType: BusinessProjectType;
  description: string;
  agreementSigned: boolean;
  contractSigned: boolean;
  contractSignedAt: string | null;
  budget: number;
  projectStatus: BusinessProjectStatus;
  startDate: string | null;
  endDate: string | null;
  assignedManagerId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Project Milestone
export type MilestoneStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'returned';

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  dueDate: string | null;
  assignedEmployeeId: string | null;
  status: MilestoneStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Project Payment
export type ProjectPaymentStatus = 'pending' | 'collection_needed' | 'paid' | 'overdue';
export type PaymentType = 'deposit' | 'final' | 'custom';

export interface ProjectPayment {
  id: string;
  projectId: string;
  clientId: string;
  title: string;
  amount: number;
  dueDate: string;
  status: ProjectPaymentStatus;
  description: string;
  milestoneId: string | null;
  paymentType: PaymentType;
  isDue: boolean;
  isPaid: boolean;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Hosting Record
export interface HostingRecord {
  id: string;
  clientId: string;
  domainName: string;
  hostingProvider: string;
  yearlyPaymentAmount: number;
  nextPaymentDate: string;
  lastPaidDate: string | null;
  status: 'active' | 'expiring_soon' | 'overdue' | 'cancelled';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Accountant Document
export interface AccountantDocument {
  id: string;
  period: string; // e.g. "jan-feb", "mar-apr", "may-jun", "jul-aug", "sep-oct", "nov-dec"
  periodLabel: string; // e.g. "ינואר-פברואר 2026"
  year: number;
  fileName: string;
  fileUrl: string;
  fileType: 'invoice' | 'receipt' | 'report' | 'tax' | 'other';
  notes: string;
  sentToAccountant: boolean;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Podcast Session
export type PodcastPackageType = 'recording_only' | 'recording_3_videos' | 'recording_5_videos' | 'recording_10_videos';
export type PodcastSessionStatus = 'booked' | 'completed' | 'cancelled' | 'no_show';
export type PodcastContentStatus = 'pending_upload' | 'drafts_uploaded' | 'client_review' | 'revisions' | 'approved' | 'completed';

export interface PodcastSession {
  id: string;
  clientId: string;
  clientName: string;
  packageType: PodcastPackageType;
  price: number;
  sessionDate: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm (auto: startTime + 1.5hr)
  sessionStatus: PodcastSessionStatus;
  contentStatus: PodcastContentStatus;
  agreementPdfUrl: string;
  agreementSent: boolean;
  videosCount: number;
  draftUrls: string[];
  finalUrls: string[];
  paymentStatus: ProjectPaymentStatus;
  paidAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Client Portal Comment / Feedback
export interface PortalComment {
  id: string;
  clientId: string;
  portalUserId: string;
  entityType: 'gantt_item' | 'approval' | 'file' | 'project' | 'general';
  entityId: string;
  action: 'approve' | 'request_changes' | 'comment';
  comment: string;
  isInternal: boolean; // false = client-facing
  createdAt: string;
  updatedAt: string;
}

// Activity log entry
export interface ActivityEntry {
  id: string;
  type: 'project' | 'client' | 'render' | 'ai' | 'payment' | 'task' | 'lead';
  icon: string;
  title: string;
  description: string;
  entityId: string | null;
  userId: string | null;
  createdAt: string;
}

// Automation Rule
export type AutomationTrigger =
  | 'task_created' | 'task_status_changed' | 'file_uploaded_to_task'
  | 'gantt_created' | 'gantt_approved' | 'gantt_sent_to_client'
  | 'payment_due' | 'payment_overdue'
  | 'lead_status_changed' | 'proposal_sent'
  | 'project_created' | 'project_status_changed'
  | 'podcast_session_booked' | 'podcast_session_completed'
  | 'client_missing_monthly_gantt' | 'client_less_than_2_weekly_posts'
  | 'weekly_client_email_day' | 'employee_task_due_today';

export type AutomationAction =
  | 'send_email' | 'send_whatsapp' | 'create_task' | 'update_status'
  | 'create_notification' | 'assign_employee' | 'generate_pdf'
  | 'add_to_calendar' | 'push_to_approval_center';

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  isActive: boolean;
  targetEmail: string;
  targetWhatsApp: string;
  templateId: string | null;
  conditions: string;
  lastTriggeredAt: string | null;
  triggerCount: number;
  approvalMode?: 'auto_safe' | 'requires_approval' | 'recommendation_only';
  scope?: string;
  clientId?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Automation Run — persisted execution record
export type AutomationRunStatus = 'success' | 'failed' | 'skipped' | 'pending_approval' | 'approved' | 'rejected';

export interface AutomationRun {
  id: string;
  ruleId: string;
  ruleName: string;
  eventId: string;
  eventType: string;
  trigger: string;
  action: string;
  status: AutomationRunStatus;
  approvalMode: 'auto_safe' | 'requires_approval' | 'recommendation_only';
  result: Record<string, unknown>;
  aiDecision: Record<string, unknown> | null;
  clientId: string | null;
  entityType: string;
  entityId: string | null;
  executedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Approval Queue Item — pending automation approvals
export type ApprovalQueueStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalQueueItem {
  id: string;
  automationRunId: string;
  ruleId: string;
  ruleName: string;
  action: string;
  eventType: string;
  eventPayload: Record<string, unknown>;
  clientId: string | null;
  clientName: string;
  entityType: string;
  entityId: string | null;
  aiRecommendation: string | null;
  aiConfidence: number | null;
  status: ApprovalQueueStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

// WhatsApp Message
export type WhatsAppMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface WhatsAppMessage {
  id: string;
  clientId: string;
  clientName: string;
  phone: string;
  templateName: string;
  message: string;
  status: WhatsAppMessageStatus;
  direction: 'outgoing' | 'incoming';
  relatedEntityType: string;
  relatedEntityId: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Email Template
export type EmailTemplateType =
  | 'gantt_approval' | 'weekly_update' | 'payment_reminder' | 'portal_login'
  | 'task_submitted' | 'task_returned' | 'proposal_followup'
  | 'podcast_agreement' | 'podcast_final_materials' | 'accountant_export'
  | 'general';

export interface EmailTemplate {
  id: string;
  name: string;
  type: EmailTemplateType;
  subject: string;
  bodyHtml: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Mailing
export type MailingStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

export interface Mailing {
  id: string;
  subject: string;
  body: string;
  recipientFilter: {
    type: 'all' | 'by_client_type' | 'by_employee' | 'by_payment_status' | 'by_portal' | 'manual';
    clientTypes?: string[];
    employeeId?: string;
    paymentStatus?: string;
    portalEnabled?: boolean;
    manualClientIds?: string[];
  };
  recipientCount: number;
  status: MailingStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
}

// Gmail Integration
export type GmailConnectionStatus = 'not_connected' | 'connected' | 'error' | 'reconnecting';

export interface MilestoneFile {
  id: string;
  milestoneId: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  contentType: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectTimelineEvent {
  id: string;
  projectId: string;
  actionType: string;
  description: string;
  createdAt: string;
}

// ── Project Notifications ──
export type ProjectNotificationType = 'milestone_overdue' | 'no_assignee' | 'inactivity' | 'payment_overdue' | 'status_change';
export type ProjectNotificationSeverity = 'critical' | 'warning' | 'info';

export interface ProjectNotification {
  id: string;
  type: ProjectNotificationType;
  severity: ProjectNotificationSeverity;
  message: string;
  projectId: string;
  milestoneId: string | null;
  isRead: boolean;
  linkHref: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GmailSettings {
  id: string;
  connectionStatus: GmailConnectionStatus;
  connectedEmail: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string | null;
  senderDisplayName: string;
  replyToEmail: string;
  defaultSignature: string;
  lastSyncAt: string | null;
  lastError: string;
  isSystemEmailOrigin: boolean;
  createdAt: string;
  updatedAt: string;
}

// System Event — internal system-level events and monitoring
export type SystemEventType = 'error' | 'warning' | 'info' | 'success' | 'migration' | 'sync' | 'trigger';

export interface SystemEvent {
  id: string;
  type: SystemEventType;
  source: string; // e.g. 'ai-renderer', 'email-service', 'sync-service'
  title: string;
  message: string;
  details: Record<string, unknown>;
  severity: 'critical' | 'high' | 'medium' | 'low';
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
}

// Audit Log — user action tracking and compliance
export type AuditLogAction =
  | 'create' | 'update' | 'delete' | 'read'
  | 'approve' | 'reject' | 'submit'
  | 'export' | 'import' | 'download'
  | 'share' | 'invite' | 'remove_access'
  | 'change_settings' | 'authenticate';

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: AuditLogAction;
  entityType: string; // e.g. 'client', 'project', 'task'
  entityId: string | null;
  entityName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  changes: Record<string, { old: unknown; new: unknown }>;
  result: 'success' | 'failure';
  errorMessage: string | null;
  createdAt: string;
}
