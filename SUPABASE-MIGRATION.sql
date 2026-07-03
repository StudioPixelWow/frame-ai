-- ============================================================
-- PIXEL PRIME — Central Job Runner Migration
-- ============================================================
-- הרץ את ה-SQL הזה ב-Supabase SQL Editor:
-- https://uaruggdabeyiuppcvbbi.supabase.co → SQL Editor → New Query
--
-- זה יוצר שתי טבלאות חדשות:
--   1. scheduled_jobs — רשימת כל הג'ובים האוטומטיים
--   2. job_runs — היסטוריית הרצות
-- ============================================================

-- טבלה 1: scheduled_jobs
-- מאחסנת את כל 15 הג'ובים הרשומים עם סטטוס, זמני הרצה, וכו'
CREATE TABLE IF NOT EXISTS public.scheduled_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- טבלה 2: job_runs
-- מאחסנת כל הרצה בודדת — תוצאה, משך, שגיאה
CREATE TABLE IF NOT EXISTS public.job_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- רענון PostgREST schema cache (חובה כדי שה-API יראה את הטבלאות)
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- וידוא — הרץ אחרי ה-CREATE כדי לוודא שהטבלאות נוצרו
-- ============================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('scheduled_jobs', 'job_runs');
