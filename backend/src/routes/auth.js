const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const passport = require('passport');
const { body } = require('express-validator');
const db       = require('../config/db');
const { validate }                 = require('../middleware/validate');
const { authenticate, attachMeta } = require('../middleware/auth');
const {
  generateAccessToken, generateRefreshToken,
  hashToken, verifyTokenHash, generateSecureToken,
} = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { logAction } = require('../services/auditService');

// ── Helpers ────────────────────────────────────────────────
const safeUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role, avatar_url: u.avatar_url });

function sendTokens(res, user, rememberMe = false) {
  const accessToken  = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user, rememberMe);
  return { accessToken, refreshToken };
}

// ── Register ───────────────────────────────────────────────
router.post('/register',
  attachMeta,
  [
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('email').trim().isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 })
      .matches(/[A-Z]/).withMessage('Needs uppercase letter')
      .matches(/[0-9]/).withMessage('Needs a number'),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { name, email, password } = req.body;

      const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
      if (exists.length) return res.status(409).json({ success: false, message: 'Email already registered.' });

      const hash  = await bcrypt.hash(password, 12);
      const token = generateSecureToken();
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      const [result] = await db.query(
        `INSERT INTO users (name, email, password_hash, role, verification_token, token_expires_at)
         VALUES (?, ?, ?, 'staff', ?, ?)`,
        [name, email, hash, token, expires]
      );

      await sendVerificationEmail(email, name, token);
      await logAction({ userId: result.insertId, action: 'REGISTER', tableName: 'users', recordId: result.insertId, req });

      res.status(201).json({ success: true, message: 'Registration successful. Check your email to verify.' });
    } catch (err) { next(err); }
  }
);

// ── Verify Email ───────────────────────────────────────────
router.get('/verify-email', async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'Token required.' });

    const [rows] = await db.query(
      'SELECT id FROM users WHERE verification_token = ? AND token_expires_at > NOW() AND email_verified = 0',
      [token]
    );
    if (!rows.length) return res.status(400).json({ success: false, message: 'Invalid or expired verification link.' });

    await db.query(
      'UPDATE users SET email_verified = 1, verification_token = NULL, token_expires_at = NULL WHERE id = ?',
      [rows[0].id]
    );
    res.json({ success: true, message: 'Email verified. You can now log in.' });
  } catch (err) { next(err); }
});

// ── Login ──────────────────────────────────────────────────
router.post('/login',
  attachMeta,
  [
    body('email').trim().isEmail().normalizeEmail(),
    body('password').notEmpty(),
    body('rememberMe').optional().isBoolean(),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { email, password, rememberMe = false } = req.body;

      const [rows] = await db.query(
        'SELECT * FROM users WHERE email = ? LIMIT 1', [email]
      );
      const user = rows[0];

      if (!user || !user.is_active) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      if (!user.email_verified) {
        return res.status(403).json({ success: false, message: 'Please verify your email first.' });
      }
      if (!user.password_hash) {
        return res.status(400).json({ success: false, message: 'This account uses Google login.' });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

      const { accessToken, refreshToken } = sendTokens(res, user, rememberMe);
      const rtHash = await hashToken(refreshToken);
      await db.query('UPDATE users SET refresh_token_hash = ? WHERE id = ?', [rtHash, user.id]);

      await logAction({ userId: user.id, action: 'LOGIN', tableName: 'users', recordId: user.id, req });

      res.json({
        success: true,
        message: 'Login successful.',
        data: { accessToken, refreshToken, user: safeUser(user) },
      });
    } catch (err) { next(err); }
  }
);

// ── Refresh Token ──────────────────────────────────────────
router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token required.' });

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' });
    }

    const [rows] = await db.query('SELECT * FROM users WHERE id = ? AND is_active = 1', [payload.id]);
    const user = rows[0];
    if (!user?.refresh_token_hash) {
      return res.status(401).json({ success: false, message: 'Session revoked. Please log in again.' });
    }

    const valid = await verifyTokenHash(refreshToken, user.refresh_token_hash);
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid refresh token.' });

    const newAccessToken  = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const newHash = await hashToken(newRefreshToken);
    await db.query('UPDATE users SET refresh_token_hash = ? WHERE id = ?', [newHash, user.id]);

    res.json({ success: true, data: { accessToken: newAccessToken, refreshToken: newRefreshToken } });
  } catch (err) { next(err); }
});

// ── Logout ─────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await db.query('UPDATE users SET refresh_token_hash = NULL WHERE id = ?', [req.user.id]);
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) { next(err); }
});

// ── Forgot Password ────────────────────────────────────────
router.post('/forgot-password',
  [body('email').trim().isEmail().normalizeEmail()],
  validate,
  async (req, res, next) => {
    try {
      const { email } = req.body;
      const [rows] = await db.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);

      // Always return success to prevent email enumeration
      if (!rows.length) {
        return res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
      }
      const user = rows[0];
      const token = generateSecureToken();
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h
      await db.query(
        'UPDATE users SET verification_token = ?, token_expires_at = ? WHERE id = ?',
        [token, expires, user.id]
      );
      await sendPasswordResetEmail(email, user.name, token);
      res.json({ success: true, message: 'If this email exists, a reset link has been sent.' });
    } catch (err) { next(err); }
  }
);

// ── Reset Password ─────────────────────────────────────────
router.post('/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }).matches(/[A-Z]/).matches(/[0-9]/),
  ],
  validate,
  async (req, res, next) => {
    try {
      const { token, password } = req.body;
      const [rows] = await db.query(
        'SELECT id FROM users WHERE verification_token = ? AND token_expires_at > NOW()',
        [token]
      );
      if (!rows.length) return res.status(400).json({ success: false, message: 'Invalid or expired reset link.' });

      const hash = await bcrypt.hash(password, 12);
      await db.query(
        'UPDATE users SET password_hash = ?, verification_token = NULL, token_expires_at = NULL, refresh_token_hash = NULL WHERE id = ?',
        [hash, rows[0].id]
      );
      res.json({ success: true, message: 'Password reset successful. Please log in.' });
    } catch (err) { next(err); }
  }
);

// ── Google OAuth ───────────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed` }),
  async (req, res) => {
    try {
      const user = req.user;
      const { accessToken, refreshToken } = sendTokens(res, user, false);
      const rtHash = await hashToken(refreshToken);
      await db.query('UPDATE users SET refresh_token_hash = ? WHERE id = ?', [rtHash, user.id]);

      // Redirect to frontend with tokens in query (frontend stores them)
      res.redirect(
        `${process.env.CLIENT_URL}/oauth-callback?` +
        `accessToken=${encodeURIComponent(accessToken)}&` +
        `refreshToken=${encodeURIComponent(refreshToken)}`
      );
    } catch {
      res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }
  }
);

// ── Get Current User ───────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name, email, role, avatar_url, email_verified, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
