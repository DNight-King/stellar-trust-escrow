'use client';

/**
 * usePaymentTokenAvailability — optimistic, recovery-safe payment-token status.
 *
 * When the selected token changes, the last server-confirmed status for that
 * token is shown immediately (or `checking` when none is known) while a fresh
 * check runs. If the check fails, the display rolls back to the last confirmed
 * server status instead of discarding it, and `stale` is set so callers can
 * keep submission blocked. Responses from superseded checks are ignored, so a
 * late failure never overwrites a newer server update. The user's selection
 * is never modified.
 */

import { useEffect, useRef, useState } from 'react';

export function usePaymentTokenAvailability({ address, isConnected, tokenSymbol, fetchStatus }) {
  const [state, setState] = useState({ status: 'unavailable', pending: false, stale: false });
  const confirmedRef = useRef({});
  const requestRef = useRef(0);

  // Confirmed statuses are wallet-scoped; drop them when the wallet changes.
  useEffect(() => {
    confirmedRef.current = {};
  }, [address]);

  useEffect(() => {
    const requestId = ++requestRef.current;

    if (tokenSymbol === 'custom') {
      setState({ status: 'unsupported', pending: false, stale: false });
      return;
    }
    if (!isConnected || !address) {
      setState({ status: 'unavailable', pending: false, stale: false });
      return;
    }

    const confirmed = confirmedRef.current[tokenSymbol];
    setState({ status: confirmed ?? 'checking', pending: true, stale: false });

    fetchStatus({ sourceAddress: address, tokenSymbol })
      .then((status) => {
        if (requestId !== requestRef.current) return;
        confirmedRef.current[tokenSymbol] = status;
        setState({ status, pending: false, stale: false });
      })
      .catch(() => {
        if (requestId !== requestRef.current) return;
        const fallback = confirmedRef.current[tokenSymbol];
        setState({ status: fallback ?? 'unavailable', pending: false, stale: Boolean(fallback) });
      });
  }, [address, isConnected, tokenSymbol, fetchStatus]);

  return state;
}
