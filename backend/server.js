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

// ── Trust proxy (Render sits behind a load balancer) ───────────────────
app.set('trust proxy', 1);

// ── Security headers ───────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── CORS ───────────────────────────────────────────────────────────────
const rawOrigins = process.env.ALLOWED_ORIGINS
  || process.env.CLIENT_URL
  || 'http://localhost:5173';

const allowedOrigins = rawOrigins
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// 🔥 BULLETPROOF FIX: Agar environment variables mein vercel link missing ho, toh yeh line khud add kar degi
if (!allowedOrigins.includes('https://brimi.vercel.app')) {
  allowedOrigins.push('https://brimi.vercel.app');
}

console.log('✅ CORS allowed origins:');
allowedOrigins.forEach(o => console.log(`   • ${o}`));

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`⛔ CORS blocked: ${origin}`);
    // callback(null, false) rakhein taake 500 error crash na ho
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
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
const { staffDashRouter } = require('./src/routes/dashboard');
app.use('/api/staff/dashboard', staffDashRouter);

const settingsRoutes = require('./src/routes/settings');
app.use('/api/settings', settingsRoutes);
app.use('/api/customers', require('./src/routes/customers'));
app.use('/api/products',  require('./src/routes/products'));
app.use('/api/receipts',  require('./src/routes/receipts'));
app.use('/api/invoices',  require('./src/routes/invoices'));

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
const PORT = parseInt(process.env.PORT || '3000');
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
