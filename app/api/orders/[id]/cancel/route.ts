import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/orders/[id]/cancel — Cancel an active order by order_code.
 * Accessible by students (matching order code / phone) or admins.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSupabase = createAdminClient();
    const { id: rawCode } = await params;
    const orderCode = rawCode.startsWith('#') ? rawCode : `#${rawCode}`;

    const body = await request.json().catch(() => ({}));
    const { reason = 'Cancelled by user' } = body;

    // Fetch order
    const { data: order, error } = await adminSupabase
      .from('orders')
      .select('*')
      .or(`order_code.eq.${orderCode},order_code.eq.${rawCode}`)
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.order_status === 'COMPLETED' || order.order_status === 'CANCELLED') {
      return NextResponse.json({
        success: false,
        error: `Order cannot be cancelled because it is already ${order.order_status.toLowerCase()}`,
      }, { status: 400 });
    }

    // Update status to CANCELLED
    const { data: updatedOrder, error: updateError } = await adminSupabase
      .from('orders')
      .update({
        order_status: 'CANCELLED',
        rejection_reason: reason,
      })
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to cancel order' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
      data: updatedOrder,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
