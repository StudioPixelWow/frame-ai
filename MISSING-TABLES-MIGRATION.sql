-- ============================================================
-- PIXEL PRIME — Missing Specialty Tables Migration
-- ============================================================
-- הרץ את ה-SQL הזה ב-Supabase SQL Editor AFTER the middleware fix is deployed
-- These are tables used by specific cron handlers but not in collections.ts
-- ============================================================

-- 1. weekly_summaries — used by weekly-summary cron
CREATE TABLE IF NOT EXISTS public.weekly_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. whatsapp_scheduled — used by whatsapp-scheduled cron
CREATE TABLE IF NOT EXISTS public.whatsapp_scheduled (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. meta_action_log — used by meta-auto-optimize cron
CREATE TABLE IF NOT EXISTS public.meta_action_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. seo_daily_progress — used by daily SEO progress scanner
CREATE TABLE IF NOT EXISTS public.seo_daily_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. seo_automation_log — used by daily SEO runner
CREATE TABLE IF NOT EXISTS public.seo_automation_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. app_whatsapp_qr_sessions — used by WhatsApp QR digest
CREATE TABLE IF NOT EXISTS public.app_whatsapp_qr_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verify — run after CREATE
-- ============================================================
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'weekly_summaries', 'whatsapp_scheduled', 'meta_action_log',
  'seo_daily_progress', 'seo_automation_log', 'app_whatsapp_qr_sessions'
);
-- Should return 6 rows
