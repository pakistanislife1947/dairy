const passport      = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const db             = require('./db');

passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.GOOGLE_CALLBACK_URL,
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email    = profile.emails?.[0]?.value;
      const googleId = profile.id;
      const name     = profile.displayName;
      const avatar   = profile.photos?.[0]?.value || null;

      if (!email) return done(new Error('Google account has no email'), null);

      // Check if user exists by google_id or email
      const [rows] = await db.query(
        'SELECT * FROM users WHERE google_id = ? OR email = ? LIMIT 1',
        [googleId, email]
      );

      if (rows.length > 0) {
        const user = rows[0];
        if (!user.is_active)
          return done(null, false, { message: 'Account deactivated.' });

        // Link google_id if not yet linked
        if (!user.google_id) {
          await db.query('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?',
            [googleId, avatar, user.id]);
        }
        return done(null, user);
      }

      // New user — register as staff, unverified email gets auto-verified via OAuth
      const [result] = await db.query(
        `INSERT INTO users (name, email, google_id, avatar_url, role, is_active, email_verified)
         VALUES (?, ?, ?, ?, 'staff', 1, 1)`,
        [name, email, googleId, avatar]
      );

      const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      return done(null, newUser[0]);
    } catch (err) {
      return done(err, null);
    }
  }
));

module.exports = passport;
