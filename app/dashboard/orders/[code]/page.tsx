'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import OrderTracker from '@/components/OrderTracker';
import type { Order } from '@/types';

export default function OrderDetailPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment resubmission state
  const [resubmitting, setResubmitting] = useState(false);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [resubError, setResubError] = useState('');
  const [resubLoading, setResubLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${code}`);
      const data = await res.json();
      if (data.success) {
        setOrder(data.data);
      }
    } catch {
      // Retry
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 15000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  const handleDownloadReceipt = () => {
    // Open dynamic PDF receipt endpoint directly in new window/tab for instant download
    window.open(`/api/orders/${code}/receipt`, '_blank');
  };

  const handleResubmitPayment = async () => {
    if (!screenshotFile || !utrNumber.trim()) {
      setResubError('Please upload a screenshot and enter the UTR number');
      return;
    }

    setResubLoading(true);
    setResubError('');

    try {
      const formData = new FormData();
      formData.append('file', screenshotFile);
      formData.append('orderCode', code);

      const uploadRes = await fetch('/api/upload/screenshot', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) {
        setResubError(uploadData.error || 'Upload failed');
        return;
      }

      const paymentRes = await fetch(`/api/orders/${code}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshotPath: uploadData.data.screenshotPath,
          utrNumber: utrNumber.trim(),
        }),
      });
      const paymentData = await paymentRes.json();

      if (paymentData.success) {
        setResubmitting(false);
        setScreenshotFile(null);
        setUtrNumber('');
        fetchOrder();
      } else {
        setResubError(paymentData.error || 'Submission failed');
      }
    } catch {
      setResubError('An error occurred');
    } finally {
      setResubLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <svg className="animate-spin w-6 h-6 text-primary-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-surface-500">Order not found</p>
        <button onClick={() => router.push('/dashboard/orders')} className="text-primary-600 font-semibold text-sm mt-2">
          ← Back to orders
        </button>
      </div>
    );
  }

  const isReady = order.order_status === 'READY_FOR_PICKUP';
  const isCompleted = order.order_status === 'COMPLETED';
  const isRejected = order.payment_status === 'PAYMENT_REJECTED';

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Uploaded wrong file / document');
  const [customReason, setCustomReason] = useState('');

  const confirmAndExecuteCancel = async () => {
    setCancelling(true);
    const finalReason = cancelReason === 'Other' ? customReason.trim() || 'Cancelled by student' : cancelReason;

    try {
      const res = await fetch(`/api/orders/${code}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: finalReason }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCancelModal(false);
        fetchOrder();
      } else {
        alert(data.error || 'Failed to cancel order');
      }
    } catch {
      alert('Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const isCancellable = ['PAYMENT_SUBMITTED', 'ACCEPTED'].includes(order?.order_status || '') || isRejected;

  return (
    <div className="animate-fade-in space-y-4">
      {/* Order Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/dashboard/orders')} className="text-xs text-primary-600 font-medium mb-1 hover:text-primary-700">
            ← My Orders
          </button>
          <h1 className="text-xl font-bold text-surface-900 dark:text-white">#{order.order_code}</h1>
        </div>
        <span className="text-sm text-surface-400">
          {new Date(order.created_at).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>

      {/* Ready for Pickup Banner */}
      {isReady && (
        <div className="bg-success-50 border-2 border-success-500 rounded-2xl p-6 text-center animate-pulse-soft">
          <p className="text-success-600 font-bold text-2xl">#{order.order_code}</p>
          <p className="text-success-600 font-bold text-lg mt-1">READY FOR PICKUP</p>
          <p className="text-success-500 text-sm mt-2">
            Please show this Order ID at the Xerox counter.
          </p>
        </div>
      )}

      {/* Status Tracker */}
      <div className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <OrderTracker orderStatus={order.order_status} paymentStatus={order.payment_status} />
      </div>

      {/* Rejection reason + Resubmit */}
      {isRejected && (
        <div className="bg-danger-50 dark:bg-danger-950/50 border border-danger-500/20 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-danger-600 dark:text-danger-400">Payment Rejected</p>
            {order.rejection_reason && (
              <p className="text-sm text-danger-500 dark:text-danger-300 mt-1">Reason: {order.rejection_reason}</p>
            )}
          </div>

          {!resubmitting ? (
            <button
              onClick={() => setResubmitting(true)}
              className="bg-danger-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-danger-700 active:scale-[0.98]"
            >
              Resubmit Payment Proof
            </button>
          ) : (
            <div className="space-y-3 bg-white dark:bg-slate-900 rounded-xl p-3 border border-surface-200 dark:border-slate-800">
              {resubError && (
                <p className="text-xs text-danger-600">{resubError}</p>
              )}
              <div>
                <label className="text-xs font-medium text-surface-600 dark:text-slate-400 mb-1 block">New Screenshot</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                  className="text-xs text-surface-700 dark:text-slate-300"
                />
              </div>
              <div>
                <label htmlFor="resub-utr" className="text-xs font-medium text-surface-600 dark:text-slate-400 mb-1 block">UTR Number</label>
                <input
                  id="resub-utr"
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  placeholder="Enter UTR"
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-slate-700 bg-transparent text-surface-900 dark:text-white text-sm outline-none focus:border-primary-500"
                />
              </div>
              <button
                onClick={handleResubmitPayment}
                disabled={resubLoading}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
              >
                {resubLoading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Order Details */}
      <div className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-2xl p-4 space-y-2 shadow-sm">
        <h3 className="font-semibold text-sm text-surface-700 dark:text-slate-300 mb-2">Print Configuration</h3>
        <Detail label="File" value={order.file_name || 'Document'} />
        <Detail label="Pages" value={`${order.page_count} PDF pages`} />
        <Detail label="Color" value={order.color_mode === 'BW' ? 'Black & White' : order.color_mode === 'COLOR' ? 'Color' : `Specific (${order.custom_color_pages})`} />
        <Detail label="Sides" value={order.side === 'SINGLE' ? 'Single side' : 'Both sides'} />
        <Detail label="Layout" value={`${order.pages_per_sheet} page(s) per sheet`} />
        <Detail label="Binding" value={order.binding_type === 'SOFT' ? 'Soft Binding (+₹20)' : 'No Binding'} />
        <Detail label="Copies" value={`${order.copies}`} />
        <hr className="border-surface-100 dark:border-slate-800" />
        <div className="flex justify-between pt-1">
          <span className="font-bold text-sm text-surface-900 dark:text-white">Total</span>
          <span className="font-bold text-sm text-primary-600 dark:text-primary-400">₹{Number(order.total_amount).toFixed(2)}</span>
        </div>
      </div>

      {/* Instant Receipt Download button when Order is Completed */}
      {isCompleted && (
        <button
          onClick={handleDownloadReceipt}
          className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-emerald-700 active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Official PDF Receipt
        </button>
      )}

      {/* Cancel Order Action Button */}
      {isCancellable && (
        <button
          onClick={() => setShowCancelModal(true)}
          disabled={cancelling}
          className="w-full bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {cancelling ? 'Cancelling Order...' : '✕ Cancel This Order'}
        </button>
      )}

      {/* Custom Cancel Order Confirmation Modal UI */}
      {showCancelModal && (
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
                  Are you sure you want to cancel order #{order.order_code}?
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
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="w-full bg-surface-100 hover:bg-surface-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-surface-700 dark:text-slate-200 font-extrabold py-3 px-4 rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50"
              >
                No, Keep Order
              </button>
              <button
                type="button"
                onClick={confirmAndExecuteCancel}
                disabled={cancelling}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 px-4 rounded-xl text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {cancelling ? (
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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-surface-500">{label}</span>
      <span className="font-medium text-surface-800">{value}</span>
    </div>
  );
}
