import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-slate-950 transition-colors relative overflow-hidden">
      {/* Background ambient lighting glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-primary-500/20 via-purple-500/15 to-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hero */}
      <header className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center relative z-10">
        {/* Badge */}
        <div className="mb-6 animate-fade-in">
          <span className="inline-flex items-center gap-2 bg-primary-50 dark:bg-indigo-950/80 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-indigo-800 px-4 py-1.5 rounded-full text-xs font-bold shadow-xs">
            ⚡ Fast, Queue-Free Campus Xerox
          </span>
        </div>

        {/* Logo & Headline */}
        <div className="mb-8 animate-fade-in max-w-2xl">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-tr from-primary-600 to-indigo-500 text-white rounded-3xl mb-6 shadow-xl glow-primary transform hover:scale-105 transition-all duration-300">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-surface-900 dark:text-white tracking-tight">
            Campus<span className="gradient-text">Xerox</span>
          </h1>
          <p className="mt-4 text-xl sm:text-2xl text-surface-600 dark:text-slate-300 font-semibold max-w-lg mx-auto">
            Upload PDF. Pay Online. Collect in Seconds.
          </p>
        </div>

        {/* CTA */}
        <div className="animate-slide-up">
          <Link
            href="/login"
            className="inline-flex items-center gap-2.5 bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white px-9 py-4 rounded-2xl font-bold text-lg hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] shadow-xl glow-primary transition-all duration-200"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Order Xerox Now
          </Link>
        </div>

        {/* 3 Steps */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full animate-slide-up">
          <StepCard
            number={1}
            title="Upload PDF"
            description="Upload your assignments, lecture notes, or project reports"
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            }
          />
          <StepCard
            number={2}
            title="Choose & Pay"
            description="Select color mode, sides & layout, then pay via UPI QR"
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            }
          />
          <StepCard
            number={3}
            title="Collect"
            description="Get notified live & pick up prints at Xerox counter"
            icon={
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            }
          />
        </div>
      </header>

      {/* Footer */}
      <footer className="py-8 text-center text-xs font-medium text-surface-500 dark:text-slate-400 border-t border-surface-200/60 dark:border-slate-800">
        <p>CampusXerox — Skip the counter queue, save your time.</p>
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
    <div className="glass-card rounded-3xl p-6 hover:-translate-y-1 hover:shadow-2xl hover:border-primary-300/50 transition-all duration-300 text-left group">
      <div className="flex items-center justify-between mb-4">
        <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-indigo-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center border border-primary-200/50 dark:border-indigo-800/50 group-hover:scale-110 transition-transform">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {icon}
          </svg>
        </div>
        <span className="text-xs font-extrabold text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-indigo-900/60 px-3 py-1 rounded-full border border-primary-200/40 dark:border-indigo-800">
          Step {number}
        </span>
      </div>
      <h3 className="font-bold text-base text-surface-900 dark:text-white">{title}</h3>
      <p className="text-xs text-surface-500 dark:text-slate-400 mt-1.5 leading-relaxed">{description}</p>
    </div>
  );
}
