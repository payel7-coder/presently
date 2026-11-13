import React, { useState, useRef, useEffect } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { Avatar } from './Avatar';
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
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBulkImport: () => void;
  onOpenLoginModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenBulkImport,
  onOpenLoginModal,
}) => {
  const { currentUser, resetToDefaultBTEBData, canImportStudents, isAdmin, logout } =
    useAttendance();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
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

  if (!currentUser) return null;

  const isTeacher = currentUser.role === 'teacher';

  const navItems = isTeacher
    ? [
        { id: 'my-subjects', label: 'My BTEB Subjects', icon: BookOpen },
        { id: 'take-attendance', label: 'Take Attendance', icon: UserCheck },
        { id: 'reports', label: 'Reports & Trends', icon: BarChart3 },
        { id: 'roster', label: 'Student Directory', icon: Users },
      ]
    : [
        { id: 'admin-assignments', label: 'BTEB Subject Allocation', icon: School },
        { id: 'admin-classes', label: 'Semester Batches & Students', icon: Users },
        { id: 'reports', label: 'Academic Reports', icon: BarChart3 },
      ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Left Zone: Brand Lockup */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
              <CheckCircle2 className="w-5 h-5 stroke-[2.25]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900">
                Presently
              </span>
              <span className="hidden sm:inline text-slate-300">·</span>
              <span className="hidden sm:inline text-xs font-medium text-slate-500">
                BTEB 2022
              </span>
            </div>
          </div>

          {/* Center Zone: Primary Navigation */}
          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-1"
          >
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
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
                </button>
              );
            })}
          </nav>

          {/* Right Zone: Utilities & Account */}
          <div className="flex items-center gap-2 shrink-0">
            {canImportStudents && (
              <button
                type="button"
                onClick={onOpenBulkImport}
                className="flex items-center gap-1.5 h-9 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
                title="Admin Access: Bulk Import Student CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Import CSV</span>
                <span className="sm:hidden">Import</span>
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                await logout();
              }}
              className="hidden lg:flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 hover:border-rose-200 bg-white border border-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              title="Sign out of current account"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign Out</span>
            </button>

            {/* Account Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 h-9 pl-1.5 pr-2.5 rounded-lg border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-colors text-left"
                aria-expanded={showUserDropdown}
                aria-haspopup="true"
              >
                <Avatar src={currentUser.avatar} name={currentUser.name} size="xs" />
                <div className="hidden sm:flex items-center gap-1.5 max-w-[160px]">
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {currentUser.name}
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                      currentUser.role === 'admin'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                    }`}
                  >
                    {currentUser.role}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isAdmin ? 'Administrator · Full System Access' : 'Faculty · Course Attendance & Reports'}
                    </p>
                  </div>

                  <div className="p-1 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenLoginModal();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <LogIn className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Switch Account / Sign In</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowResetConfirm(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>Restore BTEB 2022 Defaults</span>
                    </button>

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      onClick={async () => {
                        setShowUserDropdown(false);
                        await logout();
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive Mobile Navigation Strip */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden border-t border-slate-100 bg-slate-50/70 px-4 py-2 flex items-center gap-1.5 overflow-x-auto"
      >
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                isActive
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
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
    </header>
  );
};
