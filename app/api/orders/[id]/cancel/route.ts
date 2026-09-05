import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/orders/[id]/cancel — Cancel an order by order code.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSupabase = createAdminClient();
    const { id: orderCode } = await params;

    const { data: order, error: orderError } = await adminSupabase
      .from('orders')
      .select('*')
      .ilike('order_code', orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (['CANCELLED', 'REJECTED'].includes(order.order_status)) {
      return NextResponse.json({
        success: true,
        data: order,
        message: `Order is already ${order.order_status.toLowerCase()}`,
      });
    }

    if (order.order_status === 'COMPLETED') {
      return NextResponse.json({
        success: false,
        error: 'Completed orders cannot be cancelled',
      }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const { reason = 'Cancelled by user' } = body;

    // Tier 1: Try updating with CANCELLED status & cancellation_reason column
    let { data: updatedOrder, error: updateError } = await adminSupabase
      .from('orders')
      .update({
        order_status: 'CANCELLED',
        cancellation_reason: reason,
        rejection_reason: `Cancelled: ${reason}`,
      })
      .eq('id', order.id)
      .select()
      .single();

    // Tier 2: Try updating with CANCELLED status without cancellation_reason column
    if (updateError) {
      console.warn('Tier 1 cancel update failed:', updateError.message);
      const tier2 = await adminSupabase
        .from('orders')
        .update({
          order_status: 'CANCELLED',
          rejection_reason: `Cancelled by user: ${reason}`,
        })
        .eq('id', order.id)
        .select()
        .single();
      updatedOrder = tier2.data;
      updateError = tier2.error;
    }

    // Tier 3: If 'CANCELLED' violates Postgres constraint in live DB, fallback to 'REJECTED' with cancellation reason
    if (updateError) {
      console.warn('Tier 2 cancel update failed:', updateError.message, 'Using Tier 3 fallback (REJECTED)');
      const tier3 = await adminSupabase
        .from('orders')
        .update({
          order_status: 'REJECTED',
          payment_status: 'PAYMENT_REJECTED',
          rejection_reason: `Cancelled by user: ${reason}`,
        })
        .eq('id', order.id)
        .select()
        .single();
      updatedOrder = tier3.data;
      updateError = tier3.error;
    }

    if (updateError) {
      console.error('All cancellation attempts failed:', updateError);
      return NextResponse.json({
        success: false,
        error: `Failed to cancel order: ${updateError.message || 'Database error'}`
      }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: msg }, { status: 400 });
  }
}
