'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Order } from '@/types';
import { createClient } from '@/lib/supabase/client';

const TABS = [
  { key: 'PENDING', label: '🟡 Pending Verification', statusGroup: ['PAYMENT_SUBMITTED'] },
  { key: 'ACTIVE', label: '🔵 Active & Printing', statusGroup: ['ACCEPTED', 'PRINTING'] },
  { key: 'COMPLETED', label: '🟢 Done & Ready', statusGroup: ['READY_FOR_PICKUP', 'COMPLETED'] },
  { key: 'ALL', label: '📋 All Orders', statusGroup: [] },
];

export default function OrganizedAdminDashboard() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState('PENDING');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState('');

  const [stats, setStats] = useState({
    pending: 0,
    active: 0,
    completedToday: 0,
    dailyRevenue: 0,
    totalRevenue: 0,
  });

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limit=100');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const allOrders: Order[] = data.data;

        // Filter orders by active tab
        const currentTabConfig = TABS.find((t) => t.key === activeTab);
        let filtered = allOrders;

        if (currentTabConfig && currentTabConfig.statusGroup.length > 0) {
          filtered = allOrders.filter((o) => currentTabConfig.statusGroup.includes(o.order_status));
        }

        if (search.trim()) {
          const q = search.toLowerCase();
          filtered = filtered.filter(
            (o) =>
              o.order_code.toLowerCase().includes(q) ||
              (o.student_name || '').toLowerCase().includes(q) ||
              (o.phone_number || '').includes(q)
          );
        }

        setOrders(filtered);

        // Stats calculation
        const pendingCount = allOrders.filter((o) => o.order_status === 'PAYMENT_SUBMITTED').length;
        const activeCount = allOrders.filter((o) => o.order_status === 'ACCEPTED' || o.order_status === 'PRINTING').length;
        const completedCount = allOrders.filter((o) => o.order_status === 'COMPLETED' || o.order_status === 'READY_FOR_PICKUP').length;

        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        const completedOrders = allOrders.filter((o) => o.order_status === 'COMPLETED');
        const last24hCompleted = completedOrders.filter(
          (o) => new Date(o.completed_at || o.created_at).getTime() >= twentyFourHoursAgo
        );

        const rev24h = last24hCompleted.reduce((sum, o) => sum + Number(o.total_amount), 0);
        const revTotal = completedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

        setStats({
          pending: pendingCount,
          active: activeCount,
          completedToday: completedCount,
          dailyRevenue: rev24h,
          totalRevenue: revTotal,
        });
      }
    } catch {
      // Retry
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleQuickStatusChange = async (orderCode: string, newStatus: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActionLoadingId(orderCode);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders();
      } else {
        alert(data.error || 'Failed to update order status');
      }
    } catch {
      alert('Network error updating order');
    } finally {
      setActionLoadingId('');
    }
  };

  const handleDownloadPdf = async (filePath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const supabase = createClient();
      const { data } = await supabase.storage.from('xerox-files').createSignedUrl(filePath, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      alert('Failed to download PDF');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">Pending Action</p>
          <p className="text-3xl font-extrabold text-amber-800 mt-1">{stats.pending}</p>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">In Progress</p>
          <p className="text-3xl font-extrabold text-blue-800 mt-1">{stats.active}</p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Completed / Ready</p>
          <p className="text-3xl font-extrabold text-emerald-800 mt-1">{stats.completedToday}</p>
        </div>

        <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-bold text-primary-700 uppercase tracking-wide">24h Revenue</p>
          <p className="text-3xl font-extrabold text-primary-800 mt-1">₹{stats.dailyRevenue.toFixed(0)}</p>
        </div>
      </div>

      {/* SEARCH BAR & TAB FILTERS */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Order Code (#101), Student Name, or Phone..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-surface-300 bg-white text-surface-900 placeholder:text-surface-400 focus:border-primary-500 outline-none text-sm font-medium shadow-xs"
          />
        </div>

        {/* TABS */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                  isActive
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-white text-surface-700 border-surface-200 hover:border-surface-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ORDERS LIST */}
      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin w-8 h-8 text-primary-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((order) => {
            const formattedCode = order.order_code.startsWith('#') ? order.order_code : `#${order.order_code}`;
            const isLoadingThis = actionLoadingId === order.order_code;

            return (
              <div
                key={order.id}
                onClick={() => router.push(`/admin/orders/${order.order_code}`)}
                className="bg-white border border-surface-200 hover:border-primary-300 rounded-2xl p-4 shadow-sm transition-all cursor-pointer space-y-3"
              >
                {/* CARD HEADER */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-extrabold text-primary-600 bg-primary-50 px-3 py-1 rounded-xl border border-primary-100 font-mono">
                      {formattedCode}
                    </span>
                    <div>
                      <h3 className="font-bold text-base text-surface-900">
                        {order.student_name || 'Student'}
                      </h3>
                      <p className="text-xs text-surface-500 font-mono">
                        📱 {order.phone_number || 'No phone'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-bold text-surface-900 font-mono block">
                      ₹{Number(order.total_amount).toFixed(2)}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                      order.order_status === 'PAYMENT_SUBMITTED'
                        ? 'bg-amber-100 text-amber-800'
                        : order.order_status === 'ACCEPTED' || order.order_status === 'PRINTING'
                        ? 'bg-blue-100 text-blue-800'
                        : order.order_status === 'COMPLETED' || order.order_status === 'READY_FOR_PICKUP'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-surface-100 text-surface-600'
                    }`}>
                      {order.order_status}
                    </span>
                  </div>
                </div>

                {/* PRINT SPECS SUMMARY */}
                <div className="bg-surface-50 rounded-xl p-3 text-xs space-y-1 text-surface-600 border border-surface-100">
                  <p><strong>Files:</strong> {order.file_name} ({order.page_count} pages total)</p>
                  <p><strong>Config:</strong> {order.color_mode} · {order.side} sided · {order.pages_per_sheet} p/sheet · {order.copies} copy(ies)</p>
                  {order.utr_number && (
                    <p className="font-mono"><strong>UTR:</strong> {order.utr_number}</p>
                  )}
                </div>

                {/* DIRECT ACTION BUTTONS ON THE CARD */}
                <div className="flex gap-2 pt-1 flex-wrap">
                  {order.file_path && (
                    <button
                      onClick={(e) => handleDownloadPdf(order.file_path!, e)}
                      className="bg-surface-100 hover:bg-surface-200 text-surface-800 text-xs px-3 py-2 rounded-xl font-bold transition-all flex items-center gap-1"
                    >
                      <span>📥 Download PDF</span>
                    </button>
                  )}

                  {order.phone_number && (
                    <a
                      href={`https://wa.me/${order.phone_number.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Hi ${order.student_name}, regarding your Xerox Order ${formattedCode}:`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs px-3 py-2 rounded-xl font-bold transition-all"
                    >
                      💬 WhatsApp Student
                    </a>
                  )}

                  <div className="ml-auto flex gap-2">
                    {order.order_status === 'PAYMENT_SUBMITTED' && (
                      <button
                        onClick={(e) => handleQuickStatusChange(order.order_code, 'ACCEPTED', e)}
                        disabled={isLoadingThis}
                        className="bg-primary-600 hover:bg-primary-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {isLoadingThis ? 'Updating...' : '✓ Accept Order'}
                      </button>
                    )}

                    {(order.order_status === 'ACCEPTED' || order.order_status === 'PRINTING') && (
                      <button
                        onClick={(e) => handleQuickStatusChange(order.order_code, 'COMPLETED', e)}
                        disabled={isLoadingThis}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 py-2 rounded-xl font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                        {isLoadingThis ? 'Updating...' : '✓ Mark Done (Ready)'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white border border-surface-200 rounded-2xl p-6 text-surface-400 text-sm">
          No orders found in this category
        </div>
      )}
    </div>
  );
}
