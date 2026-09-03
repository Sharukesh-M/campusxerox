# CampusXerox — Deployment Guide

## Prerequisites
- A [Supabase](https://supabase.com) account (free tier works)
- A [Vercel](https://vercel.com) account (free tier works)
- A [ZhipuAI](https://open.bigmodel.cn) API key (optional, for UTR OCR verification)
- Node.js 18+ installed locally

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Key** → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Set Up Database

Go to **SQL Editor** in Supabase Dashboard and run these SQL files in order:

1. **`supabase/schema.sql`** — Creates tables, indexes, RLS policies, and auth trigger
2. **`supabase/storage.sql`** — Creates private storage buckets with policies
3. **`supabase/seed.sql`** — Inserts default pricing settings

---

## Step 3: Enable Auth

1. Go to **Authentication → Settings** in Supabase Dashboard
2. Under **Email Auth**, ensure email/password is enabled
3. Set the **Site URL** to your Vercel deployment URL (e.g., `https://campusxerox.vercel.app`)
4. Add redirect URLs:
   - `https://campusxerox.vercel.app/api/auth/callback`
   - `http://localhost:3000/api/auth/callback` (for local dev)

---

## Step 4: Create Admin Account

1. Go to **Authentication → Users** and click **Add User**
2. Enter an email and password for the admin
3. Copy the user's UUID
4. Go to **SQL Editor** and run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE id = 'PASTE_UUID_HERE';
   ```

---

## Step 5: Local Development

```bash
# Install dependencies
npm install

# Copy env file and fill in values
cp .env.example .env.local

# Edit .env.local with your Supabase credentials
# NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
# SUPABASE_SERVICE_ROLE_KEY=eyJ...
# GLM_API_KEY=your_glm_key (optional)

# Start dev server
npm run dev
```

Open http://localhost:3000

---

## Step 6: Deploy to Vercel

1. Push your code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and click **Import Project**
3. Select your repository
4. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GLM_API_KEY` (optional)
5. Deploy!

---

## Step 7: Test the Full Flow

### Student Flow
1. Sign up with a new email
2. Confirm email (check inbox or Supabase Auth logs)
3. Log in → Dashboard
4. Click "New Xerox Order"
5. Upload a PDF → pages detected
6. Configure: B&W, Single Side, 1 page/sheet, 1 copy
7. Review price summary
8. Note the UPI ID, pay via your UPI app
9. Upload payment screenshot + enter UTR
10. Order created → track status

### Admin Flow
1. Log in with admin credentials → Admin Dashboard
2. See the new order in "New" tab
3. Click on order → see printing instructions + payment proof
4. Verify payment → order moves to "Accepted"
5. Start Printing → "Printing"
6. Ready for Pickup → "Ready"
7. Mark Completed → receipt generated, PDF deleted
8. Student can now download the receipt

---

## Architecture Notes

```
/app                    — Next.js App Router pages
/app/api                — Server-side API routes
/components             — React components
/lib/supabase           — Supabase client helpers
/services               — Business logic (pricing, orders, OCR, etc.)
/types                  — TypeScript type definitions
/supabase               — Database migration SQL files
```

### Security
- RLS enforced on all tables
- Private storage buckets with signed URLs
- Server-side price calculation (never trust client)
- Admin role checked from database (never from token/frontend)
- No secrets exposed to browser

### Data Flow
```
Student Upload → Supabase Storage (xerox-files)
Student Payment → Screenshot to Supabase Storage (payment-proofs)
                → Async OCR via GLM-4V
Admin Verify   → Status updates in orders table
Completion     → Receipt PDF generated → Supabase Storage (receipts)
                → Source PDF deleted
Cleanup (cron) → Expired files + orders cleaned up hourly
```
