/**
 * Privacy-safe telemetry for the payment-token availability display.
 *
 * Events carry only allow-listed enum values (token symbol, outcome, status).
 * Wallet addresses, contract/token addresses, error messages, and timestamps
 * are never included, so identical interactions produce identical payloads.
 */

export const PAYMENT_TOKEN_TELEMETRY_EVENT = 'escrow:telemetry';

const TOKENS = new Set(['usdc', 'xlm']);
const OUTCOMES = new Set(['confirmed', 'rolled_back', 'failed']);
const STATUSES = new Set(['whitelisted', 'supported', 'unsupported', 'paused', 'unavailable']);

export function createPaymentTokenTelemetry({ token, outcome, status }) {
  return {
    event: 'payment_token_availability',
    token: TOKENS.has(token) ? token : 'other',
    outcome: OUTCOMES.has(outcome) ? outcome : 'unknown',
    status: STATUSES.has(status) ? status : 'unknown',
  };
}

/** Dispatches a sanitized event; telemetry failures never affect the UI. */
export function emitPaymentTokenTelemetry(fields, target = globalThis.window) {
  try {
    target?.dispatchEvent(
      new CustomEvent(PAYMENT_TOKEN_TELEMETRY_EVENT, { detail: createPaymentTokenTelemetry(fields) }),
    );
  } catch {
    // Swallow: telemetry is best-effort.
  }
}
