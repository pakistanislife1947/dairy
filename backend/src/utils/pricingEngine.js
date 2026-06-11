/**
 * Brimi Dairy Pricing Engine
 *
 * Formula (from email):
 *   X    = (0.22 × fat) + 0.72 + (LR / 4) + fat
 *   13TS = X × (200 / 13)          ← "standardised_ts"
 *   PURCHASE RATE = 13TS × base_rate
 *   TOTAL = PURCHASE RATE × milk_weight
 *
 * SNF (derived, for display only):
 *   SNF = (LR / 4) + 0.2
 *
 * Config keys in settings table:
 *   target_ts (13), base_rate, constant_c1 (0.22), constant_c2 (0.72),
 *   constant_c3 (4), constant_scale (200)
 */

const DEFAULT = {
  target_ts:      13,
  base_rate:      1,
  constant_c1:    0.22,
  constant_c2:    0.72,
  constant_c3:    4,
  constant_scale: 200,
};

function getNum(cfg, key) {
  const v = parseFloat(cfg?.[key]);
  return isNaN(v) ? DEFAULT[key] : v;
}

function validateConfig(cfg) {
  const t  = getNum(cfg, 'target_ts');
  const c3 = getNum(cfg, 'constant_c3');
  if (t  === 0) throw new Error('target_ts cannot be zero — update Settings.');
  if (c3 === 0) throw new Error('constant_c3 (LR divisor) cannot be zero — update Settings.');
}

/**
 * Main calculation
 * Returns: { ts, standardised_ts, snf_computed, rate_per_unit, total_payout }
 */
function computeTS({ cfg = {}, fat, lr, weight }) {
  validateConfig(cfg);

  const c1    = getNum(cfg, 'constant_c1');    // 0.22
  const c2    = getNum(cfg, 'constant_c2');    // 0.72
  const c3    = getNum(cfg, 'constant_c3');    // 4
  const scale = getNum(cfg, 'constant_scale'); // 200
  const ts_t  = getNum(cfg, 'target_ts');      // 13
  const brate = getNum(cfg, 'base_rate');

  const f = parseFloat(fat);
  const l = parseFloat(lr);
  const w = parseFloat(weight);

  // Step 1: X = (c1 * fat) + c2 + (LR / c3) + fat
  const X = (c1 * f) + c2 + (l / c3) + f;

  // Step 2: standardised_ts = X * (scale / target_ts)
  const standardised_ts = X * (scale / ts_t);

  // Step 3: purchase_rate = standardised_ts * base_rate
  const rate_per_unit = standardised_ts * brate;

  // Step 4: total payout
  const total_payout = rate_per_unit * w;

  // SNF derived: LR/4 + 0.2 (display only)
  const snf_computed = (l / c3) + 0.2;

  // Sp. Gravity (display only): 1 + LR/1000
  const sp_gravity = 1 + (l / 1000);

  return {
    ts:              parseFloat(X.toFixed(4)),
    standardised_ts: parseFloat(standardised_ts.toFixed(4)),
    snf_computed:    parseFloat(snf_computed.toFixed(3)),
    sp_gravity:      parseFloat(sp_gravity.toFixed(3)),
    rate_per_unit:   parseFloat(rate_per_unit.toFixed(4)),
    total_payout:    parseFloat(total_payout.toFixed(2)),
  };
}

// Legacy helpers kept for backward compat
function computeRate({ base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction, actual_fat, actual_snf }) {
  const fatAdj = (actual_fat - ideal_fat) * fat_correction;
  const snfAdj = actual_snf != null ? (actual_snf - ideal_snf) * snf_correction : 0;
  return Math.max(0, parseFloat((parseFloat(base_rate) + fatAdj + snfAdj).toFixed(4)));
}
function computeAmount(quantity_liters, computed_rate) {
  return parseFloat((parseFloat(quantity_liters) * computed_rate).toFixed(4));
}

module.exports = { computeTS, computeRate, computeAmount, validateConfig, DEFAULT };
