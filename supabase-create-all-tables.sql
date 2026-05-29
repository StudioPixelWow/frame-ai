-- ══════════════════════════════════════════════════════════════════════════════
-- Studio Pixel — Full Table Creation Script
-- Run this in Supabase SQL Editor to create ALL missing tables
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ══════════════════════════════════════════════════════════════════════════════

-- Core Business
CREATE TABLE IF NOT EXISTS public.app_leads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_campaigns (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_ad_sets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_ads (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_approvals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_payments (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Client Management
CREATE TABLE IF NOT EXISTS public.app_client_gantt_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_client_tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_client_files (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_client_knowledge (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_client_insights (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_creative_dna (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_client_notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Employee & Tasks
CREATE TABLE IF NOT EXISTS public.app_employee_tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_follow_up_reminders (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Campaign Actions & Activity
CREATE TABLE IF NOT EXISTS public.campaign_actions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.campaign_action_approvals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.campaign_activity_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Auto Campaign Engine
CREATE TABLE IF NOT EXISTS public.auto_campaign_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.auto_campaign_findings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Reports
CREATE TABLE IF NOT EXISTS public.app_reports (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Auto Growth Engine
CREATE TABLE IF NOT EXISTS public.growth_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.growth_opportunities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.growth_actions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.growth_action_results (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Agency Knowledge Layer
CREATE TABLE IF NOT EXISTS public.agency_knowledge_items (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.industry_playbooks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- SEO/GEO Growth Plans
CREATE TABLE IF NOT EXISTS public.app_seo_plans (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_seo_websites (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_seo_growth_tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Green Invoice + Invoicing
CREATE TABLE IF NOT EXISTS public.app_invoices (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_green_invoice_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Receipt Scanner
CREATE TABLE IF NOT EXISTS public.app_scanned_receipts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Email Sequences
CREATE TABLE IF NOT EXISTS public.app_email_sequences (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_sequence_subscribers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Social Media / Postiz
CREATE TABLE IF NOT EXISTS public.app_scheduled_posts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- LinkedIn
CREATE TABLE IF NOT EXISTS public.app_linkedin_posts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Surveys
CREATE TABLE IF NOT EXISTS public.app_surveys (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_survey_responses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Backlink Intelligence
CREATE TABLE IF NOT EXISTS public.app_backlink_campaigns (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_backlink_targets (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Communication
CREATE TABLE IF NOT EXISTS public.app_whatsapp_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_mailings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_gmail_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_meetings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- System
CREATE TABLE IF NOT EXISTS public.app_system_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_audit_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_ad_references (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Podcast
CREATE TABLE IF NOT EXISTS public.app_podcast_sessions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_podcast_strategies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_podcast_episodes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_episode_analyses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_podcast_clip_candidates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_approved_clips (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Video Pipeline
CREATE TABLE IF NOT EXISTS public.app_video_pipeline_states (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_video_versions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_video_audit_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_hook_analyses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_ai_video_analyses (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Lead Research & Growth Intelligence
CREATE TABLE IF NOT EXISTS public.app_lead_research (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Autopilot
CREATE TABLE IF NOT EXISTS public.autopilot_settings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.autopilot_runs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.autopilot_actions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.autopilot_activity_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW());

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
