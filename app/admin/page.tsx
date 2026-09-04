'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { Order } from '@/types';

const TABS = [
  { key: 'PAYMENT_SUBMITTED', label: 'New', color: 'warning' },
  { key: 'ACCEPTED', label: 'Accepted', color: 'primary' },
  { key: 'READY_FOR_PICKUP', label: 'Ready', color: 'success' },
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
  const [stats, setStats] = useState({
    today: 0,
    pending: 0,
    accepted: 0,
    ready: 0,
    completed: 0,
    revenue: 0,
    totalRevenue: 0,
  });

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
      // Fetch all statuses for counts
      const statuses = ['PAYMENT_SUBMITTED', 'ACCEPTED', 'READY_FOR_PICKUP', 'COMPLETED'];
      const counts: Record<string, number> = {};

      for (const status of statuses) {
        const res = await fetch(`/api/orders?status=${status}&limit=1`);
        const data = await res.json();
        counts[status] = data.count || 0;
      }

      // Calculate 24-hour daily revenue (resets every 24 hours)
      const completedRes = await fetch('/api/orders?status=COMPLETED&limit=100');
      const completedData = await completedRes.json();
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

      const allCompletedOrders: Order[] = completedData.data || [];
      const last24hOrders = allCompletedOrders.filter((o) => {
        const timestamp = new Date(o.completed_at || o.created_at).getTime();
        return timestamp >= twentyFourHoursAgo;
      });

      const daily24hRevenue = last24hOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
      const totalAllTimeRevenue = allCompletedOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);

      setStats({
        today: last24hOrders.length,
        pending: counts['PAYMENT_SUBMITTED'] || 0,
        accepted: counts['ACCEPTED'] || 0,
        ready: counts['READY_FOR_PICKUP'] || 0,
        completed: counts['COMPLETED'] || 0,
        revenue: daily24hRevenue,
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

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [activeTab, fetchOrders]);

  return (
    <div className="animate-fade-in space-y-5">
      {/* Top Header & Service Status Quick Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-surface-200 rounded-2xl p-4 shadow-xs">
        <div>
          <h1 className="text-lg font-bold text-surface-900">Admin Dashboard</h1>
          <p className="text-xs text-surface-500">Manage orders and store operating status</p>
        </div>
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
          <span>{shopOpen ? '🟢 SERVICE AVAILABLE (OPEN)' : '🔴 SERVICE DISABLED (CLOSED)'}</span>
        </button>
      </div>

      {/* Stats Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="24h Orders" value={stats.today} color="primary" />
        <StatCard label="Pending" value={stats.pending} color="warning" />
        <StatCard label="Accepted" value={stats.accepted} color="primary" />
        <StatCard label="Ready" value={stats.ready} color="success" />
        <StatCard label="Completed" value={stats.completed} color="surface" />
        <StatCard label="24h Revenue" value={`₹${stats.revenue.toFixed(0)}`} color="success" subtitle="Resets 24h" />
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
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => router.push(`/admin/orders/${order.order_code}`)}
              className="w-full text-left bg-white border border-surface-200 rounded-xl p-4 hover:border-primary-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-surface-900">#{order.order_code}</span>
                    <span className="text-xs text-surface-500">
                      {(order.profiles as { name?: string })?.name || 'Student'}
                    </span>
                    {order.utr_match_status === 'MATCH' && (
                      <span className="text-xs bg-success-50 text-success-600 px-1.5 py-0.5 rounded font-medium">✓ UTR Match</span>
                    )}
                    {order.utr_match_status === 'MISMATCH' && (
                      <span className="text-xs bg-danger-50 text-danger-600 px-1.5 py-0.5 rounded font-bold">✗ UTR Mismatch</span>
                    )}
                  </div>
                  <p className="text-xs text-surface-400 mt-1">
                    {order.file_name} · {order.page_count}p ·{' '}
                    {order.color_mode === 'BW' ? 'B&W' : 'Color'} ·{' '}
                    {order.side === 'BOTH' ? '2-sided' : '1-sided'} ·{' '}
                    {order.pages_per_sheet}/sheet · {order.copies}×
                  </p>
                </div>
                <span className="font-bold text-sm text-primary-600 shrink-0 ml-3">
                  ₹{Number(order.total_amount).toFixed(2)}
                </span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-surface-400 text-sm">
          No orders in this category
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
