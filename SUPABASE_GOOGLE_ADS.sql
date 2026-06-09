-- ============================================================
-- Google Ads Reports — יצירת הטבלאות ב-Supabase
-- הדבק הכול ל-Supabase → SQL Editor → Run (בטוח להריץ שוב).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.app_google_ads_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_google_ads_connections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.app_google_ads_report_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- רענון מטמון הסכמה כדי שה-API יראה את הטבלאות מיד
NOTIFY pgrst, 'reload schema';
