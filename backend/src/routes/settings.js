// backend/src/routes/settings.js
const express  = require('express');
const router   = express.Router();
const db       = require('../config/db');
const { authenticate, adminOnly } = require('../middleware/auth');

// GET /api/settings — public (needed by frontend on load for logo)
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

// GET /api/settings/:key
router.get('/:key', async (req, res) => {
  try {
    const row = await db.queryOne('SELECT key, value FROM settings WHERE key = $1', [req.params.key]);
    if (!row) return res.status(404).json({ success: false, message: 'Setting not found' });
    res.json({ success: true, key: row.key, value: row.value });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch setting' });
  }
});

// PUT /api/settings/:key (admin only)
router.put('/:key', authenticate, adminOnly, async (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ success: false, message: 'value is required' });
  try {
    await db.query(
      `INSERT INTO settings (key, value, updated_by, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [req.params.key, value, req.user.id]
    );
    res.json({ success: true, message: 'Setting updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update setting' });
  }
});

// POST /api/settings/logo (admin only)
router.post('/logo', authenticate, adminOnly, async (req, res) => {
  const { logo, name } = req.body;
  if (!logo) return res.status(400).json({ success: false, message: 'logo field is required' });
  const isDataUri = logo.startsWith('data:image/');
  const isUrl     = logo.startsWith('http://') || logo.startsWith('https://');
  if (!isDataUri && !isUrl) return res.status(400).json({ success: false, message: 'logo must be a data URI or https URL' });
  if (logo.length > 700_000) return res.status(400).json({ success: false, message: 'Logo too large. Max ~500KB.' });

  try {
    await db.query(
      `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      ['logo_url', logo, req.user.id]
    );
    if (name) {
      await db.query(
        `INSERT INTO settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
        ['logo_name', name, req.user.id]
      );
    }
    res.json({ success: true, message: 'Logo updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update logo' });
  }
});

// DELETE /api/settings/logo (admin only)
router.delete('/logo', authenticate, adminOnly, async (req, res) => {
  try {
    await db.query(
      `UPDATE settings SET value = '', updated_by = $1, updated_at = NOW() WHERE key = 'logo_url'`,
      [req.user.id]
    );
    res.json({ success: true, message: 'Logo reset' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset logo' });
  }
});

module.exports = router;
