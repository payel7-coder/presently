import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { openAuthDatabase } from './authDb';
import { EmailSender, PasswordResetEmailPayload } from './emailService';
import { createAuthApiApp } from './app';
import { GENERIC_FORGOT_PASSWORD_MESSAGE, hashResetTokenSha256 } from './passwordResetService';

interface TestHarness {
  baseUrl: string;
  sentEmails: PasswordResetEmailPayload[];
  setNow: (ms: number) => void;
  getNow: () => number;
  close: () => Promise<void>;
  db: ReturnType<typeof openAuthDatabase>;
}

async function createTestHarness(): Promise<TestHarness> {
  const db = openAuthDatabase(':memory:');
  const sentEmails: PasswordResetEmailPayload[] = [];
  let currentNow = 1_780_000_000_000;

  const emailSender: EmailSender = {
    async sendPasswordResetEmail(payload) {
      sentEmails.push(payload);
    },
  };

  const { app } = createAuthApiApp({
    db,
    emailSender,
    jwtSecret: 'test-jwt-secret-key-for-unit-tests-only-32bytes',
    bcryptRounds: 4, // Fast adaptive hashing in isolated unit tests
    disableRateLimit: true,
    appOriginOverride: 'https://portal.bteb.edu.bd',
    now: () => currentNow,
  });

  const server = http.createServer(app);
  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  return {
    baseUrl,
    sentEmails,
    setNow: (ms: number) => {
      currentNow = ms;
    },
    getNow: () => currentNow,
    db,
    close: () =>
      new Promise<void>(resolve => {
        server.close(() => {
          db.close();
          resolve();
        });
      }),
  };
}

function extractTokenFromResetUrl(resetUrl: string): string {
  const parsed = new URL(resetUrl);
  assert.equal(parsed.pathname, '/reset-password');
  return parsed.searchParams.get('token') || '';
}

describe('Password Reset System API & Security Integration', () => {
  let harness: TestHarness;

  beforeEach(async () => {
    harness = await createTestHarness();
  });

  afterEach(async () => {
    await harness.close();
  });

  it('completes full forgot -> reset -> login -> invalidation flow and hashes token + password', async () => {
    // 1. Register primary admin account with initial strong password
    const registerRes = await fetch(`${harness.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'payelahmed70@gmail.com',
        name: 'Engr. Payel Ahmed',
        password: 'OldPassword#2026!',
        role: 'admin',
      }),
    });
    assert.equal(registerRes.status, 201);
    const registerJson = (await registerRes.json()) as any;
    const oldToken = registerJson.accessToken as string;
    assert.ok(oldToken);

    // Verify active session works before reset
    const meBefore = await fetch(`${harness.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${oldToken}` },
    });
    assert.equal(meBefore.status, 200);

    // 2. Request password reset via POST /forgot-password
    const forgotRes = await fetch(`${harness.baseUrl}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'payelahmed70@gmail.com' }),
    });
    assert.equal(forgotRes.status, 200);
    const forgotJson = (await forgotRes.json()) as any;
    assert.equal(forgotJson.message, GENERIC_FORGOT_PASSWORD_MESSAGE);
    // Ensure raw token is NEVER exposed in HTTP response
    assert.equal(JSON.stringify(forgotJson).includes('token='), false);

    assert.equal(harness.sentEmails.length, 1);
    const emailPayload = harness.sentEmails[0];
    assert.equal(emailPayload.to, 'payelahmed70@gmail.com');
    assert.equal(emailPayload.expiresInMinutes, 15);
    assert.ok(emailPayload.resetUrl.startsWith('https://portal.bteb.edu.bd/reset-password?token='));

    const rawToken = extractTokenFromResetUrl(emailPayload.resetUrl);
    // >= 32 bytes base64url is at least 43 characters
    assert.ok(rawToken.length >= 43);

    // Verify stored token in DB is SHA-256 hashed, NOT plaintext, with 15-minute expiry
    const tokenRows = harness.db.prepare('SELECT * FROM password_reset_tokens').all() as any[];
    assert.equal(tokenRows.length, 1);
    assert.notEqual(tokenRows[0].token_hash, rawToken);
    assert.equal(tokenRows[0].token_hash, hashResetTokenSha256(rawToken));
    assert.equal(tokenRows[0].used, 0);
    assert.equal(tokenRows[0].expires_at - tokenRows[0].created_at, 15 * 60 * 1000);

    // 3. Reset password via POST /reset-password
    const newPassword = 'NewStrong!Password99';
    const resetRes = await fetch(`${harness.baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        new_password: newPassword,
        confirm_password: newPassword,
      }),
    });
    assert.equal(resetRes.status, 200);

    // Verify token was invalidated immediately in DB (used = 1)
    const tokenAfter = harness.db
      .prepare('SELECT used, used_at FROM password_reset_tokens WHERE id = ?')
      .get(tokenRows[0].id) as any;
    assert.equal(tokenAfter.used, 1);
    assert.ok(tokenAfter.used_at);

    // Verify stored user password is adaptively hashed with bcrypt and matches new password
    const userAfter = harness.db
      .prepare('SELECT password_hash, token_version FROM auth_users WHERE email = ?')
      .get('payelahmed70@gmail.com') as any;
    assert.ok(userAfter.password_hash.startsWith('$2'));
    assert.equal(await bcrypt.compare(newPassword, userAfter.password_hash), true);
    assert.equal(userAfter.token_version, 2);

    // 4. Verify previously active JWT/session is IMMEDIATELY invalidated (401)
    const meAfter = await fetch(`${harness.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${oldToken}` },
    });
    assert.equal(meAfter.status, 401);

    // 5. Verify old password no longer works
    const oldLoginRes = await fetch(`${harness.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'payelahmed70@gmail.com',
        password: 'OldPassword#2026!',
      }),
    });
    assert.equal(oldLoginRes.status, 401);

    // 6. Verify token CANNOT be reused
    const reuseRes = await fetch(`${harness.baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        new_password: 'Another!Password88',
        confirm_password: 'Another!Password88',
      }),
    });
    assert.equal(reuseRes.status, 400);

    // 7. Verify new password signs in and yields a fresh valid JWT
    const newLoginRes = await fetch(`${harness.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'payelahmed70@gmail.com',
        password: newPassword,
      }),
    });
    assert.equal(newLoginRes.status, 200);
    const newLoginJson = (await newLoginRes.json()) as any;
    const meNew = await fetch(`${harness.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${newLoginJson.accessToken}` },
    });
    assert.equal(meNew.status, 200);
  });

  it('prevents email enumeration on unknown addresses', async () => {
    const res = await fetch(`${harness.baseUrl}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent.user@example.com' }),
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.equal(json.message, GENERIC_FORGOT_PASSWORD_MESSAGE);
    assert.equal(harness.sentEmails.length, 0);
  });

  it('rejects expired tokens after 15 minutes', async () => {
    await fetch(`${harness.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'payelahmed70@gmail.com',
        name: 'Engr. Payel Ahmed',
        password: 'Initial#Password1',
        role: 'admin',
      }),
    });

    await fetch(`${harness.baseUrl}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'payelahmed70@gmail.com' }),
    });

    const rawToken = extractTokenFromResetUrl(harness.sentEmails[0].resetUrl);

    // Advance simulated clock by 15 minutes + 1 second
    harness.setNow(harness.getNow() + 15 * 60 * 1000 + 1000);

    const verifyRes = await fetch(
      `${harness.baseUrl}/api/auth/reset-password/verify?token=${encodeURIComponent(rawToken)}`
    );
    assert.equal(verifyRes.status, 200);
    const verifyJson = (await verifyRes.json()) as any;
    assert.equal(verifyJson.valid, false);
    assert.ok(verifyJson.error.toLowerCase().includes('expired'));

    const resetRes = await fetch(`${harness.baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        new_password: 'NewStrong!Password99',
        confirm_password: 'NewStrong!Password99',
      }),
    });
    assert.equal(resetRes.status, 400);
    const errJson = (await resetRes.json()) as any;
    assert.ok(errJson.error.toLowerCase().includes('expired'));
  });

  it('rejects weak passwords, mismatched confirmations, and forged tokens', async () => {
    await fetch(`${harness.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'payelahmed70@gmail.com',
        name: 'Engr. Payel Ahmed',
        password: 'Initial#Password1',
        role: 'admin',
      }),
    });

    await fetch(`${harness.baseUrl}/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'payelahmed70@gmail.com' }),
    });

    const rawToken = extractTokenFromResetUrl(harness.sentEmails[0].resetUrl);

    // Weak password
    const weakRes = await fetch(`${harness.baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        new_password: 'weak',
        confirm_password: 'weak',
      }),
    });
    assert.equal(weakRes.status, 400);

    // Password mismatch
    const mismatchRes = await fetch(`${harness.baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: rawToken,
        new_password: 'Valid!Password1',
        confirm_password: 'Valid!Password2',
      }),
    });
    assert.equal(mismatchRes.status, 400);

    // Forged token
    const forgedToken = crypto.randomBytes(32).toString('base64url');
    const forgedRes = await fetch(`${harness.baseUrl}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: forgedToken,
        new_password: 'Valid!Password1',
        confirm_password: 'Valid!Password1',
      }),
    });
    assert.equal(forgedRes.status, 400);
  });

  it('protects against Host Header Poisoning when resolving reset link origin', async () => {
    await fetch(`${harness.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'payelahmed70@gmail.com',
        name: 'Engr. Payel Ahmed',
        password: 'Initial#Password1',
        role: 'admin',
      }),
    });

    await fetch(`${harness.baseUrl}/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Host: 'evil-phishing.example',
        'X-Forwarded-Host': 'evil-phishing.example',
      },
      body: JSON.stringify({ email: 'payelahmed70@gmail.com' }),
    });

    assert.equal(harness.sentEmails.length, 1);
    assert.ok(harness.sentEmails[0].resetUrl.startsWith('https://portal.bteb.edu.bd/reset-password?token='));
  });
});
