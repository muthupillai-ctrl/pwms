import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  mfaVerifySchema,
  mfaConfirmSchema,
  mfaDisableSchema,
  initiateRegisterSchema,
  verifyRegisterOtpSchema,
} from './auth.schemas';
import { env } from '../../config/env';

const router = Router();

const authLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.authMax,
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts, please try again later' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Public ──────────────────────────────────────────────────
router.post('/register/initiate', authLimiter, validate(initiateRegisterSchema), AuthController.initiateRegister);
router.post('/register/verify',   authLimiter, validate(verifyRegisterOtpSchema), AuthController.verifyRegisterOtp);
router.post('/register',          authLimiter, validate(registerSchema),          AuthController.register); // legacy
router.post('/login',             authLimiter, validate(loginSchema),             AuthController.login);
router.post('/refresh',               validate(refreshSchema),  AuthController.refresh);
router.post('/logout',                validate(logoutSchema),   AuthController.logout);

// ── MFA (pre-auth: token issued but mfaVerified=false) ───────
router.post('/mfa/verify',  authLimiter, authenticate, validate(mfaVerifySchema), AuthController.mfaVerify);

// ── Protected ────────────────────────────────────────────────
router.get('/me', authenticate, AuthController.me);

// ── MFA management (fully authenticated) ────────────────────
router.post('/mfa/setup',   authenticate, AuthController.mfaSetup);
router.post('/mfa/confirm', authenticate, validate(mfaConfirmSchema), AuthController.mfaConfirm);
router.post('/mfa/disable', authenticate, validate(mfaDisableSchema), AuthController.mfaDisable);

export { router as authRouter };
