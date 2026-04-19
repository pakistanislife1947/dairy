/**
 * Dynamic Milk Pricing Engine
 *
 * Formula:
 *   computed_rate = base_rate
 *                 + (actual_fat - ideal_fat) * fat_correction
 *                 + (actual_snf - ideal_snf) * snf_correction
 *
 * Rate cannot go below 0.
 */
function computeRate({ base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction, actual_fat, actual_snf }) {
  const fatAdj = (actual_fat - ideal_fat) * fat_correction;
  const snfAdj = actual_snf != null
    ? (actual_snf - ideal_snf) * snf_correction
    : 0;

  const rate = parseFloat(base_rate) + fatAdj + snfAdj;
  return Math.max(0, parseFloat(rate.toFixed(2)));
}

/**
 * Compute total amount for a milk record.
 */
function computeAmount(quantity_liters, computed_rate) {
  return parseFloat((parseFloat(quantity_liters) * computed_rate).toFixed(2));
}

module.exports = { computeRate, computeAmount };
