'use client';

import { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { PDFDocument } from 'pdf-lib';
import PrintPreviewCanvas from '@/components/PrintPreviewCanvas';
import { ColorMode, Side, BindingType, type PricingSettings, type PdfDocumentConfig } from '@/types';
import { calculateMultiPdfOrderPrice, parseCustomColorPages } from '@/services/pricing';

type Step = 1 | 2 | 3 | 4;

export default function NewOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Shop Status & Pricing
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [shopOpen, setShopOpen] = useState(true);
  const [shopStatusMessage, setShopStatusMessage] = useState('');

  // Student contact info
  const [studentName, setStudentName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  // Step 1 & 2: Multi-PDF Upload & Itemized Configurations
  const [pdfFiles, setPdfFiles] = useState<PdfDocumentConfig[]>([]);
  const [activePdfIndex, setActivePdfIndex] = useState(0);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Grand total estimated price
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  // Notice language toggle state ('ta' | 'en' | 'te')
  const [noticeLang, setNoticeLang] = useState<'ta' | 'en' | 'te'>('ta');
  const [showGuide, setShowGuide] = useState(true);

  // Step 4: Payment
  const [paymentMode, setPaymentMode] = useState<'UPI' | 'HAND_CASH'>('UPI');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [orderCode, setOrderCode] = useState('');

  // Fetch initial pricing & load saved contact info
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      if (typeof window !== 'undefined') {
        const savedName = localStorage.getItem('saved_student_name');
        const savedEmail = localStorage.getItem('saved_email');
        const savedPhone = localStorage.getItem('saved_phone');
        if (savedName) setStudentName(savedName);
        if (savedEmail) setEmail(savedEmail);
        if (savedPhone) setPhoneNumber(savedPhone);
      }

      const res = await fetch('/api/pricing');
      const data = await res.json();
      if (data.success && data.data) {
        setPricing(data.data);
        setShopOpen(data.data.shop_open ?? true);
        setShopStatusMessage(
          data.data.shop_status_message || 'Shop is currently closed. New uploads are disabled.'
        );
      }
    } catch {
      // Non-critical
    }
  };

  const totalPageCount = pdfFiles.reduce((sum, file) => sum + file.pageCount, 0);

  // Recalculate price across all PDFs with itemized settings
  const recalculatePrice = useCallback(
    (filesList: PdfDocumentConfig[], p: PricingSettings | null) => {
      if (!p || filesList.length === 0) return 0;
      const breakdown = calculateMultiPdfOrderPrice(filesList, p);
      return breakdown.totalAmount;
    },
    []
  );

  // Update active PDF's config
  const updateActivePdfConfig = (updates: Partial<PdfDocumentConfig>) => {
    setPdfFiles((prev) => {
      const updated = [...prev];
      if (updated[activePdfIndex]) {
        updated[activePdfIndex] = {
          ...updated[activePdfIndex],
          ...updates,
        };
      }
      const newTotal = recalculatePrice(updated, pricing);
      setEstimatedPrice(newTotal);
      return updated;
    });
  };

  // Handle PDF file selection & upload
  const handlePdfAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setError('');
    setUploadingPdf(true);

    try {
      const newItems: PdfDocumentConfig[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.type !== 'application/pdf') {
          setError(`"${file.name}" is not a PDF file`);
          continue;
        }
        if (file.size > 20 * 1024 * 1024) {
          setError(`"${file.name}" exceeds 20MB limit`);
          continue;
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const pages = pdfDoc.getPageCount();

        if (pages === 0) {
          setError(`"${file.name}" has no pages`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', { method: 'POST', body: formData });
        const data = await res.json();

        if (!data.success) {
          setError(data.error || `Failed to upload ${file.name}`);
          continue;
        }

        newItems.push({
          filePath: data.data.filePath,
          fileName: file.name,
          pageCount: pages,
          fileSize: file.size,
          colorMode: ColorMode.BW,
          customColorPages: '',
          side: Side.SINGLE,
          pagesPerSheet: 1,
          copies: 1,
          bindingType: BindingType.NONE,
        });
      }

      setPdfFiles((prev) => {
        const updated = [...prev, ...newItems];
        const newTotal = recalculatePrice(updated, pricing);
        setEstimatedPrice(newTotal);
        return updated;
      });
    } catch {
      setError('Failed to process PDF file');
    } finally {
      setUploadingPdf(false);
      e.target.value = '';
    }
  };

  const handleRemovePdf = (index: number) => {
    setPdfFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (activePdfIndex >= updated.length) {
        setActivePdfIndex(Math.max(0, updated.length - 1));
      }
      const newTotal = recalculatePrice(updated, pricing);
      setEstimatedPrice(newTotal);
      return updated;
    });
  };

  // Step 3→4: Proceed to Payment selection (does NOT place order in DB yet)
  const handleProceedToPaymentStep = () => {
    if (!studentName.trim() || !email.trim() || !phoneNumber.trim()) {
      setError('Please enter your Student Name, Email Address, and Phone Number');
      setStep(2);
      return;
    }
    if (pdfFiles.length === 0) {
      setError('Please upload at least one PDF file');
      setStep(1);
      return;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('saved_student_name', studentName.trim());
      localStorage.setItem('saved_email', email.trim());
      localStorage.setItem('saved_phone', phoneNumber.trim());
    }

    setError('');
    setStep(4);
  };

  // Step 4: Place order with UPI payment details
  const handleSubmitPayment = async () => {
    if (!screenshotFile || !utrNumber.trim()) {
      setError('Please upload a screenshot and enter the UTR number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', screenshotFile);
      formData.append('orderCode', 'TEMP');

      const uploadRes = await fetch('/api/upload/screenshot', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        setError(uploadData.error || 'Failed to upload screenshot');
        setLoading(false);
        return;
      }

      const activeItem = pdfFiles[0];
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim(),
          files: pdfFiles,
          colorMode: activeItem?.colorMode || ColorMode.BW,
          customColorPages: activeItem?.customColorPages || '',
          side: activeItem?.side || Side.SINGLE,
          pagesPerSheet: activeItem?.pagesPerSheet || 1,
          copies: activeItem?.copies || 1,
          bindingType: activeItem?.bindingType || BindingType.NONE,
          paymentMethod: 'UPI',
          utrNumber: utrNumber.trim(),
          screenshotPath: uploadData.data.screenshotPath,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to place order');
        setLoading(false);
        return;
      }

      const createdCode = data.data.order_code;
      if (typeof window !== 'undefined') {
        const saved = JSON.parse(localStorage.getItem('my_orders') || '[]');
        if (!saved.includes(createdCode)) {
          saved.unshift(createdCode);
          localStorage.setItem('my_orders', JSON.stringify(saved));
        }
      }

      router.push(`/track?code=${createdCode}`);
    } catch {
      setError('Failed to submit order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleHandCashSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      const activeItem = pdfFiles[0];
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          email: email.trim(),
          phoneNumber: phoneNumber.trim(),
          files: pdfFiles,
          colorMode: activeItem?.colorMode || ColorMode.BW,
          customColorPages: activeItem?.customColorPages || '',
          side: activeItem?.side || Side.SINGLE,
          pagesPerSheet: activeItem?.pagesPerSheet || 1,
          copies: activeItem?.copies || 1,
          bindingType: activeItem?.bindingType || BindingType.NONE,
          paymentMethod: 'HAND_CASH',
          utrNumber: 'HAND_CASH',
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to place order');
        setLoading(false);
        return;
      }

      const createdCode = data.data.order_code;
      if (typeof window !== 'undefined') {
        const saved = JSON.parse(localStorage.getItem('my_orders') || '[]');
        if (!saved.includes(createdCode)) {
          saved.unshift(createdCode);
          localStorage.setItem('my_orders', JSON.stringify(saved));
        }
      }

      router.push(`/track?code=${createdCode}`);
    } catch {
      setError('Failed to confirm hand cash order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const currentActivePdf = pdfFiles[activePdfIndex] || pdfFiles[0];
  const parsedCustomColorCount = currentActivePdf
    ? parseCustomColorPages(currentActivePdf.customColorPages || '', currentActivePdf.pageCount).size
    : 0;

  return (
    <div className="animate-fade-in space-y-6">
      {/* SHOP CLOSED BANNER */}
      {!shopOpen && (
        <div className="bg-danger-50 border-2 border-danger-500/30 rounded-2xl p-5 text-center shadow-sm animate-pulse-soft">
          <div className="w-10 h-10 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-2">
            <svg className="w-5 h-5 text-danger-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="font-bold text-danger-700 text-lg">Shop Currently Closed</h3>
          <p className="text-sm text-danger-600 mt-1">{shopStatusMessage}</p>
        </div>
      )}

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                s < step
                  ? 'bg-primary-600 text-white'
                  : s === step
                  ? 'bg-primary-100 text-primary-700 ring-2 ring-primary-300'
                  : 'bg-surface-200 text-surface-400'
              }`}
            >
              {s < step ? '✓' : s}
            </div>
            {s < 4 && (
              <div className={`flex-1 h-0.5 ${s < step ? 'bg-primary-600' : 'bg-surface-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-danger-50 text-danger-600 text-sm px-4 py-3 rounded-xl border border-danger-500/20 animate-fade-in">
          {error}
        </div>
      )}

      {/* ==================== STEP 1: Student Details & Multi-PDF Upload ==================== */}
      {step === 1 && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-surface-900 dark:text-white">Order Xerox</h2>
            <div className="bg-amber-50 dark:bg-amber-950/60 px-3 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800 text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
              <span>📞 Contact Person: <strong>Surya</strong></span>
              <a href="tel:8015587361" className="underline font-mono">8015587361</a>
            </div>
          </div>

          {/* NEUMORPHISM UI DESIGN: RATES AND PRICING CARD */}
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
                  ₹{Number(pricing?.bw_single_side || 1.20).toFixed(2)}
                  <span className="text-[10px] font-normal text-surface-400 dark:text-slate-500 font-mono"> /page</span>
                </span>
              </div>

              <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800 flex flex-col justify-between">
                <span className="text-surface-500 dark:text-slate-400 font-extrabold text-[11px]">B&W Both Sides</span>
                <span className="text-lg font-black text-surface-900 dark:text-white mt-2">
                  ₹{Number(pricing?.bw_both_side || 1.20).toFixed(2)}
                  <span className="text-[10px] font-normal text-surface-400 dark:text-slate-500 font-mono"> /side</span>
                </span>
              </div>

              <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800 flex flex-col justify-between">
                <span className="text-surface-500 dark:text-slate-400 font-extrabold text-[11px]">2 Pages / Sheet</span>
                <span className="text-lg font-black text-surface-900 dark:text-white mt-2">
                  ₹{Number(pricing?.bw_two_pages_sheet || 1.20).toFixed(2)}
                  <span className="text-[10px] font-normal text-surface-400 dark:text-slate-500 font-mono"> /sheet</span>
                </span>
              </div>

              <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800 flex flex-col justify-between">
                <span className="text-amber-700 dark:text-amber-300 font-extrabold text-[11px]">Full Color Print</span>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400 mt-2">
                  ₹{Number(pricing?.color_per_page || 10.00).toFixed(2)}
                  <span className="text-[10px] font-normal text-surface-400 dark:text-slate-500 font-mono"> /page</span>
                </span>
              </div>

              <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800 col-span-2 sm:col-span-1 flex flex-col justify-between">
                <span className="text-indigo-700 dark:text-indigo-300 font-extrabold text-[11px]">Soft Binding</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-2">
                  +₹{Number(pricing?.soft_binding_cost || 20.00).toFixed(2)}
                  <span className="text-[10px] font-normal text-surface-400 dark:text-slate-500 font-mono"> /book</span>
                </span>
              </div>
            </div>
          </div>

          {/* NEUMORPHISM UI DESIGN: INTERACTIVE PDF CONFIGURATION GUIDE */}
          {showGuide && (
            <div className="bg-[#e6ebf4] dark:bg-[#0f172a] shadow-[10px_10px_24px_#c2cad8,-10px_-10px_24px_#ffffff] dark:shadow-[10px_10px_24px_#070b14,-10px_-10px_24px_#172340] rounded-3xl p-5 border border-white/60 dark:border-slate-800/80 space-y-3.5 relative transition-all">
              <button
                onClick={() => setShowGuide(false)}
                className="absolute top-4 right-4 w-7 h-7 bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[3px_3px_6px_#cbd4e2,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#070b14,-3px_-3px_6px_#1e2b48] border border-white/50 dark:border-slate-800 rounded-full flex items-center justify-center text-xs font-black text-surface-500 dark:text-slate-400 hover:text-danger-600 dark:hover:text-danger-400 transition-all active:scale-90"
                title="Dismiss Guide"
              >
                ✕
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <div>
                  <h3 className="font-black text-sm text-surface-900 dark:text-white tracking-tight">
                    How to Configure Multiple PDFs
                  </h3>
                  <p className="text-[11px] text-surface-500 dark:text-slate-400 font-medium">Simple 3-step guide for ordering print jobs</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] p-4 rounded-2xl border border-white/40 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-primary-600 dark:text-primary-400">
                    <span className="w-5 h-5 bg-primary-100 dark:bg-primary-950/80 rounded-full flex items-center justify-center text-[10px] font-black border border-primary-300 dark:border-primary-700">1</span>
                    <span>Add All PDFs</span>
                  </div>
                  <p className="text-surface-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    Upload one or multiple PDF documents at once in Step 1.
                  </p>
                </div>
                <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] p-4 rounded-2xl border border-white/40 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-indigo-600 dark:text-indigo-400">
                    <span className="w-5 h-5 bg-indigo-100 dark:bg-indigo-950/80 rounded-full flex items-center justify-center text-[10px] font-black border border-indigo-300 dark:border-indigo-700">2</span>
                    <span>Click PDF Tabs</span>
                  </div>
                  <p className="text-surface-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    In Step 2, click document tabs to configure per-file settings.
                  </p>
                </div>
                <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] p-4 rounded-2xl border border-white/40 dark:border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-black text-amber-600 dark:text-amber-400">
                    <span className="w-5 h-5 bg-amber-100 dark:bg-amber-950/80 rounded-full flex items-center justify-center text-[10px] font-black border border-amber-300 dark:border-amber-700">3</span>
                    <span>Custom Color Pages</span>
                  </div>
                  <p className="text-surface-600 dark:text-slate-300 text-[11px] leading-relaxed">
                    Specify specific color page numbers (e.g. 1, 5-10) to save cost!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CONTACT INFO CARD */}
          <div className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-surface-500 dark:text-slate-400 uppercase tracking-wide">
              Contact Information
            </h3>
            <div>
              <label htmlFor="student-name" className="block text-xs font-bold text-surface-700 dark:text-slate-300 mb-1">
                Student Name *
              </label>
              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter your full name"
                required
                className="w-full px-4 py-3 rounded-2xl border border-surface-300 dark:border-slate-700 bg-surface-50 dark:bg-slate-800 text-surface-900 dark:text-white focus:border-primary-500 outline-none text-sm font-medium"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="student-email" className="block text-xs font-bold text-surface-700 dark:text-slate-300 mb-1">
                  Email Address * <span className="text-primary-600 font-semibold">(Compulsory)</span>
                </label>
                <input
                  id="student-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-surface-300 dark:border-slate-700 bg-surface-50 dark:bg-slate-800 text-surface-900 dark:text-white focus:border-primary-500 outline-none text-sm font-medium"
                />
                <p className="text-[11px] text-surface-500 dark:text-slate-400 mt-1 leading-snug">
                  Required to confirm your order and send tracking updates & digital receipt.
                </p>
              </div>
              <div>
                <label htmlFor="student-phone" className="block text-xs font-bold text-surface-700 dark:text-slate-300 mb-1">
                  WhatsApp / Phone Number *
                </label>
                <input
                  id="student-phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="10-digit mobile number"
                  required
                  className="w-full px-4 py-3 rounded-2xl border border-surface-300 dark:border-slate-700 bg-surface-50 dark:bg-slate-800 text-surface-900 dark:text-white focus:border-primary-500 outline-none text-sm font-mono font-medium"
                />
                <p className="text-[11px] text-surface-500 dark:text-slate-400 mt-1 leading-snug">
                  Used for order tracking and live ready-for-pickup SMS alert.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wide">
                PDF Documents ({pdfFiles.length})
              </h3>
              {pdfFiles.length > 0 && (
                <span className="text-xs text-primary-600 font-semibold">
                  Total Pages: {totalPageCount}
                </span>
              )}
            </div>

            {pdfFiles.map((item, idx) => (
              <div key={idx} className="bg-white border border-surface-200 rounded-2xl p-3.5 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-danger-50 rounded-xl flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-danger-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-surface-900 truncate max-w-[220px]">
                      {item.fileName}
                    </p>
                    <p className="text-xs text-surface-500">
                      {item.pageCount} pages · {(item.fileSize / 1024 / 1024).toFixed(1)}MB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemovePdf(idx)}
                  className="text-surface-400 hover:text-danger-500 p-1"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            <label className={`flex flex-col items-center justify-center bg-white border-2 border-dashed border-surface-300 rounded-2xl p-6 cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-all ${
              !shopOpen ? 'opacity-50 pointer-events-none' : ''
            }`}>
              <svg className="w-8 h-8 text-surface-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-sm font-semibold text-primary-600">
                {uploadingPdf ? 'Uploading PDF...' : '+ Add PDF Document'}
              </span>
              <span className="text-xs text-surface-400 mt-0.5">Upload one or multiple PDF files</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={handlePdfAdd}
                disabled={!shopOpen || uploadingPdf}
                className="hidden"
              />
            </label>
          </div>

          <button
            onClick={() => {
              if (!studentName.trim() || !phoneNumber.trim()) {
                setError('Please enter your Student Name and WhatsApp Number');
                return;
              }
              if (pdfFiles.length === 0) {
                setError('Please upload at least one PDF file');
                return;
              }
              setError('');
              const newTotal = recalculatePrice(pdfFiles, pricing);
              setEstimatedPrice(newTotal);
              setStep(2);
            }}
            disabled={!shopOpen || pdfFiles.length === 0}
            className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            Configure Print Settings per PDF →
          </button>
        </div>
      )}

      {/* ==================== STEP 2: Per-PDF Print Configuration ==================== */}
      {step === 2 && currentActivePdf && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-surface-900">Per-PDF Print Configurations</h2>
            <span className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-bold">
              PDF {activePdfIndex + 1} of {pdfFiles.length}
            </span>
          </div>

          {/* TAB BAR FOR SWITCHING & REMOVING PDFS */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {pdfFiles.map((doc, idx) => (
              <div
                key={idx}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                  activePdfIndex === idx
                    ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                    : 'bg-white text-surface-700 border-surface-200 hover:border-surface-300'
                }`}
              >
                <button
                  onClick={() => setActivePdfIndex(idx)}
                  className="flex items-center gap-1.5 focus:outline-none"
                >
                  <span className="truncate max-w-[110px]">{doc.fileName}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    activePdfIndex === idx ? 'bg-white/20 text-white' : 'bg-surface-100 text-surface-500'
                  }`}>
                    {doc.pageCount}p
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePdf(idx);
                    if (pdfFiles.length <= 1) {
                      setStep(1);
                    }
                  }}
                  title="Remove this PDF"
                  className={`p-0.5 rounded-full hover:bg-black/20 text-current transition-all ${
                    activePdfIndex === idx ? 'text-white/80 hover:text-white' : 'text-surface-400 hover:text-danger-600'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* ACTIVE PDF BANNER */}
          <div className="bg-surface-900 text-white rounded-xl px-4 py-3 flex items-center justify-between text-xs">
            <span className="font-bold truncate max-w-[200px]">{currentActivePdf.fileName}</span>
            <span className="text-surface-300 font-mono">{currentActivePdf.pageCount} pages</span>
          </div>

          {/* Live Visual Canvas Preview for Current PDF */}
          <PrintPreviewCanvas
            colorMode={currentActivePdf.colorMode}
            customColorPages={currentActivePdf.customColorPages}
            side={currentActivePdf.side}
            pagesPerSheet={currentActivePdf.pagesPerSheet}
            pageCount={currentActivePdf.pageCount}
          />

          {/* FORM CONTROLS FOR CURRENT ACTIVE PDF */}
          <div className="bg-white border border-surface-200 rounded-2xl p-4 space-y-4">
            {/* Color Mode */}
            <div>
              <label className="text-sm font-medium text-surface-700 mb-2 block">Color Selection for this PDF</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => updateActivePdfConfig({ colorMode: ColorMode.BW })}
                  className={`py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${
                    currentActivePdf.colorMode === ColorMode.BW
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
                      : 'border-surface-200 bg-white text-surface-600'
                  }`}
                >
                  All B&W
                </button>

                <button
                  onClick={() => updateActivePdfConfig({ colorMode: ColorMode.COLOR })}
                  className={`py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${
                    currentActivePdf.colorMode === ColorMode.COLOR
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
                      : 'border-surface-200 bg-white text-surface-600'
                  }`}
                >
                  All Color
                </button>

                <button
                  onClick={() => updateActivePdfConfig({ colorMode: ColorMode.CUSTOM_PAGES })}
                  className={`py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${
                    currentActivePdf.colorMode === ColorMode.CUSTOM_PAGES
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
                      : 'border-surface-200 bg-white text-surface-600'
                  }`}
                >
                  Specific Color Pages
                </button>
              </div>

              {/* Specific Color Pages Input for this PDF */}
              {currentActivePdf.colorMode === ColorMode.CUSTOM_PAGES && (
                <div className="mt-3 bg-violet-50 border border-violet-200 rounded-xl p-3.5 space-y-2 animate-fade-in">
                  <label htmlFor="pdf-custom-pages" className="block text-xs font-bold text-violet-900">
                    Specific Color Page Numbers for "{currentActivePdf.fileName}":
                  </label>
                  <input
                    id="pdf-custom-pages"
                    type="text"
                    value={currentActivePdf.customColorPages || ''}
                    onChange={(e) => updateActivePdfConfig({ customColorPages: e.target.value })}
                    placeholder="e.g. 1, 22 or 1, 5-10, 22"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-violet-300 bg-white text-surface-900 placeholder:text-surface-400 focus:border-violet-600 outline-none text-xs font-mono"
                  />
                  <p className="text-[11px] text-violet-700">
                    Color Pages: <strong className="text-violet-900">{parsedCustomColorCount} page(s)</strong> @ ₹{pricing?.color_per_page}/pg · B&W: <strong className="text-violet-900">{Math.max(0, currentActivePdf.pageCount - parsedCustomColorCount)} page(s)</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Side */}
            <div>
              <label className="text-sm font-medium text-surface-700 mb-2 block">Sides</label>
              <div className="grid grid-cols-2 gap-2">
                {[Side.SINGLE, Side.BOTH].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateActivePdfConfig({ side: s })}
                    className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                      currentActivePdf.side === s
                        ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
                        : 'border-surface-200 bg-white text-surface-600'
                    }`}
                  >
                    {s === Side.SINGLE ? 'Single Side' : 'Both Sides (Double Sided)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Pages per sheet */}
            <div>
              <label className="text-sm font-medium text-surface-700 mb-2 block">Pages per Sheet</label>
              <div className="grid grid-cols-2 gap-2">
                {[1, 2].map((pps) => (
                  <button
                    key={pps}
                    onClick={() => updateActivePdfConfig({ pagesPerSheet: pps })}
                    className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                      currentActivePdf.pagesPerSheet === pps
                        ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
                        : 'border-surface-200 bg-white text-surface-600'
                    }`}
                  >
                    {pps === 1 ? '1 Page per Sheet' : '2 Pages per Sheet (Horizontal)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Binding Option for this PDF */}
            <div>
              <label className="text-sm font-medium text-surface-700 mb-2 block">Binding for this PDF</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => updateActivePdfConfig({ bindingType: BindingType.NONE })}
                  className={`py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${
                    currentActivePdf.bindingType === BindingType.NONE
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
                      : 'border-surface-200 bg-white text-surface-600'
                  }`}
                >
                  No Binding
                </button>

                <button
                  onClick={() => updateActivePdfConfig({ bindingType: BindingType.SOFT })}
                  className={`py-2.5 rounded-xl text-xs font-medium border-2 transition-all flex flex-col items-center justify-center ${
                    currentActivePdf.bindingType === BindingType.SOFT
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
                      : 'border-surface-200 bg-white text-surface-600'
                  }`}
                >
                  <span>Soft Binding</span>
                  <span className="text-[10px] text-primary-600 font-bold">+₹20</span>
                </button>

                <button
                  disabled
                  className="py-2.5 rounded-xl text-xs font-medium border-2 border-surface-200 bg-surface-100 text-surface-400 cursor-not-allowed flex flex-col items-center justify-center opacity-60"
                >
                  <span>Spiral Binding</span>
                  <span className="text-[9px] bg-surface-300 text-surface-700 px-1.5 py-0.5 rounded-full font-semibold mt-0.5">
                    Coming Soon
                  </span>
                </button>
              </div>
            </div>

            {/* Copies */}
            <div>
              <label className="text-sm font-medium text-surface-700 mb-2 block">Copies for this PDF</label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateActivePdfConfig({ copies: Math.max(1, currentActivePdf.copies - 1) })}
                  className="w-10 h-10 rounded-xl border-2 border-surface-200 flex items-center justify-center text-surface-600 hover:border-primary-300 font-bold"
                >
                  −
                </button>
                <span className="w-12 text-center text-lg font-bold text-surface-900">{currentActivePdf.copies}</span>
                <button
                  onClick={() => updateActivePdfConfig({ copies: Math.min(100, currentActivePdf.copies + 1) })}
                  className="w-10 h-10 rounded-xl border-2 border-surface-200 flex items-center justify-center text-surface-600 hover:border-primary-300 font-bold"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Grand Total Estimated Price */}
          <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 text-center">
            <p className="text-xs text-primary-600 font-medium mb-1">Grand Total Order Price</p>
            <p className="text-3xl font-bold text-primary-700">₹{estimatedPrice.toFixed(2)}</p>
            <p className="text-xs text-primary-600 mt-1">
              Itemized print & binding cost across all {pdfFiles.length} uploaded PDF document(s)
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="flex-1 bg-surface-100 text-surface-700 py-3 rounded-xl font-semibold text-sm hover:bg-surface-200"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-700 active:scale-[0.98]"
            >
              Review Itemized Summary →
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP 3: Itemized Order Summary ==================== */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-surface-900">Itemized Order Summary</h2>

          <div className="bg-white border border-surface-200 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between text-sm pb-2 border-b border-surface-100">
              <span className="text-surface-500">Student</span>
              <span className="font-semibold text-surface-900">{studentName} ({phoneNumber})</span>
            </div>

            {/* ITEMIZED PER-PDF BREAKDOWN */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wide">
                Configured PDF Documents ({pdfFiles.length})
              </h3>

              {pdfFiles.map((doc, idx) => (
                <div key={idx} className="bg-surface-50 border border-surface-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center font-bold text-surface-900">
                    <span className="truncate max-w-[200px]">📄 #{idx + 1} {doc.fileName}</span>
                    <span className="text-primary-700 font-mono">{doc.pageCount} pages</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-surface-600">
                    <span>Color: <strong>{doc.colorMode === 'CUSTOM_PAGES' ? `Pages (${doc.customColorPages || 'Custom'})` : doc.colorMode}</strong></span>
                    <span>Side: <strong>{doc.side}</strong></span>
                    <span>Layout: <strong>{doc.pagesPerSheet} p/sheet</strong></span>
                    <span>Binding: <strong>{doc.bindingType === 'SOFT' ? 'Soft (+₹20)' : 'None'}</strong></span>
                    <span>Copies: <strong>{doc.copies}</strong></span>
                  </div>
                </div>
              ))}
            </div>

            <hr className="border-surface-100" />

            <div className="flex justify-between items-center">
              <span className="font-bold text-surface-900">Grand Total</span>
              <span className="text-2xl font-bold text-primary-600">₹{estimatedPrice.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep(2)}
              className="flex-1 bg-surface-100 text-surface-700 py-3 rounded-xl font-semibold text-sm hover:bg-surface-200"
            >
              ← Back
            </button>
            <button
              onClick={handleProceedToPaymentStep}
              className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-700 active:scale-[0.98]"
            >
              Select Payment Method →
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP 4: Manual Payment ==================== */}
      {step === 4 && (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-surface-900 dark:text-white">Select Payment & Confirm Order</h2>

          <div className="bg-primary-50 dark:bg-primary-950/60 border border-primary-500/20 dark:border-primary-700/50 rounded-2xl p-4 text-center">
            <p className="text-xs text-primary-600 dark:text-primary-300 font-bold uppercase tracking-wider">Grand Total Amount Due</p>
            <p className="text-2xl font-black text-primary-700 dark:text-primary-200 mt-1">₹{estimatedPrice.toFixed(2)}</p>
          </div>

          {/* NEUMORPHISM UI DESIGN: MULTILINGUAL NOTICE CARD WITH INTERACTIVE TRANSLATE BUTTONS */}
          <div className="bg-[#e6ebf4] dark:bg-[#0f172a] shadow-[10px_10px_24px_#c2cad8,-10px_-10px_24px_#ffffff] dark:shadow-[10px_10px_24px_#070b14,-10px_-10px_24px_#172340] rounded-3xl p-5 text-center border border-amber-300/50 dark:border-amber-600/40 space-y-3.5 transition-all">
            <div className="flex items-center justify-between pb-2 border-b border-surface-300/40 dark:border-slate-800">
              <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                Notice Board
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-surface-500 dark:text-slate-400 mr-1 hidden sm:inline">Translate:</span>
                <button
                  onClick={() => setNoticeLang('ta')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 ${
                    noticeLang === 'ta'
                      ? 'bg-amber-500 text-white shadow-[inset_2px_2px_4px_#b45309,inset_-2px_-2px_4px_#f59e0b]'
                      : 'bg-[#f0f4f9] dark:bg-[#131b2e] text-surface-700 dark:text-slate-200 shadow-[3px_3px_6px_#cbd4e2,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#070b14,-3px_-3px_6px_#1e2b48] border border-white/50 dark:border-slate-800'
                  }`}
                >
                  Tamil
                </button>
                <button
                  onClick={() => setNoticeLang('en')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 ${
                    noticeLang === 'en'
                      ? 'bg-amber-500 text-white shadow-[inset_2px_2px_4px_#b45309,inset_-2px_-2px_4px_#f59e0b]'
                      : 'bg-[#f0f4f9] dark:bg-[#131b2e] text-surface-700 dark:text-slate-200 shadow-[3px_3px_6px_#cbd4e2,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#070b14,-3px_-3px_6px_#1e2b48] border border-white/50 dark:border-slate-800'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => setNoticeLang('te')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all active:scale-95 ${
                    noticeLang === 'te'
                      ? 'bg-amber-500 text-white shadow-[inset_2px_2px_4px_#b45309,inset_-2px_-2px_4px_#f59e0b]'
                      : 'bg-[#f0f4f9] dark:bg-[#131b2e] text-surface-700 dark:text-slate-200 shadow-[3px_3px_6px_#cbd4e2,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#070b14,-3px_-3px_6px_#1e2b48] border border-white/50 dark:border-slate-800'
                  }`}
                >
                  Telugu
                </button>
              </div>
            </div>

            <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,inset_-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800">
              <p className="text-base font-black text-surface-900 dark:text-amber-100 tracking-wide">
                {noticeLang === 'ta' && 'கடன் அன்பை முறிக்கும்'}
                {noticeLang === 'en' && 'Debt destroys love'}
                {noticeLang === 'te' && 'Appu leni ganji doppede chalunu'}
              </p>
            </div>
          </div>

          {/* NEUMORPHISM UI DESIGN: PAYMENT METHOD TOGGLE (UPI vs HAND CASH) */}
          <div className="bg-[#e6ebf4] dark:bg-[#0f172a] shadow-[10px_10px_24px_#c2cad8,-10px_-10px_24px_#ffffff] dark:shadow-[10px_10px_24px_#070b14,-10px_-10px_24px_#172340] rounded-3xl p-3 border border-white/60 dark:border-slate-800/80 flex gap-2">
            <button
              onClick={() => setPaymentMode('UPI')}
              className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
                paymentMode === 'UPI'
                  ? 'bg-primary-600 text-white shadow-[inset_2px_2px_4px_#3730a3,inset_-2px_-2px_4px_#6366f1]'
                  : 'bg-[#f0f4f9] dark:bg-[#131b2e] text-surface-700 dark:text-slate-200 shadow-[3px_3px_6px_#cbd4e2,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#070b14,-3px_-3px_6px_#1e2b48] border border-white/50 dark:border-slate-800'
              }`}
            >
              UPI / Online Payment
            </button>
            <button
              onClick={() => setPaymentMode('HAND_CASH')}
              className={`flex-1 py-3 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
                paymentMode === 'HAND_CASH'
                  ? 'bg-emerald-600 text-white shadow-[inset_2px_2px_4px_#065f46,inset_-2px_-2px_4px_#10b981]'
                  : 'bg-[#f0f4f9] dark:bg-[#131b2e] text-surface-700 dark:text-slate-200 shadow-[3px_3px_6px_#cbd4e2,-3px_-3px_6px_#ffffff] dark:shadow-[3px_3px_6px_#070b14,-3px_-3px_6px_#1e2b48] border border-white/50 dark:border-slate-800'
              }`}
            >
              Hand Cash (Pay on Pickup)
            </button>
          </div>

          {/* HAND CASH PAYMENT OPTION CONTAINER */}
          {paymentMode === 'HAND_CASH' && (
            <div className="bg-[#e6ebf4] dark:bg-[#0f172a] shadow-[10px_10px_24px_#c2cad8,-10px_-10px_24px_#ffffff] dark:shadow-[10px_10px_24px_#070b14,-10px_-10px_24px_#172340] rounded-3xl p-6 border border-emerald-300/50 dark:border-emerald-600/40 text-center space-y-4 transition-all">
              <div>
                <h3 className="text-lg font-black text-surface-900 dark:text-white">
                  Hand Cash on Pickup
                </h3>
                <p className="text-xs text-surface-500 dark:text-slate-400 mt-1">
                  Pay <strong className="text-emerald-600 dark:text-emerald-400 font-extrabold text-base">₹{estimatedPrice.toFixed(2)}</strong> in cash when collecting printouts at shop
                </p>
              </div>

              <div className="bg-[#f0f4f9] dark:bg-[#131b2e] shadow-[inset_3px_3px_6px_#cbd4e2,inset_-3px_-3px_6px_#ffffff] dark:shadow-[inset_3px_3px_6px_#070b14,-3px_-3px_6px_#1e2b48] rounded-2xl p-4 border border-white/40 dark:border-slate-800 text-xs text-surface-700 dark:text-slate-300 space-y-1">
                <p className="font-extrabold">Shop Contact: <span className="text-primary-600 dark:text-primary-400 font-mono">Surya (8015587361)</span></p>
                <p className="text-[11px] text-surface-500 dark:text-slate-400">Order will be printed and ready for pickup immediately!</p>
              </div>

              <button
                onClick={handleHandCashSubmit}
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {loading ? 'Confirming Order...' : `Confirm Order with Hand Cash (₹${estimatedPrice.toFixed(2)}) →`}
              </button>
            </div>
          )}

          {/* UPI PAYMENT CARD */}
          {paymentMode === 'UPI' && (
            <>
              <div className="bg-white dark:bg-slate-900 border-2 border-primary-100 dark:border-slate-800 rounded-2xl p-5 space-y-4 text-center shadow-sm">
                <h3 className="font-bold text-base text-surface-900 dark:text-white">
                  Pay <span className="text-primary-600 dark:text-primary-400 text-xl font-extrabold">₹{estimatedPrice.toFixed(2)}</span> to Surya R
                </h3>

                {/* Live QR Code / Custom Uploaded QR Photo */}
                <div className="flex flex-col items-center justify-center">
                  <div className="bg-white p-3 rounded-2xl border-2 border-surface-200 shadow-md">
                    <img
                      src={
                        pricing?.upi_qr_image_path ||
                        `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                          `upi://pay?pa=${pricing?.upi_id || 'surya2092005-1@oksbi'}&pn=Surya%20R&am=${estimatedPrice.toFixed(2)}&cu=INR`
                        )}`
                      }
                      alt="UPI QR Code"
                      className="w-48 h-48 rounded-xl object-contain"
                    />
                  </div>
                  <p className="text-xs text-surface-500 mt-2 font-medium">Scan with GPay, PhonePe, Paytm, or BHIM</p>
                </div>

                {/* 1-Click Mobile Pay Button */}
                <a
                  href={`upi://pay?pa=${pricing?.upi_id || 'surya2092005-1@oksbi'}&pn=Surya%20R&am=${estimatedPrice.toFixed(2)}&cu=INR`}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-[0.98] transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>Tap to Pay ₹{estimatedPrice.toFixed(2)} via UPI App</span>
                </a>

                {/* UPI ID Copy Box */}
                <div className="bg-surface-50 rounded-xl p-3 flex items-center justify-between border border-surface-200">
                  <div className="text-left">
                    <p className="text-[10px] text-surface-400 font-bold uppercase">UPI ID</p>
                    <p className="font-mono text-sm font-bold text-surface-900 select-all">
                      {pricing?.upi_id || 'surya2092005-1@oksbi'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(pricing?.upi_id || 'surya2092005-1@oksbi');
                      alert('UPI ID copied to clipboard!');
                    }}
                    className="bg-surface-200 hover:bg-surface-300 text-surface-800 text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div className="bg-white border border-surface-200 rounded-2xl p-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-surface-700 mb-2 block">Upload Payment Screenshot</label>
                  {!screenshotFile ? (
                    <label className="flex items-center justify-center bg-surface-50 border-2 border-dashed border-surface-300 rounded-xl py-6 cursor-pointer hover:border-primary-400">
                      <div className="text-center">
                        <svg className="w-8 h-8 text-surface-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-surface-500">Upload screenshot</span>
                      </div>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="flex items-center justify-between bg-surface-50 rounded-xl p-3">
                      <span className="text-sm text-surface-700 truncate">{screenshotFile.name}</span>
                      <button
                        onClick={() => setScreenshotFile(null)}
                        className="text-surface-400 hover:text-danger-500 ml-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="utr" className="text-sm font-medium text-surface-700 mb-1.5 block">
                    UTR / Transaction Reference Number
                  </label>
                  <input
                    id="utr"
                    type="text"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="Enter 12-digit UTR number"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 bg-surface-50 text-surface-900 placeholder:text-surface-400 focus:border-primary-500 outline-none text-sm font-mono"
                  />
                </div>
              </div>

              <button
                onClick={handleSubmitPayment}
                disabled={loading || !screenshotFile || !utrNumber.trim()}
                className="w-full bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {loading ? 'Submitting...' : 'Submit Payment Proof'}
              </button>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 bg-surface-100 text-surface-700 py-2.5 rounded-xl font-semibold text-xs hover:bg-surface-200 transition-all flex items-center justify-center gap-1"
            >
              <span>← Edit Print Settings</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (orderCode) {
                  try {
                    await fetch(`/api/orders/${orderCode}/cancel`, { method: 'POST' });
                  } catch {
                    // Non-critical
                  }
                }
                router.push('/dashboard/orders');
              }}
              className="flex-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 py-2.5 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1"
            >
              <span>✕ Cancel Order</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
