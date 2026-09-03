import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Admin Supabase client with service role key.
 * Bypasses RLS — use only in server-side code for:
 * - Cleanup operations
 * - Receipt generation/storage
 * - OCR processing
 * - Admin operations that need to bypass RLS
 *
 * NEVER import this in client-side code.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SERVICE_ROLE_KEY environment variables');
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
