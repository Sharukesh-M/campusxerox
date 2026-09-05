import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateOrdersPdfReport } from '@/services/reports';
import type { Order } from '@/types';

/**
 * GET /api/admin/orders/report — Generate official PDF orders report (Admin route).
 * Query parameters: status (PAYMENT_SUBMITTED | ACCEPTED | COMPLETED | REJECTED | CANCELLED | ALL)
 */
export async function GET(request: Request) {
  try {
    const adminSupabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'ALL';
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);

    let query = adminSupabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'ALL') {
      if (status === 'REJECTED') {
        query = query.or('order_status.eq.REJECTED,payment_status.eq.PAYMENT_REJECTED');
      } else if (status === 'PAYMENT_SUBMITTED') {
        query = query.eq('order_status', 'PAYMENT_SUBMITTED').neq('payment_status', 'PAYMENT_REJECTED');
      } else {
        query = query.eq('order_status', status);
      }
    }

    const { data: orders, error } = await query;

    if (error || !orders) {
      console.error('Fetch Orders for Report Error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch order records' }, { status: 500 });
    }

    // Generate PDF report Buffer using jsPDF
    const pdfBuffer = generateOrdersPdfReport(orders as Order[], status);

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `CampusXerox_Orders_Report_${status}_${dateStr}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('PDF Report API Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
