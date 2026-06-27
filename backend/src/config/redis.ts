import { createClient, RedisClientType } from 'redis';
import { env } from './env';
import { logger } from '../utils/logger';

let redisClient: RedisClientType;

export async function connectRedis(): Promise<RedisClientType> {
  redisClient = createClient({
    url: env.redis.url,
    socket: {
      tls: env.redis.url.startsWith('rediss://'),
      rejectUnauthorized: false,
      keepAlive: 10_000,      // send TCP keep-alive every 10 s so idle connections don't drop
      connectTimeout: 10_000, // fail fast if the initial connect hangs
      noDelay: true,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis: max reconnect attempts reached');
          return new Error('Redis reconnect limit exceeded');
        }
        const delay = Math.min(retries * 100, 3000);
        logger.warn(`Redis: reconnecting in ${delay}ms (attempt ${retries})`);
        return delay;
      },
    },
  }) as RedisClientType;

  redisClient.on('error', (err) => logger.error('Redis error', { error: err.message }));
  redisClient.on('connect', () => logger.info('Redis connected'));
  redisClient.on('reconnecting', () => logger.warn('Redis reconnecting'));

  await redisClient.connect();
  return redisClient;
}

export function getRedis(): RedisClientType {
  if (!redisClient) throw new Error('Redis not initialised — call connectRedis() first');
  return redisClient;
}

// ── Typed helpers ────────────────────────────────────────────

export const redis = {
  get: (key: string) => getRedis().get(key),

  set: (key: string, value: string, ttlSeconds?: number) => {
    if (ttlSeconds) return getRedis().set(key, value, { EX: ttlSeconds });
    return getRedis().set(key, value);
  },

  del: (...keys: string[]) => getRedis().del(keys),

  exists: (key: string) => getRedis().exists(key),

  expire: (key: string, seconds: number) => getRedis().expire(key, seconds),

  incr: (key: string) => getRedis().incr(key),

  /** Store JSON objects */
  setJSON: <T>(key: string, value: T, ttlSeconds?: number) =>
    redis.set(key, JSON.stringify(value), ttlSeconds),

  getJSON: async <T>(key: string): Promise<T | null> => {
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
};

// ── Key namespaces (centralised to avoid typos) ───────────────
export const REDIS_KEYS = {
  refreshToken: (tokenId: string) => `pwms:refresh:${tokenId}`,
  otpAttempts:  (userId: string)  => `pwms:otp_attempts:${userId}`,
  totpSecret:   (userId: string)  => `pwms:totp_temp:${userId}`,
  rateLimit:    (ip: string)      => `pwms:rl:${ip}`,
  sessionMeta:  (userId: string)  => `pwms:session:${userId}`,
  registerOtp:  (email: string)   => `pwms:register_otp:${email.toLowerCase()}`,
};
