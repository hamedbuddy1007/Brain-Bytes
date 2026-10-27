import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { router } from './routes.js';

export const app = express();

const configuredOrigins = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

if (process.env.VERCEL_URL) {
  configuredOrigins.push(`https://${process.env.VERCEL_URL}`);
}
if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
  configuredOrigins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
}

function isAllowedOrigin(origin, hostHeader) {
  if (!origin) return true;
  if (configuredOrigins.includes(origin)) return true;

  try {
    const originUrl = new URL(origin);
    const originHost = originUrl.host;

    // In same-origin production deployment, origin host matches req host
    if (hostHeader && originHost.toLowerCase() === hostHeader.toLowerCase()) {
      return true;
    }

    // In local development only, allow local and LAN addresses
    if (process.env.NODE_ENV !== 'production') {
      const hostname = originUrl.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
      if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
      if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
      if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
      if (hostname.endsWith('.local')) return true;
    }
  } catch {
    return false;
  }
  return false;
}

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());

app.use(cors({
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));

app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const origin = req.get('origin');
    const host = req.get('host');
    if (origin && !isAllowedOrigin(origin, host)) {
      return res.status(403).json({ error: 'Origin not allowed' });
    }
  }
  next();
});

app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

// Generous on purpose: all participants will likely share one public IP (campus NAT).
const participantLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

app.use('/api/auth', authLimiter);
app.use('/auth', authLimiter);

app.use('/api/participants', participantLimiter);
app.use('/participants', participantLimiter);

// Mount API router on /api
app.use('/api', router);

// Fallback mount router directly for environments where /api is stripped by proxy
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  return router(req, res, next);
});

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((error, _req, res, _next) => {
  if (error?.status && error.status < 500) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error('API request error:', error?.message || 'Unknown error');
  res.status(500).json({ error: 'Unexpected server error' });
});

export default app;
