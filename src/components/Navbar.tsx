import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import {
  Users,
  CheckCircle2,
  BarChart3,
  BookOpen,
  UserCheck,
  RotateCcw,
  Sparkles,
  School,
  FileSpreadsheet,
  Lock,
  LogIn,
  LogOut,
  ChevronDown,
  Database
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
  const { currentUser, users, setCurrentUser, resetToDefaultBTEBData, canImportStudents, isAdmin, isFirebaseLive, logout } =
    useAttendance();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!currentUser) return null;

  const isTeacher = currentUser.role === 'teacher';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 bg-clip-text text-transparent">
                  Presently
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                  BTEB 2022
                </span>
                <span className="hidden 2xl:inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 border border-cyan-200">
                  <Database className="w-2.5 h-2.5 text-cyan-600" />
                  Firebase Realtime
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden 2xl:block">
                Diploma in Computer Science & Technology • 1-Click Roll Call
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-0.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
            {isTeacher ? (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('my-subjects')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'my-subjects'
                      ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>My BTEB Subjects</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('take-attendance')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'take-attendance'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span>Take Attendance</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse shrink-0" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'reports'
                      ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span>Reports & Trends</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('roster')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'roster'
                      ? 'bg-white text-emerald-800 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Users className="w-4 h-4 text-slate-600 shrink-0" />
                  <span>Student Directory</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveTab('admin-assignments')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'admin-assignments'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <School className="w-4 h-4 shrink-0" />
                  <span>BTEB Subject Allocation</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('admin-classes')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'admin-classes'
                      ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <Users className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>Semester Batches & Students</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('reports')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === 'reports'
                      ? 'bg-white text-indigo-900 shadow-xs border border-slate-200/60'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-cyan-600 shrink-0" />
                  <span>Academic Reports</span>
                </button>
              </>
            )}
          </nav>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Student Import Button - STRICTLY RESTRICTED TO ADMIN */}
            {canImportStudents && (
              <button
                type="button"
                onClick={onOpenBulkImport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-2xs whitespace-nowrap"
                title="Admin Access: Bulk Import Student CSV"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Import CSV</span>
              </button>
            )}

            {/* Quick Login / Role Switch CTA */}
            <button
              type="button"
              onClick={onOpenLoginModal}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-2xs whitespace-nowrap"
              title="Sign in with Firebase Auth or switch account"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="hidden sm:inline">Switch</span>
            </button>

            {/* Sign Out Button */}
            <button
              type="button"
              onClick={async () => {
                await logout();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors shadow-2xs whitespace-nowrap"
              title="Sign out of current account"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            {/* Account Profile Badge */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all text-left shadow-2xs"
                aria-expanded={showUserDropdown}
                aria-haspopup="true"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-lg object-cover ring-2 ring-emerald-500/20"
                />
                <div className="hidden sm:block max-w-[140px]">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-800 leading-tight truncate">
                      {currentUser.name}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded shrink-0 ${
                        currentUser.role === 'admin'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {currentUser.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">
                    {currentUser.title || currentUser.department}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Active User Session
                    </p>
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {currentUser.name} ({currentUser.email})
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Permission: {isAdmin ? 'Administrator (Full Access)' : 'Teacher (Import Restricted)'}
                    </p>
                  </div>

                  <div className="p-1 space-y-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        onOpenLoginModal();
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <LogIn className="w-4 h-4 text-emerald-600" />
                      <span>Switch Account / Sign In with Firebase</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        setShowUserDropdown(false);
                        await logout();
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl text-left text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>Sign Out (End Session)</span>
                    </button>
                  </div>

                  <div className="pt-2 mt-1 border-t border-slate-100 px-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserDropdown(false);
                        setShowResetConfirm(true);
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore BTEB Probidhan 2022 Defaults
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <RotateCcw className="w-6 h-6" />
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
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetToDefaultBTEBData();
                  setShowResetConfirm(false);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
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
