/**
 * Milk Pricing Engine — TS-based formula
 *
 * Config variables (fetched from settings table):
 *   target_ts      (default 13.00)  — standard TS target
 *   base_rate      — price per standardised unit
 *   constant_c1    (default 0.22)   — fat multiplier
 *   constant_c2    (default 0.72)   — base addition
 *   constant_c3    (default 4.00)   — LR divisor
 *   constant_scale (default 200.00) — scaling factor
 *
 * Formula:
 *   X              = (c1 × fat) + c2 + (LR / c3) + fat
 *   standardised   = X × (scale / target_ts)
 *   rate_per_unit  = standardised × base_rate
 *   total_payout   = rate_per_unit × milk_weight
 */

const DEFAULT = {
  target_ts:      13.00,
  base_rate:       0,      // must be set by admin
  constant_c1:     0.22,
  constant_c2:     0.72,
  constant_c3:     4.00,
  constant_scale: 200.00,
};

/**
 * Validate config — throws on division-by-zero guards
 */
function validateConfig(cfg) {
  const t  = parseFloat(cfg.target_ts      ?? DEFAULT.target_ts);
  const c3 = parseFloat(cfg.constant_c3    ?? DEFAULT.constant_c3);
  if (!t  || t  === 0) throw new Error('target_ts cannot be zero — update settings.');
  if (!c3 || c3 === 0) throw new Error('constant_c3 (LR divisor) cannot be zero — update settings.');
}

/**
 * Core calculation
 * @param {object} cfg   — settings from DB
 * @param {number} fat   — fat_percentage
 * @param {number} lr    — lactometer_reading
 * @param {number} weight — milk_weight (litres)
 * @returns {{ ts, standardised_ts, rate_per_unit, total_payout }}
 */
function computeTS({ cfg, fat, lr, weight }) {
  validateConfig(cfg);

  const c1    = parseFloat(cfg.constant_c1    ?? DEFAULT.constant_c1);
  const c2    = parseFloat(cfg.constant_c2    ?? DEFAULT.constant_c2);
  const c3    = parseFloat(cfg.constant_c3    ?? DEFAULT.constant_c3);
  const scale = parseFloat(cfg.constant_scale ?? DEFAULT.constant_scale);
  const ts_t  = parseFloat(cfg.target_ts      ?? DEFAULT.target_ts);
  const brate = parseFloat(cfg.base_rate      ?? DEFAULT.base_rate);

  const f = parseFloat(fat);
  const l = parseFloat(lr);
  const w = parseFloat(weight);

  // Step 1: Total Solids
  const X = (c1 * f) + c2 + (l / c3) + f;

  // Step 2: TS Standardisation
  const standardised_ts = X * (scale / ts_t);

  // Step 3: Final payout
  const rate_per_unit = standardised_ts * brate;
  const total_payout  = rate_per_unit * w;

  return {
    ts:              parseFloat(X.toFixed(4)),
    standardised_ts: parseFloat(standardised_ts.toFixed(4)),
    rate_per_unit:   parseFloat(rate_per_unit.toFixed(4)),
    total_payout:    parseFloat(total_payout.toFixed(4)),
  };
}

// ── Legacy helpers (kept for any code that still imports them) ────────────
function computeRate({ base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction, actual_fat, actual_snf }) {
  const fatAdj = (actual_fat - ideal_fat) * fat_correction;
  const snfAdj = actual_snf != null ? (actual_snf - ideal_snf) * snf_correction : 0;
  return Math.max(0, parseFloat((parseFloat(base_rate) + fatAdj + snfAdj).toFixed(4)));
}

function computeAmount(quantity_liters, computed_rate) {
  return parseFloat((parseFloat(quantity_liters) * computed_rate).toFixed(4));
}

module.exports = { computeTS, computeRate, computeAmount, validateConfig, DEFAULT };
