import crypto from 'node:crypto';
import { type DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AuthUserRow, PasswordResetTokenRow, UserSessionRow } from './authDb.ts';
import type { EmailSender } from './emailService.ts';
import {
  buildResetLink,
  isValidRawTokenFormat,
  RESET_TOKEN_TTL_MINUTES,
  RESET_TOKEN_TTL_MS,
  validateEmailAddress,
  validatePasswordComplexity,
  validatePasswordResetPayload,
} from '../src/utils/passwordResetLogic.ts';

function isPrimaryAdminEmail(email?: string | null): boolean {
  return Boolean(email && email.trim().toLowerCase() === 'payelahmed70@gmail.com');
}

export class HttpError extends Error {
  status: number;
  details?: string[];

  constructor(status: number, message: string, details?: string[]) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export interface SessionTokenPayload {
  sub: string;
  email: string;
  role: 'admin' | 'teacher';
  sid: string;
  tv: number;
}

export interface PublicAuthUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher';
  approvalStatus: 'approved' | 'pending' | 'rejected';
  passwordUpdatedAt: string | null;
}

export interface PasswordResetServiceOptions {
  db: DatabaseSync;
  emailSender: EmailSender;
  jwtSecret?: string;
  bcryptRounds?: number;
  sessionTtlMs?: number;
  now?: () => number;
}

const DEFAULT_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const DEFAULT_BCRYPT_ROUNDS = 12;

export const GENERIC_FORGOT_PASSWORD_MESSAGE =
  'If an account with that email exists, a password reset link has been sent.';

export function generateUrlSafeResetToken(byteLength = 32): string {
  const safeBytes = Math.max(32, byteLength);
  return crypto.randomBytes(safeBytes).toString('base64url');
}

export function hashResetTokenSha256(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function toPublicUser(row: AuthUserRow): PublicAuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    approvalStatus: row.approval_status,
    passwordUpdatedAt: row.password_updated_at,
  };
}

export class PasswordResetService {
  private readonly db: DatabaseSync;
  private readonly emailSender: EmailSender;
  private readonly jwtSecret: string;
  private readonly bcryptRounds: number;
  private readonly sessionTtlMs: number;
  private readonly nowFn: () => number;

  constructor(options: PasswordResetServiceOptions) {
    this.db = options.db;
    this.emailSender = options.emailSender;
    this.jwtSecret =
      options.jwtSecret ||
      process.env.JWT_SECRET?.trim() ||
      crypto.randomBytes(32).toString('hex');
    this.bcryptRounds = options.bcryptRounds ?? DEFAULT_BCRYPT_ROUNDS;
    this.sessionTtlMs = options.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.nowFn = options.now ?? (() => Date.now());
  }

  public ensurePrimaryAdminDirectoryStub(): void {
    const email = 'payelahmed70@gmail.com';
    const existing = this.findUserByEmail(email);
    if (existing) return;

    const nowIso = new Date(this.nowFn()).toISOString();
    this.db
      .prepare(
        `INSERT INTO auth_users (
          id, email, name, role, approval_status, password_hash, token_version, password_updated_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)`
      )
      .run(
        'admin-payel',
        email,
        'Engr. Payel Ahmed',
        'admin',
        'approved',
        null,
        nowIso,
        nowIso
      );
  }

  public findUserByEmail(email: string): AuthUserRow | undefined {
    const normalized = email.trim().toLowerCase();
    return this.db
      .prepare('SELECT * FROM auth_users WHERE email = ? LIMIT 1')
      .get(normalized) as AuthUserRow | undefined;
  }

  public findUserById(userId: string): AuthUserRow | undefined {
    return this.db
      .prepare('SELECT * FROM auth_users WHERE id = ? LIMIT 1')
      .get(userId) as AuthUserRow | undefined;
  }

  public async registerUser(input: {
    id?: string;
    email: string;
    password: string;
    name: string;
    role: 'admin' | 'teacher';
  }): Promise<{
    user: PublicAuthUser;
    requiresApproval: boolean;
    accessToken?: string;
  }> {
    const emailCheck = validateEmailAddress(input.email);
    if (!emailCheck.valid) {
      throw new HttpError(400, emailCheck.error || 'Invalid email address.');
    }

    const cleanName = typeof input.name === 'string' ? input.name.trim() : '';
    if (!cleanName || cleanName.length < 2 || cleanName.length > 120) {
      throw new HttpError(400, 'Full name must be between 2 and 120 characters.');
    }

    const complexity = validatePasswordComplexity(input.password);
    if (!complexity.valid) {
      throw new HttpError(400, complexity.errors[0], complexity.errors);
    }

    const existing = this.findUserByEmail(emailCheck.email);
    const isPrimary = isPrimaryAdminEmail(emailCheck.email);

    if (existing) {
      if (isPrimary && !existing.password_hash) {
        const passwordHash = await bcrypt.hash(input.password, this.bcryptRounds);
        const nowIso = new Date(this.nowFn()).toISOString();
        this.db
          .prepare(
            `UPDATE auth_users
             SET name = ?, password_hash = ?, password_updated_at = ?, updated_at = ?
             WHERE id = ? AND password_hash IS NULL`
          )
          .run(cleanName, passwordHash, nowIso, nowIso, existing.id);

        const updated = this.findUserById(existing.id)!;
        const { accessToken } = this.issueSessionForUser(updated);
        return {
          user: toPublicUser(updated),
          requiresApproval: false,
          accessToken,
        };
      }
      if (existing.approval_status === 'pending') {
        throw new HttpError(
          409,
          'An account with this email is already registered and awaiting administrator approval.'
        );
      }
      if (existing.approval_status === 'rejected') {
        throw new HttpError(
          403,
          'A previous registration request for this email was declined. Please contact an administrator.'
        );
      }
      throw new HttpError(
        409,
        'An account with this email already exists. Please sign in or use Forgot Password to set your password.'
      );
    }

    const resolvedRole: 'admin' | 'teacher' = isPrimary
      ? 'admin'
      : input.role === 'admin'
        ? 'admin'
        : 'teacher';
    const approvalStatus: 'approved' | 'pending' = isPrimary ? 'approved' : 'pending';
    const passwordHash = await bcrypt.hash(input.password, this.bcryptRounds);
    const nowIso = new Date(this.nowFn()).toISOString();
    const userId =
      input.id?.trim() ||
      (isPrimary ? 'admin-payel' : `usr-${crypto.randomUUID()}`);

    this.db
      .prepare(
        `INSERT INTO auth_users (
          id, email, name, role, approval_status, password_hash, token_version, password_updated_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      )
      .run(
        userId,
        emailCheck.email,
        cleanName,
        resolvedRole,
        approvalStatus,
        passwordHash,
        nowIso,
        nowIso,
        nowIso
      );

    const created = this.findUserById(userId)!;

    if (approvalStatus === 'pending') {
      return {
        user: toPublicUser(created),
        requiresApproval: true,
      };
    }

    const { accessToken } = this.issueSessionForUser(created);
    return {
      user: toPublicUser(created),
      requiresApproval: false,
      accessToken,
    };
  }

  public async loginUser(input: {
    email: string;
    password: string;
  }): Promise<{ user: PublicAuthUser; accessToken: string }> {
    const emailCheck = validateEmailAddress(input.email);
    if (!emailCheck.valid) {
      throw new HttpError(400, emailCheck.error || 'Please provide a valid email address.');
    }
    const password = typeof input.password === 'string' ? input.password : '';
    if (!password) {
      throw new HttpError(400, 'Password is required.');
    }

    const user = this.findUserByEmail(emailCheck.email);
    if (!user) {
      // Constant-time mitigation against timing-based account enumeration
      await bcrypt.compare(password, '$2b$12$C6UzMDM.H6dfI/f/IKcEeO6t3zQxK5k7g5k5wD2p0N5vL2m1xW2e.');
      throw new HttpError(401, 'Invalid email address or password.');
    }

    if (!user.password_hash) {
      await bcrypt.compare(password, '$2b$12$C6UzMDM.H6dfI/f/IKcEeO6t3zQxK5k7g5k5wD2p0N5vL2m1xW2e.');
      throw new HttpError(
        401,
        'No password has been set for this account yet. Use "Forgot Password?" to set your password via reset link.'
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      throw new HttpError(401, 'Invalid email address or password.');
    }

    if (user.approval_status === 'pending') {
      throw new HttpError(
        403,
        'Your registration is pending administrator approval. Please wait until an administrator approves your account before signing in.'
      );
    }
    if (user.approval_status === 'rejected') {
      throw new HttpError(
        403,
        'Your registration request was declined by the administrator. Please contact your department office for assistance.'
      );
    }

    const { accessToken } = this.issueSessionForUser(user);
    return {
      user: toPublicUser(user),
      accessToken,
    };
  }

  public issueSessionForUser(user: AuthUserRow): {
    sessionId: string;
    accessToken: string;
  } {
    const nowMs = this.nowFn();
    const expiresAt = nowMs + this.sessionTtlMs;
    const sessionId = crypto.randomUUID();

    this.db
      .prepare(
        `INSERT INTO user_sessions (
          id, user_id, token_version, created_at, expires_at, revoked_at
        ) VALUES (?, ?, ?, ?, ?, NULL)`
      )
      .run(sessionId, user.id, user.token_version, nowMs, expiresAt);

    const payload: SessionTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sid: sessionId,
      tv: user.token_version,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, {
      expiresIn: Math.floor(this.sessionTtlMs / 1000),
      algorithm: 'HS256',
    });

    return { sessionId, accessToken };
  }

  public verifyBearerToken(bearerToken: string): {
    user: PublicAuthUser;
    sessionId: string;
  } {
    if (!bearerToken) {
      throw new HttpError(401, 'Authentication token required.');
    }

    let decoded: SessionTokenPayload;
    try {
      decoded = jwt.verify(bearerToken, this.jwtSecret, {
        algorithms: ['HS256'],
      }) as SessionTokenPayload;
    } catch {
      throw new HttpError(401, 'Session is invalid or has expired. Please sign in again.');
    }

    if (!decoded?.sub || !decoded?.sid || typeof decoded.tv !== 'number') {
      throw new HttpError(401, 'Invalid session token.');
    }

    const user = this.findUserById(decoded.sub);
    if (!user || user.approval_status !== 'approved') {
      throw new HttpError(401, 'Account is unavailable or awaiting approval.');
    }

    if (user.token_version !== decoded.tv) {
      throw new HttpError(401, 'Session invalidated due to security update. Please sign in again.');
    }

    const session = this.db
      .prepare('SELECT * FROM user_sessions WHERE id = ? AND user_id = ? LIMIT 1')
      .get(decoded.sid, user.id) as UserSessionRow | undefined;

    if (!session || session.revoked_at !== null || session.expires_at <= this.nowFn()) {
      throw new HttpError(401, 'Session has been revoked or expired. Please sign in again.');
    }

    return {
      user: toPublicUser(user),
      sessionId: session.id,
    };
  }

  public revokeSession(sessionId: string): void {
    const nowMs = this.nowFn();
    this.db
      .prepare('UPDATE user_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
      .run(nowMs, sessionId);
  }

  public adminSyncDirectoryUser(input: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'teacher';
    approvalStatus: 'approved' | 'pending' | 'rejected';
  }): PublicAuthUser {
    const emailCheck = validateEmailAddress(input.email);
    if (!emailCheck.valid) {
      throw new HttpError(400, emailCheck.error || 'Invalid email address.');
    }
    const cleanName = input.name?.trim() || emailCheck.email.split('@')[0];
    const cleanRole: 'admin' | 'teacher' =
      isPrimaryAdminEmail(emailCheck.email) || input.role === 'admin' ? 'admin' : 'teacher';
    const cleanStatus: 'approved' | 'pending' | 'rejected' = isPrimaryAdminEmail(emailCheck.email)
      ? 'approved'
      : input.approvalStatus;

    const existing = this.findUserByEmail(emailCheck.email);
    const nowIso = new Date(this.nowFn()).toISOString();

    if (existing) {
      this.db
        .prepare(
          `UPDATE auth_users
           SET name = ?, role = ?, approval_status = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(cleanName, cleanRole, cleanStatus, nowIso, existing.id);
      if (cleanStatus !== 'approved') {
        this.db
          .prepare('UPDATE user_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
          .run(this.nowFn(), existing.id);
      }
      return toPublicUser(this.findUserById(existing.id)!);
    }

    const userId = input.id?.trim() || `usr-${crypto.randomUUID()}`;
    this.db
      .prepare(
        `INSERT INTO auth_users (
          id, email, name, role, approval_status, password_hash, token_version, password_updated_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, 1, NULL, ?, ?)`
      )
      .run(userId, emailCheck.email, cleanName, cleanRole, cleanStatus, nowIso, nowIso);

    return toPublicUser(this.findUserById(userId)!);
  }

  public async requestPasswordReset(input: {
    email: string;
    origin: string;
    requestedIp?: string | null;
  }): Promise<{ message: string }> {
    const emailCheck = validateEmailAddress(input.email);
    if (!emailCheck.valid) {
      throw new HttpError(400, emailCheck.error || 'Please provide a valid email address.');
    }

    const user = this.findUserByEmail(emailCheck.email);

    // Do not leak whether an email is registered or rejected
    if (!user || user.approval_status === 'rejected') {
      return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
    }

    const rawToken = generateUrlSafeResetToken(32);
    const tokenHash = hashResetTokenSha256(rawToken);
    const nowMs = this.nowFn();
    const expiresAt = nowMs + RESET_TOKEN_TTL_MS;
    const tokenId = crypto.randomUUID();
    const resetUrl = buildResetLink(input.origin, rawToken);

    this.db.exec('BEGIN IMMEDIATE');
    try {
      // Invalidate any previously issued unused tokens for this user
      this.db
        .prepare(
          'UPDATE password_reset_tokens SET used = 1, used_at = ? WHERE user_id = ? AND used = 0'
        )
        .run(nowMs, user.id);

      this.db
        .prepare(
          `INSERT INTO password_reset_tokens (
            id, user_id, token_hash, expires_at, used, used_at, created_at, requested_ip
          ) VALUES (?, ?, ?, ?, 0, NULL, ?, ?)`
        )
        .run(tokenId, user.id, tokenHash, expiresAt, nowMs, input.requestedIp || null);

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    await this.emailSender.sendPasswordResetEmail({
      to: user.email,
      recipientName: user.name,
      resetUrl,
      expiresInMinutes: RESET_TOKEN_TTL_MINUTES,
    });

    return { message: GENERIC_FORGOT_PASSWORD_MESSAGE };
  }

  public checkResetTokenStatus(rawToken: string): {
    valid: boolean;
    reason?: string;
    expiresAt?: number;
  } {
    if (!isValidRawTokenFormat(rawToken)) {
      return { valid: false, reason: 'Invalid password reset token format.' };
    }

    const tokenHash = hashResetTokenSha256(rawToken.trim());
    const row = this.db
      .prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ? LIMIT 1')
      .get(tokenHash) as PasswordResetTokenRow | undefined;

    if (!row) {
      return { valid: false, reason: 'Invalid or expired password reset link.' };
    }

    if (row.used === 1) {
      return {
        valid: false,
        reason: 'This password reset link has already been used. Please request a new one.',
      };
    }

    if (row.expires_at <= this.nowFn()) {
      return {
        valid: false,
        reason: 'This password reset link has expired (15-minute validity window). Please request a new one.',
      };
    }

    return { valid: true, expiresAt: row.expires_at };
  }

  public async resetPasswordWithToken(input: {
    token?: unknown;
    new_password?: unknown;
    confirm_password?: unknown;
    newPassword?: unknown;
    confirmPassword?: unknown;
  }): Promise<{ message: string }> {
    const validation = validatePasswordResetPayload(input);
    if (!validation.valid) {
      throw new HttpError(400, validation.errors[0], validation.errors);
    }

    const tokenHash = hashResetTokenSha256(validation.token);
    const tokenRow = this.db
      .prepare('SELECT * FROM password_reset_tokens WHERE token_hash = ? LIMIT 1')
      .get(tokenHash) as PasswordResetTokenRow | undefined;

    if (!tokenRow) {
      throw new HttpError(400, 'Invalid or expired password reset token.');
    }

    if (tokenRow.used === 1) {
      throw new HttpError(
        400,
        'This password reset link has already been used. Please request a new reset link.'
      );
    }

    const checkNow = this.nowFn();
    if (tokenRow.expires_at <= checkNow) {
      throw new HttpError(
        400,
        'This password reset link has expired. Please request a new reset link.'
      );
    }

    // Hash new password outside write lock
    const newPasswordHash = await bcrypt.hash(validation.newPassword, this.bcryptRounds);
    const commitNow = this.nowFn();
    const commitIso = new Date(commitNow).toISOString();

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const consumeResult = this.db
        .prepare(
          `UPDATE password_reset_tokens
           SET used = 1, used_at = ?
           WHERE id = ? AND used = 0 AND expires_at > ?`
        )
        .run(commitNow, tokenRow.id, commitNow);

      if (consumeResult.changes !== 1) {
        this.db.exec('ROLLBACK');
        throw new HttpError(
          400,
          'This password reset link is expired or has already been used.'
        );
      }

      // Invalidate any other pending tokens for safety
      this.db
        .prepare(
          `UPDATE password_reset_tokens
           SET used = 1, used_at = ?
           WHERE user_id = ? AND used = 0`
        )
        .run(commitNow, tokenRow.user_id);

      // Update user password and bump token_version to invalidate all active JWTs
      this.db
        .prepare(
          `UPDATE auth_users
           SET password_hash = ?, token_version = token_version + 1, password_updated_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(newPasswordHash, commitIso, commitIso, tokenRow.user_id);

      // Revoke all active sessions for the user
      this.db
        .prepare(
          `UPDATE user_sessions
           SET revoked_at = ?
           WHERE user_id = ? AND revoked_at IS NULL`
        )
        .run(commitNow, tokenRow.user_id);

      this.db.exec('COMMIT');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Ignore if already rolled back
      }
      throw err;
    }

    return {
      message: 'Your password has been reset successfully. All active sessions have been invalidated.',
    };
  }
}
