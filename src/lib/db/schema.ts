// Client — central business entity
export type ClientType = 'marketing' | 'branding' | 'websites' | 'hosting' | 'podcast' | 'lead';
export type PaymentStatus = 'current' | 'overdue' | 'pending' | 'none';
export type GanttStatus = 'draft' | 'approved' | 'sent_to_client' | 'client_approved' | 'none';
export type MetaConnectionStatus = 'connected' | 'not_connected' | 'token_expired' | 'missing_permissions' | 'sync_error';

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
  // Content scheduling
  weeklyPostsCount: number;
  publishDays: number[]; // 0=Sun, 1=Mon, ... 6=Sat — default [0,2,4] (Sun/Tue/Thu)
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
  // Meta Ad Account Connection
  metaBusinessId: string;
  metaAdAccountId: string;
  metaAccessToken: string;
  metaPageId: string;
  metaInstagramAccountId: string;
  metaPixelId: string;
  metaConnectionStatus: MetaConnectionStatus;
  metaLastSyncedAt: string | null;
  metaLastSyncError: string;
  // TikTok Ads Connection
  tiktokAdvertiserId: string;
  tiktokAccessToken: string;
  tiktokConnectionStatus: MetaConnectionStatus;
  tiktokLastSyncedAt: string | null;
  tiktokLastSyncError: string;
  // Google Ads Connection
  googleCustomerId: string;
  googleRefreshToken: string;
  googleDeveloperToken: string;
  googleManagerId: string;
  googleConnectionStatus: MetaConnectionStatus;
  googleLastSyncedAt: string | null;
  googleLastSyncError: string;
  // WordPress Connection (for SEO/GEO automation)
  wpSiteUrl: string;
  wpUsername: string;
  wpApplicationPassword: string;
  wpConnectionStatus: MetaConnectionStatus;
  wpSiteName: string;
  wpConnectedAt: string | null;
  // Google Search Console Connection
  gscRefreshToken: string;
  gscSiteUrl: string;
  gscConnectionStatus: 'connected' | 'not_connected' | 'token_expired' | 'error';
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
  // Campaign-client binding (attribution)
  campaignId: string | null;
  campaignName: string;
  adAccountId: string;
  adSetId: string | null;
  adId: string | null;
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
export type CampaignStatus = 'draft' | 'in_progress' | 'waiting_approval' | 'approved' | 'scheduled' | 'active' | 'completed' | 'paused' | 'rejected' | 'archived';
export type CampaignMediaType = 'image' | 'video';
export type CampaignPlatform = 'facebook' | 'instagram' | 'tiktok' | 'google' | 'linkedin' | 'multi_platform';

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
  // Meta sync
  metaCampaignId: string;
  metaSyncSource: 'local' | 'meta_sync';
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Ad Set — middle layer (Campaign → Ad Set → Ad)
export type AdSetStatus = 'active' | 'paused' | 'draft' | 'archived';

export interface AdSet {
  id: string;
  campaignId: string;
  name: string;
  status: AdSetStatus;

  // Audience / Targeting
  ageMin: number | null;
  ageMax: number | null;
  genders: ('male' | 'female' | 'all')[];
  geoLocations: string[];          // e.g. ["תל אביב", "ירושלים"]
  interests: string[];             // e.g. ["עסקים קטנים", "שיווק דיגיטלי"]
  customAudiences: string[];       // audience IDs
  excludedAudiences: string[];     // excluded audience IDs
  placements: string[];            // e.g. ["feed", "stories", "reels"]

  // Budget & Schedule
  dailyBudget: number | null;
  lifetimeBudget: number | null;
  startDate: string | null;
  endDate: string | null;
  bidStrategy: 'lowest_cost' | 'cost_cap' | 'bid_cap' | null;
  bidAmount: number | null;

  // Meta sync
  metaAdSetId: string;
  lastSyncedAt: string | null;

  // Notes
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// Ad — creative layer (Campaign → Ad Set → Ad)
export type AdStatus = 'active' | 'paused' | 'draft' | 'rejected' | 'archived';
export type AdCreativeType = 'image' | 'video' | 'carousel' | 'slideshow';

export interface Ad {
  id: string;
  adSetId: string;
  campaignId: string;           // denormalized for easy queries
  name: string;
  status: AdStatus;

  // Creative
  creativeType: AdCreativeType;
  mediaUrl: string;             // image or video URL
  thumbnailUrl: string | null;  // video thumbnail / carousel first image
  primaryText: string;          // main ad copy
  headline: string;             // bold headline
  description: string;          // optional description line
  ctaType: string;              // e.g. "LEARN_MORE", "SIGN_UP", "SHOP_NOW"
  ctaLink: string;              // destination URL

  // Linked assets
  linkedVideoProjectId: string | null;
  linkedClientFileId: string | null;

  // Performance metrics (synced from Meta or manual)
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  conversions: number;
  ctr: number;                  // clicks/impressions
  cpl: number;                  // cost per lead
  cpc: number;                  // cost per click
  roas: number;                 // return on ad spend
  reach: number;                // unique people who saw the ad
  frequency: number;            // average times each person saw the ad
  cpm: number;                  // cost per 1000 impressions

  // Meta sync
  metaAdId: string;
  lastSyncedAt: string | null;

  notes: string;
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
export type MilestoneStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'returned' | 'completed';

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

// Campaign Action — pending automation actions from optimization engine
export type CampaignActionType =
  | 'duplicate_ad'
  | 'create_variation'
  | 'pause_ad'
  | 'resume_ad'
  | 'increase_budget'
  | 'decrease_budget'
  | 'test_new_audience'
  | 'create_new_adset'
  | 'mark_for_review';

export type CampaignActionStatus =
  | 'pending'
  | 'approval_required'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed';

export interface CampaignAction {
  id: string;
  type: CampaignActionType;
  title: string;
  objectType: 'campaign' | 'adset' | 'ad';
  objectId: string;
  objectName: string;
  campaignId: string;
  campaignName: string;
  adSetId: string | null;
  adId: string | null;
  clientId: string;
  clientName: string;
  recommendationId: string | null;
  payload: Record<string, unknown>;
  status: CampaignActionStatus;
  sourceRecommendationId: string | null;
  sourceRecommendationType: string | null;
  description: string;
  previewBefore: string;
  previewAfter: string;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  executedAt: string | null;
  failedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// Campaign Action Approval — approval items linked to actions
export type CampaignActionApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface CampaignActionApproval {
  id: string;
  actionId: string;
  clientId: string;
  campaignId: string;
  title: string;
  description: string;
  previewBefore: string;
  previewAfter: string;
  affectedObjectType: 'campaign' | 'adset' | 'ad';
  affectedObjectId: string;
  status: CampaignActionApprovalStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

// Campaign Activity Log — traceable log of all campaign actions
export type CampaignActivityType =
  | 'recommendation_created'
  | 'action_generated'
  | 'approval_requested'
  | 'action_approved'
  | 'action_rejected'
  | 'action_executed'
  | 'action_failed'
  | 'draft_ad_created'
  | 'ad_paused'
  | 'ad_resumed'
  | 'budget_changed'
  | 'adset_created'
  | 'marked_for_review'
  | 'auto_scan_started'
  | 'auto_scan_completed'
  | 'auto_finding_detected'
  | 'auto_action_created'
  | 'publish_complete'
  | 'publish_partial';

export interface CampaignActivityLog {
  id: string;
  campaignId: string;
  clientId: string;
  actionId: string | null;
  approvalId: string | null;
  activityType: CampaignActivityType;
  title: string;
  description: string;
  performedBy: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Auto Campaign System ────────────────────────────────────────────

export type AutoCampaignRunStatus = 'running' | 'completed' | 'failed';

export interface AutoCampaignRun {
  id: string;
  clientId: string;
  campaignId: string | null;        // null = scanned all client campaigns
  status: AutoCampaignRunStatus;
  triggeredBy: 'manual' | 'scheduled' | 'system';
  campaignsScanned: number;
  findingsCount: number;
  actionsCreated: number;
  summary: string;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export type AutoFindingType =
  | 'creative_fatigue'
  | 'budget_waste'
  | 'scale_opportunity'
  | 'weak_audience'
  | 'winning_ad'
  | 'tracking_issue';

export type AutoFindingSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AutoCampaignFinding {
  id: string;
  runId: string;
  clientId: string;
  campaignId: string;
  campaignName: string;
  adSetId: string | null;
  adSetName: string | null;
  adId: string | null;
  adName: string | null;
  type: AutoFindingType;
  severity: AutoFindingSeverity;
  confidence: number;               // 0–100
  reason: string;
  expectedImpact: string;
  suggestedAction: string;
  actionCreated: boolean;
  actionId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── Reports ──────────────────────────────────────────────────────────

export type ReportType = 'campaign' | 'client_monthly' | 'internal_manager';
export type ReportStatus = 'generating' | 'ready' | 'failed' | 'sent';
export type ReportMode = 'client_facing' | 'internal';

export interface Report {
  id: string;
  type: ReportType;
  mode: ReportMode;
  title: string;
  status: ReportStatus;
  // Scope
  clientId: string;
  clientName: string;
  campaignId: string | null;       // null for client/manager reports
  campaignName: string | null;
  // Date range
  periodStart: string;
  periodEnd: string;
  // Generated data snapshot
  data: ReportData;
  // File
  pdfUrl: string | null;           // Supabase Storage URL if generated
  // Meta
  generatedBy: string;
  sentTo: string | null;           // email address if sent
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportData {
  // Campaign-level
  campaignSummary?: ReportCampaignSummary;
  adSetSummaries?: ReportAdSetSummary[];
  adPerformance?: ReportAdPerformance[];
  // Aggregated metrics
  totalSpend: number;
  totalLeads: number;
  totalImpressions: number;
  totalClicks: number;
  avgCpl: number;
  avgCtr: number;
  // Insights
  bestPerformingAd?: { name: string; headline: string; ctr: number; leads: number; cpl: number } | null;
  weakPoints: string[];
  recommendations: string[];
  actionsTaken: string[];
  pendingActions: string[];
  // Monthly extras
  campaignsActive?: number;
  approvalsCompleted?: number;
  approvalsPending?: number;
  nextMonthRecommendations?: string[];
  executiveSummary?: string;
  // Manager extras
  clientHealth?: string;
  budgetWasteRisks?: string[];
  automationActions?: string[];
  employeeFollowUps?: string[];
  // Data sufficiency
  hasEnoughData: boolean;
}

export interface ReportCampaignSummary {
  id: string;
  name: string;
  status: string;
  platform: string;
  spend: number;
  leads: number;
  cpl: number;
  ctr: number;
  adSetsCount: number;
  adsCount: number;
}

export interface ReportAdSetSummary {
  id: string;
  name: string;
  status: string;
  spend: number;
  leads: number;
  cpl: number;
  adsCount: number;
}

export interface ReportAdPerformance {
  id: string;
  name: string;
  headline: string;
  status: string;
  impressions: number;
  clicks: number;
  spend: number;
  leads: number;
  ctr: number;
  cpl: number;
}

// Client Notification
export type ClientNotificationType = 'campaign_created' | 'approval_required' | 'report_ready' | 'performance_alert' | 'optimization_applied' | 'ad_created' | 'general';

export interface ClientNotification {
  id: string;
  clientId: string;
  type: ClientNotificationType;
  title: string;
  body: string;
  icon: string;
  read: boolean;
  actionUrl?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  createdAt: string;
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

// Ad Reference — real competitor ad examples for Gantt content inspiration
export interface AdReference {
  id: string;
  // Content
  imageUrl: string;
  description: string;
  source: string; // e.g. "Meta Ad Library", "TikTok Creative Center"
  sourceUrl: string; // link to original ad
  // Categorization
  industry: string; // matches client.businessField
  contentType: string; // social_post, reel, story, carousel, etc.
  platform: string; // facebook, instagram, tiktok, all
  style: string; // minimal, bold_text, lifestyle, etc.
  tags: string[]; // free-form tags for matching
  // Metadata
  advertiserName: string;
  engagementScore: number; // 0-100, manually set
  isActive: boolean;
  addedBy: string; // user who added it
  createdAt: string;
  updatedAt: string;
}

// ── Podcast Strategy Engine ──────────────────────────────────────────

export type PodcastEpisodeType = 'deep_interview' | 'sales' | 'educational' | 'viral_short' | 'authority';

export type PodcastGoal =
  | 'personal_exposure' | 'trust_building' | 'professional_differentiation'
  | 'lead_generation' | 'sales' | 'market_education'
  | 'storytelling' | 'objection_handling';

export type PodcastTone = 'formal' | 'casual' | 'sharp';

export type PodcastQuestionType = 'hook' | 'story' | 'authority' | 'objection' | 'cta';

export type PodcastQuestionLabel = 'viral' | 'emotional' | 'sales';

export type PodcastStrategyStatus = 'draft' | 'ready' | 'in_recording' | 'completed';

export interface PodcastGuestPersona {
  tone: PodcastTone;
  expertiseLevel: 'beginner' | 'intermediate' | 'expert' | 'thought_leader';
  speakingStyle: string;
  industry: string;
  audience: string;
}

export interface PodcastQuestion {
  id: string;
  text: string;
  type: PodcastQuestionType;
  score: number; // 1–100
  labels: PodcastQuestionLabel[];
  selected: boolean;
  order: number;
  status: 'pending' | 'done' | 'skipped'; // for host mode
}

export interface PodcastClipIdea {
  questionId: string;
  clipTitle: string;
  hookLine: string;
  captionIdea: string;
  platformFit: ('reels' | 'tiktok' | 'youtube_shorts')[];
}

export interface PodcastEpisodeStructure {
  openingHook: string;
  intro: string;
  segments: { title: string; description: string; durationMinutes: number }[];
  transitions: string[];
  closingCTA: string;
}

export interface PodcastStrategy {
  id: string;
  sessionId: string; // links to PodcastSession
  clientId: string;
  clientName: string;
  // Step 1
  episodeType: PodcastEpisodeType;
  // Step 2
  goals: PodcastGoal[];
  // Step 3
  persona: PodcastGuestPersona;
  // Step 4
  episodeStructure: PodcastEpisodeStructure | null;
  // Step 5 + 6
  questions: PodcastQuestion[];
  // Step 7
  clipIdeas: PodcastClipIdea[];
  // Meta
  status: PodcastStrategyStatus;
  useRealAI: boolean;
  clientApproved: boolean;
  clientApprovedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Auto Growth Engine ───────────────────────────────────────────

export type GrowthRunStatus = 'running' | 'completed' | 'failed';

export type GrowthOpportunityType =
  | 'scale'
  | 'creative_replacement'
  | 'budget_waste'
  | 'platform_shift'
  | 'audience_expansion'
  | 'funnel_leak'
  | 'content_to_campaign'
  | 'client_risk';

export type GrowthOpportunitySeverity = 'low' | 'medium' | 'high' | 'critical';
export type GrowthOpportunityStatus = 'new' | 'acknowledged' | 'acted_on' | 'dismissed' | 'resolved';

export type GrowthActionType =
  | 'create_ad_variation'
  | 'duplicate_winning_ad'
  | 'create_new_adset'
  | 'suggest_budget_increase'
  | 'suggest_budget_reduction'
  | 'pause_weak_ad'
  | 'create_campaign_from_content'
  | 'create_campaign_from_podcast'
  | 'create_retargeting_campaign'
  | 'create_report'
  | 'create_followup_task';

export type GrowthApprovalStatus = 'draft' | 'pending_admin' | 'pending_client' | 'approved' | 'rejected';
export type GrowthExecutionStatus = 'not_started' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export type GrowthActionOutcome = 'improved' | 'no_change' | 'declined' | 'too_early' | 'unknown';

export interface GrowthRun {
  id: string;
  status: GrowthRunStatus;
  triggeredBy: 'manual' | 'scheduled' | 'system';
  clientsScanned: number;
  campaignsScanned: number;
  opportunitiesFound: number;
  actionsGenerated: number;
  summary: string;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
}

export interface GrowthOpportunity {
  id: string;
  runId: string;
  clientId: string;
  clientName: string;
  campaignId: string | null;
  campaignName: string | null;
  adSetId: string | null;
  adId: string | null;
  platform: string | null;
  type: GrowthOpportunityType;
  severity: GrowthOpportunitySeverity;
  confidence: number; // 0-100
  title: string;
  reason: string;
  expectedImpact: string;
  status: GrowthOpportunityStatus;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface GrowthAction {
  id: string;
  opportunityId: string;
  clientId: string;
  clientName: string;
  campaignId: string | null;
  campaignName: string | null;
  platform: string | null;
  actionType: GrowthActionType;
  title: string;
  reason: string;
  expectedImpact: string;
  confidenceScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  approvalMode: 'recommend_only' | 'admin_approval' | 'client_approval' | 'safe_internal';
  approvalStatus: GrowthApprovalStatus;
  executionStatus: GrowthExecutionStatus;
  payload: Record<string, unknown>;
  suggestedNextStep: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  executedAt: string | null;
  failedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthActionResult {
  id: string;
  actionId: string;
  clientId: string;
  beforeMetrics: Record<string, number>;
  afterMetrics: Record<string, number>;
  outcome: GrowthActionOutcome;
  impactSummary: string;
  notes: string;
  measuredAt: string;
  createdAt: string;
}

// ─── Agency Knowledge Layer ───────────────────────────────────────────

export type KnowledgeItemType =
  | 'hook'
  | 'cta'
  | 'visual'
  | 'audience'
  | 'content_angle'
  | 'platform'
  | 'failure'
  | 'pattern';

export type KnowledgeSourceType =
  | 'ad_performance'
  | 'campaign_performance'
  | 'lead_quality'
  | 'gantt_idea'
  | 'podcast_clip'
  | 'video_performance'
  | 'approval_history'
  | 'growth_action'
  | 'report_insight'
  | 'manual';

export interface KnowledgeItem {
  id: string;
  type: KnowledgeItemType;
  industry: string;
  clientId: string | null;
  clientName: string | null;
  sourceType: KnowledgeSourceType;
  sourceId: string | null;
  title: string;
  summary: string;
  evidenceData: Record<string, unknown>;
  performanceMetrics: Record<string, number>;
  usageCount: number;
  confidenceScore: number; // 0-100
  decayScore: number; // 0-100, higher = more decayed
  tags: string[];
  platform: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IndustryPlaybook {
  id: string;
  industry: string;
  topHooks: PlaybookEntry[];
  bestCTAs: PlaybookEntry[];
  winningContentAngles: PlaybookEntry[];
  bestVisualPatterns: PlaybookEntry[];
  bestPlatforms: PlaybookEntry[];
  audienceNotes: PlaybookEntry[];
  failurePatterns: PlaybookEntry[];
  clientCount: number;
  campaignCount: number;
  lastUpdated: string;
  createdAt: string;
}

export interface PlaybookEntry {
  text: string;
  confidenceScore: number;
  evidenceCount: number;
  sourceIds: string[];
}

// ─── SEO/GEO Growth Plan Engine ───────────────────────────────────────────

export type SeoPlanStatus = 'draft' | 'scanning' | 'goals_set' | 'visibility_done' | 'insights_ready' | 'plan_generated' | 'tasks_created' | 'active' | 'completed';

export interface SeoWebsiteScan {
  url: string;
  scannedAt: string;
  hasSSL: boolean;
  loadTimeMs: number;
  mobileOptimized: boolean;
  metaTitle: string;
  metaDescription: string;
  h1Tags: string[];
  totalPages: number;
  indexedPages: number;
  brokenLinks: number;
  hasRobotsTxt: boolean;
  hasSitemap: boolean;
  domainAuthority: number;
  techStack: string[];
  cmsDetected: string;
  structuredData: boolean;
  openGraph: boolean;
  canonicalTags: boolean;
  issues: SeoIssue[];
  // Extended scan data
  websiteFacts?: Record<string, any>;
  aiQueries?: any[];
}

export interface SeoIssue {
  type: 'critical' | 'warning' | 'info';
  category: 'technical' | 'content' | 'performance' | 'mobile' | 'security';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface SeoGoal {
  id: string;
  type: 'traffic' | 'leads' | 'rankings' | 'local_visibility' | 'ai_visibility' | 'brand_authority' | 'ecommerce' | 'custom';
  label: string;
  targetMetric: string;
  currentValue: number;
  targetValue: number;
  priority: 'high' | 'medium' | 'low';
}

export interface AiVisibilityQuery {
  id: string;
  query: string;
  category: string;
  intent: 'informational' | 'commercial' | 'navigational' | 'transactional';
  importance: 'high' | 'medium' | 'low';
}

export interface AiVisibilityResult {
  queryId: string;
  query: string;
  engine: 'chatgpt' | 'gemini' | 'perplexity' | 'claude' | 'copilot';
  mentioned: boolean;
  position: number | null;
  context: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'not_mentioned';
  competitorsMentioned: string[];
  scannedAt: string;
}

export interface SeoInsight {
  id: string;
  category: 'opportunity' | 'threat' | 'strength' | 'weakness';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  source: 'website_scan' | 'ai_visibility' | 'competitor_analysis' | 'content_gap';
  actionable: boolean;
  suggestedAction: string;
}

export interface SeoPlanWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  theme: string;
  focus: string;
  tasks: SeoPlanTask[];
}

export interface SeoPlanTask {
  id: string;
  weekNumber: number;
  dayOfWeek: number;
  title: string;
  description: string;
  category: 'technical' | 'content' | 'onpage' | 'offpage' | 'local' | 'ai_optimization' | 'analytics';
  priority: 'high' | 'medium' | 'low';
  estimatedHours: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  assignedTo: string | null;
  completedAt: string | null;
  deliverable: string;
  kpiTarget: string;
}

export interface SeoKeywordRankSnapshot {
  date: string;
  rank: number | null; // null = not ranked
}

export interface SeoKeywordTracking {
  keyword: string;
  source: 'client' | 'ai';
  initialRank: number | null;
  currentRank: number | null;
  trend: 'up' | 'down' | 'stable' | 'new';
  lastChecked: string | null;
  history: SeoKeywordRankSnapshot[];
  priority: number; // 1 = highest
  addedAt: string;
}

export interface SeoPlan {
  id: string;
  clientId: string;
  clientName: string;
  websiteUrl: string;
  status: SeoPlanStatus;
  // Step data
  websiteScan: SeoWebsiteScan | null;
  goals: SeoGoal[];
  visibilityQueries: AiVisibilityQuery[];
  visibilityResults: AiVisibilityResult[];
  insights: SeoInsight[];
  weeks: SeoPlanWeek[];
  // Scores
  overallScore: number;
  technicalScore: number;
  contentScore: number;
  visibilityScore: number;
  // Metadata
  createdAt: string;
  updatedAt: string;
  generatedAt: string | null;
  completedTasks: number;
  totalTasks: number;
  // New 60-day plan fields
  days?: any[];
  phases?: any[];
  scannedPages?: SeoScannedPage[];
  contentGaps?: SeoContentGap[];
  competitors?: SeoCompetitor[];
  reports?: SeoReportMeta[];
  activityLog?: SeoActivityEntry[];
  // WordPress connection (saved per-plan from connect-wordpress flow)
  wpConnection?: {
    siteUrl: string;
    username: string;
    applicationPassword: string;
    connectedAt?: string;
    siteName?: string;
    yoastInstalled?: boolean;
    pagesCount?: number;
  } | null;
  // Client email for notifications
  clientEmail?: string;
  // Business profile from wizard
  businessProfile?: Record<string, any>;
  // AI keywords
  aiKeywords?: Array<{ keyword: string; [key: string]: any }>;
  // Client priority keywords (manually entered, up to 10)
  clientKeywords?: SeoKeywordTracking[];
  // Automation log
  automationLog?: Array<{
    date: string;
    dayNumber: number;
    results: any[];
    totalTasks: number;
    executedTasks: number;
    successfulTasks: number;
  }>;
  // Scan history & baseline tracking for progress reports
  baselineScan?: SeoWebsiteScan | null;
  baselineAiQueries?: Array<{
    platform: string;
    query: string;
    queryId: string;
    found: boolean;
    position?: number;
    snippet?: string;
    confidence: number;
    scanMode: string;
    checkedAt: string;
    responseText?: string;
    sources?: {url: string; domain: string; title?: string}[];
    mentionType?: string;
  }> | null;
  baselineKeywordRanks?: Array<{ keyword: string; rank: number | null; checkedAt: string }> | null;
  baselineCapturedAt?: string | null;
  scanHistory?: Array<{
    scanId: string;
    scannedAt: string;
    websiteScan: SeoWebsiteScan;
    aiQueries?: any[];
    keywordRanks?: Array<{ keyword: string; rank: number | null }>;
    visibilityScore?: number;
    technicalScore?: number;
    overallScore?: number;
    summary?: string;
  }> | null;
  lastRescanAt?: string | null;
  // Daily progress snapshots (auto-generated by cron every 24h)
  dailySnapshots?: Array<{
    date: string;
    timestamp: string;
    keywordRanks: Array<{ keyword: string; googleRank: number | null; previousRank: number | null; change: number }>;
    aiVisibility: {
      totalQueries: number;
      totalFound: number;
      byPlatform: Record<string, { found: number; total: number }>;
    };
    technicalScore: number;
    overallScore: number;
  }>;
  // AI-generated articles
  aiArticles?: any[];
}

// ─── SEO/GEO Extended Types ─────────────────────────────────────────────────

export interface SeoWebsite {
  id: string;
  clientId: string;
  url: string;
  domain: string;
  label: string;
  isPrimary: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface SeoScannedPage {
  url: string;
  title: string;
  missingMeta: boolean;
  missingH1: boolean;
  missingAlt: boolean;
  wordCount: number;
  hasSchema: boolean;
  scannedAt: string;
}

export interface SeoContentGap {
  id: string;
  query: string;
  category: string;
  intent: string;
  importance: 'high' | 'medium' | 'low';
  suggestedAction: string;
  relatedUrl: string | null;
}

export interface SeoCompetitor {
  id: string;
  domain: string;
  name: string;
  overlapScore: number;
  strengths: string[];
  weaknesses: string[];
  topKeywords: string[];
  discoveredAt: string;
}

export interface SeoReportMeta {
  id: string;
  name: string;
  generatedAt: string;
  language: string;
  type: string;
  meta?: Record<string, unknown>;
}

export interface SeoActivityEntry {
  ts: string;
  action: string;
  actor: string;
  details?: string;
}

// ─── Results & Visibility Layer ─────────────────────────────────────────────

export type ScanMode = 'real' | 'simulated' | 'unavailable';

export type VisibilityPlatformId = 'google_seo' | 'google_ai_overview' | 'gemini' | 'chatgpt' | 'claude' | 'perplexity';

export interface PlatformSummary {
  platformId: VisibilityPlatformId;
  platformName: string;
  icon: string;
  queriesScanned: number;
  mentions: number;
  visibilityPct: number;
  scanMode: ScanMode;
  lastScannedAt: string | null;
}

export interface PlatformResultBase {
  id: string;
  planId: string;
  platformId: VisibilityPlatformId;
  query: string;
  queryCategory: string;
  queryIntent: string;
  mentioned: boolean;
  scanMode: ScanMode;
  confidence: number;        // 0-100
  evidence: ResultEvidence;
  scannedAt: string;
  competitorsMentioned: string[];
  opportunityScore: number;  // 0-100, higher = bigger opportunity
  cluster?: string;          // keyword cluster grouping
}

export interface ResultEvidence {
  sourceUrl: string | null;
  extractedSnippet: string | null;
  rawApiResponse: string | null;
  scanMode: ScanMode;
  confidence: number;
}

/** Google SEO (Organic) specific fields */
export interface GoogleSeoResult extends PlatformResultBase {
  platformId: 'google_seo';
  organicPosition: number | null;
  pageUrl: string | null;
  pageTitle: string | null;
  metaDescription: string | null;
}

/** Google AI Overview specific fields */
export interface GoogleAiOverviewResult extends PlatformResultBase {
  platformId: 'google_ai_overview';
  aiOverviewExists: boolean;
  mentionPosition: number | null;
  aiSnippet: string | null;
  sourceUrls: string[];
}

/** AI Platform result (Gemini, ChatGPT, Claude, Perplexity) */
export interface AiPlatformResult extends PlatformResultBase {
  answer: string | null;           // full or truncated answer
  mentionContext: string | null;   // text snippet around mention
  sources: string[];
}

export type PlatformResult = GoogleSeoResult | GoogleAiOverviewResult | AiPlatformResult;

export interface VisibilityScanHistory {
  id: string;
  planId: string;
  scannedAt: string;
  platformSummaries: PlatformSummary[];
  totalQueries: number;
  totalMentions: number;
  overallVisibilityPct: number;
}

export interface SeoGrowthTask {
  id: string;
  planId: string;
  day: number;
  title: string;
  type: string;
  description: string;
  impactLevel: 'critical' | 'high' | 'medium' | 'low';
  effortHours: number;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  assignedTo: string | null;
  completedAt: string | null;
  relatedPageUrl: string | null;
  expectedOutcome: string;
  reason: string;
  contentBrief: string | null;
  createdAt: string;
  updatedAt: string;
}

// ===== Green Invoice (חשבונית ירוקה) =====

export type InvoiceDocType = 10 | 20 | 30 | 100 | 200 | 210 | 300 | 400 | 405;
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled' | 'overdue';
export type InvoicePaymentMethod = 'cash' | 'cheque' | 'bank_transfer' | 'credit_card' | 'bit' | 'paybox' | 'other';

export interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  greenInvoiceDocId: string | null;
  greenInvoiceNumber: number | null;
  greenInvoicePdfUrl: string | null;
  docType: InvoiceDocType;
  status: InvoiceStatus;
  description: string;
  remarks: string;
  currency: 'ILS' | 'USD' | 'EUR';
  subtotal: number;
  vatAmount: number;
  total: number;
  vatRate: number;
  items: InvoiceItem[];
  paymentMethod: InvoicePaymentMethod | null;
  paidAt: string | null;
  dueDate: string | null;
  isRecurring: boolean;
  recurringFrequency: 'monthly' | 'quarterly' | 'annual' | null;
  linkedPaymentId: string | null;
  linkedPodcastSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  vatType: 0 | 1;
  total: number;
}

// ===== Receipt Scanner (סריקת קבלות) =====

export type ExpenseCategory =
  | 'office' | 'software' | 'advertising' | 'travel' | 'meals'
  | 'professional_services' | 'equipment' | 'insurance' | 'taxes'
  | 'supplies' | 'utilities' | 'rent' | 'salary' | 'other';

export type ReceiptStatus = 'pending_review' | 'approved' | 'rejected' | 'sent_to_accountant';

export interface ScannedReceipt {
  id: string;
  vendorName: string;
  vendorTaxId: string;
  receiptDate: string;
  receiptNumber: string;
  subtotal: number;
  vatAmount: number;
  total: number;
  currency: 'ILS' | 'USD' | 'EUR';
  category: ExpenseCategory;
  categoryConfidence: number;
  isDeductible: boolean;
  deductionPercentage: number;
  imageUrl: string;
  ocrText: string;
  status: ReceiptStatus;
  notes: string;
  approvedBy: string | null;
  fiscalMonth: number;
  fiscalYear: number;
  linkedInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ===== Email Sequences =====

export type SequenceStatus = 'draft' | 'active' | 'paused' | 'completed';
export type SequenceStepType = 'email' | 'wait' | 'condition' | 'whatsapp';
export type SequenceTrigger = 'new_lead' | 'new_client' | 'payment_received' | 'invoice_sent' | 'manual' | 'form_submit';

export interface EmailSequence {
  id: string;
  name: string;
  description: string;
  trigger: SequenceTrigger;
  status: SequenceStatus;
  tikun40Compliant: boolean;
  unsubscribeUrl: string;
  senderName: string;
  senderEmail: string;
  steps: EmailSequenceStep[];
  totalSubscribers: number;
  totalSent: number;
  totalOpened: number;
  totalClicked: number;
  totalUnsubscribed: number;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSequenceStep {
  id: string;
  type: SequenceStepType;
  order: number;
  subject: string;
  bodyHtml: string;
  waitDays: number;
  waitHours: number;
  conditionField: string;
  conditionOperator: 'equals' | 'contains' | 'gt' | 'lt';
  conditionValue: string;
  sent: number;
  opened: number;
  clicked: number;
}

export interface SequenceSubscriber {
  id: string;
  sequenceId: string;
  email: string;
  name: string;
  currentStep: number;
  status: 'active' | 'completed' | 'unsubscribed' | 'bounced';
  subscribedAt: string;
  lastEmailAt: string | null;
  metadata: Record<string, any>;
}

// ===== Social Media / Postiz =====

export type SocialPlatformType = 'facebook' | 'instagram' | 'tiktok' | 'linkedin' | 'twitter';
export type ScheduledPostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'pending_approval';

export interface ScheduledSocialPost {
  id: string;
  clientId: string;
  clientName: string;
  platform: SocialPlatformType;
  content: string;
  mediaUrls: string[];
  hashtags: string[];
  scheduledAt: string;
  publishedAt: string | null;
  status: ScheduledPostStatus;
  postizPostId: string | null;
  postizError: string | null;
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  linkedGanttItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ===== LinkedIn Strategy =====

export interface LinkedInPost {
  id: string;
  clientId: string;
  contentHebrew: string;
  contentEnglish: string;
  language: 'he' | 'en' | 'bilingual';
  postType: 'text' | 'article' | 'carousel' | 'video' | 'poll';
  industry: string;
  targetAudience: string;
  impressions: number;
  reactions: number;
  comments: number;
  shares: number;
  profileViews: number;
  scheduledAt: string | null;
  publishedAt: string | null;
  status: ScheduledPostStatus;
  createdAt: string;
  updatedAt: string;
}

// ===== Survey Builder =====

export type SurveyType = 'nps' | 'csat' | 'feedback' | 'research' | 'custom';
export type SurveyStatus = 'draft' | 'active' | 'closed' | 'archived';
export type SurveyQuestionType = 'rating' | 'nps' | 'text' | 'multiple_choice' | 'single_choice' | 'scale';
export type SurveyDistribution = 'email' | 'whatsapp' | 'link' | 'embedded';

export interface Survey {
  id: string;
  clientId: string | null;
  title: string;
  description: string;
  type: SurveyType;
  status: SurveyStatus;
  questions: SurveyQuestion[];
  distributionChannels: SurveyDistribution[];
  shareUrl: string;
  totalResponses: number;
  avgScore: number | null;
  npsScore: number | null;
  isRtl: boolean;
  language: 'he' | 'en';
  brandColor: string;
  thankYouMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyQuestion {
  id: string;
  type: SurveyQuestionType;
  text: string;
  required: boolean;
  order: number;
  options: string[];
  minLabel?: string;
  maxLabel?: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  respondentEmail: string | null;
  respondentName: string | null;
  answers: Record<string, any>;
  npsScore: number | null;
  completedAt: string;
  source: SurveyDistribution;
  createdAt: string;
}

// ===== Backlink Intelligence =====

export type BacklinkOutreachType = 'guest_post' | 'resource_link' | 'broken_link' | 'pr' | 'directory' | 'partnership';
export type BacklinkTargetStatus = 'prospect' | 'contacted' | 'responded' | 'secured' | 'rejected' | 'lost';
export type BacklinkCampaignType = 'guest_post' | 'pr' | 'broken_link' | 'resource' | 'directory';
export type BacklinkCampaignStatus = 'active' | 'paused' | 'completed';

export interface BacklinkTarget {
  id: string;
  campaignId: string;
  clientId: string;
  targetDomain: string;
  targetUrl?: string;
  contactEmail?: string;
  domainAuthority: number;
  relevanceScore: number;
  outreachType: BacklinkOutreachType;
  status: BacklinkTargetStatus;
  pitchTemplate?: string;
  notes?: string;
  createdAt: string;
  lastContactedAt?: string;
}

export interface BacklinkCampaign {
  id: string;
  clientId: string;
  name: string;
  type: BacklinkCampaignType;
  targets: string[];
  totalProspects: number;
  contacted: number;
  secured: number;
  status: BacklinkCampaignStatus;
  niche: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

// ===== Green Invoice Settings =====

export interface GreenInvoiceSettings {
  id: string;
  apiId: string;
  apiSecret: string;
  sandbox: boolean;
  businessName: string;
  businessTaxId: string;
  defaultDocType: InvoiceDocType;
  autoIssueOnPayment: boolean;
  connected: boolean;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}
