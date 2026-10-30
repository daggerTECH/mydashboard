import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { config, assertConfigured } from './config.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import { WcApiError } from './services/wooClient.js';

const app = express();

// Trust the first proxy hop (nginx/Caddy in front of this on Oracle Cloud) so
// secure cookies and rate limiting see the real client IP/protocol.
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(cors({ origin: config.frontendUrl, credentials: true }));

const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please wait a moment and try again.' },
});
app.use('/api', limiter);

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth, dataRoutes);

// Central error handler — always returns JSON, never leaks stack traces.
app.use((err, req, res, next) => {
  if (err instanceof WcApiError) {
    return res.status(err.httpStatus).json({ success: false, message: err.message });
  }
  console.error(err); // eslint-disable-line no-console
  res.status(500).json({ success: false, message: 'An unexpected server error occurred.' });
});

const missing = assertConfigured();
if (missing.length) {
  console.warn('⚠️  Backend is not fully configured yet:');
  missing.forEach((m) => console.warn('   - ' + m));
  console.warn('   Copy .env.example to .env and fill in real values. The server will still start, but every WooCommerce-backed request will fail with a clear error.');
}

app.listen(config.port, () => {
  console.log(`XL Peptides dashboard API listening on port ${config.port}`);
});
