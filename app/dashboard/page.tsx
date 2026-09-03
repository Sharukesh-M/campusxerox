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

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user!.id)
    .single();

  const { data: pricing } = await supabase
    .from('pricing_settings')
    .select('*')
    .limit(1)
    .single();

  const { data: recentOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const isShopClosed = pricing?.shop_open === false;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-surface-900">
          Welcome, {profile?.name || 'Student'} 👋
        </h1>
        <p className="text-surface-500 text-sm mt-1">What would you like to do today?</p>
      </div>

      {/* SERVICE UNAVAILABLE BANNER WHEN SHOP IS CLOSED */}
      {isShopClosed && (
        <div className="bg-danger-50 border-2 border-danger-500/30 rounded-2xl p-5 text-center shadow-sm animate-pulse-soft">
          <div className="w-12 h-12 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-extrabold text-danger-700 text-lg">⛔ Service Currently Unavailable</h3>
          <p className="text-sm text-danger-600 mt-1 font-medium">
            {pricing?.shop_status_message || 'The Xerox shop is currently closed. Uploads are disabled.'}
          </p>
          {pricing?.opening_time && pricing?.closing_time && (
            <p className="text-xs text-danger-500 mt-1.5 font-mono">
              Operating Hours: {pricing.opening_time} to {pricing.closing_time}
            </p>
          )}
        </div>
      )}

      {/* Action Cards */}
      <div className="grid grid-cols-2 gap-3">
        {!isShopClosed ? (
          <Link
            href="/dashboard/new-order"
            className="bg-primary-600 text-white rounded-2xl p-5 hover:bg-primary-700 active:scale-[0.98] shadow-lg shadow-primary-600/20 group"
          >
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-3 group-hover:bg-white/30">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div className="font-semibold text-sm">New Xerox Order</div>
            <div className="text-xs text-white/70 mt-0.5">Upload & print</div>
          </Link>
        ) : (
          <div className="bg-surface-200 border border-surface-300 text-surface-400 rounded-2xl p-5 cursor-not-allowed opacity-75">
            <div className="w-10 h-10 bg-surface-300 rounded-xl flex items-center justify-center mb-3 text-surface-500">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="font-semibold text-sm text-surface-600">Service Unavailable</div>
            <div className="text-xs text-surface-500 mt-0.5">Shop is closed</div>
          </div>
        )}

        <Link
          href="/dashboard/orders"
          className="bg-white border border-surface-200 rounded-2xl p-5 hover:border-primary-300 hover:shadow-md active:scale-[0.98] group"
        >
          <div className="w-10 h-10 bg-surface-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-primary-50">
            <svg className="w-5 h-5 text-surface-600 group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="font-semibold text-sm text-surface-800">My Orders</div>
          <div className="text-xs text-surface-500 mt-0.5">Track status</div>
        </Link>
      </div>

      {/* PRINT RATES CATALOG CARD */}
      {pricing && (
        <div className="bg-white border border-surface-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-surface-500 uppercase tracking-wide">
              💰 Xerox Print Rates & Services
            </h2>
            <span className="text-[10px] bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold">
              Live Rates
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
            <PriceItem label="B&W Single Side" rate={`₹${Number(pricing.bw_single_side).toFixed(2)}/pg`} />
            <PriceItem label="B&W Both Sides" rate={`₹${Number(pricing.bw_both_side).toFixed(2)}/side`} />
            <PriceItem label="B&W 2 Pages/Sheet" rate={`₹${Number(pricing.bw_two_pages_sheet).toFixed(2)}/sheet`} />
            <PriceItem label="Color Print" rate={`₹${Number(pricing.color_per_page).toFixed(2)}/pg`} />
            <PriceItem label="Soft Binding" rate={`+₹${Number(pricing.soft_binding_cost || 20).toFixed(2)}`} />
          </div>
        </div>
      )}

      {/* Recent Orders */}
      {recentOrders && recentOrders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-surface-500 uppercase tracking-wide mb-3">
            Recent Orders
          </h2>
          <div className="space-y-2">
            {recentOrders.map((order) => (
              <Link
                key={order.id}
                href={`/dashboard/orders/${order.order_code}`}
                className="flex items-center justify-between bg-white border border-surface-200 rounded-xl px-4 py-3 hover:border-primary-200 hover:shadow-sm"
              >
                <div>
                  <div className="font-semibold text-sm text-surface-900">
                    #{order.order_code}
                  </div>
                  <div className="text-xs text-surface-400 mt-0.5">
                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                    {' · '}
                    ₹{Number(order.total_amount).toFixed(2)}
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    STATUS_COLORS[order.order_status] || 'bg-surface-100 text-surface-500'
                  }`}
                >
                  {STATUS_LABELS[order.order_status] || order.order_status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(!recentOrders || recentOrders.length === 0) && (
        <div className="text-center py-8">
          <p className="text-surface-500 text-sm">No orders yet. Create your first one!</p>
        </div>
      )}
    </div>
  );
}

function PriceItem({ label, rate }: { label: string; rate: string }) {
  return (
    <div className="bg-surface-50 rounded-xl p-2.5 flex flex-col justify-between border border-surface-100">
      <span className="text-surface-500 font-medium">{label}</span>
      <span className="font-bold text-surface-900 mt-0.5">{rate}</span>
    </div>
  );
}
