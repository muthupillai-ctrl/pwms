import crypto from 'crypto';
import { redis, REDIS_KEYS } from '../../config/redis';
import { env } from '../../config/env';

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface RefreshTokenMeta {
  userId: string;
  email: string;
  tokenId: string;
  createdAt: string;
  userAgent?: string;
  ip?: string;
}

export class TokenService {
  /** Create a new refresh token, store its metadata in Redis */
  async createRefreshToken(
    userId: string,
    email: string,
    userAgent?: string,
    ip?: string
  ): Promise<string> {
    const tokenId = crypto.randomUUID();
    const token = `${tokenId}.${crypto.randomBytes(32).toString('hex')}`;

    const meta: RefreshTokenMeta = {
      userId,
      email,
      tokenId,
      createdAt: new Date().toISOString(),
      userAgent,
      ip,
    };

    await redis.setJSON(
      REDIS_KEYS.refreshToken(tokenId),
      meta,
      REFRESH_TTL_SECONDS
    );

    return token;
  }

  /** Validate a refresh token. Returns meta if valid, null if invalid/expired. */
  async validateRefreshToken(token: string): Promise<RefreshTokenMeta | null> {
    const tokenId = token.split('.')[0];
    if (!tokenId) return null;

    const meta = await redis.getJSON<RefreshTokenMeta>(
      REDIS_KEYS.refreshToken(tokenId)
    );
    return meta;
  }

  /** Rotate: delete old token, issue new one */
  async rotateRefreshToken(
    oldToken: string,
    userAgent?: string,
    ip?: string
  ): Promise<{ newRefreshToken: string; meta: RefreshTokenMeta } | null> {
    const meta = await this.validateRefreshToken(oldToken);
    if (!meta) return null;

    // Revoke old token immediately (prevents replay)
    await this.revokeRefreshToken(oldToken);

    const newRefreshToken = await this.createRefreshToken(
      meta.userId,
      meta.email,
      userAgent,
      ip
    );

    return { newRefreshToken, meta };
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const tokenId = token.split('.')[0];
    if (tokenId) await redis.del(REDIS_KEYS.refreshToken(tokenId));
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    // In a full implementation, maintain a user→tokenIds set in Redis
    // For Phase 1, we rely on short access token TTL + explicit logout
    // TODO: track tokenIds per user in a Redis set
  }
}
