import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * POST /api/upload/screenshot — Upload a payment screenshot.
 * Validates user auth, image format, size, and uploads using admin client.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

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
    const filePath = `${user.id}/${orderCode}.${ext}`;

    // Upload to payment-proofs bucket
    let uploadError: { message: string } | null = null;
    try {
      const adminSupabase = createAdminClient();
      const { error: adminErr } = await adminSupabase.storage
        .from('payment-proofs')
        .upload(filePath, uint8Array, {
          contentType: file.type,
          upsert: true,
        });
      uploadError = adminErr;
    } catch {
      uploadError = { message: 'Admin client failed' };
    }

    if (uploadError) {
      console.warn('Admin screenshot upload failed, trying user client fallback:', uploadError.message);
      const { error: userErr } = await supabase.storage
        .from('payment-proofs')
        .upload(filePath, uint8Array, {
          contentType: file.type,
          upsert: true,
        });
      uploadError = userErr;
    }

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
