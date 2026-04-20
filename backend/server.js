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

// Trust proxy — required for Railway/Render (fixes rate limiter IP detection)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS — supports comma-separated origins: "https://x.vercel.app,http://localhost:5173"
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max:      parseInt(process.env.RATE_LIMIT_MAX       || '300'),
  standardHeaders: true, legacyHeaders: false,
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

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Passport
app.use(passport.initialize());

// Routes
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

// Health
app.get('/api/health', (_req, res) => {
  res.json({ success: true, status: 'ok', version: '2.0.0', ts: new Date().toISOString() });
});
app.get('/', (_req, res) => {
  res.json({ message: 'Dairy ERP API is running' });
});

// Error handlers
const { notFound, errorHandler } = require('./src/middleware/errorHandler');
app.use(notFound);
app.use(errorHandler);

// Start
const PORT = parseInt(process.env.PORT || '8080');
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🥛 Dairy ERP API  →  http://localhost:${PORT}`);
  console.log(`🌍 Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ CORS: ${allowedOrigins.join(', ')}\n`);
});

const shutdown = (sig) => {
  console.log(`\n${sig} — shutting down…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000);
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException',  e => { console.error('Uncaught:', e);    process.exit(1); });
process.on('unhandledRejection', e => { console.error('Unhandled:', e);   process.exit(1); });

module.exports = server;
