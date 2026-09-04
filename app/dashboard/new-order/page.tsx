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
  const [phoneNumber, setPhoneNumber] = useState('');

  // Step 1 & 2: Multi-PDF Upload & Itemized Configurations
  const [pdfFiles, setPdfFiles] = useState<PdfDocumentConfig[]>([]);
  const [activePdfIndex, setActivePdfIndex] = useState(0);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  // Grand total estimated price
  const [estimatedPrice, setEstimatedPrice] = useState(0);

  // Step 4: Payment
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [utrNumber, setUtrNumber] = useState('');
  const [orderCode, setOrderCode] = useState('');

  // Fetch initial profile & shop settings
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .single();
        if (profile?.name) {
          setStudentName(profile.name);
        }
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

  // Step 3→4: Create order
  const handleCreateOrder = async () => {
    if (!studentName.trim() || !phoneNumber.trim()) {
      setError('Please enter your Student Name and WhatsApp/Phone Number');
      setStep(1);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const activeItem = pdfFiles[0];
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentName.trim(),
          phoneNumber: phoneNumber.trim(),
          files: pdfFiles,
          colorMode: activeItem?.colorMode || ColorMode.BW,
          customColorPages: activeItem?.customColorPages || '',
          side: activeItem?.side || Side.SINGLE,
          pagesPerSheet: activeItem?.pagesPerSheet || 1,
          copies: activeItem?.copies || 1,
          bindingType: activeItem?.bindingType || BindingType.NONE,
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to create order');
        return;
      }

      setOrderCode(data.data.order_code);
      setEstimatedPrice(Number(data.data.total_amount));
      setStep(4);
    } catch {
      setError('Failed to create order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Submit payment proof
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
      formData.append('orderCode', orderCode);

      const uploadRes = await fetch('/api/upload/screenshot', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        setError(uploadData.error || 'Failed to upload screenshot');
        return;
      }

      const paymentRes = await fetch(`/api/orders/${orderCode}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshotPath: uploadData.data.screenshotPath,
          utrNumber: utrNumber.trim(),
        }),
      });

      const paymentData = await paymentRes.json();
      if (!paymentData.success) {
        setError(paymentData.error || 'Failed to submit payment');
        return;
      }

      router.push(`/dashboard/orders/${orderCode}`);
    } catch {
      setError('Failed to submit payment. Please try again.');
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
          <h2 className="text-xl font-bold text-surface-900">Student Details & Upload</h2>

          <div className="bg-white border border-surface-200 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-surface-500 uppercase tracking-wide">
              Contact Information
            </h3>
            <div>
              <label htmlFor="student-name" className="block text-xs font-medium text-surface-700 mb-1">
                Student Name *
              </label>
              <input
                id="student-name"
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter your full name"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 bg-surface-50 text-surface-900 focus:border-primary-500 outline-none text-sm"
              />
            </div>
            <div>
              <label htmlFor="student-phone" className="block text-xs font-medium text-surface-700 mb-1">
                WhatsApp / Phone Number *
              </label>
              <input
                id="student-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="10-digit mobile number"
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-300 bg-surface-50 text-surface-900 focus:border-primary-500 outline-none text-sm font-mono"
              />
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
            <span className="font-bold truncate max-w-[200px]">📄 {currentActivePdf.fileName}</span>
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
                  🖨 All B&W
                </button>

                <button
                  onClick={() => updateActivePdfConfig({ colorMode: ColorMode.COLOR })}
                  className={`py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${
                    currentActivePdf.colorMode === ColorMode.COLOR
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
                      : 'border-surface-200 bg-white text-surface-600'
                  }`}
                >
                  🎨 All Color
                </button>

                <button
                  onClick={() => updateActivePdfConfig({ colorMode: ColorMode.CUSTOM_PAGES })}
                  className={`py-2.5 rounded-xl text-xs font-medium border-2 transition-all ${
                    currentActivePdf.colorMode === ColorMode.CUSTOM_PAGES
                      ? 'border-primary-500 bg-primary-50 text-primary-700 font-bold'
                      : 'border-surface-200 bg-white text-surface-600'
                  }`}
                >
                  ✨ Specific Color Pages
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
              onClick={handleCreateOrder}
              disabled={loading}
              className="flex-1 bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? 'Creating...' : 'Proceed to Pay →'}
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP 4: Manual Payment ==================== */}
      {step === 4 && (
        <div className="space-y-5">
          <h2 className="text-xl font-bold text-surface-900">Pay & Submit</h2>

          <div className="bg-success-50 border border-success-500/20 rounded-2xl p-4 text-center">
            <p className="text-xs text-success-600 font-medium">Order Created</p>
            <p className="text-2xl font-bold text-success-600 mt-1">#{orderCode}</p>
          </div>

          {/* UPI PAYMENT CARD */}
          <div className="bg-white border-2 border-primary-100 rounded-2xl p-5 space-y-4 text-center shadow-sm">
            <h3 className="font-bold text-base text-surface-900">
              Pay <span className="text-primary-600 text-xl font-extrabold">₹{estimatedPrice.toFixed(2)}</span> to Surya R
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
      )}
    </div>
  );
}
