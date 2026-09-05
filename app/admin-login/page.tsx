'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter admin passcode');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Invalid passcode');
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-surface-50 dark:bg-slate-950 transition-colors relative overflow-hidden">
      {/* Glow effect */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-4">
        {/* Top Back Link */}
        <div className="flex justify-start">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 px-3.5 py-2 rounded-xl shadow-xs transition-all"
          >
            ← Back to Student Xerox Portal
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-surface-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-gradient-to-tr from-primary-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg glow-primary">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">Admin Login</h1>
            <p className="text-xs text-surface-500 dark:text-slate-400">
              Enter admin passcode to access shop management dashboard
            </p>
          </div>

          {error && (
            <div className="bg-danger-50 dark:bg-danger-950/50 text-danger-600 dark:text-danger-400 text-xs px-4 py-3 rounded-xl border border-danger-200 dark:border-danger-800 animate-fade-in text-center font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-passcode" className="block text-xs font-bold text-surface-700 dark:text-slate-300 mb-1.5 uppercase tracking-wide">
                Admin Passcode
              </label>
              <input
                id="admin-passcode"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-surface-300 dark:border-slate-700 bg-surface-50 dark:bg-slate-800 text-surface-900 dark:text-white focus:border-primary-500 dark:focus:border-primary-400 outline-none text-sm font-mono shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-500 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold text-sm shadow-lg glow-primary active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Access Admin Dashboard →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
