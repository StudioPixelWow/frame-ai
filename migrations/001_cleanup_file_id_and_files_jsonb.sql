-- Migration: Remove stale columns from milestone-related tables
-- Date: 2026-04-17
-- Context:
--   1. business_project_milestone_files may have a legacy `file_id` column
--      that is no longer used in application code. The app uses:
--      id (UUID PK), milestone_id, file_name, file_url, file_size, content_type,
--      created_at, updated_at.
--   2. business_project_milestones may have a legacy `files` JSONB column
--      that stored file references inline. Files are now stored in the
--      separate business_project_milestone_files table.
--   3. The employees table needs an `app_role` column for RBAC
--      (separate from the existing `role` column which stores job title).

-- 1. Drop file_id from milestone files table (if it exists)
ALTER TABLE public.business_project_milestone_files
  DROP COLUMN IF EXISTS file_id;

-- 2. Drop legacy files JSONB from milestones table (if it exists)
ALTER TABLE public.business_project_milestones
  DROP COLUMN IF EXISTS files;

-- 3. Ensure app_role column exists on employees table
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS app_role TEXT DEFAULT 'employee';

-- 4. Refresh PostgREST schema cache so it picks up the changes
NOTIFY pgrst, 'reload schema';
