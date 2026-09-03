import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateReceipt } from '@/services/receipts';
import type { Order, Profile } from '@/types';

/**
 * GET /api/orders/[id]/receipt — Generates and streams PDF receipt on-the-fly.
 * Stores 0 bytes in Supabase Storage to keep free tier usage minimal.
 */
export async function GET(
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

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, profiles(name, email)')
      .eq('order_code', orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Check authorization (student owner or admin)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin' && order.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (order.order_status !== 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Receipt available only for completed orders' }, { status: 404 });
    }

    // Generate receipt PDF in memory (0 storage used)
    const studentProfile = (order.profiles || { name: order.student_name, email: user.email }) as unknown as Profile;
    const pdfBuffer = generateReceipt(order as unknown as Order, studentProfile);
    const uint8Array = new Uint8Array(pdfBuffer);

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="CampusXerox_Receipt_${orderCode}.pdf"`,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
