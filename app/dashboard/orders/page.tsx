import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  PAYMENT_SUBMITTED: 'bg-warning-50 text-warning-600',
  ACCEPTED: 'bg-primary-50 text-primary-600',
  PRINTING: 'bg-primary-50 text-primary-700',
  READY_FOR_PICKUP: 'bg-success-50 text-success-600',
  COMPLETED: 'bg-surface-100 text-surface-500',
  REJECTED: 'bg-danger-50 text-danger-600',
  CANCELLED: 'bg-surface-100 text-surface-400',
};

const STATUS_LABELS: Record<string, string> = {
  PAYMENT_SUBMITTED: 'Pending',
  ACCEPTED: 'Accepted',
  PRINTING: 'Printing',
  READY_FOR_PICKUP: 'Ready',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-surface-900">My Orders</h1>
        <Link
          href="/dashboard/new-order"
          className="bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary-700 active:scale-[0.98]"
        >
          + New Order
        </Link>
      </div>

      {orders && orders.length > 0 ? (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/orders/${order.order_code}`}
              className="flex items-center justify-between bg-white border border-surface-200 rounded-xl px-4 py-3.5 hover:border-primary-200 hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-surface-900">
                    #{order.order_code}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    STATUS_COLORS[order.order_status] || 'bg-surface-100 text-surface-500'
                  }`}>
                    {STATUS_LABELS[order.order_status] || order.order_status}
                  </span>
                </div>
                <p className="text-xs text-surface-400 mt-1 truncate">
                  {order.file_name || 'Document'} · {order.page_count} pages ·{' '}
                  {new Date(order.created_at).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <div className="text-right ml-3 shrink-0">
                <p className="font-bold text-sm text-surface-900">₹{Number(order.total_amount).toFixed(2)}</p>
                <svg className="w-4 h-4 text-surface-300 ml-auto mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-surface-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-surface-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
          <p className="text-surface-500 text-sm mb-4">No orders yet</p>
          <Link
            href="/dashboard/new-order"
            className="inline-block bg-primary-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-700"
          >
            Create Your First Order
          </Link>
        </div>
      )}
    </div>
  );
}
