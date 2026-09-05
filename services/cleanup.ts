/**
 * Cleanup service — deletes expired PDF files and payment proof screenshots after 24 hours.
 * Runs server-side, triggered automatically or via cron endpoint /api/cron/cleanup.
 * Keeps free-tier Supabase Storage usage at ~0 MB.
 */

import { createAdminClient } from '@/lib/supabase/admin';

interface CleanupResult {
  ordersProcessed: number;
  filesDeleted: number;
  errors: string[];
}

/**
 * Automatically purge PDF files and payment proof screenshots older than 24 hours.
 */
export async function deleteExpiredFiles(): Promise<CleanupResult> {
  const supabase = createAdminClient();
  const result: CleanupResult = {
    ordersProcessed: 0,
    filesDeleted: 0,
    errors: [],
  };

  try {
    // Automatic 24-hour deletion disabled per user specification.
    // Order clearing is performed manually by admin via Clear All Order Data button.
    console.log('24-Hour automatic cleanup disabled. Orders remain intact until manually cleared.');
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Cleanup error: ${message}`);
  }

  console.log('24-Hour Cleanup result:', JSON.stringify(result));
  return result;
}

async function deleteFile(
  supabase: ReturnType<typeof createAdminClient>,
  bucket: string,
  path: string,
  result: CleanupResult
) {
  try {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) {
      if (!error.message.includes('not found') && !error.message.includes('Not Found')) {
        result.errors.push(`Failed to delete ${bucket}/${path}: ${error.message}`);
        return;
      }
    }
    result.filesDeleted++;
  } catch {
    result.errors.push(`Exception deleting ${bucket}/${path}`);
  }
}
