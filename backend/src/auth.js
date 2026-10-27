import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'bb_session';
const PARTICIPANT_COOKIE = 'bb_participant_session';
const ADMIN_COOKIE = 'bb_admin_session';
const ONE_DAY_SECONDS = 60 * 60 * 24;

export function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must contain at least 32 characters in production');
    }
    // Development-only fallback if not configured
    return 'dev_brain_bytes_insecure_session_secret_min_32_chars!';
  }
  return value;
}

export function issueSession(res, identity) {
  const token = jwt.sign(
    { sub: String(identity.id), role: identity.role },
    secret(),
    { expiresIn: ONE_DAY_SECONDS }
  );

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ONE_DAY_SECONDS * 1000,
    path: '/',
  };

  if (identity.role === 'admin') {
    res.cookie(ADMIN_COOKIE, token, cookieOptions);
  } else {
    res.cookie(PARTICIPANT_COOKIE, token, cookieOptions);
  }
  // Generic session cookie for compatibility
  res.cookie(COOKIE_NAME, token, cookieOptions);

  return token;
}

export function clearSession(res, role) {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };

  if (!role || role === 'admin') res.clearCookie(ADMIN_COOKIE, cookieOptions);
  if (!role || role === 'participant') res.clearCookie(PARTICIPANT_COOKIE, cookieOptions);
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

export function extractAuth(req, expectedRole = null) {
  try {
    let token = null;
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    if (!token && req.cookies) {
      if (expectedRole === 'admin') {
        token = req.cookies[ADMIN_COOKIE];
      } else if (expectedRole === 'participant') {
        token = req.cookies[PARTICIPANT_COOKIE];
      } else {
        token = req.cookies[PARTICIPANT_COOKIE] || req.cookies[ADMIN_COOKIE] || req.cookies[COOKIE_NAME];
      }
    }

    if (!token) return null;

    const session = jwt.verify(token, secret());
    if (expectedRole && session.role !== expectedRole) {
      return null;
    }

    return { id: Number(session.sub), role: session.role };
  } catch {
    return null;
  }
}

export function requireAuth(role) {
  return (req, res, next) => {
    try {
      let token = null;
      const authHeader = req.headers?.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim();
      }

      if (!token && req.cookies) {
        if (role === 'admin') {
          token = req.cookies[ADMIN_COOKIE] || (req.cookies[COOKIE_NAME] && !req.cookies[PARTICIPANT_COOKIE] ? req.cookies[COOKIE_NAME] : null);
        } else if (role === 'participant') {
          token = req.cookies[PARTICIPANT_COOKIE] || (req.cookies[COOKIE_NAME] && !req.cookies[ADMIN_COOKIE] ? req.cookies[COOKIE_NAME] : null);
        } else {
          token = req.cookies[PARTICIPANT_COOKIE] || req.cookies[ADMIN_COOKIE] || req.cookies[COOKIE_NAME];
        }
      }

      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const session = jwt.verify(token, secret());
      if (role && session.role !== role) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      req.auth = { id: Number(session.sub), role: session.role };
      next();
    } catch {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }
  };
}
