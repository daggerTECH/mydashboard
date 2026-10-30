import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';

const COOKIE_NAME = 'dashboard_session';
const COOKIE_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProd, // requires HTTPS in production (set NODE_ENV=production behind your reverse proxy)
    sameSite: config.isProd ? 'none' : 'lax', // 'none' because the frontend (Vercel) and backend (Oracle Cloud) are different origins
    maxAge: COOKIE_MAX_AGE_MS,
    path: '/',
  };
}

export async function login(req, res) {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }
  if (username !== config.auth.username) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }
  const valid = await bcrypt.compare(password, config.auth.passwordHash);
  if (!valid) {
    return res.status(401).json({ success: false, message: 'Invalid credentials.' });
  }

  const token = jwt.sign({ sub: username }, config.auth.jwtSecret, { expiresIn: '12h' });
  res.cookie(COOKIE_NAME, token, cookieOptions());
  res.json({ success: true, data: { username } });
}

export function logout(req, res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: 0 });
  res.json({ success: true, data: { loggedOut: true } });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret);
    req.user = payload.sub;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' });
  }
}

export function me(req, res) {
  res.json({ success: true, data: { username: req.user } });
}
