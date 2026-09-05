import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * POST /api/upload/screenshot — Upload a payment screenshot (Guest mode enabled).
 * Validates image format, size, and uploads using Admin Client.
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const orderCode = formData.get('orderCode') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!orderCode) {
      return NextResponse.json({ success: false, error: 'Order code is required' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_SCREENSHOT_SIZE) {
      return NextResponse.json({ success: false, error: 'Screenshot size exceeds 5MB limit' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Determine file extension
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const timestamp = Date.now();
    const filePath = `guest/${orderCode}_${timestamp}.${ext}`;

    // Upload to payment-proofs bucket via Admin Client
    const adminSupabase = createAdminClient();
    const { error: uploadError } = await adminSupabase.storage
      .from('payment-proofs')
      .upload(filePath, uint8Array, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Screenshot Upload Error:', uploadError);
      return NextResponse.json({ success: false, error: `Screenshot upload failed: ${uploadError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        screenshotPath: filePath,
      },
    });
  } catch (error) {
    console.error('Screenshot upload catch error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
