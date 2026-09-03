import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <header className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        {/* Logo */}
        <div className="mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-2xl mb-4">
            <svg className="w-8 h-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-surface-900 tracking-tight">
            Campus<span className="text-primary-600">Xerox</span>
          </h1>
          <p className="mt-3 text-lg sm:text-xl text-surface-500 font-medium">
            Upload. Pay. Collect.
          </p>
        </div>

        {/* CTA */}
        <div className="animate-slide-up flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/dashboard/new-order"
            className="inline-flex items-center gap-2 bg-primary-600 text-white px-8 py-3.5 rounded-xl font-semibold text-lg hover:bg-primary-700 active:scale-[0.98] shadow-lg shadow-primary-600/25"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Order Xerox
          </Link>
          <Link
            href="/track"
            className="inline-flex items-center gap-2 bg-white text-surface-800 border border-surface-300 hover:border-surface-400 px-7 py-3.5 rounded-xl font-semibold text-lg shadow-sm hover:shadow active:scale-[0.98]"
          >
            Track Order
          </Link>
        </div>

        {/* 3 Steps */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-2xl w-full animate-slide-up">
          <StepCard
            number={1}
            title="Upload PDF"
            description="Upload your assignment, notes, or project report"
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            }
          />
          <StepCard
            number={2}
            title="Choose & Pay"
            description="Select printing options, see the price, and pay via UPI"
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            }
          />
          <StepCard
            number={3}
            title="Collect"
            description="Pick up your printed documents when ready"
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            }
          />
        </div>
      </header>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-surface-400">
        <p>CampusXerox — Skip the queue, save your time.</p>
      </footer>
    </div>
  );
}

function StepCard({
  number,
  title,
  description,
  icon,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-surface-200 hover:border-primary-200 hover:shadow-md transition-all group">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary-100">
          <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {icon}
          </svg>
        </div>
        <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">
          Step {number}
        </span>
      </div>
      <h3 className="font-semibold text-surface-800">{title}</h3>
      <p className="text-sm text-surface-500 mt-1">{description}</p>
    </div>
  );
}
