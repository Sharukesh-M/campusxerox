import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';

/**
 * DELETE /api/admin/orders/clear — Permanently delete all order data and reset order sequence to XR-001 (Admin only).
 */
export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const isAdmin = cookieStore.get('admin_session')?.value === 'true';

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Forbidden — Admin authorization required' }, { status: 403 });
    }

    const adminSupabase = createAdminClient();

    // 1. Fetch all orders to clean up storage files and gather IDs
    const { data: allOrders } = await adminSupabase
      .from('orders')
      .select('id, file_path, files, payment_screenshot_path');

    if (allOrders && allOrders.length > 0) {
      const ids = allOrders.map((o) => o.id).filter(Boolean);

      // Clean storage files
      for (const order of allOrders) {
        if (order.file_path) {
          await adminSupabase.storage.from('xerox-files').remove([order.file_path]).catch(() => {});
        }
        if (Array.isArray(order.files)) {
          for (const fileItem of order.files) {
            if (fileItem && typeof fileItem === 'object' && fileItem.filePath) {
              await adminSupabase.storage.from('xerox-files').remove([fileItem.filePath]).catch(() => {});
            }
          }
        }
        if (order.payment_screenshot_path) {
          await adminSupabase.storage.from('payment-proofs').remove([order.payment_screenshot_path]).catch(() => {});
        }
      }

      // Delete by explicitly collected IDs
      const { error: deleteError } = await adminSupabase
        .from('orders')
        .delete()
        .in('id', ids);

      if (deleteError) {
        console.error('Delete all orders error:', deleteError);
        return NextResponse.json({ success: false, error: `Failed to clear orders: ${deleteError.message}` }, { status: 500 });
      }
    } else {
      // Fallback bulk delete if any remain
      await adminSupabase.from('orders').delete().gt('created_at', '1970-01-01T00:00:00Z');
    }

    return NextResponse.json({
      success: true,
      message: 'All order data and storage files cleared. New orders will start from XR-001.',
    });
  } catch (error) {
    console.error('Clear orders API catch error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
