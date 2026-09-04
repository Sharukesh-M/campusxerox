import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_QR_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

/**
 * POST /api/upload/qr — Upload a custom UPI QR code photo (admin only).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify user & admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Only JPEG, PNG, WebP, and SVG images are allowed' }, { status: 400 });
    }

    if (file.size > MAX_QR_SIZE) {
      return NextResponse.json({ success: false, error: 'QR image size exceeds 5MB limit' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = `data:${file.type};base64,${buffer.toString('base64')}`;

    // Upload to payment-proofs bucket as backup storage
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : file.type === 'image/svg+xml' ? 'svg' : 'jpg';
    const filePath = `qr-code/custom_qr.${ext}`;

    try {
      const adminSupabase = createAdminClient();
      await adminSupabase.storage
        .from('payment-proofs')
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: true,
        });
    } catch {
      // Non-critical if bucket upload fails, base64 data URL acts as reliable fallback
    }

    return NextResponse.json({
      success: true,
      data: {
        qrImagePath: base64Image,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
