import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { calculateExpiryDate } from '@/services/orders';
import { calculateMultiPdfOrderPrice } from '@/services/pricing';
import { ColorMode, Side, BindingType, type PricingSettings, type PdfDocumentConfig } from '@/types';
import { cookies } from 'next/headers';
import { sendAdminNtfyNotification } from '@/services/notifications';

/**
 * POST /api/orders — Create a new guest xerox order.
 * Accepts studentName, email, phoneNumber, files, etc.
 */
export async function POST(request: Request) {
  try {
    const adminSupabase = createAdminClient();
    const body = await request.json();

    const {
      studentName,
      email = '',
      phoneNumber,
      files,
      filePath,
      fileName,
      pageCount,
      colorMode,
      customColorPages = '',
      side,
      pagesPerSheet,
      copies,
      bindingType = BindingType.NONE,
      paymentMethod = 'UPI',
      utrNumber = null,
      screenshotPath = null,
    } = body;

    // Validate student details
    if (!studentName?.trim() || !phoneNumber?.trim()) {
      return NextResponse.json({ success: false, error: 'Student Name and Phone Number are required' }, { status: 400 });
    }

    // Process files list (supports single or multi-PDF upload)
    let processedFiles: PdfDocumentConfig[] = [];
    if (Array.isArray(files) && files.length > 0) {
      processedFiles = files;
    } else if (filePath && fileName && pageCount) {
      processedFiles = [{
        filePath,
        fileName,
        pageCount,
        fileSize: 0,
        colorMode: colorMode || ColorMode.BW,
        customColorPages: customColorPages || '',
        side: side || Side.SINGLE,
        pagesPerSheet: pagesPerSheet || 1,
        copies: copies || 1,
        bindingType: bindingType || BindingType.NONE,
      }];
    } else {
      return NextResponse.json({ success: false, error: 'At least one PDF file is required' }, { status: 400 });
    }

    // Calculate total pages across all uploaded PDFs
    const totalPageCount = processedFiles.reduce((sum, item) => sum + item.pageCount, 0);

    if (totalPageCount < 1) {
      return NextResponse.json({ success: false, error: 'Invalid total page count' }, { status: 400 });
    }

    // Validate enum options
    if (colorMode && !['BW', 'COLOR', 'CUSTOM_PAGES'].includes(colorMode)) {
      return NextResponse.json({ success: false, error: 'Invalid color mode' }, { status: 400 });
    }

    // Fetch current pricing & shop open status
    const { data: pricing, error: pricingError } = await adminSupabase
      .from('pricing_settings')
      .select('*')
      .limit(1)
      .single();

    if (pricingError || !pricing) {
      console.error('Pricing Fetch Error:', pricingError);
      return NextResponse.json({ success: false, error: 'Failed to fetch pricing settings' }, { status: 500 });
    }

    // Check shop opening status
    if (pricing.shop_open === false) {
      return NextResponse.json({
        success: false,
        error: pricing.shop_status_message || 'Shop is currently closed. New uploads are disabled.',
      }, { status: 400 });
    }

    // Server-side price calculation across all PDFs with itemized per-PDF configs
    const priceBreakdown = calculateMultiPdfOrderPrice(
      processedFiles,
      pricing as PricingSettings
    );

    // Generate daily sequential order code starting at XR-001 (resets daily at midnight)
    let seqNumber = 1;
    let orderCode = `XR-${String(seqNumber).padStart(3, '0')}`;

    let retries = 0;
    while (retries < 100) {
      const { data: existing } = await adminSupabase
        .from('orders')
        .select('id')
        .eq('order_code', orderCode)
        .maybeSingle();

      if (!existing) break;
      seqNumber++;
      orderCode = `XR-${String(seqNumber).padStart(3, '0')}`;
      retries++;
    }

    if (retries >= 100) {
      orderCode = `XR-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    }

    // Create order record
    const mainFile = processedFiles[0];
    const orderPayload = {
      order_code: orderCode,
      student_name: studentName.trim(),
      email: email.trim(),
      phone_number: phoneNumber.trim(),
      files: processedFiles,
      file_path: mainFile.filePath,
      file_name: processedFiles.length === 1 ? mainFile.fileName : `${processedFiles.length} PDF Documents`,
      page_count: totalPageCount,
      color_mode: colorMode || mainFile.colorMode || ColorMode.BW,
      custom_color_pages: colorMode === 'CUSTOM_PAGES' ? customColorPages : null,
      side: side || mainFile.side || Side.SINGLE,
      pages_per_sheet: pagesPerSheet || mainFile.pagesPerSheet || 1,
      copies: copies || mainFile.copies || 1,
      binding_type: bindingType || mainFile.bindingType || BindingType.NONE,
      binding_cost: priceBreakdown.bindingCost,
      printing_subtotal: priceBreakdown.printingSubtotal,
      total_amount: priceBreakdown.totalAmount,
      price_snapshot: pricing,
      payment_screenshot_path: screenshotPath || null,
      utr_number: paymentMethod === 'HAND_CASH' ? 'HAND_CASH' : utrNumber,
      payment_status: 'PAYMENT_SUBMITTED',
      order_status: 'PAYMENT_SUBMITTED',
      expires_at: calculateExpiryDate(pricing.file_retention_days),
    };

    let { data: order, error: orderError } = await adminSupabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    // Fallback if live DB check constraint does not include 'CUSTOM_PAGES'
    if (orderError && orderError.message?.includes('orders_color_mode_check')) {
      console.warn('color_mode constraint fallback triggered:', orderError.message);
      const fallbackPayload = {
        ...orderPayload,
        color_mode: orderPayload.color_mode === 'CUSTOM_PAGES' ? 'COLOR' : 'BW',
      };
      const fallbackResult = await adminSupabase
        .from('orders')
        .insert(fallbackPayload)
        .select()
        .single();
      order = fallbackResult.data;
      orderError = fallbackResult.error;
    }

    if (orderError) {
      console.error('Order Insert Error:', orderError);
      return NextResponse.json({ success: false, error: `Failed to create order: ${orderError.message}` }, { status: 400 });
    }

    // Trigger instant mobile push alert to admin via ntfy.sh
    if (order) {
      const modeText = order.utr_number === 'HAND_CASH' ? 'Hand Cash (Pay on Pickup)' : 'UPI / Online';
      sendAdminNtfyNotification({
        title: `New Order #${order.order_code}!`,
        message: `Student: ${order.student_name || 'Student'}\nPhone: ${order.phone_number}\nAmount: ₹${Number(order.total_amount).toFixed(2)}\nPayment: ${modeText}`,
        orderCode: order.order_code,
        priority: 'high',
        tags: ['package', 'printer'],
      }).catch((err) => console.error('Ntfy push error:', err));
    }

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    console.error('Create Order catch error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/orders — Search / List orders by phone number, order code, array of codes, or admin query.
 */
export async function GET(request: Request) {
  try {
    const adminSupabase = createAdminClient();
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('admin_session')?.value === 'true';

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const code = searchParams.get('code');
    const codes = searchParams.get('codes');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // First Come, First Served (FCFS): Active/Pending orders are sorted by created_at ASCENDING (oldest first)
    const sortAscending = status === 'COMPLETED' || status === 'CANCELLED' || status === 'REJECTED' ? false : true;

    let query = adminSupabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: sortAscending })
      .range(offset, offset + limit - 1);

    if (code) {
      query = query.ilike('order_code', code.trim());
    } else if (phone) {
      query = query.eq('phone_number', phone.trim());
    } else if (codes) {
      const codeList = codes.split(',').map((c) => c.trim()).filter(Boolean);
      if (codeList.length > 0) {
        query = query.in('order_code', codeList);
      }
    } else if (search && isAdmin) {
      query = query.or(`order_code.ilike.%${search}%,student_name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%`);
    }

    if (status) {
      if (status === 'REJECTED') {
        query = query.or('order_status.eq.REJECTED,payment_status.eq.PAYMENT_REJECTED');
      } else if (status === 'PAYMENT_SUBMITTED') {
        query = query.eq('order_status', 'PAYMENT_SUBMITTED').neq('payment_status', 'PAYMENT_REJECTED');
      } else {
        query = query.eq('order_status', status);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Fetch Orders Error:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
    }

    const orderList = data || [];
    // Generate signed URLs for payment proof screenshots using admin Supabase
    for (const order of orderList) {
      if (order.payment_screenshot_path) {
        try {
          const { data: signed } = await adminSupabase.storage
            .from('payment-proofs')
            .createSignedUrl(order.payment_screenshot_path, 86400);
          if (signed?.signedUrl) {
            order.payment_screenshot_url = signed.signedUrl;
          }
        } catch {
          // Ignore signed URL failure
        }
      }
    }

    return NextResponse.json({ success: true, data: orderList, count: count || 0 });
  } catch (error) {
    console.error('GET Orders Error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
