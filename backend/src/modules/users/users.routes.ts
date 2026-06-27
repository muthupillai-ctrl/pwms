import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { authenticate } from '../../middleware/authenticate';
import { validate } from '../../middleware/validate';
import { query, queryOne } from '../../config/db';
import { ok, notFound } from '../../utils/response';
import { AppError } from '../../middleware/errorHandler';
import bcrypt from 'bcryptjs';

const router = Router();

const updateProfileSchema = Joi.object({
  fullName: Joi.string().min(2).max(100).trim(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{9,14}$/).allow(null),
  currency: Joi.string().length(3).uppercase().default('INR'),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8).max(72)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .required(),
});

// GET /users/profile
router.get('/profile', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await queryOne(
      `SELECT id, email, full_name, phone, currency, mfa_enabled, is_active, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user!.sub]
    );
    if (!user) { notFound(res); return; }
    ok(res, user);
  } catch (err) { next(err); }
});

// PATCH /users/profile
router.patch('/profile', authenticate, validate(updateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fullName, phone, currency } = req.body;
    const user = await queryOne(
      `UPDATE users SET
         full_name  = COALESCE($1, full_name),
         phone      = COALESCE($2, phone),
         currency   = COALESCE($3, currency),
         updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, full_name, phone, currency, mfa_enabled, updated_at`,
      [fullName, phone, currency, req.user!.sub]
    );
    ok(res, user);
  } catch (err) { next(err); }
});

// POST /users/change-password
router.post('/change-password', authenticate, validate(changePasswordSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await queryOne<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.sub]
    );
    if (!user) { notFound(res); return; }

    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) throw new AppError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user!.sub]);
    ok(res, { message: 'Password changed successfully' });
  } catch (err) { next(err); }
});

export { router as usersRouter };
