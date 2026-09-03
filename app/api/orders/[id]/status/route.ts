import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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
    const supabase = await createClient();
    const { id: orderCode } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { status: newStatus, reason } = body;

    if (!newStatus) {
      return NextResponse.json({ success: false, error: 'Status is required' }, { status: 400 });
    }

    // Get current order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, profiles(name, email)')
      .eq('order_code', orderCode)
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
    }

    if (newStatus === 'COMPLETED') {
      updates.completed_at = new Date().toISOString();

      // Delete the raw PDF file from storage on completion to save storage
      try {
        const adminSupabase = createAdminClient();
        if (order.file_path) {
          await adminSupabase.storage
            .from('xerox-files')
            .remove([order.file_path]);
          updates.file_path = null;
        }
      } catch {
        // Non-critical — cleanup will handle it later
      }
    }

    // Update order in database
    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('order_code', orderCode)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
    }

    // AUTOMATED DISPATCH: Send automated Email & CallMeBot WhatsApp notifications asynchronously
    const studentEmail = (order.profiles as { email?: string })?.email;
    const studentPhone = order.phone_number;
    const studentName = order.student_name || (order.profiles as { name?: string })?.name || 'Student';

    if (newStatus === 'READY_FOR_PICKUP') {
      // 1. WhatsApp notification
      if (studentPhone) {
        sendCallMeBotWhatsApp({
          phone: studentPhone,
          message: `📢 *CampusXerox Notice*\n\nHi ${studentName},\nYour Order *#${orderCode}* is READY FOR PICKUP! 🖨️\nPlease visit the Xerox counter.`,
        }).catch(() => {});
      }

      // 2. Gmail SMTP notification
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
      const receiptUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/orders/${orderCode}/receipt`;

      // 1. WhatsApp receipt notification
      if (studentPhone) {
        sendCallMeBotWhatsApp({
          phone: studentPhone,
          message: `✅ *CampusXerox Order Completed*\n\nHi ${studentName},\nYour order *#${orderCode}* (₹${Number(order.total_amount).toFixed(2)}) is completed.\n\n📄 Receipt: ${receiptUrl}`,
        }).catch(() => {});
      }

      // 2. Gmail SMTP email receipt notification
      if (studentEmail) {
        sendEmailNotification({
          to: studentEmail,
          subject: `Official Receipt for Order #${orderCode} — CampusXerox`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
              <h2 style="color: #059669;">Order #${orderCode} Completed! ✅</h2>
              <p>Hi <strong>${studentName}</strong>,</p>
              <p>Thank you for your business! Your order <strong>#${orderCode}</strong> (₹${Number(order.total_amount).toFixed(2)}) has been completed.</p>
              <p><a href="${receiptUrl}" style="background: #4f46e5; color: #ffffff; padding: 10px 18px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Download PDF Receipt</a></p>
            </div>
          `,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
