// src/routes/auth.js
// Full try-catch on every route. Never crashes on bad input or DB errors.
// Column name: "password" (as renamed in Supabase — was password_hash)

const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db       = require('../config/db');

// ── JWT helpers ────────────────────────────────────────────
// Fallbacks prevent startup crash — but ALWAYS set these in Railway Variables
const JWT_SECRET         = process.env.JWT_SECRET         || null;
const REFRESH_SECRET     = process.env.REFRESH_TOKEN_SECRET || null;
const JWT_EXPIRES        = process.env.JWT_EXPIRES_IN      || '15m';
const REFRESH_EXPIRES    = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
const REFRESH_LONG       = process.env.REFRESH_TOKEN_LONG_EXPIRES_IN || '30d';

function makeAccessToken(user) {
  if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function makeRefreshToken(user, rememberMe = false) {
  if (!REFRESH_SECRET) throw new Error('REFRESH_TOKEN_SECRET environment variable is not set');
  return jwt.sign(
    { id: user.id, type: 'refresh' },
    REFRESH_SECRET,
    { expiresIn: rememberMe ? REFRESH_LONG : REFRESH_EXPIRES }
  );
}

// Safe user object — never send password to client
const safeUser = (u) => ({
  id:         u.id,
  name:       u.name,
  email:      u.email,
  role:       u.role,
  avatar_url: u.avatar_url || null,
});

// ── Validation middleware ──────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors:  errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ══════════════════════════════════════════════════════════
// POST /api/auth/register
// ══════════════════════════════════════════════════════════
router.post('/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/[A-Z]/).withMessage('Password needs at least one uppercase letter')
      .matches(/[0-9]/).withMessage('Password needs at least one number'),
  ],
  validate,
  async (req, res) => {
    try {
      const { name, email, password } = req.body;

      // 1. Check duplicate email
      const existing = await db.queryOne(
        'SELECT id FROM users WHERE email = $1 LIMIT 1',
        [email]
      );
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
        });
      }

      // 2. Hash password
      const hash = await bcrypt.hash(password, 12);

      // 3. Insert user (email_verified = true for simplicity without email service)
      const newUser = await db.queryOne(
        `INSERT INTO users (name, email, password, role, is_active, email_verified)
         VALUES ($1, $2, $3, 'staff', true, true)
         RETURNING id, name, email, role`,
        [name, email, hash]
      );

      if (!newUser) {
        return res.status(500).json({
          success: false,
          message: 'User creation failed. Please try again.',
        });
      }

      // 4. Issue tokens immediately (auto-login after register)
      const accessToken  = makeAccessToken(newUser);
      const refreshToken = makeRefreshToken(newUser);

      // 5. Store hashed refresh token
      const rtHash = await bcrypt.hash(refreshToken, 10);
      await db.query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [rtHash, newUser.id]);

      return res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        data: {
          accessToken,
          refreshToken,
          user: safeUser(newUser),
        },
      });

    } catch (err) {
      console.error('[POST /register] Error:', err.message);

      // Catch duplicate email at DB level (race condition)
      if (err.code === '23505') {
        return res.status(409).json({
          success: false,
          message: 'An account with this email already exists.',
        });
      }

      return res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
          ? 'Registration failed. Please try again.'
          : `Registration error: ${err.message}`,
      });
    }
  }
);

// ══════════════════════════════════════════════════════════
// POST /api/auth/login
// ══════════════════════════════════════════════════════════
router.post('/login',
  [
    body('email').trim().isEmail().normalizeEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
    body('rememberMe').optional().isBoolean(),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password, rememberMe = false } = req.body;

      // 1. Find user by email
      const user = await db.queryOne(
        `SELECT id, name, email, password, role, avatar_url,
                is_active, email_verified, refresh_token_hash
         FROM users
         WHERE email = $1
         LIMIT 1`,
        [email]
      );

      // Generic message — never reveal whether email exists
      const invalidMsg = 'Invalid email or password.';

      if (!user) {
        return res.status(401).json({ success: false, message: invalidMsg });
      }

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: 'This account has been deactivated. Contact admin.',
        });
      }

      // 2. Check if stored password is a bcrypt hash or plain text
      // Plain text passwords start with a letter — bcrypt hashes start with "$2"
      // This handles the case where you inserted a plain-text password via SQL Editor
      let passwordMatch = false;

      if (!user.password) {
        // No password stored — Google OAuth account
        return res.status(400).json({
          success: false,
          message: 'This account uses Google login. Use the Google button to sign in.',
        });
      }

      const isHashed = user.password.startsWith('$2a$') || user.password.startsWith('$2b$');

      if (isHashed) {
        // Normal flow — compare with bcrypt
        passwordMatch = await bcrypt.compare(password, user.password);
      } else {
        // PLAIN TEXT in DB (dev/test only) — direct compare
        // After successful login, auto-upgrade to hash
        passwordMatch = (password === user.password);

        if (passwordMatch) {
          console.warn(`⚠️  User ${email} has plain-text password — upgrading to bcrypt hash.`);
          const upgraded = await bcrypt.hash(password, 12);
          await db.query('UPDATE users SET password = $1 WHERE id = $2', [upgraded, user.id]);
        }
      }

      if (!passwordMatch) {
        return res.status(401).json({ success: false, message: invalidMsg });
      }

      // 3. Check email verification (skip if not required in your setup)
      // Uncomment if you want to enforce email verification:
      // if (!user.email_verified) {
      //   return res.status(403).json({ success: false, message: 'Please verify your email first.' });
      // }

      // 4. Generate tokens
      const accessToken  = makeAccessToken(user);
      const refreshToken = makeRefreshToken(user, rememberMe);

      // 5. Store hashed refresh token in DB
      const rtHash = await bcrypt.hash(refreshToken, 10);
      await db.query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [rtHash, user.id]);

      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        data: {
          accessToken,
          refreshToken,
          user: safeUser(user),
        },
      });

    } catch (err) {
      console.error('[POST /login] Error:', err.message);
      return res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
          ? 'Login failed. Please try again.'
          : `Login error: ${err.message}`,
      });
    }
  }
);

// ══════════════════════════════════════════════════════════
// POST /api/auth/refresh
// ══════════════════════════════════════════════════════════
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required.' });
    }

    if (!REFRESH_SECRET) {
      return res.status(500).json({ success: false, message: 'Server auth config error.' });
    }

    // Verify the refresh token signature
    let payload;
    try {
      payload = jwt.verify(refreshToken, REFRESH_SECRET);
    } catch (jwtErr) {
      const msg = jwtErr.name === 'TokenExpiredError'
        ? 'Session expired. Please log in again.'
        : 'Invalid refresh token.';
      return res.status(401).json({ success: false, message: msg });
    }

    // Get user and check stored token hash
    const user = await db.queryOne(
      'SELECT id, name, email, role, is_active, refresh_token_hash FROM users WHERE id = $1',
      [payload.id]
    );

    if (!user || !user.is_active || !user.refresh_token_hash) {
      return res.status(401).json({ success: false, message: 'Session revoked. Please log in again.' });
    }

    const valid = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid session. Please log in again.' });
    }

    // Rotate both tokens
    const newAccessToken  = makeAccessToken(user);
    const newRefreshToken = makeRefreshToken(user);
    const newRtHash       = await bcrypt.hash(newRefreshToken, 10);

    await db.query('UPDATE users SET refresh_token_hash = $1 WHERE id = $2', [newRtHash, user.id]);

    return res.json({
      success: true,
      data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
    });

  } catch (err) {
    console.error('[POST /refresh] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Token refresh failed.' });
  }
});

// ══════════════════════════════════════════════════════════
// POST /api/auth/logout
// ══════════════════════════════════════════════════════════
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token && JWT_SECRET) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        await db.query('UPDATE users SET refresh_token_hash = NULL WHERE id = $1', [payload.id]);
      } catch {
        // Expired token — still log out, just can't clear refresh token
      }
    }
    return res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    console.error('[POST /logout] Error:', err.message);
    return res.json({ success: true, message: 'Logged out.' }); // Always succeed
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/auth/me
// ══════════════════════════════════════════════════════════
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided.' });
    }
    if (!JWT_SECRET) {
      return res.status(500).json({ success: false, message: 'Server auth config error.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      const msg = jwtErr.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
      return res.status(401).json({ success: false, message: msg });
    }

    const user = await db.queryOne(
      'SELECT id, name, email, role, avatar_url, email_verified, created_at FROM users WHERE id = $1 AND is_active = true',
      [payload.id]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated.' });
    }

    return res.json({ success: true, data: user });

  } catch (err) {
    console.error('[GET /me] Error:', err.message);
    return res.status(500).json({ success: false, message: 'Could not fetch user.' });
  }
});

module.exports = router;
