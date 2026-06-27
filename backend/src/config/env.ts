import dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  nodeEnv: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  apiPrefix: optional('API_PREFIX', '/api/v1'),
  isProduction: process.env.NODE_ENV === 'production',

  db: {
    host:     required('DB_HOST'),
    port:     parseInt(optional('DB_PORT', '5432'), 10),
    name:     required('DB_NAME'),
    user:     required('DB_USER'),
    password: required('DB_PASSWORD'),
    ssl:      optional('DB_SSL', 'true') === 'true',
    poolMin:  parseInt(optional('DB_POOL_MIN', '2'), 10),
    poolMax:  parseInt(optional('DB_POOL_MAX', '10'), 10),
  },

  redis: {
    url: required('REDIS_URL'),
  },

  jwt: {
    secret:          required('JWT_SECRET'),
    accessExpiresIn: optional('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  refreshTokenSecret: required('REFRESH_TOKEN_SECRET'),

  totp: {
    appName: optional('TOTP_APP_NAME', 'PWMS'),
  },

  cors: {
    origin: optional('CORS_ORIGIN', 'http://localhost:4200'),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    max:      parseInt(optional('RATE_LIMIT_MAX', '100'), 10),
    authMax:  parseInt(optional('AUTH_RATE_LIMIT_MAX', '10'), 10),
  },

  log: {
    level: optional('LOG_LEVEL', 'info'),
  },

  smtp: {
    user: optional('SMTP_USER', ''),
    pass: optional('SMTP_PASS', '').replace(/\s/g, ''), // Gmail App Passwords are displayed with spaces but must be sent without
    from: optional('SMTP_FROM', 'PWMS <noreply@pwms.com>'),
  },
} as const;
