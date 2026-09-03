import { NextResponse } from 'next/server';
import { deleteExpiredFiles } from '@/services/cleanup';

/**
 * POST /api/cleanup — Trigger cleanup of expired files.
 * Called by Vercel Cron (hourly) or manually by admin.
 *
 * Vercel Cron automatically adds CRON_SECRET for security.
 */
export async function POST(request: Request) {
  try {
    // Verify authorization (Vercel Cron secret or admin auth)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await deleteExpiredFiles();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Cleanup failed' }, { status: 500 });
  }
}
