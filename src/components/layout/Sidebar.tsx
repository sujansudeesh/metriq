import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Scale,
  ClipboardList,
  FileCheck2,
  History,
  Users as UsersIcon,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authService } from '../../services/authService';
import { User } from '../../types';
import { MetriqLogo } from '../common/MetriqLogo';

export const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const [authUser, setAuthUser] = useState<User | null>(null);

  useEffect(() => {
    let isMounted = true;
    authService.getCurrentUser().then((user) => {
      if (isMounted && user) {
        setAuthUser(user);
      }
    });

    const unsubscribe = authService.onAuthStateChange((user) => {
      if (isMounted) {
        setAuthUser(user);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await authService.signOut();
    navigate('/login');
  };

  const isSystemAdmin = authUser?.role === 'ADMIN' || authUser?.role === 'Approving Officer / Lab Director';

  const primaryNavItems = [
    { label: t('nav.dashboard'), path: '/dashboard', icon: LayoutDashboard },
    { label: t('nav.instruments'), path: '/instruments', icon: Scale },
    { label: t('nav.tests'), path: '/test-sessions', icon: ClipboardList },
    { label: t('nav.reports'), path: '/reports', icon: FileCheck2 },
  ];

  const adminNavItems = [
    { label: t('nav.users'), path: '/users', icon: UsersIcon },
    { label: t('nav.audit'), path: '/audit-trail', icon: History },
    { label: t('nav.settings'), path: '/settings', icon: SettingsIcon },
  ];

  return (
    <aside
      className={`bg-[#08162A] border-r border-[#12355B] text-slate-300 flex flex-col transition-all duration-300 relative select-none font-sans ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Top Header & Brand Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[#12355B]">
        {!collapsed && (
          <MetriqLogo variant="compact" size="md" showSIHBadge={true} isLight={true} />
        )}
        {collapsed && (
          <div className="w-full flex justify-center">
            <MetriqLogo variant="mark-only" size="md" />
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#12355B] transition-colors hidden md:block cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {/* Primary Navigation Section */}
        <div className="space-y-1">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-semibold transition-all group ${
                    isActive
                      ? 'bg-[#12355B] text-[#C8A46B] font-bold border-l-4 border-[#C8A46B] shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-[#12355B]/60'
                  }`
                }
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </div>

        {/* Secondary Administration Section (Only for Admin Roles) */}
        {isSystemAdmin && (
          <div className="pt-2 border-t border-[#12355B]/80 space-y-1">
            {!collapsed && (
              <span className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-[#C8A46B]/80 block mb-1">
                ADMINISTRATION
              </span>
            )}
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all group ${
                      isActive
                        ? 'bg-[#12355B] text-[#C8A46B] font-bold border-l-4 border-[#C8A46B]'
                        : 'text-slate-400 hover:text-white hover:bg-[#12355B]/40'
                    }`
                  }
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        )}
      </nav>

      {/* Bottom User Profile Card */}
      <div className="p-3 border-t border-[#12355B] bg-[#050E1A]">
        {!collapsed ? (
          <div className="flex items-center justify-between p-2 rounded-md bg-[#0B1F3A] border border-[#12355B]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-md bg-[#12355B] border border-[#C8A46B]/40 text-[#C8A46B] font-extrabold text-xs flex items-center justify-center shrink-0">
                {(authUser?.name || 'Officer').split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-white truncate">{authUser?.name || 'Metrology Officer'}</span>
                <span className="text-[10px] text-[#C8A46B] font-mono truncate">{authUser?.role || 'TESTING_OFFICER'}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center p-2.5 text-slate-400 hover:text-rose-300 hover:bg-[#12355B] rounded-md transition-colors cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};
