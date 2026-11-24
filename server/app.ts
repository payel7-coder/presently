import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { type DatabaseSync } from 'node:sqlite';
import { openAuthDatabase } from './authDb.ts';
import { createNodemailerSender, type EmailSender } from './emailService.ts';
import { HttpError, PasswordResetService, type PublicAuthUser } from './passwordResetService.ts';

export interface CreateServerAppOptions {
  db?: DatabaseSync;
  emailSender?: EmailSender;
  jwtSecret?: string;
  bcryptRounds?: number;
  disableRateLimit?: boolean;
  appOriginOverride?: string;
  now?: () => number;
}

interface AuthenticatedRequest extends Request {
  authUser?: PublicAuthUser;
  authSessionId?: string;
}

const VALID_HOST_REGEX = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/;

export function resolveSafeAppOrigin(req: Request, override?: string): string {
  if (override) {
    return new URL(override).origin;
  }

  const envOrigin = process.env.APP_URL?.trim();
  if (envOrigin && envOrigin !== 'MY_APP_URL') {
    try {
      const parsed = new URL(envOrigin);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Fall through to validated host header check
    }
  }

  const hostHeader = (req.get('host') || '').trim();
  if (hostHeader && VALID_HOST_REGEX.test(hostHeader)) {
    const protocol = req.protocol === 'https' ? 'https' : 'http';
    return `${protocol}://${hostHeader}`;
  }

  return 'http://localhost:3000';
}

export function createAuthApiApp(options: CreateServerAppOptions = {}): {
  app: Express;
  db: DatabaseSync;
  service: PasswordResetService;
} {
  const db = options.db || openAuthDatabase();
  const emailSender = options.emailSender || createNodemailerSender();
  const service = new PasswordResetService({
    db,
    emailSender,
    jwtSecret: options.jwtSecret,
    bcryptRounds: options.bcryptRounds,
    now: options.now,
  });

  service.ensurePrimaryAdminDirectoryStub();

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '100kb' }));

  // Prevent reset token leakage via Referer header & cache sensitive auth responses
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.path === '/reset-password' || req.path.startsWith('/api/auth') || req.path === '/forgot-password') {
      res.setHeader('Referrer-Policy', 'no-referrer');
    }
    next();
  });

  const noStore = (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    next();
  };

  const forgotLimiter = options.disableRateLimit
    ? (_req: Request, _res: Response, next: NextFunction) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 15,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: 'Too many password reset requests. Please try again in a few minutes.',
        },
      });

  const resetLimiter = options.disableRateLimit
    ? (_req: Request, _res: Response, next: NextFunction) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: 'Too many reset attempts. Please wait before trying again.',
        },
      });

  const authLimiter = options.disableRateLimit
    ? (_req: Request, _res: Response, next: NextFunction) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 40,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          error: 'Too many authentication attempts. Please try again shortly.',
        },
      });

  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      res.status(401).json({ error: 'Authorization Bearer token is required.' });
      return;
    }

    try {
      const verified = service.verifyBearerToken(match[1].trim());
      req.authUser = verified.user;
      req.authSessionId = verified.sessionId;
      next();
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      res.status(401).json({ error: 'Unauthorized' });
    }
  };

  const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || req.authUser.role !== 'admin') {
      res.status(403).json({ error: 'Administrator access required.' });
      return;
    }
    next();
  };

  const handleForgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const origin = resolveSafeAppOrigin(req, options.appOriginOverride);
      const result = await service.requestPasswordReset({
        email: req.body?.email,
        origin,
        requestedIp: req.ip || null,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  const handleVerifyResetToken = (req: Request, res: Response) => {
    const rawToken = typeof req.query.token === 'string' ? req.query.token : '';
    const status = service.checkResetTokenStatus(rawToken);
    if (!status.valid) {
      res.status(200).json({ valid: false, error: status.reason });
      return;
    }
    res.status(200).json({ valid: true, expiresAt: status.expiresAt });
  };

  const handleResetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await service.resetPasswordWithToken({
        token: req.body?.token,
        new_password: req.body?.new_password,
        confirm_password: req.body?.confirm_password,
        newPassword: req.body?.newPassword,
        confirmPassword: req.body?.confirmPassword,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  app.get('/api/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  // Core requested endpoints + /api/auth aliases
  app.post('/forgot-password', noStore, forgotLimiter, handleForgotPassword);
  app.post('/api/auth/forgot-password', noStore, forgotLimiter, handleForgotPassword);

  app.get('/api/auth/reset-password/verify', noStore, handleVerifyResetToken);

  app.post('/reset-password', noStore, resetLimiter, handleResetPassword);
  app.post('/api/auth/reset-password', noStore, resetLimiter, handleResetPassword);

  app.post('/api/auth/register', noStore, authLimiter, async (req, res, next) => {
    try {
      const result = await service.registerUser({
        id: req.body?.id,
        email: req.body?.email,
        password: req.body?.password,
        name: req.body?.name,
        role: req.body?.role,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.post('/api/auth/login', noStore, authLimiter, async (req, res, next) => {
    try {
      const result = await service.loginUser({
        email: req.body?.email,
        password: req.body?.password,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  });

  app.get('/api/auth/me', noStore, requireAuth, (req: AuthenticatedRequest, res) => {
    res.status(200).json({ user: req.authUser });
  });

  app.post('/api/auth/logout', noStore, requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.authSessionId) {
      service.revokeSession(req.authSessionId);
    }
    res.status(200).json({ message: 'Signed out successfully.' });
  });

  app.post(
    '/api/auth/admin/sync-users',
    noStore,
    requireAuth,
    requireAdmin,
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const usersList = Array.isArray(req.body?.users) ? req.body.users : [];
        if (usersList.length > 500) {
          throw new HttpError(400, 'Batch sync limit exceeded (max 500 users).');
        }
        const synced: PublicAuthUser[] = [];
        for (const item of usersList) {
          if (item && typeof item.email === 'string') {
            synced.push(
              service.adminSyncDirectoryUser({
                id: typeof item.id === 'string' ? item.id : '',
                email: item.email,
                name: typeof item.name === 'string' ? item.name : '',
                role: item.role === 'admin' ? 'admin' : 'teacher',
                approvalStatus:
                  item.approvalStatus === 'pending' || item.approvalStatus === 'rejected'
                    ? item.approvalStatus
                    : 'approved',
              })
            );
          }
        }
        res.status(200).json({ syncedCount: synced.length });
      } catch (err) {
        next(err);
      }
    }
  );

  // Centralized error handler — never expose stack traces
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({
        error: err.message,
        ...(err.details ? { details: err.details } : {}),
      });
      return;
    }

    console.error('Unhandled auth API error:', err);
    res.status(500).json({
      error: 'An unexpected server error occurred. Please try again.',
    });
  });

  return { app, db, service };
}
