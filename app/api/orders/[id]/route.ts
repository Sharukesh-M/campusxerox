import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/orders/[id] — Get a single order by order_code (Public / Guest accessible).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSupabase = createAdminClient();
    const { id } = await params;

    const { data: order, error } = await adminSupabase
      .from('orders')
      .select('*')
      .ilike('order_code', id)
      .single();

    if (error || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Generate signed URL for payment screenshot if path exists
    if (order.payment_screenshot_path) {
      try {
        const { data: signed } = await adminSupabase.storage
          .from('payment-proofs')
          .createSignedUrl(order.payment_screenshot_path, 86400); // 24 hour URL
        if (signed?.signedUrl) {
          order.payment_screenshot_url = signed.signedUrl;
        }
      } catch {
        // Non-critical signed URL failure
      }
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
