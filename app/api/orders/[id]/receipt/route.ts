import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateReceipt } from '@/services/receipts';
import type { Order, Profile } from '@/types';

/**
 * GET /api/orders/[id]/receipt — Generates and streams PDF receipt on-the-fly.
 */
export async function GET(
  _request: Request,
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

    if (order.order_status !== 'COMPLETED') {
      return NextResponse.json({ success: false, error: 'Receipt available only for completed orders' }, { status: 404 });
    }

    const studentProfile: Profile = {
      id: order.id,
      name: order.student_name || 'Student',
      email: order.email || '',
      role: 'student',
      created_at: order.created_at,
    };

    const pdfBuffer = generateReceipt(order as unknown as Order, studentProfile);
    const uint8Array = new Uint8Array(pdfBuffer);

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="CampusXerox_Receipt_${orderCode}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Receipt generation error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
