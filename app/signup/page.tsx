import Link from 'next/link';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-surface-50 dark:bg-slate-950 transition-colors">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
        <div className="w-14 h-14 bg-gradient-to-tr from-primary-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg glow-primary">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div>
          <h1 className="text-2xl font-black text-surface-900 dark:text-white">
            Skip Registration
          </h1>
          <p className="text-xs text-surface-500 dark:text-slate-400 mt-2 leading-relaxed">
            CampusXerox does not require signup! Simply enter your Name and Phone Number to order prints instantly.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/dashboard/new-order"
            className="w-full block bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg glow-primary transition-all"
          >
            Order Xerox Now →
          </Link>
          <Link
            href="/track"
            className="w-full block bg-surface-100 dark:bg-slate-800 hover:bg-surface-200 text-surface-800 dark:text-slate-200 py-3 rounded-xl font-bold text-sm transition-all"
          >
            Track Order with Phone / Code
          </Link>
        </div>

        <div className="pt-4 border-t border-surface-100 dark:border-slate-800">
          <p className="text-xs text-surface-400 dark:text-slate-500">
            Admin portal access:{' '}
            <Link href="/admin-login" className="text-primary-600 dark:text-primary-400 font-bold hover:underline">
              Go to Admin Login →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
