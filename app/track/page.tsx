'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Order } from '@/types';

export default function PublicTrackPage() {
  const searchParams = useSearchParams();
  const initialCode = searchParams.get('code') || searchParams.get('query') || '';

  const [query, setQuery] = useState(initialCode);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cancellingCode, setCancellingCode] = useState('');

  const searchOrders = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/track?query=${encodeURIComponent(searchQuery.trim())}`);
      const data = await res.json();

      if (data.success && data.data && data.data.length > 0) {
        setOrders(data.data);
      } else {
        setOrders([]);
        setError('No active orders found matching your input');
      }
    } catch {
      setError('Failed to search orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // On initial mount: if code/query provided in URL or stored in localStorage, auto fetch!
  useEffect(() => {
    if (initialCode) {
      setQuery(initialCode);
      searchOrders(initialCode);
    } else if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('campusxerox_orders') || '[]');
        if (stored.length > 0) {
          setQuery(stored[0]);
          searchOrders(stored[0]);
        }
      } catch {}
    }
  }, [initialCode, searchOrders]);

  const handleCancelOrder = async (orderCode: string) => {
    if (!confirm(`Are you sure you want to cancel Order #${orderCode}?`)) return;

    setCancellingCode(orderCode);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by student' }),
      });
      const data = await res.json();

      if (data.success) {
        alert(`Order #${orderCode} has been cancelled.`);
        searchOrders(query || orderCode);
      } else {
        alert(data.error || 'Failed to cancel order.');
      }
    } catch {
      alert('Failed to cancel order. Please try again.');
    } finally {
      setCancellingCode('');
    }
  };

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center px-4 py-8">
      <div className="w-full max-w-xl space-y-6">
        {/* LOGO & HEADER */}
        <div className="text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-3xl font-extrabold text-surface-900 tracking-tight">
              Campus<span className="text-primary-600">Xerox</span>
            </h1>
          </Link>
          <p className="text-surface-500 text-sm mt-1">Track your Xerox order status in real-time</p>
        </div>

        {/* SEARCH BOX */}
        <div className="bg-white border border-surface-200 rounded-2xl p-4 shadow-sm space-y-3">
          <label className="block text-xs font-bold text-surface-500 uppercase tracking-wide">
            Order Lookup
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              searchOrders(query);
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter Order Code (e.g. 101) or Mobile Number"
              className="flex-1 px-4 py-2.5 rounded-xl border border-surface-300 bg-surface-50 text-surface-900 placeholder:text-surface-400 focus:border-primary-500 outline-none text-sm font-medium"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {loading ? 'Searching...' : 'Track'}
            </button>
          </form>
        </div>

        {/* ERROR MSG */}
        {error && (
          <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-2xl p-4 text-center text-sm font-medium">
            {error}
          </div>
        )}

        {/* ORDERS LIST */}
        {orders.length > 0 && (
          <div className="space-y-4">
            {orders.map((ord) => {
              const formattedCode = ord.order_code.startsWith('#') ? ord.order_code : `#${ord.order_code}`;
              const isCompleted = ord.order_status === 'COMPLETED';
              const isCancelled = ord.order_status === 'CANCELLED';
              const isAccepted = ord.order_status === 'ACCEPTED' || ord.order_status === 'PRINTING';

              return (
                <div key={ord.id} className="bg-white border border-surface-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between pb-3 border-b border-surface-100">
                    <div>
                      <span className="text-2xl font-extrabold text-primary-600 block">
                        {formattedCode}
                      </span>
                      <span className="text-sm font-semibold text-surface-800">
                        {ord.student_name} · {ord.phone_number}
                      </span>
                    </div>
                    <span className="text-xl font-bold text-surface-900 font-mono">
                      ₹{Number(ord.total_amount).toFixed(2)}
                    </span>
                  </div>

                  {/* TIMELINE STATUS STEPPER */}
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-surface-400 uppercase">Live Order Progress</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                      {/* Step 1: Received */}
                      <div className={`p-2.5 rounded-xl border ${
                        ord.order_status === 'PAYMENT_SUBMITTED'
                          ? 'bg-amber-50 border-amber-300 text-amber-700 ring-2 ring-amber-200'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      }`}>
                        <span>1. Order Received</span>
                      </div>

                      {/* Step 2: Accepted */}
                      <div className={`p-2.5 rounded-xl border ${
                        isAccepted
                          ? 'bg-blue-50 border-blue-300 text-blue-700 ring-2 ring-blue-200'
                          : isCompleted
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-surface-100 border-surface-200 text-surface-400'
                      }`}>
                        <span>2. Printing</span>
                      </div>

                      {/* Step 3: Done */}
                      <div className={`p-2.5 rounded-xl border ${
                        isCompleted
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 ring-2 ring-emerald-200'
                          : isCancelled
                          ? 'bg-danger-50 border-danger-200 text-danger-600'
                          : 'bg-surface-100 border-surface-200 text-surface-400'
                      }`}>
                        <span>3. {isCancelled ? 'Cancelled' : 'Ready for Pickup'}</span>
                      </div>
                    </div>
                  </div>

                  {/* ORDER DETAILS SUMMARY */}
                  <div className="bg-surface-50 rounded-xl p-3 text-xs space-y-1 text-surface-600 border border-surface-200">
                    <p><strong>Documents:</strong> {ord.file_name} ({ord.page_count} pages)</p>
                    <p><strong>Config:</strong> {ord.color_mode} · {ord.side} · {ord.copies} copy(ies)</p>
                    <p><strong>Submitted:</strong> {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="flex gap-2 pt-1">
                    {!isCompleted && !isCancelled && (
                      <button
                        onClick={() => handleCancelOrder(ord.order_code)}
                        disabled={cancellingCode === ord.order_code}
                        className="flex-1 bg-danger-50 hover:bg-danger-100 text-danger-600 border border-danger-200 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                      >
                        {cancellingCode === ord.order_code ? 'Cancelling...' : 'Cancel Order'}
                      </button>
                    )}

                    {isCompleted && (
                      <a
                        href={`/api/orders/${ord.order_code}/receipt`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold text-center shadow-sm"
                      >
                        Download PDF Receipt
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* BOTTOM ACTION */}
        <div className="text-center pt-4">
          <Link
            href="/dashboard/new-order"
            className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-xl font-semibold text-sm shadow-md active:scale-[0.98] transition-all"
          >
            + Place New Xerox Order
          </Link>
        </div>
      </div>
    </div>
  );
}
