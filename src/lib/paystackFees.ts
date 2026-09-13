/**
 * Paystack's standard Nigeria local-card fee schedule: 1.5% of the amount, plus a flat ₦100 —
 * waived for transactions of ₦2,500 or less — with the total fee capped at ₦2,000 regardless of
 * amount. This is Paystack's own published pricing, not a Declut-configured value, so it's
 * computed here rather than pulled from GET /settings (which only carries Declut's own
 * commission/fee fields). Client-side estimate for display only — checkout's actual charge is
 * computed server-side by Paystack itself.
 */
const PERCENTAGE_RATE = 0.015;
const FLAT_FEE = 100;
const FLAT_FEE_WAIVER_THRESHOLD = 2500;
const FEE_CAP = 2000;

export function calculatePaystackFee(amount: number): number {
  const percentageFee = amount * PERCENTAGE_RATE;
  const fee = amount > FLAT_FEE_WAIVER_THRESHOLD ? percentageFee + FLAT_FEE : percentageFee;
  return Math.min(fee, FEE_CAP);
}
