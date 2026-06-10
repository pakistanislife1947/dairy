/**
 * Milk Pricing Engine — TS-based formula
 *
 * Formula:
 *   X              = (c1 × fat) + c2 + (LR / c3) + fat
 *   standardised   = X × (scale / target_ts)
 *   rate_per_unit  = standardised × base_rate
 *   total_payout   = rate_per_unit × milk_weight
 */

const DEFAULT = {
  target_ts:      13.00,
  base_rate:       1,
  constant_c1:     0.22,
  constant_c2:     0.72,
  constant_c3:     4.00,
  constant_scale: 200.00,
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

function computeTS({ cfg = {}, fat, lr, weight }) {
  validateConfig(cfg);

  const c1    = getNum(cfg, 'constant_c1');
  const c2    = getNum(cfg, 'constant_c2');
  const c3    = getNum(cfg, 'constant_c3');
  const scale = getNum(cfg, 'constant_scale');
  const ts_t  = getNum(cfg, 'target_ts');
  const brate = getNum(cfg, 'base_rate');

  const f = parseFloat(fat);
  const l = parseFloat(lr);
  const w = parseFloat(weight);

  const X               = (c1 * f) + c2 + (l / c3) + f;
  const standardised_ts = X * (scale / ts_t);
  const rate_per_unit   = standardised_ts * brate;
  const total_payout    = rate_per_unit * w;

  return {
    ts:              parseFloat(X.toFixed(4)),
    standardised_ts: parseFloat(standardised_ts.toFixed(4)),
    rate_per_unit:   parseFloat(rate_per_unit.toFixed(4)),
    total_payout:    parseFloat(total_payout.toFixed(4)),
  };
}

// Legacy helpers
function computeRate({ base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction, actual_fat, actual_snf }) {
  const fatAdj = (actual_fat - ideal_fat) * fat_correction;
  const snfAdj = actual_snf != null ? (actual_snf - ideal_snf) * snf_correction : 0;
  return Math.max(0, parseFloat((parseFloat(base_rate) + fatAdj + snfAdj).toFixed(4)));
}
function computeAmount(quantity_liters, computed_rate) {
  return parseFloat((parseFloat(quantity_liters) * computed_rate).toFixed(4));
}

module.exports = { computeTS, computeRate, computeAmount, validateConfig, DEFAULT };
