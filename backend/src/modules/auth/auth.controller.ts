import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { created, ok, noContent, unauthorized } from '../../utils/response';

const authService = new AuthService();

export const AuthController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, fullName, phone } = req.body;
      const result = await authService.register(email, password, fullName, phone);
      created(res, result);
    } catch (err) { next(err); }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await authService.login(
        email, password,
        req.headers['user-agent'],
        req.ip
      );
      ok(res, result);
    } catch (err) { next(err); }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshTokens(
        refreshToken,
        req.headers['user-agent'],
        req.ip
      );
      ok(res, tokens);
    } catch (err) { next(err); }
  },

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);
      noContent(res);
    } catch (err) { next(err); }
  },

  // ── MFA ─────────────────────────────────────────────────
  async mfaVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.sub;
      if (!userId) { unauthorized(res); return; }
      const tokens = await authService.verifyMfa(userId, req.body.token, req.headers['user-agent'], req.ip);
      ok(res, tokens);
    } catch (err) { next(err); }
  },

  async mfaSetup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { sub: userId, email } = req.user!;
      const setup = await authService.setupMfa(userId, email);
      ok(res, { otpauthUrl: setup.otpauthUrl, qrCodeDataUrl: setup.qrCodeDataUrl });
    } catch (err) { next(err); }
  },

  async mfaConfirm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.confirmMfaSetup(req.user!.sub, req.body.token);
      ok(res, { message: 'MFA enabled successfully' });
    } catch (err) { next(err); }
  },

  async mfaDisable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.disableMfa(req.user!.sub, req.body.password);
      ok(res, { message: 'MFA disabled successfully' });
    } catch (err) { next(err); }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ok(res, { user: req.user });
    } catch (err) { next(err); }
  },

  // ── OTP Registration ─────────────────────────────────────
  async initiateRegister(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, fullName, phone } = req.body;
      await authService.initiateRegistration(email, password, fullName, phone);
      ok(res, { message: 'OTP sent to your email address' });
    } catch (err) { next(err); }
  },

  async verifyRegisterOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyRegistrationOtp(
        email, otp,
        req.headers['user-agent'],
        req.ip
      );
      created(res, result);
    } catch (err) { next(err); }
  },

  // ── Forgot / Reset Password ─────────────────────────────
  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      await authService.initiatePasswordReset(email);
      // Always return OK — do not leak whether the email exists
      ok(res, { message: 'If that email is registered, an OTP has been sent.' });
    } catch (err) { next(err); }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, otp, newPassword } = req.body;
      await authService.resetPassword(email, otp, newPassword);
      ok(res, { message: 'Password reset successfully. You can now log in.' });
    } catch (err) { next(err); }
  },

};
