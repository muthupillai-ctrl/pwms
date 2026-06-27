import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

export type UserRole = 'owner' | 'admin' | 'loan_user';

export interface JwtPayload {
  sub: string;        // user id
  email: string;
  role: UserRole;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  iat?: number;
  exp?: number;
}

export class JwtService {
  signAccess(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, env.jwt.secret, {
      algorithm: 'HS256',
      expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
      issuer: 'pwms-api',
      audience: 'pwms-client',
    });
  }

  verifyAccess(token: string): JwtPayload | null {
    try {
      const payload = jwt.verify(token, env.jwt.secret, {
        algorithms: ['HS256'],
        issuer: 'pwms-api',
        audience: 'pwms-client',
      }) as JwtPayload;
      return payload;
    } catch (err: any) {
      logger.debug('JWT verify failed', { reason: err.message });
      return null;
    }
  }

  /** Decode without verification — for logging/debugging only */
  decode(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload;
    } catch {
      return null;
    }
  }
}
