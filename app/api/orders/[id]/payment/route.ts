import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractUtrFromScreenshot } from '@/services/ocr';
import { compareUtrs } from '@/services/payments';

/**
 * POST /api/orders/[id]/payment — Submit or resubmit payment proof.
 * Student uploads screenshot path + UTR. Triggers async OCR.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSupabase = createAdminClient();
    const { id: rawCode } = await params;
    const formattedCode = rawCode.startsWith('#') ? rawCode : `#${rawCode}`;

    const body = await request.json();
    const { screenshotPath, utrNumber } = body;

    if (!screenshotPath || !utrNumber) {
      return NextResponse.json({ success: false, error: 'Screenshot and UTR number are required' }, { status: 400 });
    }

    // Validate UTR format (basic check)
    const trimmedUtr = utrNumber.trim();
    if (trimmedUtr.length < 6 || trimmedUtr.length > 30) {
      return NextResponse.json({ success: false, error: 'UTR number must be between 6 and 30 characters' }, { status: 400 });
    }

    // Get order using admin client (matching rawCode or formattedCode)
    const { data: order, error: orderError } = await adminSupabase
      .from('orders')
      .select('*')
      .or(`order_code.eq.${formattedCode},order_code.eq.${rawCode}`)
      .maybeSingle();

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

    // Update order with payment proof using admin client
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
      .eq('id', order.id)
      .select()
      .single();

    if (updateError) {
      console.error('Payment Proof Update Error:', updateError);
      return NextResponse.json({ success: false, error: `Failed to submit payment proof: ${updateError.message}` }, { status: 500 });
    }

    // Trigger async OCR (non-blocking)
    triggerOcrCheck(order.order_code, screenshotPath, trimmedUtr, order.user_id).catch(
      (err) => console.error('Async OCR check failed:', err)
    );

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
      updates.rejection_reason = reason || 'Payment verification failed';
    }

    const { data: updatedOrder, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('order_code', orderCode)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to update payment status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updatedOrder });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Async OCR check — runs in background after payment proof submission.
 * Updates the order's utr_match_status without blocking the student.
 */
async function triggerOcrCheck(
  orderCode: string,
  screenshotPath: string,
  enteredUtr: string,
  userId: string
) {
  try {
    const adminSupabase = createAdminClient();

    // Get signed URL for the screenshot
    const { data: signedUrlData } = await adminSupabase.storage
      .from('payment-proofs')
      .createSignedUrl(screenshotPath, 300); // 5 min expiry

    if (!signedUrlData?.signedUrl) {
      await updateOcrResult(adminSupabase, orderCode, null, 'OCR_FAILED');
      return;
    }

    // Call OCR service
    const ocrResult = await extractUtrFromScreenshot(signedUrlData.signedUrl);

    // Compare UTRs
    const matchStatus = compareUtrs(enteredUtr, ocrResult.text);

    // Update order with OCR result
    await updateOcrResult(adminSupabase, orderCode, ocrResult.text, matchStatus);
  } catch (error) {
    console.error('OCR check error:', error);
    try {
      const adminSupabase = createAdminClient();
      await updateOcrResult(adminSupabase, orderCode, null, 'OCR_FAILED');
    } catch {
      // Silently fail — admin can still manually verify
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
    .eq('order_code', orderCode);
}
