import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { logger } from './utils/logger';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { accountsRouter } from './modules/accounts/accounts.routes';
import { fdRouter } from './modules/fixed-deposits/fd.routes';
import { portfolioRouter } from './modules/portfolio/portfolio.routes';
import { stocksRouter }    from './modules/stocks/stocks.routes';
import { mfRouter }        from './modules/mutual-funds/mf.routes';
import { bondsRouter }     from './modules/bonds/bonds.routes';
import { loansRouter }     from './modules/loans/loans.routes';
import { sipRouter }       from './modules/sip/sip.routes';
import { adminRouter }     from './modules/admin/admin.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

// ── Security headers ─────────────────────────────────────────
app.use(helmet());
app.set('trust proxy', 1);

// ── CORS ─────────────────────────────────────────────────────
// CORS_ORIGIN supports exact origins or wildcard subdomains (e.g. https://*.ahamsys.com)
const allowedOrigins = env.cors.origin.split(',').map(o => o.trim());

function buildOriginMatcher(pattern: string): (origin: string) => boolean {
  if (pattern.includes('*')) {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '[^.]+');
    const re = new RegExp(`^${escaped}$`);
    return (o) => re.test(o);
  }
  return (o) => o === pattern;
}

const matchers = allowedOrigins.map(buildOriginMatcher);

app.use(cors({
  origin: (origin, callback) => {
    // allow non-browser requests (curl, mobile, SSR) and same-origin
    if (!origin) return callback(null, true);
    if (matchers.some(m => m(origin))) return callback(null, true);
    logger.warn('CORS blocked', { origin });
    callback(new Error(`CORS policy does not allow origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ─────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Request logging ──────────────────────────────────────────
if (!env.isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// ── Global rate limiter ──────────────────────────────────────
app.use(rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, slow down.' },
  },
}));

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.nodeEnv, ts: new Date().toISOString() });
});

// ── API routes ───────────────────────────────────────────────
const apiRouter = express.Router();
apiRouter.use('/auth',     authRouter);
apiRouter.use('/users',    usersRouter);
apiRouter.use('/accounts',       accountsRouter);
apiRouter.use('/fixed-deposits', fdRouter);
apiRouter.use('/portfolio',      portfolioRouter);
apiRouter.use('/stocks',         stocksRouter);
apiRouter.use('/mutual-funds',   mfRouter);
apiRouter.use('/bonds',          bondsRouter);
apiRouter.use('/loans',          loansRouter);
apiRouter.use('/sip',            sipRouter);
apiRouter.use('/admin',          adminRouter);

app.use(env.apiPrefix, apiRouter);

// ── 404 & error handlers ─────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
