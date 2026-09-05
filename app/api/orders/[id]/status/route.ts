import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { isValidStatusTransition } from '@/services/orders';
import { sendEmailNotification, sendCallMeBotWhatsApp } from '@/services/messaging';

/**
 * PATCH /api/orders/[id]/status — Update order status (admin only).
 * Triggers automated Email (Gmail SMTP) & WhatsApp (CallMeBot) notifications.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('admin_session')?.value === 'true';

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden — Admin access required' }, { status: 403 });
    }

    const adminSupabase = createAdminClient();
    const { id: orderCode } = await params;

    const body = await request.json();
    const { status: newStatus, reason } = body;

    if (!newStatus) {
      return NextResponse.json({ success: false, error: 'Status is required' }, { status: 400 });
    }

    // Get current order
    const { data: order, error: orderError } = await adminSupabase
      .from('orders')
      .select('*')
      .ilike('order_code', orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Validate status transition
    if (!isValidStatusTransition(order.order_status, newStatus)) {
      return NextResponse.json({
        success: false,
        error: `Cannot transition from ${order.order_status} to ${newStatus}`,
      }, { status: 400 });
    }

    // Build update
    const updates: Record<string, unknown> = {
      order_status: newStatus,
    };

    if (newStatus === 'ACCEPTED') {
      updates.accepted_at = new Date().toISOString();
    }

    if (newStatus === 'REJECTED') {
      updates.rejection_reason = reason || 'Order rejected by admin';
      updates.payment_status = 'PAYMENT_REJECTED';
    }

    if (newStatus === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();

      try {
        if (order.file_path) {
          await adminSupabase.storage
            .from('xerox-files')
            .remove([order.file_path]);
          updates.file_path = null;
        }
      } catch {
        // Non-critical cleanup
      }
    }

    // Update order in database
    const { data: updatedOrder, error: updateError } = await adminSupabase
      .from('orders')
      .update(updates)
      .ilike('order_code', orderCode)
      .select()
      .single();

    if (updateError) {
      console.error('Update status error:', updateError);
      return NextResponse.json({ success: false, error: `Failed to update order: ${updateError.message}` }, { status: 500 });
    }

    // Automated Dispatch: Send automated Email & CallMeBot WhatsApp notifications
    const studentEmail = order.email;
    const studentPhone = order.phone_number;
    const studentName = order.student_name || 'Student';

    if (newStatus === 'READY_FOR_PICKUP') {
      if (studentPhone) {
        sendCallMeBotWhatsApp({
          phone: studentPhone,
          message: `📢 *CampusXerox Notice*\n\nHi ${studentName},\nYour Order *#${orderCode}* is READY FOR PICKUP! 🖨️\nPlease visit the Xerox counter.`,
        }).catch(() => {});
      }

      if (studentEmail) {
        sendEmailNotification({
          to: studentEmail,
          subject: `Order #${orderCode} is Ready for Pickup — CampusXerox`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
              <h2 style="color: #4f46e5;">Order #${orderCode} is Ready for Pickup! 🎉</h2>
              <p>Hi <strong>${studentName}</strong>,</p>
              <p>Your print order <strong>#${orderCode}</strong> has been printed and is ready for pickup at the Xerox counter.</p>
              <p style="background: #f1f5f9; padding: 12px; border-radius: 8px; font-weight: bold;">Order Code: #${orderCode}</p>
              <p>Thank you for using CampusXerox!</p>
            </div>
          `,
        }).catch(() => {});
      }
    } else if (newStatus === 'COMPLETED') {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const receiptUrl = `${baseUrl}/api/orders/${orderCode}/receipt`;

      if (studentPhone) {
        sendCallMeBotWhatsApp({
          phone: studentPhone,
          message: `✅ *CampusXerox Order Completed*\n\nHi ${studentName},\nYour order *#${orderCode}* (₹${Number(order.total_amount).toFixed(2)}) has been marked completed.\n\n📄 Download Official Receipt:\n${receiptUrl}\n\nShop Contact: Surya (8015587361)`,
        }).catch(() => {});
      }

      if (studentEmail) {
        sendEmailNotification({
          to: studentEmail,
          subject: `🎉 Order #${orderCode} Completed — Official Receipt Attached | CampusXerox`,
          html: `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
              <div style="text-align: center; padding-bottom: 20px; border-bottom: 2px solid #4f46e5;">
                <h1 style="color: #4f46e5; margin: 0; font-size: 24px; font-weight: 800;">CampusXerox</h1>
                <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Instant Queue-Free Print Services</p>
              </div>

              <div style="padding: 20px 0;">
                <h2 style="color: #059669; font-size: 20px; margin-top: 0;">Order Completed & Ready! ✅</h2>
                <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                  Hi <strong>${studentName}</strong>,
                </p>
                <p style="font-size: 14px; line-height: 1.6; color: #334155;">
                  Your xerox printing order <strong>#${orderCode}</strong> has been successfully printed and marked completed. You can download your official tax/digital receipt below.
                </p>

                <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
                  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                    <tr>
                      <td style="padding: 6px 0; color: #64748b;">Order Code:</td>
                      <td style="padding: 6px 0; font-weight: font-bold; text-align: right; color: #4f46e5; font-family: monospace; font-size: 15px;">#${orderCode}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #64748b;">Document:</td>
                      <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #1e293b;">${order.file_name || 'Xerox Documents'}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #64748b;">Total Pages:</td>
                      <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #1e293b;">${order.page_count} pages</td>
                    </tr>
                    <tr style="border-top: 1px solid #e2e8f0;">
                      <td style="padding: 10px 0 0 0; font-weight: bold; font-size: 15px; color: #0f172a;">Total Amount Paid:</td>
                      <td style="padding: 10px 0 0 0; font-weight: 800; font-size: 18px; text-align: right; color: #059669;">₹${Number(order.total_amount).toFixed(2)}</td>
                    </tr>
                  </table>
                </div>

                <div style="text-align: center; margin: 28px 0;">
                  <a href="${receiptUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.25);">
                    📥 Download Official PDF Receipt
                  </a>
                </div>

                <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 14px; font-size: 12px; color: #92400e;">
                  <strong>Need help or have questions?</strong><br/>
                  Contact Person: <strong>Surya</strong><br/>
                  Phone / WhatsApp: <a href="tel:8015587361" style="color: #b45309; font-weight: bold;">8015587361</a>
                </div>
              </div>

              <div style="text-align: center; padding-top: 16px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 11px;">
                Thank you for using CampusXerox! Skip the queue, save your time.
              </div>
            </div>
          `,
        }).catch((err) => console.error('Failed to send completion email:', err));
      }
    }

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
