-- ============================================================
-- CampusXerox — Admin Account Setup
-- ============================================================
--
-- STEPS TO CREATE AN ADMIN:
--
-- 1. Go to your Supabase Dashboard → Authentication → Users
-- 2. Click "Add User" and create a user with email/password
-- 3. Note the user's UUID from the dashboard
-- 4. Run the SQL below, replacing 'YOUR_USER_UUID' with the actual UUID
--
-- ============================================================

-- Promote a user to admin
UPDATE profiles
SET role = 'admin'
WHERE id = 'YOUR_USER_UUID_HERE';

-- Verify the promotion
SELECT id, name, email, role FROM profiles WHERE role = 'admin';

-- ============================================================
-- IMPORTANT:
-- - There is NO admin signup flow — this is intentional
-- - Only database-level operations can promote users to admin
-- - Never expose an API endpoint that allows role changes
-- ============================================================
