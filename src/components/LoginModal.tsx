import React, { useState } from 'react';
import { useAttendance } from '../context/AttendanceContext';
import { validatePasswordComplexity } from '../utils/passwordResetLogic';
import {
  LogIn,
  KeyRound,
  Mail,
  X,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { loginWithEmail, registerWithEmail, requestPasswordReset } = useAttendance();

  const [mode, setMode] = useState<'email-login' | 'register' | 'forgot'>('email-login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'admin' | 'teacher'>('teacher');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (mode === 'forgot') {
      setLoading(true);
      try {
        const message = await requestPasswordReset(email.trim());
        setSuccessMsg(message);
      } catch (err: any) {
        setErrorMsg(err.message || 'Unable to process password reset request');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      const check = validatePasswordComplexity(password);
      if (!check.valid) {
        setErrorMsg(check.errors[0]);
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'email-login') {
        await loginWithEmail(email.trim(), password);
        onClose();
      } else {
        const result = await registerWithEmail(email.trim(), password, name.trim(), role);
        if (result.requiresApproval) {
          setSuccessMsg(
            `Registration submitted for ${result.user.email}. An administrator must approve this account before sign-in.`
          );
          setMode('email-login');
          setPassword('');
          setName('');
        } else {
          onClose();
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 my-8">
        <div className="flex items-start justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <LogIn className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                {mode === 'forgot' ? 'Reset Password' : 'Switch Account'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                BTEB Probidhan 2022 Institutional Authentication
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex rounded-lg bg-slate-100 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => { setMode('email-login'); setErrorMsg(null); }}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              mode === 'email-login' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              mode === 'register' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => { setMode('forgot'); setErrorMsg(null); setSuccessMsg(null); }}
            className={`flex-1 py-1.5 rounded-md transition-colors ${
              mode === 'forgot' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Reset
          </button>
        </div>

        {errorMsg && (
          <div role="alert" className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div role="status" className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
            <Clock className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleEmailSubmit} className="mt-5 space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engr. Asif Mahmud"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  System Role
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-medium text-slate-900"
                >
                  <option value="teacher">Teacher (Attendance &amp; Reports)</option>
                  <option value="admin">Administrator (Full Access &amp; Student Import)</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Institutional Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                placeholder="faculty@polytechnic.bteb.gov.bd"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-9 pl-9 pr-3 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                {mode === 'email-login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setErrorMsg(null);
                      setSuccessMsg(null);
                    }}
                    className="text-[11px] font-semibold text-emerald-700 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  minLength={mode === 'register' ? 8 : 1}
                  placeholder={mode === 'register' ? 'Min 8 chars, upper, lower, digit, symbol' : 'Enter password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-9 pl-9 pr-3 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 h-9 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center"
          >
            <span>
              {loading
                ? 'Processing...'
                : mode === 'email-login'
                  ? 'Sign In'
                  : mode === 'register'
                    ? 'Submit for Admin Approval'
                    : 'Send Password Reset Link'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
