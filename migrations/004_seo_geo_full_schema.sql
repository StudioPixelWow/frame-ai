-- Migration: SEO/GEO Growth Plan Builder — Full Relational Schema
-- Date: 2026-05-02
-- Safe to run multiple times — all statements use IF NOT EXISTS.
--
-- Creates 14 tables for the SEO/GEO module:
--   1.  seo_client_websites        — websites linked to clients
--   2.  seo_geo_plans              — master plan per website
--   3.  seo_plan_goals             — goals within a plan
--   4.  seo_website_scans          — scan snapshots of a website
--   5.  seo_scanned_pages          — individual pages found during scan
--   6.  seo_ai_questions           — AI visibility queries
--   7.  seo_ai_visibility_results  — per-engine scan results
--   8.  seo_competitors            — tracked competitors
--   9.  seo_content_gaps           — content gap analysis
--   10. seo_growth_plan_days       — 60 daily plan slots
--   11. seo_growth_tasks           — tasks within each day
--   12. seo_ai_reports             — generated PDF reports
--   13. seo_activity_logs          — audit trail for all actions
--   14. seo_scheduled_scans        — future recurring scans
--
-- Conventions:
--   • UUIDs as primary keys (gen_random_uuid())
--   • All tables have created_at + updated_at (TIMESTAMPTZ)
--   • Status values stored as TEXT (PostgreSQL enums are painful to alter)
--   • JSONB for flexible/nested data
--   • Foreign keys use REFERENCES with ON DELETE CASCADE
--   • Indexes on all FK columns + common filter columns
--   • All table names prefixed with seo_ for namespace isolation

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. seo_client_websites
--    Links clients to their websites. One client can have many websites.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_client_websites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       TEXT NOT NULL,                        -- FK → clients.id (TEXT in existing schema)
  url             TEXT NOT NULL,
  domain          TEXT,                                 -- extracted domain, e.g. "example.co.il"
  label           TEXT DEFAULT '',                      -- friendly name, e.g. "אתר ראשי"
  is_primary      BOOLEAN DEFAULT false,
  status          TEXT DEFAULT 'active',                -- active | inactive | pending_verification
  verified_at     TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',                   -- CMS, tech stack, hosting info
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_client_websites_client
  ON public.seo_client_websites (client_id);
CREATE INDEX IF NOT EXISTS idx_seo_client_websites_domain
  ON public.seo_client_websites (domain);

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. seo_geo_plans
--    Master plan entity — one plan per website per engagement.
--    Statuses: draft → scanning → goals_set → visibility_done →
--              insights_ready → plan_generated → tasks_created →
--              active → completed | archived
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_geo_plans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       TEXT NOT NULL,                        -- FK → clients.id
  website_id      UUID,                                 -- FK → seo_client_websites.id
  website_url     TEXT NOT NULL,
  plan_name       TEXT DEFAULT '',
  status          TEXT DEFAULT 'draft',
  plan_type       TEXT DEFAULT 'seo_geo',               -- seo_geo | seo_only | geo_only | local_seo
  duration_days   INTEGER DEFAULT 60,
  -- Aggregate scores (0-100, computed from scans + visibility)
  overall_score       INTEGER DEFAULT 0,
  technical_score     INTEGER DEFAULT 0,
  content_score       INTEGER DEFAULT 0,
  visibility_score    INTEGER DEFAULT 0,
  local_score         INTEGER DEFAULT 0,
  -- Task progress
  total_tasks         INTEGER DEFAULT 0,
  completed_tasks     INTEGER DEFAULT 0,
  -- Plan configuration
  target_market       TEXT DEFAULT 'IL',                -- ISO country code
  target_languages    TEXT[] DEFAULT ARRAY['he'],
  industry            TEXT DEFAULT '',
  budget_monthly      NUMERIC(12,2) DEFAULT 0,
  assigned_manager_id TEXT,                             -- FK → employees.id
  -- Timestamps
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_geo_plans_client
  ON public.seo_geo_plans (client_id);
CREATE INDEX IF NOT EXISTS idx_seo_geo_plans_website
  ON public.seo_geo_plans (website_id);
CREATE INDEX IF NOT EXISTS idx_seo_geo_plans_status
  ON public.seo_geo_plans (status);
CREATE INDEX IF NOT EXISTS idx_seo_geo_plans_manager
  ON public.seo_geo_plans (assigned_manager_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. seo_plan_goals
--    Goals attached to a plan. Many goals per plan.
--    Types: traffic | leads | rankings | local_visibility |
--           ai_visibility | brand_authority | ecommerce | custom
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_plan_goals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
  goal_type       TEXT NOT NULL,
  label           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  target_metric   TEXT DEFAULT '',                      -- e.g. "organic sessions/month"
  current_value   NUMERIC(14,2) DEFAULT 0,
  target_value    NUMERIC(14,2) DEFAULT 0,
  priority        TEXT DEFAULT 'medium',                -- high | medium | low
  achieved        BOOLEAN DEFAULT false,
  achieved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_plan_goals_plan
  ON public.seo_plan_goals (plan_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. seo_website_scans
--    Snapshots of a website scan. One website can be scanned many times.
--    Stores both structured scores and raw scan data as JSONB.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_website_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID REFERENCES public.seo_geo_plans(id) ON DELETE SET NULL,
  website_id      UUID REFERENCES public.seo_client_websites(id) ON DELETE SET NULL,
  url             TEXT NOT NULL,
  scan_status     TEXT DEFAULT 'pending',               -- pending | running | completed | failed
  -- Core metrics
  has_ssl         BOOLEAN DEFAULT false,
  load_time_ms    INTEGER DEFAULT 0,
  mobile_score    INTEGER DEFAULT 0,                    -- 0-100
  desktop_score   INTEGER DEFAULT 0,                    -- 0-100
  accessibility_score INTEGER DEFAULT 0,                -- 0-100
  seo_score       INTEGER DEFAULT 0,                    -- 0-100 (Lighthouse-style)
  -- Meta
  meta_title      TEXT DEFAULT '',
  meta_description TEXT DEFAULT '',
  canonical_url   TEXT,
  -- Counts
  total_pages     INTEGER DEFAULT 0,
  indexed_pages   INTEGER DEFAULT 0,
  broken_links    INTEGER DEFAULT 0,
  total_images    INTEGER DEFAULT 0,
  images_without_alt INTEGER DEFAULT 0,
  -- Booleans
  has_robots_txt  BOOLEAN DEFAULT false,
  has_sitemap     BOOLEAN DEFAULT false,
  has_structured_data BOOLEAN DEFAULT false,
  has_open_graph  BOOLEAN DEFAULT false,
  has_canonical_tags BOOLEAN DEFAULT false,
  has_hreflang    BOOLEAN DEFAULT false,
  -- Authority
  domain_authority INTEGER DEFAULT 0,
  page_authority   INTEGER DEFAULT 0,
  backlink_count   INTEGER DEFAULT 0,
  referring_domains INTEGER DEFAULT 0,
  -- Structured results
  h1_tags         JSONB DEFAULT '[]',
  tech_stack      JSONB DEFAULT '[]',
  cms_detected    TEXT DEFAULT '',
  issues          JSONB DEFAULT '[]',                   -- Array of {type, category, title, description, impact}
  raw_data        JSONB DEFAULT '{}',                   -- Full raw scan output
  -- Timing
  scan_started_at TIMESTAMPTZ,
  scan_completed_at TIMESTAMPTZ,
  scan_duration_ms INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_website_scans_plan
  ON public.seo_website_scans (plan_id);
CREATE INDEX IF NOT EXISTS idx_seo_website_scans_website
  ON public.seo_website_scans (website_id);
CREATE INDEX IF NOT EXISTS idx_seo_website_scans_status
  ON public.seo_website_scans (scan_status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. seo_scanned_pages
--    Individual pages discovered during a website scan.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_scanned_pages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id         UUID NOT NULL REFERENCES public.seo_website_scans(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  path            TEXT DEFAULT '/',
  http_status     INTEGER DEFAULT 200,
  page_title      TEXT DEFAULT '',
  meta_description TEXT DEFAULT '',
  h1              TEXT DEFAULT '',
  word_count      INTEGER DEFAULT 0,
  load_time_ms    INTEGER DEFAULT 0,
  -- Scores per page
  seo_score       INTEGER DEFAULT 0,
  content_score   INTEGER DEFAULT 0,
  -- Issues
  has_canonical   BOOLEAN DEFAULT false,
  has_schema      BOOLEAN DEFAULT false,
  is_indexed      BOOLEAN DEFAULT true,
  issues          JSONB DEFAULT '[]',
  -- Internal linking
  internal_links_in  INTEGER DEFAULT 0,                 -- links pointing TO this page
  internal_links_out INTEGER DEFAULT 0,                 -- links FROM this page
  external_links_out INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_scanned_pages_scan
  ON public.seo_scanned_pages (scan_id);
CREATE INDEX IF NOT EXISTS idx_seo_scanned_pages_status
  ON public.seo_scanned_pages (http_status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. seo_ai_questions
--    AI visibility queries — questions to check across AI engines.
--    Can be auto-generated or manually added.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_ai_questions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
  query_text      TEXT NOT NULL,
  category        TEXT DEFAULT 'general',               -- general | product | service | comparison | local | brand
  intent          TEXT DEFAULT 'informational',         -- informational | commercial | navigational | transactional
  importance      TEXT DEFAULT 'medium',                -- high | medium | low
  source          TEXT DEFAULT 'manual',                -- manual | ai_generated | imported
  is_active       BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_ai_questions_plan
  ON public.seo_ai_questions (plan_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. seo_ai_visibility_results
--    Results of checking each question against each AI engine.
--    One row per (question × engine × scan-run).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_ai_visibility_results (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
  question_id     UUID NOT NULL REFERENCES public.seo_ai_questions(id) ON DELETE CASCADE,
  scan_run_id     UUID,                                 -- groups results from the same scan batch
  engine          TEXT NOT NULL,                         -- chatgpt | gemini | perplexity | claude | copilot | google_sge
  -- Result
  mentioned       BOOLEAN DEFAULT false,
  mention_position INTEGER,                             -- 1=first, null=not mentioned
  mention_context TEXT DEFAULT '',                       -- snippet of AI response
  sentiment       TEXT DEFAULT 'not_mentioned',          -- positive | neutral | negative | not_mentioned
  -- Competitor tracking
  competitors_mentioned JSONB DEFAULT '[]',              -- ["comp1","comp2"]
  our_rank_vs_competitors INTEGER,                       -- 1=best, null=not ranked
  -- Response metadata
  response_length INTEGER DEFAULT 0,
  response_hash   TEXT,                                  -- dedup across runs
  raw_response    JSONB DEFAULT '{}',
  -- Timing
  scanned_at      TIMESTAMPTZ DEFAULT now(),
  latency_ms      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_plan
  ON public.seo_ai_visibility_results (plan_id);
CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_question
  ON public.seo_ai_visibility_results (question_id);
CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_engine
  ON public.seo_ai_visibility_results (engine);
CREATE INDEX IF NOT EXISTS idx_seo_ai_visibility_scan_run
  ON public.seo_ai_visibility_results (scan_run_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. seo_competitors
--    Competitors tracked per plan. Used for comparison in visibility scans
--    and content gap analysis.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_competitors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  website_url     TEXT NOT NULL,
  domain          TEXT,
  -- Metrics (updated after each scan)
  domain_authority INTEGER DEFAULT 0,
  estimated_traffic INTEGER DEFAULT 0,
  keyword_overlap  INTEGER DEFAULT 0,                    -- shared keywords count
  content_score    INTEGER DEFAULT 0,
  ai_visibility_score INTEGER DEFAULT 0,                 -- how often AI mentions them
  -- Notes
  strengths       JSONB DEFAULT '[]',
  weaknesses      JSONB DEFAULT '[]',
  notes           TEXT DEFAULT '',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_competitors_plan
  ON public.seo_competitors (plan_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. seo_content_gaps
--    Content opportunities identified by comparing our site against
--    competitors and AI recommendations.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_content_gaps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
  keyword         TEXT NOT NULL,
  search_volume   INTEGER DEFAULT 0,
  difficulty      INTEGER DEFAULT 0,                     -- 0-100
  current_position INTEGER,                              -- null = not ranking
  gap_type        TEXT DEFAULT 'missing',                -- missing | thin | outdated | competitor_only
  category        TEXT DEFAULT 'general',
  -- Opportunity
  estimated_traffic INTEGER DEFAULT 0,
  priority        TEXT DEFAULT 'medium',                 -- high | medium | low
  suggested_content_type TEXT DEFAULT 'article',         -- article | landing_page | faq | guide | video
  suggested_title TEXT DEFAULT '',
  suggested_outline JSONB DEFAULT '[]',
  -- Competitor data
  competitor_urls JSONB DEFAULT '[]',                    -- URLs of competitor pages ranking for this keyword
  -- Status
  status          TEXT DEFAULT 'identified',             -- identified | planned | in_progress | published | skipped
  task_id         UUID,                                  -- FK → seo_growth_tasks.id (linked when converted to task)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_content_gaps_plan
  ON public.seo_content_gaps (plan_id);
CREATE INDEX IF NOT EXISTS idx_seo_content_gaps_status
  ON public.seo_content_gaps (status);
CREATE INDEX IF NOT EXISTS idx_seo_content_gaps_priority
  ON public.seo_content_gaps (priority);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. seo_growth_plan_days
--     60 daily slots forming the structured growth plan.
--     Each day has a theme/focus and contains multiple tasks.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_growth_plan_days (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
  day_number      INTEGER NOT NULL,                      -- 1-60
  week_number     INTEGER NOT NULL,                      -- 1-9 (derived: ceil(day/7))
  calendar_date   DATE,                                  -- actual date when scheduled
  theme           TEXT DEFAULT '',                        -- e.g. "תשתית טכנית"
  focus           TEXT DEFAULT '',                        -- description of daily focus
  status          TEXT DEFAULT 'pending',                 -- pending | in_progress | completed | skipped
  notes           TEXT DEFAULT '',
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (plan_id, day_number)
);

CREATE INDEX IF NOT EXISTS idx_seo_growth_plan_days_plan
  ON public.seo_growth_plan_days (plan_id);
CREATE INDEX IF NOT EXISTS idx_seo_growth_plan_days_date
  ON public.seo_growth_plan_days (calendar_date);
CREATE INDEX IF NOT EXISTS idx_seo_growth_plan_days_status
  ON public.seo_growth_plan_days (status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. seo_growth_tasks
--     Individual tasks within each day. Assignable, trackable, with
--     deliverables and KPI targets.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_growth_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
  day_id          UUID REFERENCES public.seo_growth_plan_days(id) ON DELETE SET NULL,
  day_number      INTEGER NOT NULL,                      -- 1-60 (denormalized for easy queries)
  sort_order      INTEGER DEFAULT 0,
  -- Task details
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  category        TEXT DEFAULT 'general',                -- technical | content | onpage | offpage | local | ai_optimization | analytics | outreach
  priority        TEXT DEFAULT 'medium',                 -- critical | high | medium | low
  estimated_hours NUMERIC(5,2) DEFAULT 1,
  actual_hours    NUMERIC(5,2),
  -- Assignment
  assigned_to     TEXT,                                  -- FK → employees.id
  assigned_at     TIMESTAMPTZ,
  -- Status
  status          TEXT DEFAULT 'pending',                -- pending | in_progress | completed | blocked | skipped | cancelled
  blocked_reason  TEXT,
  -- Deliverables
  deliverable     TEXT DEFAULT '',                       -- expected output
  kpi_target      TEXT DEFAULT '',                       -- measurable target
  kpi_actual      TEXT,                                  -- actual result
  -- Links
  content_gap_id  UUID,                                  -- FK → seo_content_gaps.id if task was generated from a gap
  related_url     TEXT,                                  -- URL this task affects
  attachments     JSONB DEFAULT '[]',                    -- [{name, url, type}]
  -- Completion
  completed_at    TIMESTAMPTZ,
  completed_by    TEXT,
  completion_notes TEXT DEFAULT '',
  -- Recurrence
  is_recurring    BOOLEAN DEFAULT false,
  recurrence_rule TEXT,                                  -- e.g. "weekly" — for ongoing tasks
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_plan
  ON public.seo_growth_tasks (plan_id);
CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_day
  ON public.seo_growth_tasks (day_id);
CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_status
  ON public.seo_growth_tasks (status);
CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_assigned
  ON public.seo_growth_tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_category
  ON public.seo_growth_tasks (category);
CREATE INDEX IF NOT EXISTS idx_seo_growth_tasks_day_number
  ON public.seo_growth_tasks (plan_id, day_number);

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. seo_ai_reports
--     Generated reports with optional PDF export.
--     Stores both structured report data and the PDF file reference.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_ai_reports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID NOT NULL REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
  client_id       TEXT NOT NULL,
  -- Report identity
  report_type     TEXT NOT NULL,                         -- initial_audit | weekly_progress | monthly_summary | visibility_report | final_report | custom
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  -- Content
  summary         TEXT DEFAULT '',                       -- executive summary text
  sections        JSONB DEFAULT '[]',                    -- [{title, content, charts, metrics}]
  key_metrics     JSONB DEFAULT '{}',                    -- {score, tasks_done, traffic_change, ...}
  recommendations JSONB DEFAULT '[]',                    -- [{title, description, priority}]
  -- Period
  period_start    DATE,
  period_end      DATE,
  -- File
  pdf_url         TEXT,                                  -- Supabase Storage URL
  pdf_storage_key TEXT,                                  -- Storage path for deletion
  pdf_generated_at TIMESTAMPTZ,
  -- Status
  status          TEXT DEFAULT 'draft',                  -- draft | generating | ready | sent | archived
  sent_to         JSONB DEFAULT '[]',                    -- [{email, sent_at}]
  -- Metadata
  generated_by    TEXT DEFAULT 'system',                 -- system | manual
  language        TEXT DEFAULT 'he',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_ai_reports_plan
  ON public.seo_ai_reports (plan_id);
CREATE INDEX IF NOT EXISTS idx_seo_ai_reports_client
  ON public.seo_ai_reports (client_id);
CREATE INDEX IF NOT EXISTS idx_seo_ai_reports_type
  ON public.seo_ai_reports (report_type);
CREATE INDEX IF NOT EXISTS idx_seo_ai_reports_status
  ON public.seo_ai_reports (status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. seo_activity_logs
--     Audit trail for all SEO/GEO actions. Immutable (append-only).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_activity_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID REFERENCES public.seo_geo_plans(id) ON DELETE SET NULL,
  client_id       TEXT,
  -- Event
  action          TEXT NOT NULL,                         -- plan_created | scan_started | scan_completed | goal_added | visibility_scan | task_completed | report_generated | plan_status_changed | ...
  entity_type     TEXT,                                  -- plan | scan | task | goal | report | question | competitor
  entity_id       UUID,                                  -- ID of the affected entity
  -- Details
  description     TEXT DEFAULT '',
  old_value       JSONB,                                -- previous state (for changes)
  new_value       JSONB,                                -- new state
  metadata        JSONB DEFAULT '{}',
  -- Actor
  performed_by    TEXT,                                  -- user/employee ID
  performed_by_name TEXT DEFAULT '',
  ip_address      TEXT,
  -- Timing
  created_at      TIMESTAMPTZ DEFAULT now()
  -- No updated_at — logs are immutable
);

CREATE INDEX IF NOT EXISTS idx_seo_activity_logs_plan
  ON public.seo_activity_logs (plan_id);
CREATE INDEX IF NOT EXISTS idx_seo_activity_logs_client
  ON public.seo_activity_logs (client_id);
CREATE INDEX IF NOT EXISTS idx_seo_activity_logs_action
  ON public.seo_activity_logs (action);
CREATE INDEX IF NOT EXISTS idx_seo_activity_logs_created
  ON public.seo_activity_logs (created_at DESC);

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. seo_scheduled_scans
--     Future and recurring scan schedules.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.seo_scheduled_scans (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id         UUID REFERENCES public.seo_geo_plans(id) ON DELETE CASCADE,
  website_id      UUID REFERENCES public.seo_client_websites(id) ON DELETE CASCADE,
  -- Schedule
  scan_type       TEXT NOT NULL,                         -- website | ai_visibility | competitor | full
  frequency       TEXT DEFAULT 'weekly',                 -- once | daily | weekly | biweekly | monthly
  next_run_at     TIMESTAMPTZ,
  last_run_at     TIMESTAMPTZ,
  last_scan_id    UUID,                                  -- FK → seo_website_scans.id (last completed scan)
  -- Status
  is_active       BOOLEAN DEFAULT true,
  run_count       INTEGER DEFAULT 0,
  max_runs        INTEGER,                               -- null = unlimited
  -- Notification
  notify_on_complete BOOLEAN DEFAULT true,
  notify_emails   JSONB DEFAULT '[]',
  -- Metadata
  config          JSONB DEFAULT '{}',                    -- scan-specific config (depth, pages limit, etc.)
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seo_scheduled_scans_plan
  ON public.seo_scheduled_scans (plan_id);
CREATE INDEX IF NOT EXISTS idx_seo_scheduled_scans_next_run
  ON public.seo_scheduled_scans (next_run_at)
  WHERE is_active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- Reload PostgREST schema cache
-- ═══════════════════════════════════════════════════════════════════════════

NOTIFY pgrst, 'reload schema';
