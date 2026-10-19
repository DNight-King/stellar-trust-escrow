import { renderHook, act, waitFor } from '@testing-library/react';
import { usePaymentTokenAvailability } from '../../app/escrow/create/usePaymentTokenAvailability';

const ADDRESS = 'GTESTADDRESS';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(fetchStatus, initialProps = {}) {
  return renderHook((props) => usePaymentTokenAvailability({ fetchStatus, ...props }), {
    initialProps: { address: ADDRESS, isConnected: true, tokenSymbol: 'usdc', ...initialProps },
  });
}

describe('usePaymentTokenAvailability', () => {
  it('shows checking, then the server-confirmed status', async () => {
    const fetchStatus = jest.fn().mockResolvedValue('whitelisted');
    const { result } = setup(fetchStatus);

    expect(result.current).toEqual({ status: 'checking', pending: true, stale: false });
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'whitelisted', pending: false, stale: false }),
    );
    expect(fetchStatus).toHaveBeenCalledWith({ sourceAddress: ADDRESS, tokenSymbol: 'usdc' });
  });

  it('optimistically reuses the confirmed status and rolls back to it on failure', async () => {
    const fetchStatus = jest.fn().mockResolvedValueOnce('whitelisted');
    const { result, rerender } = setup(fetchStatus);
    await waitFor(() => expect(result.current.status).toBe('whitelisted'));

    fetchStatus.mockResolvedValueOnce('supported');
    rerender({ address: ADDRESS, isConnected: true, tokenSymbol: 'xlm' });
    await waitFor(() => expect(result.current.status).toBe('supported'));

    const pending = deferred();
    fetchStatus.mockReturnValueOnce(pending.promise);
    rerender({ address: ADDRESS, isConnected: true, tokenSymbol: 'usdc' });
    expect(result.current).toEqual({ status: 'whitelisted', pending: true, stale: false });

    await act(async () => {
      pending.reject(new Error('rpc down'));
    });
    expect(result.current).toEqual({ status: 'whitelisted', pending: false, stale: true });
  });

  it('falls back to unavailable when no confirmed status exists', async () => {
    const fetchStatus = jest.fn().mockRejectedValue(new Error('rpc down'));
    const { result } = setup(fetchStatus);

    await waitFor(() =>
      expect(result.current).toEqual({ status: 'unavailable', pending: false, stale: false }),
    );
  });

  it('ignores a late failure from a superseded check', async () => {
    const slow = deferred();
    const fetchStatus = jest
      .fn()
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce('supported');
    const { result, rerender } = setup(fetchStatus);

    rerender({ address: ADDRESS, isConnected: true, tokenSymbol: 'xlm' });
    await waitFor(() => expect(result.current.status).toBe('supported'));

    await act(async () => {
      slow.reject(new Error('timeout'));
    });
    expect(result.current).toEqual({ status: 'supported', pending: false, stale: false });
  });

  it('handles custom tokens and disconnected wallets without fetching', () => {
    const fetchStatus = jest.fn();
    const { result, rerender } = setup(fetchStatus, { tokenSymbol: 'custom' });
    expect(result.current.status).toBe('unsupported');

    rerender({ address: null, isConnected: false, tokenSymbol: 'usdc' });
    expect(result.current.status).toBe('unavailable');
    expect(fetchStatus).not.toHaveBeenCalled();
  });
});
