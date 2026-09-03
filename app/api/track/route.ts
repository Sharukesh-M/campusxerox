import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/track?query=... — Search active/recent orders by order code (#101, 101) or 10-digit mobile number.
 * Publicly accessible endpoint for guest tracking.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query')?.trim();

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query parameter is required' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();
    const formattedCode = query.startsWith('#') ? query : `#${query}`;

    // Search by order_code OR phone_number
    const { data: orders, error } = await adminSupabase
      .from('orders')
      .select('*')
      .or(`order_code.eq.${formattedCode},order_code.eq.${query},phone_number.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to search orders' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
