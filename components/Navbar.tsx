'use client';

import { createClient } from '@/lib/supabase/client';
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

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const hasBeenReadRef = useRef(false);

  // Live Toast Popup Alert state
  const [toastAlert, setToastAlert] = useState<{ title: string; message: string; code: string } | null>(null);
  const prevStatusesRef = useRef<Record<string, string>>({});

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

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
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

  // Poll orders for live notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/orders?limit=15');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const orderList = data.data;

        // Detect status transitions for live Toast popup
        const currentStatuses: Record<string, string> = {};
        for (const o of orderList) {
          currentStatuses[o.order_code] = o.order_status;
          const prev = prevStatusesRef.current[o.order_code];

          if (prev && prev !== o.order_status) {
            let toastMessage = '';
            if (o.order_status === 'READY_FOR_PICKUP') {
              toastMessage = '🎉 Order is Ready for Pickup at Xerox Counter!';
            } else if (o.order_status === 'COMPLETED') {
              toastMessage = '✅ Order completed! Receipt available.';
            } else if (o.order_status === 'PRINTING') {
              toastMessage = '🖨️ Order is now Printing!';
            } else if (o.order_status === 'ACCEPTED') {
              toastMessage = '👍 Order accepted by shop!';
            } else if (o.order_status === 'REJECTED') {
              toastMessage = '❌ Payment rejected. Please check status.';
            }

            if (toastMessage) {
              setToastAlert({
                title: `Order #${o.order_code}`,
                message: toastMessage,
                code: o.order_code,
              });

              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification(`CampusXerox: #${o.order_code}`, {
                  body: toastMessage,
                  icon: '/favicon.ico',
                });
              }

              setTimeout(() => setToastAlert(null), 6000);
            }
          }
        }
        prevStatusesRef.current = currentStatuses;

        // Map notification items
        const items: NotificationItem[] = orderList.map((o: { id: string; order_code: string; order_status: string; created_at: string }) => ({
          id: o.id,
          code: o.order_code,
          title: `Order #${o.order_code}`,
          status: o.order_status,
          message:
            o.order_status === 'READY_FOR_PICKUP'
              ? '🎉 Ready for pickup at counter!'
              : o.order_status === 'COMPLETED'
              ? '✅ Order completed & receipt ready'
              : o.order_status === 'PRINTING'
              ? '🖨️ Order currently printing'
              : o.order_status === 'ACCEPTED'
              ? '👍 Order accepted by shop'
              : o.order_status === 'PAYMENT_SUBMITTED'
              ? '⌛ Payment submitted'
              : `Status: ${o.order_status}`,
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
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  useEffect(() => {
    setMenuOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  const isAdmin = userRole === 'admin';

  return (
    <>
      <nav className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-b border-surface-200 dark:border-slate-800 transition-colors">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <button
            onClick={() => router.push(isAdmin ? '/admin' : '/dashboard')}
            className="flex items-center gap-2 font-bold text-lg text-primary-600 dark:text-primary-400 hover:text-primary-700"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            CampusXerox
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

            {/* NOTIFICATION BELL */}
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

              {/* HIGH-CONTRAST DARK MODE NOTIFICATION DROPDOWN */}
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-900 border-2 border-surface-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 p-4 space-y-2.5 animate-fade-in text-surface-900 dark:text-slate-100">
                  <div className="flex items-center justify-between pb-2 border-b border-surface-100 dark:border-slate-800">
                    <span className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-slate-400">
                      Notifications ({notifications.length})
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
                            router.push(isAdmin ? `/admin/orders/${n.code}` : `/dashboard/orders/${n.code}`);
                          }}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-xs ${
                            n.status === 'READY_FOR_PICKUP'
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200'
                              : n.status === 'COMPLETED'
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                              : 'bg-surface-50 dark:bg-slate-800/80 border-surface-200 dark:border-slate-700 text-surface-800 dark:text-slate-200 hover:border-primary-400'
                          }`}
                        >
                          <div className="flex justify-between font-bold text-xs mb-1">
                            <span>{n.title}</span>
                            <span className="text-[10px] opacity-75 font-mono">{n.time}</span>
                          </div>
                          <p className="text-[11px] font-medium opacity-90 leading-snug">{n.message}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-center py-4 text-surface-400 dark:text-slate-500">No notifications yet</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop nav links */}
            <div className="hidden sm:flex items-center gap-3">
              <NavLink href="/track" active={pathname === '/track'}>
                Track Order
              </NavLink>
              {isAdmin ? (
                <>
                  <NavLink href="/admin" active={pathname === '/admin'}>
                    Orders
                  </NavLink>
                  <NavLink href="/admin/settings" active={pathname === '/admin/settings'}>
                    Settings
                  </NavLink>
                </>
              ) : (
                <>
                  <NavLink href="/dashboard" active={pathname === '/dashboard'}>
                    Home
                  </NavLink>
                  <NavLink href="/dashboard/orders" active={pathname === '/dashboard/orders'}>
                    My Orders
                  </NavLink>
                </>
              )}
              {userName && (
                <>
                  <div className="h-6 w-px bg-surface-200 dark:bg-slate-700" />
                  <span className="text-xs font-semibold text-surface-600 dark:text-slate-300">{userName}</span>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-surface-500 hover:text-danger-600 dark:hover:text-danger-400 font-medium"
                  >
                    Logout
                  </button>
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
                </>
              ) : (
                <>
                  <MobileNavLink href="/dashboard" onClick={() => router.push('/dashboard')}>
                    Home
                  </MobileNavLink>
                  <MobileNavLink href="/dashboard/orders" onClick={() => router.push('/dashboard/orders')}>
                    My Orders
                  </MobileNavLink>
                </>
              )}
              <div className="pt-2 border-t border-surface-100 dark:border-slate-800">
                <p className="text-sm text-surface-400 px-3 py-1">{userName}</p>
                <button
                  onClick={handleLogout}
                  className="w-full text-left text-sm text-danger-600 dark:text-danger-400 font-medium px-3 py-2 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* LIVE TOAST POPUP NOTIFICATION BANNER */}
      {toastAlert && (
        <div className="fixed bottom-5 right-5 z-50 animate-slide-up max-w-sm w-full bg-white dark:bg-slate-800 border-2 border-primary-500 rounded-2xl p-4 shadow-2xl flex items-start justify-between gap-3 text-surface-900 dark:text-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-primary-500/20 text-primary-600 rounded-xl flex items-center justify-center shrink-0">
              🔔
            </div>
            <div>
              <p className="font-bold text-sm">{toastAlert.title}</p>
              <p className="text-xs text-surface-600 dark:text-slate-300 mt-0.5">{toastAlert.message}</p>
              <button
                onClick={() => {
                  setToastAlert(null);
                  router.push(isAdmin ? `/admin/orders/${toastAlert.code}` : `/dashboard/orders/${toastAlert.code}`);
                }}
                className="text-xs text-primary-600 dark:text-primary-400 font-bold mt-1.5 hover:underline"
              >
                View Order Details →
              </button>
            </div>
          </div>
          <button onClick={() => setToastAlert(null)} className="text-surface-400 hover:text-surface-600 text-xs">
            ✕
          </button>
        </div>
      )}
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
