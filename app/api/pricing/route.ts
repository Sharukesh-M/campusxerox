import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

/**
 * GET /api/pricing — Get current pricing settings & shop operating status (Public).
 */
export async function GET() {
  try {
    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase
      .from('pricing_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to fetch pricing' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * PUT /api/pricing — Update pricing settings & shop opening hours (admin only).
 */
export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('admin_session')?.value === 'true';

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden — Admin authorization required' }, { status: 403 });
    }

    const adminSupabase = createAdminClient();
    const body = await request.json();

    const allowedFields = [
      'bw_single_side', 'bw_both_side', 'bw_two_pages_sheet',
      'bw_four_pages_sheet', 'color_per_page', 'soft_binding_cost',
      'upi_id', 'upi_qr_image_path', 'bank_details', 'file_retention_days',
      'shop_open', 'opening_time', 'closing_time', 'shop_status_message',
    ];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (['bw_single_side', 'bw_both_side', 'bw_two_pages_sheet', 'bw_four_pages_sheet', 'color_per_page', 'soft_binding_cost'].includes(field)) {
          const val = Number(body[field]);
          if (isNaN(val) || val < 0) {
            return NextResponse.json({ success: false, error: `Invalid value for ${field}` }, { status: 400 });
          }
          updates[field] = val;
        } else if (field === 'file_retention_days') {
          const val = parseInt(body[field]);
          if (isNaN(val) || val < 1 || val > 90) {
            return NextResponse.json({ success: false, error: 'Retention days must be between 1 and 90' }, { status: 400 });
          }
          updates[field] = val;
        } else if (field === 'shop_open') {
          updates[field] = Boolean(body[field]);
        } else {
          updates[field] = body[field];
        }
      }
    }

    const { data: existing } = await adminSupabase
      .from('pricing_settings')
      .select('id')
      .limit(1)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Pricing settings not found' }, { status: 404 });
    }

    const { data, error } = await adminSupabase
      .from('pricing_settings')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to update settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
