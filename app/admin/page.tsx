'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Order } from '@/types';

const TABS = [
  { key: 'PAYMENT_SUBMITTED', label: 'New', color: 'warning' },
  { key: 'ACCEPTED', label: 'Accepted', color: 'primary' },
  { key: 'COMPLETED', label: 'Done', color: 'surface' },
  { key: 'REJECTED', label: 'Rejected', color: 'danger' },
  { key: 'CANCELLED', label: 'Cancelled', color: 'surface' },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState('PAYMENT_SUBMITTED');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [shopOpen, setShopOpen] = useState(true);
  const [togglingShop, setTogglingShop] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearingOrders, setClearingOrders] = useState(false);
  const [stats, setStats] = useState({
    today: 0,
    pending: 0,
    accepted: 0,
    completed: 0,
    revenue: 0,
    totalRevenue: 0,
  });

  const handleClearAllOrders = async () => {
    setClearingOrders(true);
    try {
      const res = await fetch('/api/admin/orders/clear', {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setShowClearModal(false);
        fetchOrders();
        fetchStats();
      } else {
        alert(data.error || 'Failed to clear orders');
      }
    } catch {
      alert('Network error while clearing orders');
    } finally {
      setClearingOrders(false);
    }
  };

  const fetchShopStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/pricing');
      const data = await res.json();
      if (data.success && data.data) {
        setShopOpen(data.data.shop_open ?? true);
      }
    } catch {
      // Non-critical
    }
  }, []);

  const handleToggleShopStatus = async () => {
    setTogglingShop(true);
    const newStatus = !shopOpen;
    try {
      const res = await fetch('/api/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop_open: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setShopOpen(newStatus);
      }
    } catch {
      // Handle error
    } finally {
      setTogglingShop(false);
    }
  };

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: activeTab, limit: '50' });
      if (search) params.set('search', search);

      const res = await fetch(`/api/orders?${params}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.data || []);
      }
    } catch {
      // Retry on next poll
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  const fetchStats = useCallback(async () => {
    try {
      // Fetch status counts
      const statuses = ['PAYMENT_SUBMITTED', 'ACCEPTED', 'COMPLETED'];
      const counts: Record<string, number> = {};

      for (const status of statuses) {
        const res = await fetch(`/api/orders?status=${status}&limit=1`);
        const data = await res.json();
        counts[status] = data.count || 0;
      }

      // Total orders count
      const allOrdersRes = await fetch('/api/orders?status=ALL&limit=1');
      const allOrdersData = await allOrdersRes.json();
      const totalOrdersCount = allOrdersData.count || 0;

      // Total revenue from all completed orders
      const completedRes = await fetch('/api/orders?status=COMPLETED&limit=200');
      const completedData = await completedRes.json();
      const allCompletedOrders: Order[] = completedData.data || [];
      const totalAllTimeRevenue = allCompletedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

      setStats({
        today: totalOrdersCount,
        pending: counts['PAYMENT_SUBMITTED'] || 0,
        accepted: counts['ACCEPTED'] || 0,
        completed: counts['COMPLETED'] || 0,
        revenue: totalAllTimeRevenue,
        totalRevenue: totalAllTimeRevenue,
      });
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchStats();
    fetchShopStatus();
    const interval = setInterval(() => {
      fetchOrders();
      fetchStats();
      fetchShopStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchStats, fetchShopStatus]);

  const handleDownloadPdfReport = () => {
    const reportUrl = `/api/admin/orders/report?status=${encodeURIComponent(activeTab)}`;
    window.open(reportUrl, '_blank');
  };

  const handleDownloadCSV = () => {
    if (!orders || orders.length === 0) return;

    const headers = [
      'Order Code',
      'Student Name',
      'Phone Number',
      'Email Address',
      'Total Amount (INR)',
      'Payment Mode',
      'Order Status',
      'Payment Status',
      'Page Count',
      'Created Date'
    ];

    const rows = orders.map((o) => [
      `"${o.order_code || ''}"`,
      `"${(o.student_name || 'Student').replace(/"/g, '""')}"`,
      `"${o.phone_number || ''}"`,
      `"${o.email || ''}"`,
      Number(o.total_amount || 0).toFixed(2),
      `"${o.utr_number === 'HAND_CASH' ? 'Hand Cash' : 'UPI'}"`,
      `"${o.order_status || ''}"`,
      `"${o.payment_status || ''}"`,
      o.page_count || 0,
      `"${new Date(o.created_at).toLocaleString('en-IN')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CampusXerox_Orders_Report_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in space-y-5">
      {/* Top Header & Service Status Quick Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-surface-200 rounded-2xl p-4 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-surface-900">Admin Dashboard</h1>
          <p className="text-xs text-surface-500">Manage orders and store operating status</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleToggleShopStatus}
            disabled={togglingShop}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm ${
              shopOpen
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span>{shopOpen ? 'SERVICE AVAILABLE (OPEN)' : 'SERVICE DISABLED (CLOSED)'}</span>
          </button>

          <button
            onClick={() => setShowClearModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 transition-all flex items-center gap-1.5"
            title="Clear all order records and reset sequence to XR-001"
          >
            Reset All Orders
          </button>
        </div>
      </div>

      {/* Stats Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Orders" value={stats.today} color="primary" />
        <StatCard label="Pending" value={stats.pending} color="warning" />
        <StatCard label="Accepted" value={stats.accepted} color="primary" />
        <StatCard label="Completed" value={stats.completed} color="surface" />
        <StatCard label="Total Revenue" value={`₹${stats.revenue.toFixed(0)}`} color="success" />
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order ID or student name..."
          className="w-full px-4 py-2.5 rounded-xl border border-surface-300 bg-white text-surface-900 placeholder:text-surface-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none text-sm"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? 'bg-primary-600 text-white'
                : 'bg-white text-surface-600 border border-surface-200 hover:border-primary-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>



      {/* Orders List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-primary-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-2">
          {orders.map((order, idx) => (
            <button
              key={order.id}
              onClick={() => router.push(`/admin/orders/${order.order_code}`)}
              className="w-full text-left bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-xl p-4 hover:border-primary-400 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {['PAYMENT_SUBMITTED', 'ACCEPTED'].includes(activeTab) && (
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border font-mono ${
                        idx === 0
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 animate-pulse'
                          : 'bg-surface-100 text-surface-700 border-surface-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {idx === 0 ? 'Queue #1 (NEXT UP)' : `Queue #${idx + 1}`}
                      </span>
                    )}
                    <span className="font-bold text-sm text-surface-900 dark:text-white">#{order.order_code}</span>
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${
                      order.utr_number === 'HAND_CASH'
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        : 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800'
                    }`}>
                      {order.utr_number === 'HAND_CASH' ? 'Hand Cash' : 'UPI'}
                    </span>
                    <span className="text-xs text-surface-600 dark:text-slate-300 font-semibold">
                      {order.student_name || 'Student'}
                    </span>
                    {order.utr_match_status === 'MATCH' && (
                      <span className="text-xs bg-success-50 text-success-600 px-1.5 py-0.5 rounded font-medium">✓ UTR Match</span>
                    )}
                    {order.utr_match_status === 'MISMATCH' && (
                      <span className="text-xs bg-danger-50 text-danger-600 px-1.5 py-0.5 rounded font-bold">✗ UTR Mismatch</span>
                    )}
                  </div>
                  <p className="text-xs text-surface-500 dark:text-slate-400 mt-1.5 font-medium">
                    {order.file_name} · {order.page_count}p ·{' '}
                    {order.color_mode === 'BW' ? 'Black & White' : order.color_mode === 'COLOR' ? 'Full Color' : 'Custom Color'} ·{' '}
                    {order.side === 'BOTH' ? '2-sided' : '1-sided'} ·{' '}
                    {order.pages_per_sheet}/sheet · {order.copies}×
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="font-black text-base text-primary-600 dark:text-primary-400 block">
                    ₹{Number(order.total_amount).toFixed(2)}
                  </span>
                  <span className="text-[10px] text-surface-400 font-mono block mt-0.5">
                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-surface-400 text-sm">
          No orders in this category
        </div>
      )}

      {/* LASTLY: BOTTOM DOWNLOAD ORDER LIST PDF & CSV REPORT BUTTONS */}
      {orders.length > 0 && (
        <div className="mt-6 pt-4 border-t border-surface-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div>
            <h3 className="font-extrabold text-sm text-surface-900 dark:text-white flex items-center gap-2">
              Export Official Order List Report ({orders.length} orders)
            </h3>
            <p className="text-xs text-surface-500 dark:text-slate-400 mt-0.5">
              Generates official document containing Order Code, Student Name, Phone Number, Email, Amount, and Status
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleDownloadPdfReport}
              className="flex-1 sm:flex-initial bg-primary-600 hover:bg-primary-700 active:scale-95 text-white px-5 py-2.5 rounded-xl font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 shrink-0"
            >
              Download Orders PDF Report
            </button>
            <button
              onClick={handleDownloadCSV}
              className="bg-surface-100 hover:bg-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-700 dark:text-slate-200 active:scale-95 px-3 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center shrink-0 border border-surface-300 dark:border-slate-700"
              title="Download CSV Format"
            >
              CSV Data
            </button>
          </div>
        </div>
      )}

      {/* CLEAR ALL ORDERS CONFIRMATION MODAL */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/50 rounded-full flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="font-extrabold text-lg text-surface-900 dark:text-white">
              Clear All Order Data?
            </h3>
            <p className="text-xs text-surface-600 dark:text-slate-300 leading-relaxed font-medium">
              Are you sure you want to permanently delete all order records and files? This will reset the order code sequence so fresh orders start from <strong className="text-primary-600 dark:text-primary-400">XR-001</strong>.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowClearModal(false)}
                disabled={clearingOrders}
                className="flex-1 px-4 py-2.5 rounded-2xl border border-surface-300 dark:border-slate-700 text-surface-700 dark:text-slate-200 font-bold text-xs hover:bg-surface-100 dark:hover:bg-slate-800 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAllOrders}
                disabled={clearingOrders}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {clearingOrders ? 'Clearing...' : 'Yes, Reset to XR-001'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, subtitle }: { label: string; value: number | string; color: string; subtitle?: string }) {
  const colorClasses: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-700',
    warning: 'bg-warning-50 text-warning-600',
    success: 'bg-success-50 text-success-600',
    danger: 'bg-danger-50 text-danger-600',
    surface: 'bg-surface-100 text-surface-600',
  };

  return (
    <div className={`rounded-xl p-3 ${colorClasses[color] || colorClasses.surface}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium opacity-75">{label}</p>
        {subtitle && <span className="text-[9px] font-bold opacity-60 uppercase">{subtitle}</span>}
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
