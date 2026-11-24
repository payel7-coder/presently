import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../firebase/config';
import {
  mapFirebaseAuthError,
  ResetRouteMode,
  validatePasswordComplexity,
  validatePasswordResetPayload,
} from '../utils/passwordResetLogic';

const AUTH_API_BASE = (import.meta.env.VITE_AUTH_API_BASE_URL || '').replace(/\/+$/, '');
const resolveAuthApiUrl = (path: string) => `${AUTH_API_BASE}${path}`;

interface ResetPasswordViewProps {
  token: string;
  mode?: ResetRouteMode;
  onNavigateToLogin: () => void;
  onPasswordResetSuccess?: () => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({
  token,
  mode = 'server',
  onNavigateToLogin,
  onPasswordResetSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [tokenState, setTokenState] = useState<'checking' | 'valid' | 'invalid'>(
    token ? 'checking' : 'invalid'
  );
  const [tokenError, setTokenError] = useState<string | null>(
    token ? null : 'Missing password reset token. Please open the complete reset link from your email.'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVerifiedEmail(null);
    if (!token) {
      setTokenState('invalid');
      setTokenError(
        'Missing password reset token. Please request a new password reset link from Sign In.'
      );
      return;
    }

    setTokenState('checking');
    setTokenError(null);

    if (mode === 'firebase') {
      verifyPasswordResetCode(auth, token)
        .then(email => {
          if (!cancelled) {
            setVerifiedEmail(email || null);
            setTokenState('valid');
          }
        })
        .catch(err => {
          if (!cancelled) {
            setTokenState('invalid');
            setTokenError(
              mapFirebaseAuthError(
                err?.code,
                'This Firebase password reset link is invalid, expired, or has already been used.'
              )
            );
          }
        });
      return () => {
        cancelled = true;
      };
    }

    const isStaticGithubPagesWithoutApi =
      !AUTH_API_BASE &&
      typeof window !== 'undefined' &&
      window.location.hostname.endsWith('.github.io');

    if (isStaticGithubPagesWithoutApi) {
      setTokenState('invalid');
      setTokenError(
        'This server-issued password reset link requires the full-stack backend server and cannot be verified on static GitHub Pages.'
      );
      return;
    }

    fetch(resolveAuthApiUrl(`/api/auth/reset-password/verify?token=${encodeURIComponent(token)}`), {
      method: 'GET',
      cache: 'no-store',
    })
      .then(async res => {
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (!ct.includes('application/json') && [404, 405, 501].includes(res.status)) {
          if (!cancelled) {
            setTokenState('invalid');
            setTokenError(
              'Password reset backend API is not available on this static host.'
            );
          }
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data.valid) {
          setTokenState('invalid');
          setTokenError(
            data.error ||
              'This password reset link is invalid, expired, or has already been used.'
          );
          return;
        }
        setTokenState('valid');
      })
      .catch(() => {
        if (cancelled) return;
        // Fall back to allowing form submit validation if network check hiccups
        setTokenState('valid');
      });

    return () => {
      cancelled = true;
    };
  }, [token, mode]);

  const complexity = validatePasswordComplexity(newPassword);
  const passwordsMatch = Boolean(confirmPassword) && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (mode === 'firebase') {
      if (!token.trim()) {
        setSubmitError('Missing Firebase password reset code.');
        return;
      }
      if (!complexity.valid) {
        setSubmitError(complexity.errors[0] || 'Please satisfy all password requirements.');
        return;
      }
      if (!passwordsMatch) {
        setSubmitError('New password and confirmation password do not match.');
        return;
      }

      setIsSubmitting(true);
      try {
        await confirmPasswordReset(auth, token.trim(), newPassword);
        setIsSuccess(true);
        setSuccessMessage('Your password has been updated. Please sign in with your new password.');
        setNewPassword('');
        setConfirmPassword('');
        onPasswordResetSuccess?.();
      } catch (err: any) {
        setSubmitError(
          mapFirebaseAuthError(err?.code, err?.message || 'Unable to update password via Firebase Authentication.')
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const validation = validatePasswordResetPayload({
      token,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });

    if (!validation.valid) {
      setSubmitError(validation.errors[0] || 'Please satisfy all password requirements.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(resolveAuthApiUrl('/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          token: validation.token,
          new_password: validation.newPassword,
          confirm_password: validation.confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitError(
          data.error || 'Unable to reset password. The link may have expired or already been used.'
        );
        if (
          typeof data.error === 'string' &&
          (data.error.toLowerCase().includes('expired') ||
            data.error.toLowerCase().includes('already been used'))
        ) {
          setTokenState('invalid');
          setTokenError(data.error);
        }
        return;
      }

      setIsSuccess(true);
      setSuccessMessage(
        data.message ||
          'Your password has been updated and all previous sessions have been signed out.'
      );
      setNewPassword('');
      setConfirmPassword('');
      onPasswordResetSuccess?.();
    } catch {
      setSubmitError('Network error while resetting password. Please retry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Institutional Security Sidebar */}
        <div className="order-2 lg:order-1 lg:col-span-5 bg-slate-900 text-white p-8 flex flex-col justify-between">
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
                <p className="text-xs text-slate-400">Account Security &amp; Recovery</p>
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Credential Recovery
              </p>
              <h1 className="text-2xl font-bold tracking-tight text-white mt-2 leading-snug">
                Set a Strong Password
              </h1>
              <p className="text-sm text-slate-300 mt-2.5 leading-relaxed">
                {mode === 'firebase'
                  ? 'This single-use Firebase recovery link verifies your account email before updating your Firebase Authentication credentials.'
                  : 'Reset links expire automatically after 15 minutes and can only be used once. Completing this reset signs out all active sessions across devices.'}
              </p>
            </div>

            <div className="mt-8 divide-y divide-slate-800 border-t border-slate-800">
              <div className="py-3.5 flex items-start gap-3">
                <KeyRound className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-xs font-semibold text-white">Single-Use Verification</h2>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    {mode === 'firebase'
                      ? 'Your Firebase action code is validated once and invalidated immediately after reset.'
                      : 'Your recovery token is hashed in storage and invalidated immediately on update.'}
                  </p>
                </div>
              </div>
              <div className="py-3.5 flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-xs font-semibold text-white">Active Session Revocation</h2>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
                    Existing access tokens are revoked immediately so only your new password works.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>{mode === 'firebase' ? 'Firebase Auth Recovery' : 'Encrypted Recovery Flow'}</span>
            <span className="font-mono text-[11px] text-slate-400">
              {mode === 'firebase' ? 'OOB Code' : '15m TTL'}
            </span>
          </div>
        </div>

        {/* Reset Form Column */}
        <div className="order-1 lg:order-2 lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between bg-white">
          <div>
            <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Create new password
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {verifiedEmail ? (
                    <>
                      Setting a new password for{' '}
                      <span className="font-semibold text-slate-800">{verifiedEmail}</span>
                    </>
                  ) : (
                    'Choose a strong institutional password meeting all complexity rules'
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToLogin}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            </div>

            {isSuccess ? (
              <div className="mt-6 space-y-5">
                <div
                  role="status"
                  className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-emerald-950">Password Updated</p>
                    <p className="mt-1 leading-relaxed text-emerald-800">{successMessage}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="w-full h-10 px-5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Sign In with New Password</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : tokenState === 'checking' ? (
              <div className="mt-8 py-10 text-center text-sm text-slate-500">
                Verifying your password reset link...
              </div>
            ) : tokenState === 'invalid' ? (
              <div className="mt-6 space-y-5">
                <div
                  role="alert"
                  className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-3"
                >
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-rose-900">
                      Reset Link Unavailable
                    </p>
                    <p className="mt-1 leading-relaxed">{tokenError}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onNavigateToLogin}
                  className="w-full h-10 px-5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Return to Sign In</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {submitError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2.5"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span className="font-medium leading-relaxed">{submitError}</span>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="reset-new-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reset-new-password"
                      name="new_password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Enter strong new password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full h-10 pl-10 pr-10 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                      aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Live Password Complexity Checklist */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Password Requirements
                    </span>
                    <span className="font-mono text-[11px] font-medium text-slate-500 tabular-nums">
                      {complexity.strengthScore}/5 met
                    </span>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {complexity.checks.map(check => (
                      <li
                        key={check.id}
                        className={`flex items-center gap-1.5 text-xs ${
                          check.id === 'special' ? 'sm:col-span-2' : ''
                        } ${
                          check.passed ? 'text-emerald-700 font-medium' : 'text-slate-500'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            check.passed ? 'text-emerald-600' : 'text-slate-300'
                          }`}
                        />
                        <span>{check.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    Confirm New Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reset-confirm-password"
                      name="confirm_password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full h-10 pl-10 pr-10 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:border-emerald-600 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md"
                      aria-label={
                        showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-rose-600 mt-1.5 font-medium">
                      Passwords do not match yet.
                    </p>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting || !complexity.valid || !passwordsMatch}
                    className={`w-full h-10 px-5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                      isSubmitting || !complexity.valid || !passwordsMatch
                        ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    <span>{isSubmitting ? 'Updating password...' : 'Reset Password'}</span>
                    {!isSubmitting && <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </form>
            )}
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
