import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PDFDocument } from 'pdf-lib';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * POST /api/upload — Upload a PDF file to Supabase Storage.
 * Validates user auth, file type, size, and extracts page count.
 * Uses admin client for storage upload to ensure reliability.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    const folderId = user?.id || 'guest';

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ success: false, error: 'Only PDF files are allowed' }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File size exceeds 20MB limit' }, { status: 400 });
    }

    // Read file to extract page count
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    let pageCount: number;
    try {
      const pdfDoc = await PDFDocument.load(uint8Array, { ignoreEncryption: true });
      pageCount = pdfDoc.getPageCount();

      if (pageCount === 0) {
        return NextResponse.json({ success: false, error: 'PDF has no pages' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid or corrupted PDF file' }, { status: 400 });
    }

    // Generate path scoped to user ID
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${folderId}/${timestamp}_${safeName}`;

    // Upload to Supabase Storage
    let uploadError: { message: string } | null = null;
    try {
      const adminSupabase = createAdminClient();
      const { error: adminErr } = await adminSupabase.storage
        .from('xerox-files')
        .upload(filePath, uint8Array, {
          contentType: 'application/pdf',
          upsert: false,
        });
      uploadError = adminErr;
    } catch {
      uploadError = { message: 'Admin client failed' };
    }

    if (uploadError) {
      console.warn('Admin upload failed, trying user client fallback:', uploadError.message);
      const { error: userErr } = await supabase.storage
        .from('xerox-files')
        .upload(filePath, uint8Array, {
          contentType: 'application/pdf',
          upsert: false,
        });
      uploadError = userErr;
    }

    if (uploadError) {
      console.error('Supabase Storage Upload Error:', uploadError);
      return NextResponse.json({ success: false, error: `Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        filePath,
        fileName: file.name,
        pageCount,
        fileSize: file.size,
      },
    });
  } catch (error) {
    console.error('Upload API catch error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
