'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Order } from '@/types';
import { createClient } from '@/lib/supabase/client';
import PrintPreviewCanvas from '@/components/PrintPreviewCanvas';
import { generateWhatsAppReceiptUrl, generateWhatsAppReadyUrl } from '@/services/notifications';

export default function AdminOrderDetailPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);

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
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [fetchOrder]);

  useEffect(() => {
    if (!order?.payment_screenshot_path) return;

    const getScreenshotUrl = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.storage
          .from('payment-proofs')
          .createSignedUrl(order.payment_screenshot_path!, 3600);
        if (data?.signedUrl) {
          setScreenshotUrl(data.signedUrl);
        }
      } catch {
        // Non-critical
      }
    };
    getScreenshotUrl();
  }, [order?.payment_screenshot_path]);

  const handlePaymentAction = async (action: 'verify' | 'reject') => {
    if (action === 'reject' && !rejectReason.trim()) {
      setShowRejectForm(true);
      return;
    }

    setActionLoading(action);
    try {
      const res = await fetch(`/api/orders/${code}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: rejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        setShowRejectForm(false);
        setRejectReason('');
        fetchOrder();
      }
    } catch {
      // Handle
    } finally {
      setActionLoading('');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(newStatus);
    try {
      const res = await fetch(`/api/orders/${code}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrder();
      }
    } catch {
      // Handle
    } finally {
      setActionLoading('');
    }
  };

  const handleDownloadPdf = async (filePath?: string | null) => {
    const path = filePath || order?.file_path;
    if (!path) return;
    try {
      const supabase = createClient();
      const { data } = await supabase.storage
        .from('xerox-files')
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch {
      // Handle
    }
  };

  const handleWhatsAppReceipt = () => {
    if (!order) return;
    const receiptUrl = `${window.location.origin}/api/orders/${order.order_code}/receipt`;

    const url = generateWhatsAppReceiptUrl(
      order.phone_number || '',
      order.order_code,
      order.student_name || 'Student',
      Number(order.total_amount),
      receiptUrl
    );
    window.open(url, '_blank');
  };

  const handleWhatsAppReady = () => {
    if (!order) return;
    const url = generateWhatsAppReadyUrl(
      order.phone_number || '',
      order.order_code,
      order.student_name || 'Student'
    );
    window.open(url, '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
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
      </div>
    );
  }

  const filesList = Array.isArray(order.files) && order.files.length > 0 ? order.files : [];

  return (
    <div className="animate-fade-in max-w-2xl mx-auto space-y-4">
      {/* Header & Student Details */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => router.push('/admin')} className="text-xs text-primary-600 font-medium hover:text-primary-700">
            ← All Orders
          </button>
          <h1 className="text-xl font-bold text-surface-900">Order #{order.order_code}</h1>
          <p className="text-sm font-semibold text-surface-700 mt-0.5">
            👤 {order.student_name || 'Student'} · 📞 {order.phone_number || 'No Phone'}
          </p>
        </div>
        <span className="text-xs text-surface-400">
          {new Date(order.created_at).toLocaleString('en-IN')}
        </span>
      </div>

      {/* OPERATOR PRINT INSTRUCTION CARD */}
      <div className="bg-white border-2 border-primary-200 rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-primary-600 uppercase tracking-wide">
            🖨 Print Specification
          </h2>
          <span className="text-xs font-bold bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full">
            {order.binding_type === 'SOFT' ? '📕 Soft Binding (+₹20)' : 'No Binding'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <InstructionBlock
            label="Color Mode"
            value={
              order.color_mode === 'CUSTOM_PAGES'
                ? `Color Pages: ${order.custom_color_pages || 'Specific'}`
                : order.color_mode === 'BW'
                ? 'B&W'
                : 'ALL COLOR'
            }
            large
          />
          <InstructionBlock label="Sides" value={order.side === 'BOTH' ? 'Both Sides' : 'Single Side'} large />
          <InstructionBlock label="Layout" value={`${order.pages_per_sheet} Page(s)/Sheet`} large />
          <InstructionBlock label="Copies" value={`${order.copies}`} large />
        </div>

        {/* Visual Print Layout Preview Canvas for Operator */}
        <PrintPreviewCanvas
          colorMode={order.color_mode}
          customColorPages={order.custom_color_pages || ''}
          side={order.side}
          pagesPerSheet={order.pages_per_sheet}
          pageCount={order.page_count}
        />

        {/* Uploaded PDF Documents list with Itemized Print Specifications */}
        <div className="pt-2 border-t border-surface-200 space-y-3">
          <p className="text-xs font-bold text-surface-500 uppercase tracking-wider">
            Itemized PDF Specifications ({filesList.length || 1})
          </p>

          {filesList.length > 0 ? (
            filesList.map((f, idx) => (
              <div key={idx} className="bg-surface-50 border border-surface-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center font-bold text-xs text-surface-900">
                  <span className="truncate max-w-[220px]">📄 #{idx + 1} {f.fileName}</span>
                  <span className="text-primary-700 font-mono">{f.pageCount} pages</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs text-surface-700">
                  <div className="bg-white p-1.5 rounded border border-surface-200">
                    Color: <strong className="text-surface-900">{f.colorMode === 'CUSTOM_PAGES' ? `Pages (${f.customColorPages || 'Custom'})` : f.colorMode || 'BW'}</strong>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-surface-200">
                    Side: <strong className="text-surface-900">{f.side || 'SINGLE'}</strong>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-surface-200">
                    Layout: <strong className="text-surface-900">{f.pagesPerSheet || 1} p/sheet</strong>
                  </div>
                  <div className="bg-white p-1.5 rounded border border-surface-200">
                    Binding: <strong className="text-surface-900">{f.bindingType === 'SOFT' ? 'Soft (+₹20)' : 'None'}</strong>
                  </div>
                </div>
                {f.filePath && (
                  <button
                    onClick={() => handleDownloadPdf(f.filePath)}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    Download #{idx + 1} PDF ({f.fileName})
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="flex items-center justify-between bg-surface-50 p-2.5 rounded-xl text-xs">
              <span className="font-semibold text-surface-800">{order.file_name}</span>
              {order.file_path && (
                <button
                  onClick={() => handleDownloadPdf(order.file_path)}
                  className="bg-primary-100 text-primary-700 px-2.5 py-1 rounded-lg font-bold hover:bg-primary-200"
                >
                  Download PDF
                </button>
              )}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-surface-200 flex justify-between items-center">
          <span className="text-sm text-surface-600">Total Print Amount</span>
          <span className="text-xl font-bold text-primary-600">₹{Number(order.total_amount).toFixed(2)}</span>
        </div>
      </div>

      {/* PAYMENT PROOF VIEWER */}
      <div className="bg-white border border-surface-200 rounded-2xl p-5">
        <h2 className="text-xs font-bold text-surface-500 uppercase tracking-wide mb-3">
          💳 Payment Verification
        </h2>

        {screenshotUrl ? (
          <div className="mb-3">
            <a href={screenshotUrl} target="_blank" rel="noopener noreferrer">
              <img
                src={screenshotUrl}
                alt="Payment screenshot"
                className="w-full max-h-64 object-contain rounded-xl border border-surface-200 bg-surface-50"
              />
            </a>
          </div>
        ) : (
          <p className="text-sm text-surface-400 mb-3">No screenshot uploaded</p>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-surface-500">Entered UTR</span>
            <span className="font-mono font-semibold text-surface-900">{order.utr_number || 'N/A'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-surface-500">OCR-read UTR</span>
            <span className="font-mono font-semibold text-surface-900">{order.ocr_extracted_utr || 'N/A'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-surface-500">UTR Match</span>
            <UtrMatchBadge status={order.utr_match_status} />
          </div>
        </div>

        {order.payment_status === 'PAYMENT_SUBMITTED' && (
          <div className="mt-4 pt-3 border-t border-surface-200 space-y-2">
            {showRejectForm ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason for payment rejection..."
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 text-sm outline-none focus:border-danger-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRejectForm(false)}
                    className="flex-1 bg-surface-100 text-surface-600 py-2 rounded-lg text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handlePaymentAction('reject')}
                    disabled={!!actionLoading}
                    className="flex-1 bg-danger-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-danger-700 disabled:opacity-50"
                  >
                    {actionLoading === 'reject' ? 'Rejecting...' : 'Reject Payment'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handlePaymentAction('verify')}
                  disabled={!!actionLoading}
                  className="flex-1 bg-success-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-success-500 disabled:opacity-50 active:scale-[0.98]"
                >
                  {actionLoading === 'verify' ? 'Verifying...' : '✓ Verify Payment'}
                </button>
                <button
                  onClick={() => setShowRejectForm(true)}
                  className="flex-1 bg-danger-50 text-danger-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-danger-100 border border-danger-200"
                >
                  ✗ Reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ORDER WORKFLOW & WHATSAPP NOTIFICATIONS */}
      <div className="bg-white border border-surface-200 rounded-2xl p-5 space-y-3">
        <h2 className="text-xs font-bold text-surface-500 uppercase tracking-wide">
          📦 Order Actions & Notifications
        </h2>

        <div className="flex gap-2">
          {order.phone_number && (
            <button
              onClick={handleWhatsAppReady}
              className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <span>💬 WhatsApp: "Ready for Pickup"</span>
            </button>
          )}
          {order.order_status === 'COMPLETED' && order.phone_number && (
            <button
              onClick={handleWhatsAppReceipt}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <span>💬 Send Receipt via WhatsApp</span>
            </button>
          )}
        </div>

        <div className="space-y-2 pt-2">
          {(order.order_status === 'ACCEPTED' || order.order_status === 'PRINTING') && (
            <div className="space-y-2">
              <ActionButton
                label="Mark Ready for Pickup"
                status="READY_FOR_PICKUP"
                color="success"
                loading={actionLoading}
                onClick={() => handleStatusChange('READY_FOR_PICKUP')}
              />
              <ActionButton
                label="Mark Completed"
                status="COMPLETED"
                color="primary"
                loading={actionLoading}
                onClick={() => handleStatusChange('COMPLETED')}
              />
            </div>
          )}
          {order.order_status === 'READY_FOR_PICKUP' && (
            <ActionButton
              label="Mark Completed"
              status="COMPLETED"
              color="primary"
              loading={actionLoading}
              onClick={() => handleStatusChange('COMPLETED')}
            />
          )}
          {order.order_status === 'COMPLETED' && (
            <p className="text-sm text-success-600 font-medium text-center py-1">
              ✓ Order completed & receipt ready
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InstructionBlock({ label, value, large }: { label: string; value: string; large?: boolean }) {
  return (
    <div className="bg-surface-50 rounded-xl p-3 text-center">
      <p className="text-xs text-surface-500 font-medium mb-0.5">{label}</p>
      <p className={`font-bold text-surface-900 ${large ? 'text-lg' : 'text-sm'}`}>{value}</p>
    </div>
  );
}

function UtrMatchBadge({ status }: { status: string }) {
  switch (status) {
    case 'MATCH':
      return <span className="bg-success-50 text-success-600 text-xs font-bold px-2 py-1 rounded-lg">✓ MATCH</span>;
    case 'MISMATCH':
      return <span className="bg-danger-50 text-danger-600 text-xs font-bold px-2 py-1 rounded-lg">✗ MISMATCH</span>;
    case 'OCR_FAILED':
      return <span className="bg-warning-50 text-warning-600 text-xs font-medium px-2 py-1 rounded-lg">⚠ OCR Failed</span>;
    default:
      return <span className="bg-surface-100 text-surface-500 text-xs font-medium px-2 py-1 rounded-lg">Not Checked</span>;
  }
}

function ActionButton({ label, status, color, loading, onClick }: {
  label: string; status: string; color: string; loading: string; onClick: () => void;
}) {
  const colors: Record<string, string> = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700',
    success: 'bg-success-600 text-white hover:bg-success-500',
    danger: 'bg-danger-600 text-white hover:bg-danger-700',
  };

  return (
    <button
      onClick={onClick}
      disabled={!!loading}
      className={`w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-[0.98] ${colors[color]}`}
    >
      {loading === status ? 'Processing...' : label}
    </button>
  );
}
