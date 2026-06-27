import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../modules/auth/jwt.service';
import { unauthorized } from '../utils/response';
import { logger } from '../utils/logger';

const jwtService = new JwtService();

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    unauthorized(res, 'Missing or malformed Authorization header');
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = jwtService.verifyAccess(token);

  if (!payload) {
    unauthorized(res, 'Invalid or expired access token');
    return;
  }

  req.user = payload;
  logger.debug('Authenticated', { userId: payload.sub, path: req.path });
  next();
}

export async function requireMfa(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    unauthorized(res);
    return;
  }
  if (req.user.mfaVerified === false) {
    res.status(403).json({
      success: false,
      error: { code: 'MFA_REQUIRED', message: 'MFA verification required' },
    });
    return;
  }
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) { unauthorized(res); return; }
  if (req.user.role !== 'admin') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' },
    });
    return;
  }
  next();
}

export async function requireOwner(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) { unauthorized(res); return; }
  if (req.user.role !== 'owner') {
    res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'This action requires owner access' },
    });
    return;
  }
  next();
}
