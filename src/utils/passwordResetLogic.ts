export const RESET_TOKEN_TTL_MINUTES = 15;
export const RESET_TOKEN_TTL_MS = RESET_TOKEN_TTL_MINUTES * 60 * 1000;
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72; // Prevent silent bcrypt 72-byte truncation

export interface PasswordRuleCheck {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special' | 'maxLength';
  label: string;
  passed: boolean;
}

export interface PasswordComplexityResult {
  valid: boolean;
  checks: PasswordRuleCheck[];
  errors: string[];
  strengthScore: number; // 0-5
}

export interface ResetPayloadValidationResult {
  valid: boolean;
  token: string;
  newPassword: string;
  confirmPassword: string;
  errors: string[];
}

export function normalizeEmailInput(email: unknown): string {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

export function validateEmailAddress(email: unknown): {
  valid: boolean;
  email: string;
  error?: string;
} {
  const normalized = normalizeEmailInput(email);
  if (!normalized) {
    return { valid: false, email: '', error: 'Email address is required.' };
  }
  if (normalized.length > 254) {
    return { valid: false, email: normalized, error: 'Email address exceeds maximum length.' };
  }
  // Strict practical email regex preventing whitespace, consecutive dots, or control chars
  const emailRegex = /^[^\s@<>()[\]\\,;:"']+@[^\s@<>()[\]\\,;:"']+\.[^\s@<>()[\]\\,;:"']{2,}$/;
  if (!emailRegex.test(normalized) || normalized.includes('..')) {
    return { valid: false, email: normalized, error: 'Please enter a valid email address.' };
  }
  return { valid: true, email: normalized };
}

export function validatePasswordComplexity(password: unknown): PasswordComplexityResult {
  const value = typeof password === 'string' ? password : '';

  const hasMinLength = value.length >= MIN_PASSWORD_LENGTH;
  const withinMaxBytes = BufferOrUtf8Length(value) <= MAX_PASSWORD_LENGTH;
  const hasUppercase = /[A-Z]/.test(value);
  const hasLowercase = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(value);

  const checks: PasswordRuleCheck[] = [
    {
      id: 'length',
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      passed: hasMinLength,
    },
    {
      id: 'uppercase',
      label: 'At least 1 uppercase letter (A-Z)',
      passed: hasUppercase,
    },
    {
      id: 'lowercase',
      label: 'At least 1 lowercase letter (a-z)',
      passed: hasLowercase,
    },
    {
      id: 'number',
      label: 'At least 1 number (0-9)',
      passed: hasNumber,
    },
    {
      id: 'special',
      label: 'At least 1 special character (!@#$%^&*...)',
      passed: hasSpecial,
    },
  ];

  const errors: string[] = [];
  if (!hasMinLength) {
    errors.push(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }
  if (!withinMaxBytes) {
    errors.push(`Password must not exceed ${MAX_PASSWORD_LENGTH} bytes.`);
  }
  if (!hasUppercase) {
    errors.push('Password must include at least 1 uppercase letter.');
  }
  if (!hasLowercase) {
    errors.push('Password must include at least 1 lowercase letter.');
  }
  if (!hasNumber) {
    errors.push('Password must include at least 1 number.');
  }
  if (!hasSpecial) {
    errors.push('Password must include at least 1 special character.');
  }

  const strengthScore = checks.filter(c => c.passed).length;

  return {
    valid: errors.length === 0,
    checks,
    errors,
    strengthScore,
  };
}

function BufferOrUtf8Length(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  return str.length;
}

export function isValidRawTokenFormat(token: unknown): boolean {
  if (typeof token !== 'string') return false;
  const trimmed = token.trim();
  // Minimum 32 bytes base64url is 43 chars; also accept >=32 hex/url-safe chars up to 256
  return /^[A-Za-z0-9_-]{32,256}$/.test(trimmed);
}

export function validatePasswordResetPayload(input: {
  token?: unknown;
  new_password?: unknown;
  confirm_password?: unknown;
  newPassword?: unknown;
  confirmPassword?: unknown;
}): ResetPayloadValidationResult {
  const token = typeof input.token === 'string' ? input.token.trim() : '';
  const newPasswordRaw =
    typeof input.new_password === 'string'
      ? input.new_password
      : typeof input.newPassword === 'string'
        ? input.newPassword
        : '';
  const confirmPasswordRaw =
    typeof input.confirm_password === 'string'
      ? input.confirm_password
      : typeof input.confirmPassword === 'string'
        ? input.confirmPassword
        : '';

  const errors: string[] = [];

  if (!token) {
    errors.push('Password reset token is required.');
  } else if (!isValidRawTokenFormat(token)) {
    errors.push('Invalid password reset token format.');
  }

  const complexity = validatePasswordComplexity(newPasswordRaw);
  errors.push(...complexity.errors);

  if (!confirmPasswordRaw) {
    errors.push('Please confirm your new password.');
  } else if (newPasswordRaw !== confirmPasswordRaw) {
    errors.push('New password and confirmation password do not match.');
  }

  return {
    valid: errors.length === 0,
    token,
    newPassword: newPasswordRaw,
    confirmPassword: confirmPasswordRaw,
    errors,
  };
}

export function buildResetLink(origin: string, rawToken: string): string {
  const parsed = new URL(origin);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Invalid application origin protocol for reset link.');
  }
  const cleanOrigin = `${parsed.protocol}//${parsed.host}`;
  return `${cleanOrigin}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

export type ResetRouteMode = 'server' | 'firebase';

export function extractResetRouteFromLocation(pathname: string, search: string): {
  isResetRoute: boolean;
  token: string;
  mode: ResetRouteMode;
} {
  const params = new URLSearchParams(search);
  const queryMode = (params.get('mode') || '').trim();
  const oobCode = (params.get('oobCode') || '').trim();

  if (queryMode === 'resetPassword' && oobCode) {
    return { isResetRoute: true, token: oobCode, mode: 'firebase' };
  }

  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const isResetRoute =
    normalizedPath === '/reset-password' || normalizedPath.endsWith('/reset-password');
  if (!isResetRoute) {
    return { isResetRoute: false, token: '', mode: 'server' };
  }
  const token = (params.get('token') || '').trim();
  return { isResetRoute: true, token, mode: 'server' };
}

