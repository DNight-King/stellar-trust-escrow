'use client';

/**
 * Payment-token availability display for the create-escrow flow.
 * `pending` marks a background refresh of a previously confirmed status;
 * `stale` marks a failed refresh that rolled back to the last confirmed status.
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

  return (
    <p
      role={blocked ? 'alert' : 'status'}
      className={`text-sm ${blocked ? 'text-red-400' : 'text-gray-400'}`}
    >
      {messages[status] || messages.unavailable}
      {pending && status !== 'checking' && ' Refreshing…'}
      {stale && ' Could not refresh; showing last confirmed status.'}
    </p>
  );
}
