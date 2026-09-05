import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/files/download?path=<filePath> — Download or open a PDF file securely via Admin Client.
 * Bypasses RLS / private bucket restrictions on 'xerox-files'.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ success: false, error: 'File path parameter is required' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 1. Try creating a signed URL with admin privileges (1 hour validity)
    const { data: signedData } = await adminSupabase.storage
      .from('xerox-files')
      .createSignedUrl(path, 3600);

    if (signedData?.signedUrl) {
      return NextResponse.redirect(signedData.signedUrl);
    }

    // 2. Direct download fallback: fetch binary stream from storage
    const { data: fileData, error: downloadError } = await adminSupabase.storage
      .from('xerox-files')
      .download(path);

    if (downloadError || !fileData) {
      console.error('Storage Download Error:', downloadError);
      return NextResponse.json({ success: false, error: 'File not found or storage error' }, { status: 404 });
    }

    const fileName = path.split('/').pop() || 'document.pdf';
    const buffer = await fileData.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error('File Download API Error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
