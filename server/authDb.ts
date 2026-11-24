import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface AuthUserRow {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'teacher';
  approval_status: 'approved' | 'pending' | 'rejected';
  password_hash: string | null;
  token_version: number;
  password_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: number;
  used: number;
  used_at: number | null;
  created_at: number;
  requested_ip: string | null;
}

export interface UserSessionRow {
  id: string;
  user_id: string;
  token_version: number;
  created_at: number;
  expires_at: number;
  revoked_at: number | null;
}

export function openAuthDatabase(dbPath?: string): DatabaseSync {
  const resolvedPath =
    dbPath ||
    process.env.AUTH_DB_PATH ||
    path.resolve(process.cwd(), 'data', 'auth.sqlite');

  if (resolvedPath !== ':memory:') {
    const dir = path.dirname(resolvedPath);
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseSync(resolvedPath);

  if (resolvedPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }
  db.exec('PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'teacher')),
      approval_status TEXT NOT NULL CHECK (approval_status IN ('approved', 'pending', 'rejected')),
      password_hash TEXT,
      token_version INTEGER NOT NULL DEFAULT 1,
      password_updated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      used_at INTEGER,
      created_at INTEGER NOT NULL,
      requested_ip TEXT,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON password_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
  `);

  return db;
}
