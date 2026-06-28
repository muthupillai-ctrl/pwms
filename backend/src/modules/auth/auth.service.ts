import bcrypt from 'bcryptjs';
import { query, queryOne } from '../../config/db';
import { JwtService, UserRole } from './jwt.service';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';
import { AppError } from '../../middleware/errorHandler';
import { logger } from '../../utils/logger';
import { redis, REDIS_KEYS } from '../../config/redis';
import { sendOtpEmail, sendPasswordResetEmail } from './email.service';

const BCRYPT_ROUNDS = 12;
const OTP_TTL_SECONDS = 600; // 10 minutes
const MAX_OTP_ATTEMPTS = 3;

interface RegisterOtpPayload {
  fullName: string;
  passwordHash: string;
  phone: string | null;
  otp: string;
  attempts: number;
}

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  mfa_enabled: boolean;
  mfa_secret: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export class AuthService {
  private jwt = new JwtService();
  private tokens = new TokenService();
  private totp = new TotpService();

  // ── Register ─────────────────────────────────────────────
  async register(
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ): Promise<{ user: Omit<UserRow, 'password_hash' | 'mfa_secret'>; tokens: AuthTokens }> {
    const existing = await queryOne<UserRow>(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );
    if (existing) throw new AppError(409, 'CONFLICT', 'Email already registered');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [user] = await query<UserRow>(
      `INSERT INTO users (email, full_name, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, phone, mfa_enabled, is_active, created_at, updated_at`,
      [email.toLowerCase(), fullName, phone ?? null, passwordHash]
    );

    logger.info('User registered', { userId: user.id, email: user.email });
    const tokens = await this.issueTokens(user, undefined, undefined, true);
    const { password_hash, mfa_secret, ...safeUser } = user;
    return { user: safeUser as Omit<UserRow, 'password_hash' | 'mfa_secret'>, tokens };
  }

  // ── Login ────────────────────────────────────────────────
  async login(
    email: string,
    password: string,
    userAgent?: string,
    ip?: string
  ): Promise<{ user: Omit<UserRow, 'password_hash' | 'mfa_secret'>; tokens: AuthTokens; mfaRequired: boolean }> {
    const user = await queryOne<UserRow>(
      `SELECT id, email, full_name, phone, password_hash, role, mfa_enabled, mfa_secret,
              is_active, created_at, updated_at
       FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (!user) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    if (!user.is_active) throw new AppError(403, 'ACCOUNT_DISABLED', 'Account is disabled');

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

    // If MFA is enabled, issue a short-lived pre-MFA token; client must call /auth/mfa/verify next
    if (user.mfa_enabled) {
      const preToken = this.jwt.signAccess({
        sub: user.id,
        email: user.email,
        role: user.role ?? 'owner',
        mfaEnabled: true,
        mfaVerified: false,
      });
      logger.info('Login: MFA required', { userId: user.id });
      return {
        user,
        tokens: { accessToken: preToken, refreshToken: '', expiresIn: '5m' },
        mfaRequired: true,
      };
    }

    const tokens = await this.issueTokens(user, userAgent, ip, true);
    logger.info('Login: success', { userId: user.id });
    const { password_hash, mfa_secret, ...safeUser } = user;
    return { user: safeUser as Omit<UserRow, 'password_hash' | 'mfa_secret'>, tokens, mfaRequired: false };
  }

  // ── MFA Verify ───────────────────────────────────────────
  async verifyMfa(
    userId: string,
    totpToken: string,
    userAgent?: string,
    ip?: string
  ): Promise<AuthTokens> {
    const user = await queryOne<UserRow>(
      'SELECT id, email, mfa_enabled, mfa_secret, is_active FROM users WHERE id = $1',
      [userId]
    );
    if (!user || !user.mfa_enabled || !user.mfa_secret) {
      throw new AppError(400, 'MFA_NOT_ENABLED', 'MFA is not enabled for this account');
    }

    const valid = this.totp.verify(totpToken, user.mfa_secret);
    if (!valid) throw new AppError(401, 'INVALID_TOTP', 'Invalid or expired MFA code');

    return this.issueTokens(user, userAgent, ip, true);
  }

  // ── Refresh Token ────────────────────────────────────────
  async refreshTokens(
    oldRefreshToken: string,
    userAgent?: string,
    ip?: string
  ): Promise<AuthTokens> {
    const result = await this.tokens.rotateRefreshToken(oldRefreshToken, userAgent, ip);
    if (!result) throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');

    const user = await queryOne<UserRow>(
      'SELECT id, email, role, mfa_enabled, is_active FROM users WHERE id = $1',
      [result.meta.userId]
    );
    if (!user || !user.is_active) throw new AppError(401, 'ACCOUNT_DISABLED', 'Account not found or disabled');

    const accessToken = this.jwt.signAccess({
      sub: user.id,
      email: user.email,
      role: user.role ?? 'owner',
      mfaEnabled: user.mfa_enabled,
      mfaVerified: true,
    });

    return { accessToken, refreshToken: result.newRefreshToken, expiresIn: '15m' };
  }

  // ── Logout ───────────────────────────────────────────────
  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revokeRefreshToken(refreshToken);
    logger.info('User logged out');
  }

  // ── MFA Setup ────────────────────────────────────────────
  async setupMfa(userId: string, userEmail: string) {
    return this.totp.generateSetupSecret(userId, userEmail);
  }

  async confirmMfaSetup(userId: string, totpToken: string): Promise<void> {
    const tempSecret = await this.totp.getTempSecret(userId);
    if (!tempSecret) {
      throw new AppError(400, 'MFA_SETUP_EXPIRED', 'MFA setup session expired. Please start again.');
    }

    const valid = this.totp.verify(totpToken, tempSecret);
    if (!valid) throw new AppError(401, 'INVALID_TOTP', 'Invalid MFA code. Please try again.');

    await query(
      'UPDATE users SET mfa_enabled = TRUE, mfa_secret = $1, updated_at = NOW() WHERE id = $2',
      [tempSecret, userId]
    );
    await this.totp.clearTempSecret(userId);
    logger.info('MFA enabled', { userId });
  }

  async disableMfa(userId: string, password: string): Promise<void> {
    const user = await queryOne<UserRow>(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [userId]
    );
    if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) throw new AppError(401, 'INVALID_CREDENTIALS', 'Incorrect password');

    await query(
      'UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL, updated_at = NOW() WHERE id = $1',
      [userId]
    );
    logger.info('MFA disabled', { userId });
  }

  // ── Registration OTP ─────────────────────────────────────
  async initiateRegistration(
    email: string,
    password: string,
    fullName: string,
    phone?: string
  ): Promise<void> {
    const normalised = email.toLowerCase();

    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [normalised]
    );
    if (existing) throw new AppError(409, 'CONFLICT', 'Email already registered');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    logger.debug('initiateRegistration: OTP generated', { email: normalised, otp });

    const payload: RegisterOtpPayload = {
      fullName,
      passwordHash,
      phone: phone ?? null,
      otp,
      attempts: 0,
    };

    logger.debug('initiateRegistration: storing OTP in Redis', { key: REDIS_KEYS.registerOtp(normalised), ttl: OTP_TTL_SECONDS });
    await redis.setJSON(REDIS_KEYS.registerOtp(normalised), payload, OTP_TTL_SECONDS);
    logger.debug('initiateRegistration: Redis write done, calling sendOtpEmail');
    await sendOtpEmail(normalised, otp, fullName);
    logger.info('Registration OTP sent', { email: normalised });
  }

  async verifyRegistrationOtp(
    email: string,
    otp: string,
    userAgent?: string,
    ip?: string
  ): Promise<{ user: Omit<UserRow, 'password_hash' | 'mfa_secret'>; tokens: AuthTokens }> {
    const normalised = email.toLowerCase();
    const key = REDIS_KEYS.registerOtp(normalised);

    const payload = await redis.getJSON<RegisterOtpPayload>(key);
    if (!payload) throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired. Please register again.');

    payload.attempts += 1;
    if (payload.otp !== otp) {
      if (payload.attempts >= MAX_OTP_ATTEMPTS) {
        await redis.del(key);
        throw new AppError(400, 'OTP_INVALID', 'Too many wrong attempts. Please register again.');
      }
      await redis.setJSON(key, payload, OTP_TTL_SECONDS);
      throw new AppError(400, 'OTP_INVALID', `Invalid OTP. ${MAX_OTP_ATTEMPTS - payload.attempts} attempt(s) remaining.`);
    }

    // OTP correct — create user
    const [user] = await query<UserRow>(
      `INSERT INTO users (email, full_name, phone, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, phone, role, mfa_enabled, is_active, created_at, updated_at`,
      [normalised, payload.fullName, payload.phone, payload.passwordHash]
    );

    await redis.del(key);
    logger.info('User registered via OTP', { userId: user.id, email: normalised });

    const tokens = await this.issueTokens(user, userAgent, ip, true);
    return { user, tokens };
  }

  // ── Forgot / Reset Password ──────────────────────────────
  async initiatePasswordReset(email: string): Promise<void> {
    const normalised = email.toLowerCase();

    const user = await queryOne<{ id: string; full_name: string }>(
      'SELECT id, full_name FROM users WHERE email = $1 AND is_active = TRUE',
      [normalised]
    );

    // Always resolve OK — do not reveal whether the email exists
    if (!user) {
      logger.info('Password reset requested for unknown/inactive email', { email: normalised });
      return;
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    logger.debug('initiatePasswordReset: OTP generated', { email: normalised, otp });

    const payload = { otp, attempts: 0, fullName: user.full_name };
    await redis.setJSON(REDIS_KEYS.passwordReset(normalised), payload, OTP_TTL_SECONDS);
    await sendPasswordResetEmail(normalised, otp, user.full_name);
    logger.info('Password reset OTP sent', { email: normalised });
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<void> {
    const normalised = email.toLowerCase();
    const key = REDIS_KEYS.passwordReset(normalised);

    logger.debug('resetPassword: start', { email: normalised, key });

    const payload = await redis.getJSON<{ otp: string; attempts: number; fullName: string }>(key);
    logger.debug('resetPassword: Redis payload', { found: !!payload, attempts: payload?.attempts });
    if (!payload) throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired. Please request a new one.');

    logger.debug('resetPassword: OTP check', {
      receivedOtp: otp,
      storedOtp: payload.otp,
      match: payload.otp === otp,
    });

    payload.attempts += 1;
    if (payload.otp !== otp) {
      if (payload.attempts >= MAX_OTP_ATTEMPTS) {
        await redis.del(key);
        throw new AppError(400, 'OTP_INVALID', 'Too many wrong attempts. Please request a new OTP.');
      }
      await redis.setJSON(key, payload, OTP_TTL_SECONDS);
      throw new AppError(400, 'OTP_INVALID', `Invalid OTP. ${MAX_OTP_ATTEMPTS - payload.attempts} attempt(s) remaining.`);
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    logger.debug('resetPassword: hashed new password', { hashPrefix: passwordHash.substring(0, 10) });

    const updated = await query<{ id: string; email: string }>(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING id, email',
      [passwordHash, normalised]
    );

    logger.debug('resetPassword: DB update result', { rowsUpdated: updated.length, updatedEmail: updated[0]?.email });

    if (updated.length === 0) {
      logger.error('resetPassword: UPDATE affected 0 rows — email not found in DB', { normalised });
      throw new AppError(404, 'NOT_FOUND', 'User not found.');
    }

    await redis.del(key);
    logger.info('Password reset successful', { email: normalised, userId: updated[0].id });
  }

  // ── Private ──────────────────────────────────────────────
  private async issueTokens(
    user: Pick<UserRow, 'id' | 'email' | 'role' | 'mfa_enabled'>,
    userAgent?: string,
    ip?: string,
    mfaVerified = false
  ): Promise<AuthTokens> {
    const accessToken = this.jwt.signAccess({
      sub: user.id,
      email: user.email,
      role: user.role ?? 'owner',
      mfaEnabled: user.mfa_enabled,
      mfaVerified,
    });
    const refreshToken = await this.tokens.createRefreshToken(user.id, user.email, userAgent, ip);
    return { accessToken, refreshToken, expiresIn: '15m' };
  }
}
