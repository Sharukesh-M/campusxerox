'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface PdfFileDetail {
  fileName: string;
  filePath?: string;
  pageCount: number;
  colorMode?: string;
  customColorPages?: string;
  side?: string;
  pagesPerSheet?: number;
  copies?: number;
  bindingType?: string;
}

interface OrderItem {
  id: string;
  order_code: string;
  student_name: string;
  email?: string;
  phone_number: string;
  file_name: string;
  page_count: number;
  color_mode?: string;
  custom_color_pages?: string;
  side?: string;
  pages_per_sheet?: number;
  copies?: number;
  binding_type?: string;
  binding_cost?: number;
  printing_subtotal?: number;
  total_amount: number;
  order_status: string;
  payment_status: string;
  rejection_reason?: string | null;
  cancellation_reason?: string | null;
  payment_screenshot_url?: string;
  utr_number?: string;
  created_at: string;
  files?: PdfFileDetail[];
}

const STATUS_COLORS: Record<string, string> = {
  PAYMENT_SUBMITTED: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
  ACCEPTED: 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800',
  PRINTING: 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
  READY_FOR_PICKUP: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700 animate-pulse',
  COMPLETED: 'bg-surface-100 dark:bg-slate-800 text-surface-600 dark:text-slate-300 border-surface-300 dark:border-slate-700',
  REJECTED: 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
  CANCELLED: 'bg-surface-100 dark:bg-slate-800 text-surface-400 dark:text-slate-500 border-surface-200 dark:border-slate-700',
};

const STATUS_LABELS: Record<string, string> = {
  PAYMENT_SUBMITTED: 'Payment Submitted (Pending Verification)',
  ACCEPTED: 'Order Accepted',
  PRINTING: 'Printing in Progress',
  READY_FOR_PICKUP: 'Ready for Pickup at Xerox Counter!',
  COMPLETED: 'Completed & Picked Up',
  REJECTED: 'Payment Verification Rejected',
  CANCELLED: 'Order Cancelled',
};

const PROGRESS_STEPS = [
  { key: 'PAYMENT_SUBMITTED', label: 'Submitted' },
  { key: 'ACCEPTED', label: 'Accepted' },
  { key: 'PRINTING', label: 'Printing' },
  { key: 'READY_FOR_PICKUP', label: 'Ready' },
  { key: 'COMPLETED', label: 'Completed' },
];

function getStepIndex(status: string): number {
  switch (status) {
    case 'PAYMENT_SUBMITTED': return 0;
    case 'ACCEPTED': return 1;
    case 'PRINTING': return 2;
    case 'READY_FOR_PICKUP': return 3;
    case 'COMPLETED': return 4;
    default: return -1;
  }
}

function TrackOrderContent() {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const [cancellingCode, setCancellingCode] = useState<string | null>(null);
  const [cancelModalOrderCode, setCancelModalOrderCode] = useState<string | null>(null);

  const searchOrders = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const isCode = searchQuery.trim().toUpperCase().startsWith('XR-');
      const param = isCode ? `code=${encodeURIComponent(searchQuery.trim())}` : `phone=${encodeURIComponent(searchQuery.trim())}`;
      
      const res = await fetch(`/api/orders?${param}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.data || []);
      } else {
        setError(data.error || 'Failed to search orders');
      }
    } catch {
      setError('Error searching orders. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    const phoneParam = searchParams.get('phone');

    if (codeParam) {
      setQuery(codeParam);
      searchOrders(codeParam);
    } else if (phoneParam) {
      setQuery(phoneParam);
      searchOrders(phoneParam);
    } else {
      // Auto fetch orders stored in localStorage
      if (typeof window !== 'undefined') {
        const saved = JSON.parse(localStorage.getItem('my_orders') || '[]');
        if (saved.length > 0) {
          fetch(`/api/orders?codes=${saved.join(',')}`)
            .then((res) => res.json())
            .then((data) => {
              if (data.success && data.data) {
                setOrders(data.data);
                setSearched(true);
              }
            })
            .catch(() => {});
        }
      }
    }
  }, [searchParams, searchOrders]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchOrders(query);
  };

  const [cancelReason, setCancelReason] = useState('Uploaded wrong file / document');
  const [customReason, setCustomReason] = useState('');

  const handleOpenCancelModal = (orderCode: string) => {
    setCancelModalOrderCode(orderCode);
    setCancelReason('Uploaded wrong file / document');
    setCustomReason('');
  };

  const confirmAndExecuteCancel = async (orderCode: string) => {
    setCancellingCode(orderCode);
    const finalReason = cancelReason === 'Other' ? customReason.trim() || 'Cancelled by student' : cancelReason;

    try {
      const res = await fetch(`/api/orders/${orderCode}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: finalReason }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders((prev) =>
          prev.map((o) =>
            o.order_code === orderCode
              ? { ...o, order_status: 'CANCELLED', cancellation_reason: finalReason }
              : o
          )
        );
        setCancelModalOrderCode(null);
      } else {
        alert(data.error || 'Failed to cancel order');
      }
    } catch {
      alert('Error cancelling order. Please try again.');
    } finally {
      setCancellingCode(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Top Navigation Link */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 px-3.5 py-2 rounded-xl shadow-xs transition-all"
        >
          ← Back to Student Xerox Portal
        </Link>
      </div>

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="w-14 h-14 bg-gradient-to-tr from-primary-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg glow-primary">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-black text-surface-900 dark:text-white tracking-tight">
          Track Your Order Details
        </h1>
        <p className="text-sm text-surface-500 dark:text-slate-400 max-w-md mx-auto">
          Enter your <strong className="text-surface-700 dark:text-slate-200">Phone Number</strong> or <strong className="text-surface-700 dark:text-slate-200">Order Code (e.g. XR-001)</strong> to view complete itemized details
        </p>
      </div>

      {/* Search Input Box */}
      <form onSubmit={handleSearchSubmit} className="max-w-md mx-auto">
        <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-2xl border-2 border-surface-200 dark:border-slate-700 shadow-xl">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter Order Code (XR-001) or Phone"
            required
            className="flex-1 px-4 py-2.5 bg-transparent text-surface-900 dark:text-white placeholder:text-surface-400 dark:placeholder:text-slate-500 outline-none text-sm font-semibold"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md glow-primary active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Track'}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-danger-50 dark:bg-danger-950/50 text-danger-600 dark:text-danger-400 text-xs px-4 py-3 rounded-xl border border-danger-200 dark:border-danger-800 text-center max-w-md mx-auto">
          {error}
        </div>
      )}

      {/* Results List */}
      {searched && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-surface-500 dark:text-slate-400 uppercase tracking-wider">
              Tracked Orders ({orders.length})
            </h2>
          </div>

          {orders.length > 0 ? (
            orders.map((order) => {
              const currentStepIdx = getStepIndex(order.order_status);
              const isCancelledOrRejected = order.order_status === 'CANCELLED' || order.order_status === 'REJECTED';

              // Normalize PDF files list
              const pdfList: PdfFileDetail[] = (order.files && order.files.length > 0)
                ? order.files
                : [{
                    fileName: order.file_name || 'Document.pdf',
                    pageCount: order.page_count || 1,
                    colorMode: order.color_mode || 'BW',
                    customColorPages: order.custom_color_pages || '',
                    side: order.side || 'SINGLE',
                    pagesPerSheet: order.pages_per_sheet || 1,
                    copies: order.copies || 1,
                    bindingType: order.binding_type || 'NONE',
                  }];

              return (
                <div
                  key={order.id}
                  className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 transition-all"
                >
                  {/* Order Header & Customer Info */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-surface-100 dark:border-slate-800 pb-5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-indigo-950/80 px-3.5 py-1 rounded-full border border-primary-200 dark:border-indigo-800 font-mono">
                          #{order.order_code}
                        </span>
                        <span className="text-xs text-surface-400 dark:text-slate-500">
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <h3 className="font-black text-xl text-surface-900 dark:text-white mt-2">
                        {order.student_name}
                      </h3>
                      <div className="text-xs text-surface-500 dark:text-slate-400 space-y-1 font-medium mt-1">
                        <p className="flex items-center gap-1.5">
                          <span>Phone:</span>
                          <strong className="text-surface-800 dark:text-slate-200">{order.phone_number}</strong>
                        </p>
                        {order.email && (
                          <p className="flex items-center gap-1.5">
                            <span>Email:</span>
                            <strong className="text-surface-800 dark:text-slate-200">{order.email}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-left sm:text-right bg-surface-50 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-surface-100 dark:border-slate-700/60 sm:bg-transparent sm:border-0 sm:p-0">
                      <span className="text-xs text-surface-400 dark:text-slate-400 block font-semibold">
                        Total Paid Amount
                      </span>
                      <span className="text-2xl font-black text-primary-600 dark:text-primary-400 block mt-0.5">
                        ₹{Number(order.total_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Status Banner */}
                  <div className={`p-4 rounded-2xl border text-sm font-bold flex items-center gap-3.5 ${
                    order.order_status === 'REJECTED' || order.payment_status === 'PAYMENT_REJECTED'
                      ? STATUS_COLORS['REJECTED']
                      : STATUS_COLORS[order.order_status] || 'bg-surface-100 text-surface-700'
                  }`}>
                    <div className="flex-1">
                      <p className="font-black text-base">
                        {order.order_status === 'REJECTED' || order.payment_status === 'PAYMENT_REJECTED'
                          ? 'Payment Verification Rejected'
                          : STATUS_LABELS[order.order_status] || order.order_status}
                      </p>
                      <p className="text-xs opacity-90 font-medium mt-0.5">
                        {order.order_status === 'REJECTED' || order.payment_status === 'PAYMENT_REJECTED'
                          ? `Reason: ${order.rejection_reason || 'Payment screenshot or UTR mismatch. Please contact Surya at 8015587361.'}`
                          : order.order_status === 'COMPLETED'
                          ? 'Order completed and picked up. Thank you!'
                          : order.order_status === 'PRINTING'
                          ? 'Your document is currently being printed by shop staff.'
                          : order.order_status === 'CANCELLED'
                          ? `Reason for Cancellation: ${order.cancellation_reason || order.rejection_reason || 'Cancelled by user'}`
                          : 'Payment received! Verification pending by shop counter.'}
                      </p>
                    </div>
                  </div>

                  {/* Order Progress Stepper */}
                  {!isCancelledOrRejected && (
                    <div className="bg-surface-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-surface-100 dark:border-slate-800 space-y-3">
                      <span className="text-[11px] font-bold text-surface-400 dark:text-slate-400 uppercase tracking-wider block">
                        Live Progress Tracker
                      </span>
                      <div className="grid grid-cols-5 gap-1 text-center">
                        {PROGRESS_STEPS.map((step, idx) => {
                          const isDone = currentStepIdx >= idx;
                          const isCurrent = currentStepIdx === idx;
                          return (
                            <div key={step.key} className="space-y-1.5">
                              <div
                                className={`h-2 rounded-full transition-all ${
                                  isCurrent
                                    ? 'bg-primary-600 ring-2 ring-primary-300 dark:ring-primary-900 animate-pulse'
                                    : isDone
                                    ? 'bg-emerald-500'
                                    : 'bg-surface-200 dark:bg-slate-700'
                                }`}
                              />
                              <span
                                className={`text-[10px] sm:text-xs font-semibold block ${
                                  isCurrent
                                    ? 'text-primary-600 dark:text-primary-400 font-extrabold'
                                    : isDone
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-surface-400 dark:text-slate-500'
                                }`}
                              >
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Complete PDF File Configurations Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-surface-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Uploaded Files & Configurations ({pdfList.length})</span>
                      <span className="font-mono text-surface-400">{order.page_count} Total Pages</span>
                    </h4>

                    <div className="space-y-2.5">
                      {pdfList.map((file, idx) => (
                        <div
                          key={idx}
                          className="bg-surface-50/80 dark:bg-slate-800/60 rounded-2xl p-4 border border-surface-200/80 dark:border-slate-700/60 space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-lg flex items-center justify-center font-bold text-xs">
                                PDF
                              </span>
                              <div>
                                <p className="font-bold text-sm text-surface-900 dark:text-white line-clamp-1">
                                  {file.fileName}
                                </p>
                                <p className="text-xs text-surface-500 dark:text-slate-400">
                                  {file.pageCount} pages · {file.copies || 1} {file.copies === 1 ? 'copy' : 'copies'}
                                </p>
                              </div>
                            </div>

                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-700 text-surface-700 dark:text-slate-300">
                              File #{idx + 1}
                            </span>
                          </div>

                          {/* Detail Badges Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-surface-100 dark:border-slate-800 text-[11px]">
                              <span className="text-surface-400 dark:text-slate-500 block text-[10px]">Color Mode</span>
                              <strong className="text-surface-800 dark:text-slate-200">
                                {file.colorMode === 'COLOR'
                                  ? 'Full Color'
                                  : file.colorMode === 'CUSTOM_PAGES'
                                  ? `Custom Color (${file.customColorPages || 'Pages specified'})`
                                  : 'Black & White'}
                              </strong>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-surface-100 dark:border-slate-800 text-[11px]">
                              <span className="text-surface-400 dark:text-slate-500 block text-[10px]">Print Side</span>
                              <strong className="text-surface-800 dark:text-slate-200">
                                {file.side === 'DOUBLE' ? 'Double Sided (Duplex)' : 'Single Sided'}
                              </strong>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-surface-100 dark:border-slate-800 text-[11px]">
                              <span className="text-surface-400 dark:text-slate-500 block text-[10px]">Pages Per Sheet</span>
                              <strong className="text-surface-800 dark:text-slate-200">
                                {file.pagesPerSheet || 1} {file.pagesPerSheet === 1 ? 'Page / Sheet' : 'Pages / Sheet'}
                              </strong>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-surface-100 dark:border-slate-800 text-[11px]">
                              <span className="text-surface-400 dark:text-slate-500 block text-[10px]">Binding</span>
                              <strong className="text-surface-800 dark:text-slate-200">
                                {file.bindingType === 'SPIRAL'
                                  ? 'Spiral Binding'
                                  : file.bindingType === 'SOFT_COVER'
                                  ? 'Soft Cover'
                                  : file.bindingType === 'HARD_COVER'
                                  ? 'Hard Cover'
                                  : 'Stapled / None'}
                              </strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Payment Details & Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Payment Proof Details */}
                    <div className="bg-surface-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-surface-100 dark:border-slate-800 space-y-2 text-xs">
                      <span className="font-bold text-surface-400 dark:text-slate-400 uppercase tracking-wider block">
                        Payment & Verification Status
                      </span>
                      <div className="flex justify-between items-center py-1 border-b border-surface-100 dark:border-slate-800">
                        <span className="text-surface-500 dark:text-slate-400">Payment Status:</span>
                        <span className="font-bold text-surface-800 dark:text-slate-200">
                          {order.payment_status || 'Submitted'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-surface-100 dark:border-slate-800">
                        <span className="text-surface-500 dark:text-slate-400">UTR / Ref Number:</span>
                        <span className="font-mono font-bold text-surface-800 dark:text-slate-200">
                          {order.utr_number || 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-surface-500 dark:text-slate-400">Payment Proof:</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {order.payment_screenshot_url ? 'Screenshot Uploaded' : 'Submitted'}
                        </span>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="bg-surface-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-surface-100 dark:border-slate-800 space-y-2 text-xs">
                      <span className="font-bold text-surface-400 dark:text-slate-400 uppercase tracking-wider block">
                        Price Breakdown
                      </span>
                      <div className="flex justify-between items-center py-1 border-b border-surface-100 dark:border-slate-800">
                        <span className="text-surface-500 dark:text-slate-400">Printing Subtotal:</span>
                        <span className="font-semibold text-surface-800 dark:text-slate-200">
                          ₹{Number(order.printing_subtotal || order.total_amount - (order.binding_cost || 0)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-surface-100 dark:border-slate-800">
                        <span className="text-surface-500 dark:text-slate-400">Binding Charge:</span>
                        <span className="font-semibold text-surface-800 dark:text-slate-200">
                          ₹{Number(order.binding_cost || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 pt-1 font-bold text-sm">
                        <span className="text-surface-900 dark:text-white">Total Paid:</span>
                        <span className="text-primary-600 dark:text-primary-400 font-black">
                          ₹{Number(order.total_amount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-surface-100 dark:border-slate-800">
                    {/* Download Receipt button if completed */}
                    {order.order_status === 'COMPLETED' ? (
                      <a
                        href={`/api/orders/${order.order_code}/receipt`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
                      >
                        Download PDF Receipt
                      </a>
                    ) : (
                      <div className="text-[11px] text-surface-400 dark:text-slate-500 italic">
                        Receipt is available upon order completion.
                      </div>
                    )}

                    {/* Cancel Order button if pending */}
                    {['PAYMENT_SUBMITTED', 'ACCEPTED'].includes(order.order_status) && (
                      <button
                        onClick={() => handleOpenCancelModal(order.order_code)}
                        disabled={cancellingCode === order.order_code}
                        className="inline-flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/80 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 active:scale-95"
                      >
                        {cancellingCode === order.order_code ? 'Cancelling...' : 'Cancel Order'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-2 shadow-xl">
              <p className="text-base font-bold text-surface-700 dark:text-slate-300">
                No matching orders found
              </p>
              <p className="text-xs text-surface-400 dark:text-slate-500 max-w-xs mx-auto">
                Double check the phone number or order code (e.g. XR-001) and try again.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Custom Cancel Order Confirmation Modal UI */}
      {cancelModalOrderCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 animate-scale-up">
            {/* Warning Icon Header */}
            <div className="w-14 h-14 bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="text-center space-y-2.5">
              <h3 className="text-xl font-black text-surface-900 dark:text-white tracking-tight">
                Cancel Order Confirmation
              </h3>
              <div className="bg-rose-50 dark:bg-rose-950/60 p-3 rounded-2xl border border-rose-200 dark:border-rose-900/60">
                <p className="text-sm font-extrabold text-rose-700 dark:text-rose-300">
                  Are you sure you want to cancel order #{cancelModalOrderCode}?
                </p>
              </div>
            </div>

            {/* Reason Selection Form */}
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-surface-700 dark:text-slate-300 uppercase tracking-wider block">
                Reason for Cancellation <span className="text-rose-500">*</span>
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 dark:border-slate-700 bg-surface-50 dark:bg-slate-800 text-surface-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500/20"
              >
                <option value="Uploaded wrong file / document">Uploaded wrong file / document</option>
                <option value="Incorrect print configuration (color/copies/sides)">Incorrect print configuration (color/copies/sides)</option>
                <option value="Placed order by mistake">Placed order by mistake</option>
                <option value="Changed my mind">Changed my mind</option>
                <option value="Other">Other reason...</option>
              </select>

              {cancelReason === 'Other' && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter custom cancellation reason..."
                  required
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-surface-900 dark:text-white text-xs outline-none focus:border-rose-500 mt-2"
                />
              )}
              <p className="text-[11px] text-surface-400 dark:text-slate-500 italic pt-0.5">
                Providing a reason helps our shop staff process your cancellation efficiently.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOrderCode(null)}
                disabled={cancellingCode === cancelModalOrderCode}
                className="w-full bg-surface-100 hover:bg-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-700 dark:text-slate-200 font-extrabold py-3 px-4 rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50"
              >
                No, Keep Order
              </button>
              <button
                type="button"
                onClick={() => confirmAndExecuteCancel(cancelModalOrderCode)}
                disabled={cancellingCode === cancelModalOrderCode}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {cancellingCode === cancelModalOrderCode ? (
                  <span>Cancelling...</span>
                ) : (
                  <span>Yes, Cancel Order</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function TrackOrderPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-surface-500">Loading order tracker...</div>}>
      <TrackOrderContent />
    </Suspense>
  );
}
