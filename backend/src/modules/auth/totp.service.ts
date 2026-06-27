import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { redis, REDIS_KEYS } from '../../config/redis';
import { env } from '../../config/env';

const TOTP_TEMP_TTL = 5 * 60; // 5 minutes to complete MFA setup

export class TotpService {
  /** Generate a new TOTP secret and QR code URL for setup */
  async generateSetupSecret(userId: string, userEmail: string): Promise<{
    secret: string;
    otpauthUrl: string;
    qrCodeDataUrl: string;
  }> {
    const secret = speakeasy.generateSecret({
      name: `${env.totp.appName} (${userEmail})`,
      issuer: env.totp.appName,
      length: 32,
    });

    // Store temp secret in Redis until user confirms with valid TOTP
    await redis.set(
      REDIS_KEYS.totpSecret(userId),
      secret.base32,
      TOTP_TEMP_TTL
    );

    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url!,
      qrCodeDataUrl,
    };
  }

  /** Verify a TOTP token against a known secret */
  verify(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1, // allow 30s clock drift either side
    });
  }

  /** Retrieve the temporary setup secret from Redis */
  async getTempSecret(userId: string): Promise<string | null> {
    return redis.get(REDIS_KEYS.totpSecret(userId));
  }

  /** Clear temporary setup secret after successful confirmation */
  async clearTempSecret(userId: string): Promise<void> {
    await redis.del(REDIS_KEYS.totpSecret(userId));
  }
}
