import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { extractUtrFromScreenshot } from '@/services/ocr';
import { compareUtrs } from '@/services/payments';
import { sendAdminNtfyNotification } from '@/services/notifications';

/**
 * POST /api/orders/[id]/payment — Submit or resubmit payment proof (Guest mode supported).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSupabase = createAdminClient();
    const { id: orderCode } = await params;

    const body = await request.json();
    const { screenshotPath, utrNumber, paymentMethod } = body;

    // Handle Hand Cash / Cash on Pickup payment option
    if (paymentMethod === 'HAND_CASH' || utrNumber === 'HAND_CASH') {
      const { data: updatedOrder, error: updateError } = await adminSupabase
        .from('orders')
        .update({
          payment_screenshot_path: null,
          utr_number: 'HAND_CASH',
          payment_status: 'PAYMENT_SUBMITTED',
          order_status: 'PAYMENT_SUBMITTED',
          rejection_reason: null,
          utr_match_status: 'NOT_CHECKED',
        })
        .ilike('order_code', orderCode)
        .select()
        .single();

      if (updateError) {
        console.error('Hand Cash Update Error:', updateError);
        return NextResponse.json({ success: false, error: `Failed to select Hand Cash option: ${updateError.message}` }, { status: 500 });
      }

      return NextResponse.json({ success: true, data: updatedOrder });
    }

    if (!screenshotPath || !utrNumber) {
      return NextResponse.json({ success: false, error: 'Screenshot and UTR number are required' }, { status: 400 });
    }

    const trimmedUtr = utrNumber.trim();
    if (trimmedUtr.length < 6 || trimmedUtr.length > 30) {
      return NextResponse.json({ success: false, error: 'UTR number must be between 6 and 30 characters' }, { status: 400 });
    }

    // Get order using admin client
    const { data: order, error: orderError } = await adminSupabase
      .from('orders')
      .select('*')
      .ilike('order_code', orderCode)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Only allow submission when payment is pending or rejected
    if (!['PAYMENT_SUBMITTED', 'PAYMENT_REJECTED'].includes(order.payment_status)) {
      return NextResponse.json({
        success: false,
        error: 'Payment proof can only be submitted for pending or rejected orders',
      }, { status: 400 });
    }

    // Update order with payment proof
    const { data: updatedOrder, error: updateError } = await adminSupabase
      .from('orders')
      .update({
        payment_screenshot_path: screenshotPath,
        utr_number: trimmedUtr,
        payment_status: 'PAYMENT_SUBMITTED',
        order_status: 'PAYMENT_SUBMITTED',
        rejection_reason: null,
        utr_match_status: 'NOT_CHECKED',
        ocr_extracted_utr: null,
      })
      .ilike('order_code', orderCode)
      .select()
      .single();

    if (updateError) {
      console.error('Payment Proof Update Error:', updateError);
      return NextResponse.json({ success: false, error: `Failed to submit payment proof: ${updateError.message}` }, { status: 500 });
    }

    // Trigger async OCR (non-blocking)
    triggerOcrCheck(orderCode, screenshotPath, trimmedUtr).catch(
      (err) => console.error('Async OCR check failed:', err)
    );

    // Trigger instant mobile push alert to admin via ntfy.sh
    if (updatedOrder) {
      sendAdminNtfyNotification({
        title: `UPI Payment Submitted #${updatedOrder.order_code}!`,
        message: `Student: ${updatedOrder.student_name || 'Student'}\nPhone: ${updatedOrder.phone_number}\nAmount: ₹${Number(updatedOrder.total_amount).toFixed(2)}\nUTR: ${trimmedUtr || 'Screenshot attached'}`,
        orderCode: updatedOrder.order_code,
        priority: 'high',
        tags: ['credit_card', 'printer'],
      }).catch((err) => console.error('Ntfy push error:', err));
    }

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Submit payment proof catch error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/orders/[id]/payment — Admin verify or reject payment.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('admin_session')?.value === 'true';

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const adminSupabase = createAdminClient();
    const { id: orderCode } = await params;

    const body = await request.json();
    const { action, reason } = body;

    if (!['verify', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'Action must be "verify" or "reject"' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (action === 'verify') {
      updates.payment_status = 'PAYMENT_VERIFIED';
      updates.order_status = 'ACCEPTED';
      updates.accepted_at = new Date().toISOString();
    } else {
      updates.payment_status = 'PAYMENT_REJECTED';
      updates.order_status = 'REJECTED';
      updates.rejection_reason = reason || 'Payment verification failed';
    }

    const { data: updatedOrder, error: updateError } = await adminSupabase
      .from('orders')
      .update(updates)
      .ilike('order_code', orderCode)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to update payment status' }, { status: 500 });
    }

    // If rejected, dispatch rejection email to student if email exists
    if (action === 'reject' && updatedOrder?.email) {
      import('@/services/messaging').then(({ sendEmailNotification }) => {
        sendEmailNotification({
          to: updatedOrder.email,
          subject: `Order #${orderCode} Update — Payment Verification Notice`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
              <h2 style="color: #e11d48;">Order #${orderCode} Payment Issue ❌</h2>
              <p>Hi <strong>${updatedOrder.student_name || 'Student'}</strong>,</p>
              <p>Your payment verification for order <strong>#${orderCode}</strong> was rejected by the shop.</p>
              <p style="background: #ffe4e6; color: #9f1239; padding: 12px; border-radius: 8px; font-weight: bold;">
                Reason: ${reason || 'Payment screenshot or UTR number mismatch'}
              </p>
              <p>Please contact shop operator <strong>Surya (8015587361)</strong> or visit the counter for clarification.</p>
            </div>
          `,
        }).catch(() => {});
      });
    }

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

async function triggerOcrCheck(
  orderCode: string,
  screenshotPath: string,
  enteredUtr: string
) {
  try {
    const adminSupabase = createAdminClient();

    const { data: signedUrlData } = await adminSupabase.storage
      .from('payment-proofs')
      .createSignedUrl(screenshotPath, 300);

    if (!signedUrlData?.signedUrl) {
      await updateOcrResult(adminSupabase, orderCode, null, 'OCR_FAILED');
      return;
    }

    const ocrResult = await extractUtrFromScreenshot(signedUrlData.signedUrl);
    const matchStatus = compareUtrs(enteredUtr, ocrResult.text);

    await updateOcrResult(adminSupabase, orderCode, ocrResult.text, matchStatus);
  } catch (error) {
    console.error('OCR check error:', error);
    try {
      const adminSupabase = createAdminClient();
      await updateOcrResult(adminSupabase, orderCode, null, 'OCR_FAILED');
    } catch {
      // Silently fail
    }
  }
}

async function updateOcrResult(
  supabase: ReturnType<typeof createAdminClient>,
  orderCode: string,
  ocrUtr: string | null,
  matchStatus: string
) {
  await supabase
    .from('orders')
    .update({
      ocr_extracted_utr: ocrUtr,
      utr_match_status: matchStatus,
    })
    .ilike('order_code', orderCode);
}
