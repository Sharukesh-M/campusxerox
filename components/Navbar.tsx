'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';

interface NavbarProps {
  userName?: string;
  userRole?: 'student' | 'admin';
}

interface NotificationItem {
  id: string;
  code: string;
  title: string;
  message: string;
  status: string;
  time: string;
}

export default function Navbar({ userName, userRole }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Notifications state (for admin)
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const hasBeenReadRef = useRef(false);

  const isAdmin = userRole === 'admin';

  // Initialize theme from localStorage / system preference
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (storedTheme === 'dark' || (!storedTheme && prefersDark)) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setDarkMode(true);
    }
  };

  // Fetch admin notifications
  const fetchNotifications = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch('/api/orders?limit=15');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const orderList = data.data;

        const items: NotificationItem[] = orderList.map((o: { id: string; order_code: string; order_status: string; created_at: string }) => ({
          id: o.id,
          code: o.order_code,
          title: `Order #${o.order_code}`,
          status: o.order_status,
          message: `Status: ${o.order_status}`,
          time: new Date(o.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));

        setNotifications(items);
        if (!hasBeenReadRef.current) {
          setUnreadCount(items.length);
        }
      }
    } catch {
      // Non-critical
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 8000);
      return () => clearInterval(interval);
    }
  }, [fetchNotifications, isAdmin]);

  const handleAdminLogout = async () => {
    await fetch('/api/auth/admin-logout', { method: 'POST' });
    router.push('/admin-login');
    router.refresh();
  };

  useEffect(() => {
    setMenuOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-b border-surface-200 dark:border-slate-800 transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => router.push(isAdmin ? '/admin' : '/dashboard')}
            className="flex items-center gap-2 font-black text-lg text-primary-600 dark:text-primary-400 hover:text-primary-700"
          >
            <span>Campus<span className="text-surface-900 dark:text-white">Xerox</span></span>
            {isAdmin && (
              <span className="text-xs font-medium bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                Admin
              </span>
            )}
          </button>

          {/* Right side controls */}
          <div className="flex items-center gap-3">
            {/* DARK / LIGHT THEME TOGGLE BUTTON */}
            <button
              onClick={toggleTheme}
              title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="p-2 rounded-xl bg-surface-100 dark:bg-slate-800 text-surface-700 dark:text-slate-200 hover:bg-surface-200 dark:hover:bg-slate-700 transition-all active:scale-95 border border-surface-200 dark:border-slate-700 flex items-center gap-1.5"
            >
              {darkMode ? (
                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span className="hidden sm:inline">Light</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-bold text-surface-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                  <span className="hidden sm:inline">Dark</span>
                </span>
              )}
            </button>

            {/* ADMIN NOTIFICATION BELL ONLY */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => {
                    setNotifOpen(!notifOpen);
                    hasBeenReadRef.current = true;
                    setUnreadCount(0);
                  }}
                  title="Notifications"
                  className="p-2 rounded-xl bg-surface-100 dark:bg-slate-800 text-surface-700 dark:text-slate-200 hover:bg-surface-200 dark:hover:bg-slate-700 transition-all relative active:scale-95 border border-surface-200 dark:border-slate-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger-500 text-white font-extrabold text-[9px] rounded-full flex items-center justify-center animate-pulse shadow-sm">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border-2 border-surface-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-4 space-y-2.5 animate-fade-in text-surface-900 dark:text-slate-100">
                    <div className="flex items-center justify-between pb-2 border-b border-surface-100 dark:border-slate-800">
                      <span className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-slate-400">
                        Admin Notifications ({notifications.length})
                      </span>
                      <button onClick={() => setNotifOpen(false)} className="text-xs text-surface-400 dark:text-slate-400 hover:text-surface-600 dark:hover:text-white">
                        ✕
                      </button>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-2 scrollbar-thin">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => {
                              setNotifOpen(false);
                              router.push(`/admin/orders/${n.code}`);
                            }}
                            className="p-3 rounded-xl border bg-surface-50 dark:bg-slate-800/80 border-surface-200 dark:border-slate-700 text-surface-800 dark:text-slate-200 hover:border-primary-400 transition-all cursor-pointer text-xs"
                          >
                            <div className="flex justify-between font-bold text-xs mb-1">
                              <span>{n.title}</span>
                              <span className="text-[10px] opacity-75 font-mono">{n.time}</span>
                            </div>
                            <p className="text-[11px] font-medium opacity-90 leading-snug">{n.message}</p>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-center py-4 text-surface-400 dark:text-slate-500">No notifications</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Desktop nav links */}
            <div className="hidden sm:flex items-center gap-3">
              {isAdmin ? (
                <>
                  <NavLink href="/admin" active={pathname === '/admin'}>
                    Orders
                  </NavLink>
                  <NavLink href="/admin/settings" active={pathname === '/admin/settings'}>
                    Settings
                  </NavLink>
                  <div className="h-6 w-px bg-surface-200 dark:bg-slate-700" />
                  <button
                    onClick={handleAdminLogout}
                    className="text-xs text-surface-500 hover:text-danger-600 dark:hover:text-danger-400 font-bold bg-danger-50 dark:bg-danger-950/40 px-3 py-1.5 rounded-xl border border-danger-200 dark:border-danger-800"
                  >
                    Admin Logout
                  </button>
                </>
              ) : (
                <>
                  <NavLink href="/dashboard" active={pathname === '/dashboard'}>
                    Home
                  </NavLink>
                  <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-xl border border-amber-200 dark:border-amber-800 text-xs font-extrabold">
                    <span>Contact Surya:</span>
                    <a href="tel:8015587361" className="underline hover:text-amber-900 dark:hover:text-amber-100">
                      8015587361
                    </a>
                  </div>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              className="sm:hidden p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-slate-800"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5 text-surface-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="sm:hidden border-t border-surface-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-fade-in">
            <div className="px-4 py-3 space-y-1">
              {isAdmin ? (
                <>
                  <MobileNavLink href="/admin" onClick={() => router.push('/admin')}>
                    Orders
                  </MobileNavLink>
                  <MobileNavLink href="/admin/settings" onClick={() => router.push('/admin/settings')}>
                    Settings
                  </MobileNavLink>
                  <button
                    onClick={handleAdminLogout}
                    className="w-full text-left text-sm text-danger-600 dark:text-danger-400 font-bold px-3 py-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20"
                  >
                    Admin Logout
                  </button>
                </>
              ) : (
                <>
                  <MobileNavLink href="/dashboard" onClick={() => router.push('/dashboard')}>
                    Home
                  </MobileNavLink>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/60 rounded-xl text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center justify-between border border-amber-200 dark:border-amber-800">
                    <span>Contact Person: Surya</span>
                    <a href="tel:8015587361" className="underline font-mono">
                      8015587361
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </nav>
    </>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${
        active
          ? 'bg-primary-50 dark:bg-slate-800 text-primary-700 dark:text-primary-300 border border-transparent dark:border-slate-700'
          : 'text-surface-600 dark:text-slate-300 hover:text-surface-900 dark:hover:text-white hover:bg-surface-50 dark:hover:bg-slate-800'
      }`}
    >
      {children}
    </a>
  );
}

function MobileNavLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-sm font-medium px-3 py-2.5 rounded-lg transition-colors ${
        active
          ? 'bg-primary-50 dark:bg-slate-800 text-primary-700 dark:text-primary-300'
          : 'text-surface-600 dark:text-slate-300 hover:bg-surface-50 dark:hover:bg-slate-800'
      }`}
    >
      {children}
    </button>
  );
}
