import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateOrderCode, calculateExpiryDate } from '@/services/orders';
import { calculatePrintPrice, calculateMultiPdfOrderPrice } from '@/services/pricing';
import { ColorMode, Side, BindingType, type PricingSettings, type PdfDocumentConfig } from '@/types';

/**
 * POST /api/orders — Create a new order.
 * Verifies shop open status, recalculates price & binding cost server-side, snapshots current prices.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      studentName,
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
    if (!['BW', 'COLOR', 'CUSTOM_PAGES'].includes(colorMode)) {
      return NextResponse.json({ success: false, error: 'Invalid color mode' }, { status: 400 });
    }
    if (!['SINGLE', 'BOTH'].includes(side)) {
      return NextResponse.json({ success: false, error: 'Invalid side option' }, { status: 400 });
    }
    if (![1, 2].includes(pagesPerSheet)) {
      return NextResponse.json({ success: false, error: 'Invalid pages per sheet' }, { status: 400 });
    }
    if (!copies || copies < 1 || copies > 100) {
      return NextResponse.json({ success: false, error: 'Invalid copies count' }, { status: 400 });
    }

    // Fetch current pricing & shop open status
    const { data: pricing, error: pricingError } = await supabase
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
    // Use admin client to check order_code existence across ALL users (bypassing student RLS read isolation)
    const adminSupabase = createAdminClient();
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
      // Fallback if 100 consecutive numbers are taken
      orderCode = `XR-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    }

    // Ensure user profile record exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: user.id,
        name: studentName.trim(),
        email: user.email || '',
        role: 'student',
      });
    }

    // Create order record
    const mainFile = processedFiles[0];
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_code: orderCode,
        user_id: user.id,
        student_name: studentName.trim(),
        phone_number: phoneNumber.trim(),
        files: processedFiles,
        file_path: mainFile.filePath,
        file_name: processedFiles.length === 1 ? mainFile.fileName : `${processedFiles.length} PDF Documents`,
        page_count: totalPageCount,
        color_mode: colorMode,
        custom_color_pages: colorMode === 'CUSTOM_PAGES' ? customColorPages : null,
        side: side,
        pages_per_sheet: pagesPerSheet,
        copies: copies || 1,
        binding_type: bindingType,
        binding_cost: priceBreakdown.bindingCost,
        printing_subtotal: priceBreakdown.printingSubtotal,
        total_amount: priceBreakdown.totalAmount,
        price_snapshot: pricing,
        payment_status: 'PAYMENT_SUBMITTED',
        order_status: 'PAYMENT_SUBMITTED',
        expires_at: calculateExpiryDate(pricing.file_retention_days),
      })
      .select()
      .single();

    if (orderError) {
      console.error('Order Insert Error:', orderError);
      return NextResponse.json({ success: false, error: `Failed to create order: ${orderError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    console.error('Create Order catch error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET /api/orders — List orders.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.role === 'admin';

    let query = supabase
      .from('orders')
      .select('*, profiles(name, email)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!isAdmin) {
      query = query.eq('user_id', user.id);
    }

    if (status) {
      query = query.eq('order_status', status);
    }

    if (search && isAdmin) {
      query = query.or(`order_code.ilike.%${search}%,student_name.ilike.%${search}%,phone_number.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data, count });
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
