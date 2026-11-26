import React, { useState, useRef, useEffect } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { Avatar } from './Avatar';
import {
  formatAttendanceTopbarContext,
  getActiveNavLabel,
  getNavItemsForRole,
  NavIconKey,
} from '../utils/navigationConfig';
import {
  Users,
  CheckCircle2,
  BarChart3,
  BookOpen,
  UserCheck,
  RotateCcw,
  School,
  FileSpreadsheet,
  LogIn,
  LogOut,
  ChevronDown,
  ClipboardList,
  Receipt,
  UserCog,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBulkImport: () => void;
  onOpenLoginModal: () => void;
  attendanceContext?: {
    subjectCode: string;
    date: string;
  } | null;
}

const NAV_ICON_MAP: Record<NavIconKey, React.ComponentType<{ className?: string }>> = {
  'book-open': BookOpen,
  'user-check': UserCheck,
  'clipboard-list': ClipboardList,
  receipt: Receipt,
  'bar-chart-3': BarChart3,
  users: Users,
  school: School,
};

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenBulkImport,
  onOpenLoginModal,
  attendanceContext,
}) => {
  const {
    currentUser,
    resetToDefaultBTEBData,
    canImportStudents,
    isAdmin,
    isRootUser,
    logout,
    pendingUsers,
  } = useAttendance();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showUserDropdown) return;
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showUserDropdown]);

  useEffect(() => {
    if (!showMobileMenu) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMobileMenu(false);
      }
    };
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setShowMobileMenu(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [showMobileMenu]);

  if (!currentUser) return null;

  const navItems = getNavItemsForRole(currentUser.role);
  const activeNavLabel = getActiveNavLabel(currentUser.role, activeTab);
  const attendanceContextLabel =
    activeTab === 'take-attendance' && attendanceContext
      ? formatAttendanceTopbarContext(attendanceContext.subjectCode, attendanceContext.date)
      : '';
  const roleBadgeLabel = isRootUser ? 'Root' : currentUser.role;
  const roleFullLabel = isRootUser
    ? 'Root User · System & Role Control'
    : isAdmin
      ? 'Administrator · Academic & Roster Control'
      : 'Faculty · Course Attendance & Reports';

  const handleMobileNavigate = (tabId: string) => {
    setShowMobileMenu(false);
    setActiveTab(tabId);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 no-print">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 lg:h-16 gap-2 sm:gap-3">
            {/* Left Zone: Brand Lockup */}
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1 lg:flex-initial">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.25]" />
              </div>
              <div className="flex items-baseline gap-1 sm:gap-1.5 min-w-0">
                <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 whitespace-nowrap shrink-0">
                  Presently
                </span>
                <span className="hidden lg:inline text-slate-300">·</span>
                {attendanceContextLabel ? (
                  <span
                    data-testid="topbar-attendance-context"
                    className="hidden lg:inline font-mono tabular-nums text-xs font-semibold text-slate-700 whitespace-nowrap"
                  >
                    {attendanceContextLabel}
                  </span>
                ) : (
                  <span className="hidden lg:inline text-xs font-medium text-slate-500 whitespace-nowrap">
                    BTEB 2022
                  </span>
                )}
                {(attendanceContextLabel || activeNavLabel) && (
                  <>
                    <span className="lg:hidden text-slate-300 shrink-0">/</span>
                    <span className="lg:hidden font-mono tabular-nums text-[11px] sm:text-xs font-semibold text-slate-700 truncate">
                      {attendanceContextLabel || activeNavLabel}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Center Zone: Desktop Primary Navigation */}
            <nav
              aria-label="Primary Navigation"
              className="hidden lg:flex items-center gap-1"
            >
              {navItems.map(item => {
                const Icon = NAV_ICON_MAP[item.icon];
                const isActive = activeTab === item.id;
                const showPendingCount =
                  isAdmin && item.id === 'admin-assignments' && pendingUsers.length > 0;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                    {showPendingCount && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold tabular-nums ${
                          isActive
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                        title={`${pendingUsers.length} registration(s) awaiting approval`}
                      >
                        {pendingUsers.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Right Zone: Utilities, Account & Mobile Menu Trigger */}
            <div className="flex items-center gap-2 shrink-0">
              {canImportStudents && (
                <button
                  type="button"
                  onClick={onOpenBulkImport}
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  title="Admin Access: Bulk Import Student CSV"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  <span>Import CSV</span>
                </button>
              )}

              {/* Account Profile Dropdown */}
              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  className="flex items-center justify-center sm:justify-start gap-2 h-9 w-9 sm:w-auto sm:pl-1.5 sm:pr-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-colors text-left shrink-0"
                  aria-label="Account menu"
                  aria-expanded={showUserDropdown}
                  aria-haspopup="true"
                >
                  <Avatar src={currentUser.avatar} name={currentUser.name} size="xs" />
                  <div className="hidden sm:flex items-center gap-1.5 max-w-[150px]">
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {currentUser.name}
                    </span>
                    <span
                      className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        isRootUser
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : currentUser.role === 'admin'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                      }`}
                    >
                      {roleBadgeLabel}
                    </span>
                  </div>
                  <ChevronDown className="hidden sm:block w-3.5 h-3.5 text-slate-400 shrink-0" />
                </button>

                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
                    <div className="px-3.5 py-2.5 border-b border-slate-100">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {currentUser.name}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {currentUser.email}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">{roleFullLabel}</p>
                    </div>

                    <div className="p-1 space-y-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          setActiveTab('user-profile');
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left text-xs font-semibold text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 transition-colors"
                      >
                        <UserCog className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>My Profile &amp; Settings</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          onOpenLoginModal();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <LogIn className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>Switch Account / Sign In</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowUserDropdown(false);
                          setShowResetConfirm(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <RotateCcw className="w-4 h-4 text-slate-500 shrink-0" />
                        <span>Restore BTEB 2022 Defaults</span>
                      </button>

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        type="button"
                        onClick={async () => {
                          setShowUserDropdown(false);
                          await logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile & Tablet Navigation Menu Trigger */}
              <button
                type="button"
                onClick={() => setShowMobileMenu(prev => !prev)}
                aria-label={showMobileMenu ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={showMobileMenu}
                aria-controls="mobile-nav-menu"
                className={`lg:hidden relative inline-flex items-center justify-center gap-1.5 h-9 px-2.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  showMobileMenu
                    ? 'bg-slate-900 border-slate-900 text-white'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                }`}
              >
                {showMobileMenu ? (
                  <X className="w-4 h-4 shrink-0" />
                ) : (
                  <Menu className="w-4 h-4 shrink-0" />
                )}
                <span>Menu</span>
                {isAdmin && pendingUsers.length > 0 && !showMobileMenu && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold tabular-nums leading-none">
                    {pendingUsers.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile & Tablet Slide-Over Navigation Menu */}
      {showMobileMenu && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex justify-end bg-slate-900/45 backdrop-blur-xs no-print"
          onClick={() => setShowMobileMenu(false)}
        >
          <aside
            id="mobile-nav-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation menu"
            onClick={e => e.stopPropagation()}
            className="w-[min(86vw,340px)] h-full bg-white shadow-2xl border-l border-slate-200 flex flex-col"
          >
            {/* Menu Header */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-md bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <CheckCircle2 className="w-4 h-4 stroke-[2.25]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 leading-none truncate">
                    Navigation
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Presently · BTEB 2022
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                aria-label="Close navigation menu"
                className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Navigation Links & Quick Actions */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
              {/* Account Identity Strip */}
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUser.name}
                    </p>
                    <span className="text-[10px] font-semibold uppercase text-slate-500 shrink-0">
                      · {roleBadgeLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                    {currentUser.email}
                  </p>
                </div>
              </div>

              {/* Workspace Routes */}
              <nav aria-label="Mobile Navigation" className="space-y-1">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Workspace
                </p>
                {navItems.map(item => {
                  const Icon = NAV_ICON_MAP[item.icon];
                  const isActive = activeTab === item.id;
                  const showPendingCount =
                    isAdmin && item.id === 'admin-assignments' && pendingUsers.length > 0;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleMobileNavigate(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full min-h-[48px] flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-800 hover:bg-slate-100 active:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-emerald-400' : 'text-slate-500'
                          }`}
                        />
                        <div className="min-w-0">
                          <span className="text-xs font-semibold block truncate">
                            {item.label}
                          </span>
                          <span
                            className={`text-[11px] block truncate ${
                              isActive ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {item.description}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {showPendingCount && (
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums ${
                              isActive
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {pendingUsers.length}
                          </span>
                        )}
                        <ChevronRight
                          className={`w-4 h-4 ${
                            isActive ? 'text-slate-400' : 'text-slate-300'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </nav>

              {/* Quick Actions & Account Settings */}
              <div className="pt-3 border-t border-slate-100 space-y-1">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Tools &amp; Account
                </p>

                {canImportStudents && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMobileMenu(false);
                      onOpenBulkImport();
                    }}
                    className="w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Import Student CSV</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-emerald-600" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleMobileNavigate('user-profile')}
                  aria-current={activeTab === 'user-profile' ? 'page' : undefined}
                  className={`w-full min-h-[44px] flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-colors ${
                    activeTab === 'user-profile'
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <UserCog
                      className={`w-4 h-4 shrink-0 ${
                        activeTab === 'user-profile' ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    />
                    <span>My Profile &amp; Settings</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    onOpenLoginModal();
                  }}
                  className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <LogIn className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Switch Account / Sign In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMobileMenu(false);
                    setShowResetConfirm(true);
                  }}
                  className="w-full min-h-[44px] flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>Restore BTEB 2022 Defaults</span>
                </button>
              </div>
            </div>

            {/* Menu Footer */}
            <div className="p-3 border-t border-slate-100 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shrink-0">
              <button
                type="button"
                onClick={async () => {
                  setShowMobileMenu(false);
                  await logout();
                }}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50/70 hover:bg-rose-100 transition-colors"
              >
                <LogOut className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl border border-slate-200">
            <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4">
              <RotateCcw className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Reset to Official BTEB 2022 Curricula?
            </h3>
            <p className="text-xs text-slate-500 mb-5 leading-relaxed">
              This will re-seed all 8 semesters of BTEB Diploma in Computer Science and Technology subjects and classes in Firebase Firestore.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetToDefaultBTEBData();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
