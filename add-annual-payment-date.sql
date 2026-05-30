-- Annual payment date for hosting clients — a recurring day/month (NO year).
-- Stored as TEXT "MM-DD" (e.g. "12-27"). Run once in the Supabase SQL Editor.
--
-- If you already created it as DATE, convert it to TEXT:
--   ALTER TABLE clients ALTER COLUMN annual_payment_date TYPE TEXT USING to_char(annual_payment_date, 'MM-DD');

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS annual_payment_date TEXT;
