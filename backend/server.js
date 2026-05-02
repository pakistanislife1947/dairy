require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const passport  = require('passport');
const fs        = require('fs');

require('./src/config/passport');

['tmp', 'logs'].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const app = express();

// ── Trust proxy (Railway sits behind a load balancer) ──────────────────
app.set('trust proxy', 1);

// ── Security headers ───────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS ───────────────────────────────────────────────────────────────
// Reads from ALLOWED_ORIGINS first, falls back to CLIENT_URL, then localhost.
// Set in Railway Variables as a comma-separated list:
//   ALLOWED_ORIGINS=https://dairy-sand.vercel.app,https://your-other-domain.com
//
// If you only have one domain you can also just set CLIENT_URL — both work.

const rawOrigins = process.env.ALLOWED_ORIGINS
  || process.env.CLIENT_URL
  || 'http://localhost:5173';

const allowedOrigins = rawOrigins
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

console.log('✅ CORS allowed origins:');
allowedOrigins.forEach(o => console.log(`   • ${o}`));

// Build the CORS options object once — reused for both middleware and preflight
const corsOptions = {
  origin(origin, callback) {
    // Allow requests with no Origin header (server-to-server, curl, mobile apps)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log the blocked origin so you can add it quickly
    console.warn(`⛔ CORS blocked: ${origin}`);
    console.warn(`   To allow it, add it to the ALLOWED_ORIGINS Railway variable.`);

    // Return 403 with JSON — NOT a thrown Error (thrown Error becomes 500 with no CORS headers)
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200, // Some browsers (IE11) choke on 204
};

// Apply CORS to all routes
app.use(cors(corsOptions));

// Explicitly handle OPTIONS preflight for every route.
// Without this, preflight requests to /api/auth/login never reach the route
// and return 404 with no CORS headers — browser shows "CORS error".
app.options('*', cors(corsOptions));

// ── Rate limiting ──────────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '300'),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20'),
  message:  { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

app.use('/api/', generalLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Body parsing ───────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── HTTP logging ───────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Passport (Google OAuth) ────────────────────────────────────────────
app.use(passport.initialize());

// ── API routes ─────────────────────────────────────────────────────────
app.use('/api/auth',      require('./src/routes/auth'));
app.use('/api/farmers',   require('./src/routes/farmers'));
app.use('/api/milk',      require('./src/routes/milk'));
app.use('/api/billing',   require('./src/routes/billing'));
app.use('/api/sales',     require('./src/routes/sales'));
app.use('/api/vehicles',  require('./src/routes/vehicles'));
app.use('/api/shops',     require('./src/routes/shops'));
app.use('/api/hr',        require('./src/routes/hr'));
app.use('/api/expenses',  require('./src/routes/expenses'));
app.use('/api/reports',   require('./src/routes/reports'));
app.use('/api/audit',     require('./src/routes/audit'));
app.use('/api/dashboard', require('./src/routes/dashboard'));

const settingsRoutes = require('./src/routes/settings');
// ... your existing routes ...
app.use('/api/settings', settingsRoutes);
app.use('/api/customers', require('./src/routes/customers'));
app.use('/api/products',  require('./src/routes/products'));

// ── Health check ───────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    success:  true,
    status:   'ok',
    version:  '2.0.0',
    env:      process.env.NODE_ENV || 'development',
    origins:  allowedOrigins,
    ts:       new Date().toISOString(),
  });
});

app.get('/', (_req, res) => {
  res.json({ message: 'Dairy ERP API is running', health: '/api/health' });
});

// ── Error handlers (must be last) ─────────────────────────────────────
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

// ── Start server ───────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000');
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🥛 Dairy ERP API  →  http://localhost:${PORT}`);
  console.log(`🌍 Env: ${process.env.NODE_ENV || 'development'}\n`);
});

// ── Graceful shutdown ──────────────────────────────────────────────────
const shutdown = (sig) => {
  console.log(`\n${sig} received — shutting down gracefully…`);
  server.close(() => { console.log('Server closed.'); process.exit(0); });
  setTimeout(() => process.exit(1), 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  err => { console.error('Uncaught Exception:', err.message); process.exit(1); });
process.on('unhandledRejection', err => { console.error('Unhandled Rejection:', err);        process.exit(1); });

module.exports = server;
