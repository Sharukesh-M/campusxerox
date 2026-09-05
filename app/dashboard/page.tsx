'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PricingSettings } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  PAYMENT_SUBMITTED: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300',
  ACCEPTED: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300',
  PRINTING: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300',
  READY_FOR_PICKUP: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 animate-pulse',
  COMPLETED: 'bg-surface-100 dark:bg-slate-800 text-surface-600 dark:text-slate-300',
  REJECTED: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300',
  CANCELLED: 'bg-surface-100 dark:bg-slate-800 text-surface-400 dark:text-slate-500',
};

const STATUS_LABELS: Record<string, string> = {
  PAYMENT_SUBMITTED: 'Pending',
  ACCEPTED: 'Accepted',
  PRINTING: 'Printing',
  READY_FOR_PICKUP: 'Ready for Pickup',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

interface OrderSummary {
  id: string;
  order_code: string;
  total_amount: number;
  order_status: string;
  created_at: string;
  student_name?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [myOrders, setMyOrders] = useState<OrderSummary[]>([]);
  const [trackQuery, setTrackQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Notice language toggle state ('ta' | 'en' | 'te')
  const [noticeLang, setNoticeLang] = useState<'ta' | 'en' | 'te'>('ta');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch live pricing
      const pricingRes = await fetch('/api/pricing');
      const pricingData = await pricingRes.json();
      if (pricingData.success && pricingData.data) {
        setPricing(pricingData.data);
      }

      // 2. Fetch saved orders from localStorage
      if (typeof window !== 'undefined') {
        const savedCodes: string[] = JSON.parse(localStorage.getItem('my_orders') || '[]');
        if (savedCodes.length > 0) {
          const ordersRes = await fetch(`/api/orders?codes=${savedCodes.join(',')}&limit=10`);
          const ordersData = await ordersRes.json();
          if (ordersData.success && ordersData.data) {
            setMyOrders(ordersData.data);
          }
        }
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  };

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackQuery.trim()) {
      router.push(`/track?code=${encodeURIComponent(trackQuery.trim())}`);
    }
  };

  const isShopClosed = pricing?.shop_open === false;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <h1 className="text-2xl font-black text-surface-900 dark:text-white tracking-tight">
            CampusXerox
          </h1>
        </div>
        <div className="bg-[#e6ebf4] dark:bg-[#131b2e] shadow-[4px_4px_10px_#c2cad8,-4px_-4px_10px_#ffffff] dark:shadow-[4px_4px_10px_#070b14,-4px_-4px_10px_#172340] px-3.5 py-2 rounded-2xl border border-white/60 dark:border-slate-800 text-xs font-bold text-surface-900 dark:text-slate-200 flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto shrink-0">
          <span className="text-surface-500 dark:text-slate-400">Contact: <strong className="text-primary-600 dark:text-primary-400">Surya</strong></span>
          <a href="tel:8015587361" className="underline font-mono text-xs sm:text-sm bg-white dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-surface-200 dark:border-slate-700 text-primary-600 dark:text-primary-400">
            8015587361
          </a>
        </div>
      </div>

      {/* SERVICE UNAVAILABLE BANNER WHEN SHOP IS CLOSED */}
      {isShopClosed && (
        <div className="bg-danger-50 dark:bg-danger-950/60 border-2 border-danger-500/30 rounded-2xl p-5 text-center shadow-sm animate-pulse-soft">
          <div className="w-12 h-12 bg-danger-100 dark:bg-danger-900/50 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-danger-600 dark:text-danger-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="font-extrabold text-danger-700 dark:text-danger-300 text-lg">Service Currently Unavailable</h3>
          <p className="text-sm text-danger-600 dark:text-danger-400 mt-1 font-medium">
            {pricing?.shop_status_message || 'The Xerox shop is currently closed. Uploads are disabled.'}
          </p>
          {pricing?.opening_time && pricing?.closing_time && (
            <p className="text-xs text-danger-500 dark:text-danger-400 mt-1.5 font-mono">
              Operating Hours: {pricing.opening_time} to {pricing.closing_time}
            </p>
          )}
        </div>
      )}

      {/* Quick Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!isShopClosed ? (
          <Link
            href="/dashboard/new-order"
            className="bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-3xl p-6 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl glow-primary group flex items-center justify-between"
          >
            <div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="font-bold text-lg">Order Xerox Now</div>
              <div className="text-xs text-white/80 mt-0.5">Upload PDF & calculate live pricing</div>
            </div>
            <span className="text-2xl font-extrabold opacity-80 group-hover:translate-x-1 transition-transform">→</span>
          </Link>
        ) : (
          <div className="bg-surface-200 dark:bg-slate-800 border border-surface-300 dark:border-slate-700 text-surface-400 rounded-3xl p-6 cursor-not-allowed opacity-75">
            <div className="w-12 h-12 bg-surface-300 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-3 text-surface-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="font-bold text-lg text-surface-600 dark:text-slate-300">Service Unavailable</div>
            <div className="text-xs text-surface-500 dark:text-slate-400 mt-0.5">Shop is currently closed</div>
          </div>
        )}

        <Link
          href="/track"
          className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-3xl p-6 hover:border-primary-400 hover:shadow-xl active:scale-[0.98] transition-all group flex items-center justify-between"
        >
          <div>
            <div className="w-12 h-12 bg-primary-50 dark:bg-indigo-950/60 rounded-2xl flex items-center justify-center mb-3 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="font-bold text-lg text-surface-900 dark:text-white">Track Order</div>
            <div className="text-xs text-surface-500 dark:text-slate-400 mt-0.5">Search by Phone or Order Code</div>
          </div>
          <span className="text-2xl font-extrabold text-surface-400 dark:text-slate-500 group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      </div>

      {/* QUICK TRACKER SEARCH BOX */}
      <div className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-surface-500 dark:text-slate-400 uppercase tracking-wide">
          Quick Order Lookup
        </h2>
        <form onSubmit={handleTrackSubmit} className="flex gap-2">
          <input
            type="text"
            value={trackQuery}
            onChange={(e) => setTrackQuery(e.target.value)}
            placeholder="Enter Phone Number or Order Code (XR-001)"
            className="flex-1 px-4 py-2.5 rounded-2xl border border-surface-300 dark:border-slate-700 bg-surface-50 dark:bg-slate-800 text-surface-900 dark:text-white focus:border-primary-500 outline-none text-sm font-semibold"
          />
          <button
            type="submit"
            className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-2xl font-bold text-xs shadow-md transition-all shrink-0"
          >
            Track Status
          </button>
        </form>
      </div>

      {/* NEUMORPHISM UI DESIGN: RATES AND PRICING CARD */}
      {pricing && (
        <div className="bg-[#e6ebf4] dark:bg-[#0f172a] shadow-[10px_10px_24px_#c2cad8,-10px_-10px_24px_#ffffff] dark:shadow-[10px_10px_24px_#070b14,-10px_-10px_24px_#172340] rounded-3xl p-6 border border-white/60 dark:border-slate-800/80 space-y-5 transition-all">
          <div className="flex items-center justify-between border-b border-surface-300/40 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-black text-surface-900 dark:text-white tracking-tight flex items-center gap-2">
                Rates & Pricing Catalog
              </h2>
              <p className="text-xs text-surface-500 dark:text-slate-400 mt-0.5">Live store printing rates per page</p>
            </div>
            <span className="text-[10px] font-black bg-primary-50 dark:bg-indigo-950/80 text-primary-600 dark:text-primary-400 px-3 py-1 rounded-full border border-primary-200 dark:border-indigo-800">
              Live Rates
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 text-xs">
            <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-surface-500 dark:text-slate-400 font-extrabold text-[11px]">B&W Single Side</span>
              <span className="text-lg font-black text-surface-900 dark:text-white mt-2">
                ₹{Number(pricing.bw_single_side).toFixed(2)}
                <span className="text-[10px] font-normal text-surface-400 dark:text-slate-500 font-mono"> /page</span>
              </span>
            </div>

            <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-surface-500 dark:text-slate-400 font-extrabold text-[11px]">B&W Both Sides</span>
              <span className="text-lg font-black text-surface-900 dark:text-white mt-2">
                ₹{Number(pricing.bw_both_side).toFixed(2)}
                <span className="text-[10px] font-normal text-surface-400 dark:text-slate-500 font-mono"> /side</span>
              </span>
            </div>

            <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-surface-500 dark:text-slate-400 font-extrabold text-[11px]">2 Pages / Sheet</span>
              <span className="text-lg font-black text-surface-900 dark:text-white mt-2">
                ₹{Number(pricing.bw_two_pages_sheet).toFixed(2)}
                <span className="text-[10px] font-normal text-surface-400 dark:text-slate-500 font-mono"> /sheet</span>
              </span>
            </div>

            <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800 flex flex-col justify-between">
              <span className="text-amber-700 dark:text-amber-300 font-extrabold text-[11px]">Full Color Print</span>
              <span className="text-lg font-black text-amber-600 dark:text-amber-400 mt-2">
                ₹{Number(pricing.color_per_page).toFixed(2)}
                <span className="text-[10px] font-normal text-surface-400 dark:text-slate-500 font-mono"> /page</span>
              </span>
            </div>

            <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800 col-span-2 sm:col-span-1 flex flex-col justify-between">
              <span className="text-indigo-700 dark:text-indigo-300 font-extrabold text-[11px]">Soft Binding</span>
              <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-2">
                +₹{Number(pricing.soft_binding_cost || 20).toFixed(2)}
                <span className="text-[10px] font-normal text-surface-400 dark:text-slate-500 font-mono"> /book</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Recent Orders Stored in localStorage */}
      {myOrders.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-surface-500 dark:text-slate-400 uppercase tracking-wide">
            Your Recent Placed Orders ({myOrders.length})
          </h2>
          <div className="space-y-2">
            {myOrders.map((order) => (
              <Link
                key={order.id}
                href={`/track?code=${order.order_code}`}
                className="flex items-center justify-between bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all"
              >
                <div>
                  <div className="font-extrabold text-sm text-surface-900 dark:text-white flex items-center gap-2">
                    <span>#{order.order_code}</span>
                    {order.student_name && (
                      <span className="text-xs font-normal text-surface-500 dark:text-slate-400">({order.student_name})</span>
                    )}
                  </div>
                  <div className="text-xs text-surface-400 dark:text-slate-500 mt-0.5">
                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    ₹{Number(order.total_amount).toFixed(2)}
                  </div>
                </div>
                <span
                  className={`text-xs font-bold px-3 py-1 rounded-full border ${
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

      {!loading && myOrders.length === 0 && (
        <div className="text-center py-6 bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-3xl p-6">
          <p className="text-surface-500 dark:text-slate-400 text-sm">No recent orders yet. Click <strong>Order Xerox Now</strong> to get started!</p>
        </div>
      )}
    </div>
  );
}
