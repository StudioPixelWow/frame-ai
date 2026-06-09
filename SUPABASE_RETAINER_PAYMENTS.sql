-- ============================================================
-- Frame-AI — Supabase setup for durable collection tracking
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to run more than once (idempotent).
-- ============================================================

-- 1) Monthly retainer payment marks (used by "ציר זמן וגבייה" → גביית ריטיינר חודשי)
--    Each row = one client marked as paid for one month.
CREATE TABLE IF NOT EXISTS public.app_retainer_payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2) Make sure the website-hosting paid status has a column to persist into.
--    (Hosting "תשלום הוסדר" writes the next annual payment date here.)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS annual_payment_date DATE;

-- 3) Reload PostgREST schema cache so the API sees the new table/column immediately.
NOTIFY pgrst, 'reload schema';
