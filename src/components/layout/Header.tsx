import React, { useState, useEffect } from 'react';
import { Bell, ChevronRight, LogOut, CheckCheck } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { RoleSwitcher } from '../common/RoleSwitcher';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import { User, UserRole } from '../../types';
import { authService } from '../../services/authService';
import { useToast } from '../common/Toast';
import { getTestSessionsStore, getReportsStore, getInstrumentsStore } from '../../mock/store';

import { isSupabaseConfigured } from '../../lib/supabase';
import { notificationService } from '../../services/notificationService';

interface HeaderProps {
  currentRole?: UserRole;
  onRoleChange?: (role: UserRole) => void;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  time: string;
  targetPath: string;
  sessionId?: string;
  reportId?: string;
  instrumentId?: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    type: 'TECHNICAL_REVIEW_PENDING',
    title: 'Technical Review Pending',
    message: 'Session TS-2026-102 requires technical audit sign-off.',
    time: '10m ago',
    targetPath: '/test-sessions/TS-2026-102?tab=review',
    sessionId: 'TS-2026-102',
    read: false,
  },
  {
    id: 'notif-2',
    type: 'CORRECTIONS_REQUIRED',
    title: 'Corrections Required',
    message: 'Reviewer requested correction on Session TS-2026-101.',
    time: '30m ago',
    targetPath: '/test-sessions/TS-2026-101?tab=weighing',
    sessionId: 'TS-2026-101',
    read: false,
  },
  {
    id: 'notif-3',
    type: 'APPROVAL_REQUIRED',
    title: 'Approval Required',
    message: 'Director sign-off needed for Session TS-2026-103.',
    time: '1h ago',
    targetPath: '/test-sessions/TS-2026-103?tab=review',
    sessionId: 'TS-2026-103',
    read: false,
  },
  {
    id: 'notif-4',
    type: 'REPORT_READY',
    title: 'Report Ready',
    message: 'Certificate REP-2026-001 has been generated.',
    time: '2h ago',
    targetPath: '/reports/REP-2026-001',
    reportId: 'REP-2026-001',
    read: false,
  },
  {
    id: 'notif-5',
    type: 'INSTRUMENT_ISSUE',
    title: 'Instrument Issue',
    message: 'Specification updated for INS-2026-001.',
    time: '3h ago',
    targetPath: '/instruments/INS-2026-001',
    instrumentId: 'INS-2026-001',
    read: false,
  },
];

export const Header: React.FC<HeaderProps> = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    isSupabaseConfigured() ? [] : INITIAL_NOTIFICATIONS
  );
  const [authUser, setAuthUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadRealNotifications = async () => {
      if (isSupabaseConfigured()) {
        const realNotifs = await notificationService.getNotificationsForCurrentUser();
        if (isMounted) {
          setNotifications(
            realNotifs.map((n) => ({
              id: n.id,
              type: n.type,
              title: n.title,
              message: n.message,
              time: n.createdAt
                ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'Just now',
              targetPath: n.targetPath,
              sessionId: n.sessionId,
              reportId: n.reportId,
              instrumentId: n.instrumentId,
              read: n.isRead,
            }))
          );
        }
      }
    };

    authService.getCurrentUser().then((user) => {
      if (isMounted && user) {
        setAuthUser(user);
        loadRealNotifications();
      }
    });

    const unsubscribe = authService.onAuthStateChange((user) => {
      if (isMounted) {
        setAuthUser(user);
        if (user) loadRealNotifications();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await authService.signOut();
    navigate('/login', { replace: true });
  };

  const handleNotificationClick = (notif: NotificationItem) => {
    // 1. Mark notification as read in database if configured
    if (isSupabaseConfigured()) {
      notificationService.markAsRead(notif.id).catch(() => {});
    }

    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );

    // 2. Close notification dropdown
    setShowNotifications(false);

    // 3. Target validation check against database / mock store
    let targetExists = true;

    if (notif.sessionId) {
      const sessions = getTestSessionsStore();
      const match = sessions.find((s) => s.id === notif.sessionId || s.session_code === notif.sessionId);
      if (!match) targetExists = false;
    }

    if (notif.reportId) {
      const reports = getReportsStore();
      const match = reports.find((r) => r.id === notif.reportId || r.reportNumber === notif.reportId);
      if (!match) targetExists = false;
    }

    if (notif.instrumentId) {
      const insts = getInstrumentsStore();
      const match = insts.find((i) => i.id === notif.instrumentId);
      if (!match) targetExists = false;
    }

    // 4. Handle invalid / missing target
    if (!targetExists) {
      showToast('Item Unavailable', 'Related item is no longer available.', 'warning');
      return;
    }

    // 5. Navigate to exact target path
    navigate(notif.targetPath);
  };

  // Generate breadcrumb path
  const pathSegments = location.pathname.split('/').filter(Boolean);

  const getBreadcrumbs = () => {
    if (pathSegments.length === 0 || pathSegments[0] === 'dashboard') {
      return [{ label: 'Dashboard', path: '/dashboard' }];
    }
    return [
      { label: 'Home', path: '/dashboard' },
      ...pathSegments.map((seg, idx) => {
        const path = '/' + pathSegments.slice(0, idx + 1).join('/');
        let label = seg.replace('-', ' ');
        label = label.charAt(0).toUpperCase() + label.slice(1);
        if (seg.startsWith('INS-') || seg.startsWith('TS-') || seg.startsWith('REP-')) {
          label = seg;
        }
        return { label, path };
      }),
    ];
  };

  const breadcrumbs = getBreadcrumbs();
  const currentPageTitle = breadcrumbs[breadcrumbs.length - 1]?.label || 'Dashboard';
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white border-b border-[#D9D3C7] shadow-xs font-sans">
      {/* Left side: Breadcrumb & Page Title */}
      <div className="flex flex-col justify-center">
        <nav className="flex items-center gap-1.5 text-xs text-[#5F6B7A] font-medium">
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.path}>
              {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
              <Link
                to={crumb.path}
                className={`hover:text-[#C8A46B] transition-colors ${
                  idx === breadcrumbs.length - 1 ? 'text-[#0B1F3A] font-bold' : ''
                }`}
              >
                {crumb.label}
              </Link>
            </React.Fragment>
          ))}
        </nav>
        <h1 className="text-lg font-bold tracking-tight text-[#0B1F3A] leading-tight">
          {currentPageTitle}
        </h1>
      </div>

      {/* Right side: Language Switcher, Read-only DB Role Badge & User Profile */}
      <div className="flex items-center gap-3">
        <LanguageSwitcher />

        {/* Read-Only DB Role Indicator */}
        <RoleSwitcher currentRole={authUser?.role || 'TESTING_OFFICER'} />

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-[#5F6B7A] hover:text-[#0B1F3A] hover:bg-[#F4ECDD]/50 transition-colors cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-[#C8A46B] ring-2 ring-white animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-88 bg-white rounded-xl shadow-2xl border border-[#D9D3C7] p-4 z-50 text-xs text-[#1A1F2B] max-h-112 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-[#D9D3C7] mb-3 font-semibold text-[#0B1F3A]">
                <div className="flex items-center gap-2">
                  <span>Laboratory Alerts</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] bg-[#F4ECDD] text-[#0B1F3A] font-bold px-2 py-0.5 rounded-full border border-[#C8A46B]/40">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isSupabaseConfigured()) {
                        notifications.forEach((n) => notificationService.markAsRead(n.id).catch(() => {}));
                      }
                      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
                    }}
                    className="text-[10px] text-[#C8A46B] hover:text-[#0B1F3A] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#5F6B7A]">
                  No new notifications.
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-3 ${
                        notif.read
                          ? 'bg-slate-50 border-slate-200 opacity-75 hover:bg-slate-100 hover:border-slate-300'
                          : 'bg-[#F9F9F7] border-[#D9D3C7] hover:bg-[#F4ECDD]/50 hover:border-[#C8A46B]/60 shadow-2xs'
                      }`}
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-[#0B1F3A] truncate">{notif.title}</span>
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-[#C8A46B] shrink-0" title="Unread Alert" />
                          )}
                        </div>
                        <p className="text-[11px] text-[#5F6B7A] leading-relaxed line-clamp-2">{notif.message}</p>
                        <span className="text-[10px] text-slate-400 font-mono block pt-0.5">{notif.time}</span>
                      </div>

                      <ChevronRight className="w-4 h-4 text-[#C8A46B] shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Badge */}
        <div className="flex items-center gap-2 pl-2 border-l border-[#D9D3C7]">
          <div className="w-8 h-8 rounded-full bg-[#0B1F3A] text-[#C8A46B] font-bold text-xs flex items-center justify-center shrink-0 border border-[#C8A46B]/40 shadow-xs">
            {(authUser?.name || 'Officer').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
          </div>
          <div className="hidden xl:flex flex-col text-left">
            <span className="text-xs font-bold text-[#0B1F3A] leading-tight">
              {authUser?.name || 'Metrology Officer'}
            </span>
            <span className="text-[10px] text-[#C8A46B] font-bold uppercase tracking-wider">
              {authUser?.role || 'TESTING_OFFICER'}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
