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
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Find all orders created or completed more than 24 hours ago that still have PDF files stored
    const { data: expiredOrders, error: queryError } = await supabase
      .from('orders')
      .select('id, file_path, files, payment_screenshot_path, order_code')
      .or(`expires_at.lt.${new Date().toISOString()},created_at.lt.${twentyFourHoursAgo}`);

    if (queryError) {
      result.errors.push(`Query error: ${queryError.message}`);
      return result;
    }

    if (!expiredOrders || expiredOrders.length === 0) {
      return result;
    }

    for (const order of expiredOrders) {
      result.ordersProcessed++;

      // Delete main PDF file
      if (order.file_path) {
        await deleteFile(supabase, 'xerox-files', order.file_path, result);
      }

      // Delete itemized files list if present
      if (Array.isArray(order.files)) {
        for (const item of order.files) {
          if (item && typeof item === 'object' && item.filePath) {
            await deleteFile(supabase, 'xerox-files', item.filePath, result);
          }
        }
      }

      // Delete payment proof screenshot
      if (order.payment_screenshot_path) {
        await deleteFile(supabase, 'payment-proofs', order.payment_screenshot_path, result);
      }

      // Clear storage paths from database row while keeping order text history
      await supabase
        .from('orders')
        .update({
          file_path: null,
          payment_screenshot_path: null,
        })
        .eq('id', order.id);
    }
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
