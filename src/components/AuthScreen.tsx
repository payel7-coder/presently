import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import {
  CheckCircle2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Database,
  AlertCircle,
  ClipboardCheck
} from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { loginWithEmail, registerWithEmail, isFirebaseLive } = useAttendance();

  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'teacher'>('teacher');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessNotice(null);

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please provide both email address and password.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      if (authMode === 'signin') {
        await loginWithEmail(email.trim(), password.trim());
      } else {
        if (!name.trim()) {
          setErrorMessage('Please enter your full name.');
          setIsLoading(false);
          return;
        }
        await registerWithEmail(email.trim(), password.trim(), name.trim(), role);
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-5xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Left Column on Desktop, Second on Mobile: Institutional Brand & Overview */}
        <div className="order-2 lg:order-1 lg:col-span-5 bg-slate-900 text-white p-8 sm:p-10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
                <CheckCircle2 className="w-5 h-5 stroke-[2.25]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight text-white">Presently</span>
                  <span className="text-slate-500">·</span>
                  <span className="text-xs font-medium text-emerald-400">BTEB 2022</span>
                </div>
                <p className="text-xs text-slate-400">
                  Diploma in Computer Science &amp; Technology
                </p>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Institutional Portal
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white mt-2 leading-snug">
                Attendance &amp; Academic Analytics
              </h1>
              <p className="text-sm text-slate-300 mt-2.5 leading-relaxed">
                Sign in with your faculty or administrator account to manage Theory and Practical roll calls, student rosters, and board-compliant registers.
              </p>
            </div>

            {/* Structured Capability List */}
            <div className="mt-8 divide-y divide-slate-800 border-t border-slate-800">
              <div className="py-4 flex items-start gap-3">
                <ClipboardCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-xs font-semibold text-white">Teacher Roll Call Workspace</h2>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Separate Theory and Practical roll calls, daily teaching targets, and printable BTEB PDF registers.
                  </p>
                </div>
              </div>

              <div className="py-4 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-xs font-semibold text-white">Role-Based Academic Control</h2>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Course allocation across 1st–8th semesters, CSV roster imports, and faculty-scoped reporting.
                  </p>
                </div>
              </div>

              <div className="py-4 flex items-start gap-3">
                <Database className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-xs font-semibold text-white">Live Attendance Ledger</h2>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Real-time Cloud Firestore synchronization with weekly summaries and &lt;75% eligibility alerts.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>{isFirebaseLive ? 'Cloud Firestore Sync' : 'Cloud Firestore Ready'}</span>
            <span className="font-mono text-[11px] text-slate-400">Tech Code 85</span>
          </div>
        </div>

        {/* Right Column on Desktop, First on Mobile: Sign In / Registration Form */}
        <div className="order-1 lg:order-2 lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {authMode === 'signin' ? 'Sign in to your account' : 'Register faculty account'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {authMode === 'signin'
                    ? 'Enter your institutional email and password to continue'
                    : 'Create an institutional profile for your department role'}
                </p>
              </div>

              <div className="inline-flex items-center bg-slate-100 p-1 rounded-lg self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setErrorMessage(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    authMode === 'signin'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setErrorMessage(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                    authMode === 'register'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="mt-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span className="font-medium leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {successNotice && (
              <div className="mt-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="font-medium">{successNotice}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Engr. Payel Ahmed"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full h-10 px-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Institutional Role <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label
                        className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                          role === 'teacher'
                            ? 'bg-emerald-50/60 border-emerald-600'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          checked={role === 'teacher'}
                          onChange={() => setRole('teacher')}
                          className="mt-0.5 accent-emerald-600"
                        />
                        <div>
                          <span className="text-xs font-semibold text-slate-900 block">Teacher</span>
                          <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                            Roll call &amp; assigned courses
                          </span>
                        </div>
                      </label>

                      <label
                        className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                          role === 'admin'
                            ? 'bg-indigo-50/60 border-indigo-600'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="role"
                          checked={role === 'admin'}
                          onChange={() => setRole('admin')}
                          className="mt-0.5 accent-indigo-600"
                        />
                        <div>
                          <span className="text-xs font-semibold text-slate-900 block">Administrator</span>
                          <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                            Allocations &amp; roster import
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Institutional Email Address <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. payelahmed70@gmail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-10 pl-10 pr-3.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password (min 6 characters)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-10 pl-10 pr-10 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`w-full h-10 px-5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    isLoading
                      ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  {isLoading ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <span>{authMode === 'signin' ? 'Sign In to My Interface' : 'Create Account & Enter'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
            <span>Bangladesh Technical Education Board · Probidhan 2022</span>
            <span className="text-slate-400">Authorized faculty accounts only</span>
          </div>
        </div>
      </div>
    </div>
  );
};
