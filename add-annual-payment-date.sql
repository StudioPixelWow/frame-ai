-- Annual payment date for hosting clients (pay once a year).
-- Run once in the Supabase SQL Editor.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS annual_payment_date DATE;
