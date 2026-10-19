'use client';

/**
 * Payment-token availability display for the create-escrow flow.
 * `pending` marks a background refresh of a previously confirmed status;
 * `stale` marks a failed refresh that rolled back to the last confirmed status.
 *
 * In-flight checks show a pulsing indicator; under `prefers-reduced-motion`
 * the indicator stays visible but static, and the text feedback is unchanged.
 */
export default function TokenStatusNotice({ status, pending = false, stale = false }) {
  const messages = {
    checking: 'Checking payment token status…',
    whitelisted: 'Payment token is whitelisted.',
    supported: 'Payment token is supported.',
    unsupported: 'Unsupported payment token. Choose XLM or USDC.',
    paused: 'Escrow creation is unavailable while the contract is paused.',
    unavailable: 'Token status is unavailable until the wallet and contract are configured.',
  };
  const blocked = status === 'unsupported' || status === 'paused';
  const inFlight = pending || status === 'checking';

  return (
    <p
      role={blocked ? 'alert' : 'status'}
      aria-busy={inFlight}
      className={`flex items-center gap-2 text-sm ${blocked ? 'text-red-400' : 'text-gray-400'}`}
    >
      {inFlight && (
        <span
          aria-hidden="true"
          data-testid="token-status-indicator"
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-indigo-400 motion-safe:animate-pulse motion-reduce:animate-none"
        />
      )}
      <span>
        {messages[status] || messages.unavailable}
        {pending && status !== 'checking' && ' Refreshing…'}
        {stale && ' Could not refresh; showing last confirmed status.'}
      </span>
    </p>
  );
}
