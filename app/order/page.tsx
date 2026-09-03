import Link from 'next/link';
import OrderWizard from '@/components/OrderWizard';

export default function StandaloneGuestOrderPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      {/* PUBLIC HEADER */}
      <header className="bg-white border-b border-surface-200 py-3.5 px-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-extrabold text-lg text-surface-900 tracking-tight">
              Campus<span className="text-primary-600">Xerox</span>
            </span>
          </Link>

          <Link
            href="/track"
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg transition-all"
          >
            Track Order →
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <OrderWizard />
      </main>
    </div>
  );
}
