import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/orders/[id] — Get a single order by order_code (e.g., #101 or 101).
 * Publicly accessible for guest tracking.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSupabase = createAdminClient();
    const { id } = await params;

    const formattedCode = id.startsWith('#') ? id : `#${id}`;

    const { data: order, error } = await adminSupabase
      .from('orders')
      .select('*')
      .or(`order_code.eq.${formattedCode},order_code.eq.${id}`)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

