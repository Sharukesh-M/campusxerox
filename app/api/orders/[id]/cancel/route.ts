import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/orders/[id]/cancel — Cancel an active order.
 * Accessible by the order's owner (student) or an admin.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: orderCode } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('order_code', orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Check permissions (User must own the order or be an admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';
    const isOwner = order.user_id === user.id;

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Check if order can be cancelled
    if (['COMPLETED', 'REJECTED', 'CANCELLED'].includes(order.order_status)) {
      return NextResponse.json({
        success: false,
        error: `Cannot cancel order in ${order.order_status} status`,
      }, { status: 400 });
    }

    // Update order status to CANCELLED
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update({ order_status: 'CANCELLED' })
      .eq('order_code', orderCode)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to cancel order' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
