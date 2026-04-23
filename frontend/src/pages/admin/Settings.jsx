// backend/src/routes/settings.js
// Handles logo upload + app settings (admin only)

const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ─── GET all settings (public — needed by frontend on load) ──────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT key, value FROM settings ORDER BY key');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings' });
  }
});

// ─── GET single setting ──────────────────────────────────────────────────────
router.get('/:key', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT key, value FROM settings WHERE key = ?', [req.params.key]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Setting not found' });
    res.json({ success: true, key: rows[0].key, value: rows[0].value });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch setting' });
  }
});

// ─── UPDATE setting (admin only) ─────────────────────────────────────────────
router.put('/:key', authenticate, requireAdmin, async (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ success: false, message: 'value is required' });

  try {
    // Upsert (insert or update)
    await db.query(
      `INSERT INTO settings (key, value, updated_by, updated_at)
       VALUES (?, ?, ?, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`,
      [req.params.key, value, req.user.id]
    );
    res.json({ success: true, message: 'Setting updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

// ─── UPDATE LOGO (admin only) — accepts base64 data URI ──────────────────────
// POST /api/settings/logo
// Body: { logo: "data:image/png;base64,..." }
router.post('/logo', authenticate, requireAdmin, async (req, res) => {
  const { logo, name } = req.body;

  if (!logo) return res.status(400).json({ success: false, message: 'logo field is required' });

  // Basic validation — must be a data URI or a URL
  const isDataUri = logo.startsWith('data:image/');
  const isUrl     = logo.startsWith('http://') || logo.startsWith('https://');

  if (!isDataUri && !isUrl) {
    return res.status(400).json({
      success: false,
      message: 'logo must be a base64 data URI (data:image/...) or a valid http(s) URL',
    });
  }

  // Size guard — 500KB base64 ≈ 375KB actual image (fair limit for a logo)
  if (logo.length > 700_000) {
    return res.status(400).json({
      success: false,
      message: 'Logo too large. Compress it or use an external URL instead.',
    });
  }

  try {
    await db.query(
      `INSERT INTO settings (key, value, updated_by, updated_at)
       VALUES ('logo_url', ?, ?, NOW())
       ON CONFLICT (key) DO UPDATE
         SET value = EXCLUDED.value,
             updated_by = EXCLUDED.updated_by,
             updated_at = NOW()`,
      [logo, req.user.id]
    );

    if (name) {
      await db.query(
        `INSERT INTO settings (key, value, updated_by, updated_at)
         VALUES ('logo_name', ?, ?, NOW())
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               updated_by = EXCLUDED.updated_by,
               updated_at = NOW()`,
        [name, req.user.id]
      );
    }

    res.json({ success: true, message: 'Logo updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update logo' });
  }
});

// ─── DELETE LOGO (reset to default) ─────────────────────────────────────────
router.delete('/logo', authenticate, requireAdmin, async (req, res) => {
  try {
    await db.query(
      `UPDATE settings SET value = '', updated_by = ?, updated_at = NOW() WHERE key = 'logo_url'`,
      [req.user.id]
    );
    res.json({ success: true, message: 'Logo reset to default' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset logo' });
  }
});

module.exports = router;
