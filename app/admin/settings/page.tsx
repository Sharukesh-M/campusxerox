'use client';

import { useEffect, useState } from 'react';
import type { PricingSettings } from '@/types';
import { generateShopOpenedMessage } from '@/services/notifications';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<PricingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Pricing form state
  const [bwSingle, setBwSingle] = useState('');
  const [bwBoth, setBwBoth] = useState('');
  const [bwTwo, setBwTwo] = useState('');
  const [bwFour, setBwFour] = useState('');
  const [colorPage, setColorPage] = useState('');
  const [softBindingCost, setSoftBindingCost] = useState('');
  const [upiId, setUpiId] = useState('');
  const [upiQrImagePath, setUpiQrImagePath] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [bankDetails, setBankDetails] = useState('');
  const [retentionDays, setRetentionDays] = useState('');

  // Shop Hours & Status state
  const [shopOpen, setShopOpen] = useState(true);
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('20:00');
  const [shopStatusMessage, setShopStatusMessage] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/pricing');
      const data = await res.json();
      if (data.success && data.data) {
        const s = data.data;
        setSettings(s);
        setBwSingle(String(s.bw_single_side));
        setBwBoth(String(s.bw_both_side));
        setBwTwo(String(s.bw_two_pages_sheet));
        setBwFour(String(s.bw_four_pages_sheet));
        setColorPage(String(s.color_per_page));
        setSoftBindingCost(String(s.soft_binding_cost || 20.00));
        setUpiId(s.upi_id || '');
        setUpiQrImagePath(s.upi_qr_image_path || null);
        setBankDetails(s.bank_details || '');
        setRetentionDays(String(s.file_retention_days));

        setShopOpen(s.shop_open ?? true);
        setOpeningTime(s.opening_time || '08:00');
        setClosingTime(s.closing_time || '20:00');
        setShopStatusMessage(s.shop_status_message || 'Shop is currently closed. Opening hours: 08:00 AM to 08:00 PM.');
      }
    } catch {
      setMessage('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingQr(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload/qr', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.data?.qrImagePath) {
        setUpiQrImagePath(data.data.qrImagePath);
        setMessage('QR image uploaded! Click "Save Settings" to apply.');
      } else {
        setMessage(data.error || 'Failed to upload QR image');
      }
    } catch {
      setMessage('Error uploading QR image');
    } finally {
      setUploadingQr(false);
      e.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/pricing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bw_single_side: parseFloat(bwSingle),
          bw_both_side: parseFloat(bwBoth),
          bw_two_pages_sheet: parseFloat(bwTwo),
          bw_four_pages_sheet: parseFloat(bwFour),
          color_per_page: parseFloat(colorPage),
          soft_binding_cost: parseFloat(softBindingCost),
          upi_id: upiId,
          upi_qr_image_path: upiQrImagePath,
          bank_details: bankDetails,
          file_retention_days: parseInt(retentionDays),
          shop_open: shopOpen,
          opening_time: openingTime,
          closing_time: closingTime,
          shop_status_message: shopStatusMessage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Settings saved successfully!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(data.error || 'Failed to save');
      }
    } catch {
      setMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleShareShopOpened = () => {
    const text = generateShopOpenedMessage(openingTime, closingTime);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
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

  return (
    <div className="max-w-lg mx-auto animate-fade-in space-y-6">
      <h1 className="text-xl font-bold text-surface-900">Admin Settings</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {message && (
          <div className={`text-sm px-4 py-3 rounded-xl border animate-fade-in ${
            message.includes('success')
              ? 'bg-success-50 text-success-600 border-success-500/20'
              : 'bg-danger-50 text-danger-600 border-danger-500/20'
          }`}>
            {message}
          </div>
        )}

        {/* SHOP OPERATING HOURS & STATUS */}
        <div className="bg-white border-2 border-primary-100 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-surface-900">Shop Service Status</h2>
              <p className="text-xs text-surface-500 mt-0.5">Control whether students can upload orders</p>
            </div>
            <button
              type="button"
              onClick={() => setShopOpen(!shopOpen)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                shopOpen
                  ? 'bg-success-600 text-white shadow-md shadow-success-600/20'
                  : 'bg-danger-600 text-white shadow-md shadow-danger-600/20'
              }`}
            >
              {shopOpen ? '🟢 OPEN' : '🔴 CLOSED'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Opening Time</label>
              <input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-300 bg-surface-50 text-sm font-semibold outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Closing Time</label>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-300 bg-surface-50 text-sm font-semibold outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">Shop Closed Banner Message</label>
            <input
              type="text"
              value={shopStatusMessage}
              onChange={(e) => setShopStatusMessage(e.target.value)}
              placeholder="Message shown to students when shop is closed..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 bg-surface-50 text-surface-900 outline-none text-xs"
            />
          </div>

          {shopOpen && (
            <button
              type="button"
              onClick={handleShareShopOpened}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
            >
              <span>💬 Share "Shop Open" Announcement via WhatsApp</span>
            </button>
          )}
        </div>

        {/* PRICING & BINDING */}
        <div className="bg-white border border-surface-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-surface-700 mb-4">Printing & Binding Costs (₹)</h2>
          <div className="space-y-3">
            <PriceInput label="B&W — Single Side (per page)" value={bwSingle} onChange={setBwSingle} />
            <PriceInput label="B&W — Both Sides (per page/side)" value={bwBoth} onChange={setBwBoth} />
            <PriceInput label="B&W — 2 Pages/Sheet (per sheet)" value={bwTwo} onChange={setBwTwo} />
            <PriceInput label="B&W — 4 Pages/Sheet (per sheet)" value={bwFour} onChange={setBwFour} />
            <PriceInput label="Color (per page)" value={colorPage} onChange={setColorPage} />
            <PriceInput label="Soft Binding Cost (+₹)" value={softBindingCost} onChange={setSoftBindingCost} />
          </div>
          <p className="text-xs text-surface-400 mt-3">
            Changes apply to future orders only. Existing order prices are snapshotted.
          </p>
        </div>

        {/* PAYMENT DETAILS */}
        <div className="bg-white border border-surface-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-surface-700 mb-4">Payment Collection Details</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourshop@upi"
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 bg-surface-50 text-surface-900 outline-none text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Custom UPI QR Photo</label>
              {upiQrImagePath ? (
                <div className="space-y-2 bg-surface-50 border border-surface-200 rounded-xl p-3 text-center">
                  <img
                    src={upiQrImagePath}
                    alt="Custom UPI QR Code"
                    className="w-36 h-36 mx-auto rounded-lg object-contain border border-surface-300 bg-white"
                  />
                  <div className="flex gap-2 justify-center">
                    <label className="bg-primary-50 text-primary-700 hover:bg-primary-100 text-xs px-3 py-1.5 rounded-lg font-bold cursor-pointer transition-all">
                      {uploadingQr ? 'Uploading...' : 'Change Photo'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        onChange={handleQrUpload}
                        disabled={uploadingQr}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setUpiQrImagePath(null)}
                      className="bg-danger-50 text-danger-600 hover:bg-danger-100 text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
                    >
                      Remove Custom QR
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center bg-surface-50 border-2 border-dashed border-surface-300 rounded-xl p-4 cursor-pointer hover:border-primary-400 transition-all">
                  <svg className="w-6 h-6 text-surface-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-semibold text-primary-600">
                    {uploadingQr ? 'Uploading Image...' : '+ Upload Custom QR Photo'}
                  </span>
                  <span className="text-[11px] text-surface-400 mt-0.5">Upload a photo of your GPay/Paytm shop QR code</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    onChange={handleQrUpload}
                    disabled={uploadingQr}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-surface-600 mb-1">Bank Details (optional)</label>
              <textarea
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                placeholder="Account Name, Bank, Account Number, IFSC"
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 bg-surface-50 text-surface-900 outline-none text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* DATA RETENTION */}
        <div className="bg-white border border-surface-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-surface-700 mb-4">Data Retention</h2>
          <div>
            <label className="block text-xs font-medium text-surface-600 mb-1">
              Keep completed orders for (days)
            </label>
            <input
              type="number"
              min="1"
              max="90"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              className="w-24 px-3.5 py-2.5 rounded-xl border border-surface-300 bg-surface-50 text-surface-900 outline-none text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 active:scale-[0.98]"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

function PriceInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-surface-600 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">₹</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-surface-300 bg-surface-50 text-surface-900 outline-none text-sm"
        />
      </div>
    </div>
  );
}
