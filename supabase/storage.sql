-- ============================================================
-- CampusXerox — Storage Buckets & Policies
-- Run this in Supabase SQL Editor
-- Safe to re-run multiple times (idempotent)
-- ============================================================

-- ========================
-- 1. CREATE PRIVATE BUCKETS
-- ========================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('xerox-files', 'xerox-files', false, 20971520, ARRAY['application/pdf']),
  ('payment-proofs', 'payment-proofs', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('receipts', 'receipts', false, 2097152, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ========================
-- 2. STORAGE POLICIES
-- ========================

-- ---- XEROX-FILES ----

DROP POLICY IF EXISTS "Students can upload own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload xerox files" ON storage.objects;
CREATE POLICY "Anyone can upload xerox files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'xerox-files');

DROP POLICY IF EXISTS "Students can read own PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read xerox files" ON storage.objects;
CREATE POLICY "Anyone can read xerox files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'xerox-files');

DROP POLICY IF EXISTS "Service can delete PDFs" ON storage.objects;
CREATE POLICY "Service can delete PDFs"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'xerox-files');

DROP POLICY IF EXISTS "Anyone can manage xerox files" ON storage.objects;
CREATE POLICY "Anyone can manage xerox files"
  ON storage.objects FOR ALL
  USING (bucket_id = 'xerox-files')
  WITH CHECK (bucket_id = 'xerox-files');

-- ---- PAYMENT-PROOFS ----

DROP POLICY IF EXISTS "Students can upload own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload payment proofs" ON storage.objects;
CREATE POLICY "Anyone can upload payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Students can read own screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read payment proofs" ON storage.objects;
CREATE POLICY "Anyone can read payment proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Service can delete screenshots" ON storage.objects;
CREATE POLICY "Service can delete screenshots"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Anyone can manage payment proofs" ON storage.objects;
CREATE POLICY "Anyone can manage payment proofs"
  ON storage.objects FOR ALL
  USING (bucket_id = 'payment-proofs')
  WITH CHECK (bucket_id = 'payment-proofs');

-- ---- RECEIPTS ----

DROP POLICY IF EXISTS "Students can read own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read receipts" ON storage.objects;
CREATE POLICY "Anyone can read receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Admins can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;
CREATE POLICY "Anyone can upload receipts"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Service can manage receipts" ON storage.objects;
CREATE POLICY "Service can manage receipts"
  ON storage.objects FOR ALL
  USING (bucket_id = 'receipts')
  WITH CHECK (bucket_id = 'receipts');
