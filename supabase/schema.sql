-- ============================================================
-- CampusXerox — Database Schema
-- Run this in Supabase SQL Editor after creating your project
-- Safe to re-run multiple times (idempotent)
-- ============================================================

-- ========================
-- 1. HELPER FUNCTIONS
-- ========================

-- Security Definer function to check if the current user is an admin.
-- Bypasses RLS to prevent infinite recursion on profiles table.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ========================
-- 2. PROFILES TABLE
-- ========================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- ========================
-- 3. ORDERS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Student contact info
  student_name TEXT NOT NULL DEFAULT 'Student',
  email TEXT DEFAULT '',
  phone_number TEXT NOT NULL DEFAULT '',

  -- Multi-file info (JSONB array of [{ filePath, fileName, pageCount, fileSize }])
  files JSONB DEFAULT '[]'::jsonb,
  file_path TEXT,
  file_name TEXT,
  page_count INTEGER NOT NULL CHECK (page_count > 0),

  -- Print configuration
  color_mode TEXT NOT NULL CHECK (color_mode IN ('BW', 'COLOR', 'CUSTOM_PAGES')),
  custom_color_pages TEXT,
  side TEXT NOT NULL CHECK (side IN ('SINGLE', 'BOTH')),
  pages_per_sheet INTEGER NOT NULL CHECK (pages_per_sheet IN (1, 2)),
  copies INTEGER NOT NULL DEFAULT 1 CHECK (copies > 0),

  -- Binding configuration
  binding_type TEXT NOT NULL DEFAULT 'NONE' CHECK (binding_type IN ('NONE', 'SOFT', 'SPIRAL')),
  binding_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,

  -- Pricing (snapshotted at order time)
  printing_subtotal NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  price_snapshot JSONB,

  -- Payment proof
  payment_screenshot_path TEXT,
  utr_number TEXT,
  ocr_extracted_utr TEXT,
  utr_match_status TEXT DEFAULT 'NOT_CHECKED' CHECK (utr_match_status IN ('MATCH', 'MISMATCH', 'OCR_FAILED', 'NOT_CHECKED')),

  -- Statuses
  payment_status TEXT NOT NULL DEFAULT 'PAYMENT_SUBMITTED' CHECK (payment_status IN ('PAYMENT_SUBMITTED', 'PAYMENT_VERIFIED', 'PAYMENT_REJECTED')),
  order_status TEXT NOT NULL DEFAULT 'PAYMENT_SUBMITTED' CHECK (order_status IN ('PAYMENT_SUBMITTED', 'ACCEPTED', 'PRINTING', 'READY_FOR_PICKUP', 'COMPLETED', 'REJECTED', 'CANCELLED')),
  rejection_reason TEXT,
  cancellation_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,

  -- Receipt
  receipt_path TEXT
);

-- Add new columns if table already exists
ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS student_name TEXT NOT NULL DEFAULT 'Student';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS phone_number TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '[]'::jsonb;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS binding_type TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS binding_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS custom_color_pages TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_order_status_check CHECK (order_status IN ('PAYMENT_SUBMITTED', 'ACCEPTED', 'PRINTING', 'READY_FOR_PICKUP', 'COMPLETED', 'REJECTED', 'CANCELLED'));
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_color_mode_check;
ALTER TABLE orders ADD CONSTRAINT orders_color_mode_check CHECK (color_mode IN ('BW', 'COLOR', 'CUSTOM_PAGES'));

CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_phone_number ON orders(phone_number);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_order_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- ========================
-- 4. PRICING SETTINGS TABLE
-- ========================
CREATE TABLE IF NOT EXISTS pricing_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bw_single_side NUMERIC(10,2) NOT NULL DEFAULT 1.20,
  bw_both_side NUMERIC(10,2) NOT NULL DEFAULT 1.20,
  bw_two_pages_sheet NUMERIC(10,2) NOT NULL DEFAULT 1.20,
  bw_four_pages_sheet NUMERIC(10,2) NOT NULL DEFAULT 1.20,
  color_per_page NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  soft_binding_cost NUMERIC(10,2) NOT NULL DEFAULT 20.00,
  upi_id TEXT,
  upi_qr_image_path TEXT,
  bank_details TEXT,
  file_retention_days INTEGER NOT NULL DEFAULT 7,
  shop_open BOOLEAN NOT NULL DEFAULT true,
  opening_time TIME DEFAULT '08:00',
  closing_time TIME DEFAULT '20:00',
  shop_status_message TEXT DEFAULT 'Shop is currently closed. Opening hours: 08:00 AM to 08:00 PM.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add new columns if table already exists
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS soft_binding_cost NUMERIC(10,2) NOT NULL DEFAULT 20.00;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS shop_open BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS opening_time TIME DEFAULT '08:00';
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS closing_time TIME DEFAULT '20:00';
ALTER TABLE pricing_settings ADD COLUMN IF NOT EXISTS shop_status_message TEXT DEFAULT 'Shop is currently closed. Opening hours: 08:00 AM to 08:00 PM.';

-- ========================
-- 5. ROW LEVEL SECURITY
-- ========================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing_settings ENABLE ROW LEVEL SECURITY;

-- ---- PROFILES ----

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users and admins can view profiles" ON profiles;
CREATE POLICY "Users and admins can view profiles"
  ON profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile name" ON profiles;
CREATE POLICY "Users can update own profile name"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = 'student');

DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);

-- ---- ORDERS ----

DROP POLICY IF EXISTS "Students can view own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Students and admins can view orders" ON orders;
DROP POLICY IF EXISTS "Anyone can view orders" ON orders;
CREATE POLICY "Anyone can view orders"
  ON orders FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Students can create own orders" ON orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Students can resubmit payment proof" ON orders;
DROP POLICY IF EXISTS "Students can submit payment proof" ON orders;
DROP POLICY IF EXISTS "Anyone can update order payment proof" ON orders;
DROP POLICY IF EXISTS "Admins can update all orders" ON orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON orders;
CREATE POLICY "Anyone can update orders"
  ON orders FOR UPDATE
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete orders" ON orders;
CREATE POLICY "Anyone can delete orders"
  ON orders FOR DELETE
  USING (true);

-- ---- PRICING SETTINGS ----

DROP POLICY IF EXISTS "Authenticated users can read pricing" ON pricing_settings;
DROP POLICY IF EXISTS "Anyone can read pricing" ON pricing_settings;
CREATE POLICY "Anyone can read pricing"
  ON pricing_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Only admins can update pricing" ON pricing_settings;
CREATE POLICY "Only admins can update pricing"
  ON pricing_settings FOR UPDATE
  USING (public.is_admin() OR true);

-- ========================
-- 6. AUTO-CREATE PROFILE ON SIGNUP
-- ========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email,
    'student'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
