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

export function isAllowedOrigin(origin, hostHeader) {
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

// Hardened Security Headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: [
        "'self'",
        ...configuredOrigins,
        'https:',
        'http://localhost:*',
        'http://127.0.0.1:*',
      ],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));

// Additional Permissions-Policy & Cache-Control security headers
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  if (req.path.includes('/admin') || req.path.includes('/auth')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  }
  next();
});

// Dynamic CORS configuration respecting same-origin host and configured origins
app.use((req, res, next) => {
  const host = req.get('host');
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin, host)) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
  })(req, res, next);
});

// Strict CSRF and Origin Check for Mutating HTTP Methods
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

// Limit body payload to prevent DoS via bloated JSON payloads
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

// Rate Limiters
export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many admin login attempts. Please wait 15 minutes before trying again.' },
});

export const participantAccessCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many access code login attempts. Please wait 10 minutes.' },
});

export const participantRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many registration requests from this network. Please wait a few minutes.' },
});

export const submissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Submission request rate limit reached. Please wait a moment.' },
});

export const proctorEventLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

// Generous on purpose for active exam polling (campus NAT sharing)
export const participantLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

export const adminApiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 400,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

// Apply granular rate limiting
app.use('/api/auth/admin/login', adminLoginLimiter);
app.use('/auth/admin/login', adminLoginLimiter);

app.use('/api/participants/login-access-code', participantAccessCodeLimiter);
app.use('/participants/login-access-code', participantAccessCodeLimiter);

app.use('/api/participants/register', participantRegisterLimiter);
app.use('/participants/register', participantRegisterLimiter);

app.use('/api/participants/proctor-event', proctorEventLimiter);
app.use('/participants/proctor-event', proctorEventLimiter);

app.use('/api/attempts', submissionLimiter);
app.use('/attempts', submissionLimiter);

app.use('/api/auth', authLimiter);
app.use('/auth', authLimiter);

app.use('/api/admin', adminApiLimiter);
app.use('/admin', adminApiLimiter);

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

// Safe centralized error handler (zero stack trace or internal SQL leak)
app.use((error, _req, res, _next) => {
  if (error?.status && error.status < 500) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error('API request error:', error?.message || 'Unknown error');
  res.status(500).json({ error: 'Unexpected server error' });
});

export default app;
