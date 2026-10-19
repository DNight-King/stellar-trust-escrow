import { renderHook, waitFor } from '@testing-library/react';
import {
  PAYMENT_TOKEN_TELEMETRY_EVENT,
  createPaymentTokenTelemetry,
  emitPaymentTokenTelemetry,
} from '../../app/escrow/create/paymentTokenTelemetry';
import { usePaymentTokenAvailability } from '../../app/escrow/create/usePaymentTokenAvailability';

const ADDRESS = 'GSECRETWALLETADDRESS';

function captureEvents() {
  const events = [];
  const listener = (event) => events.push(event.detail);
  window.addEventListener(PAYMENT_TOKEN_TELEMETRY_EVENT, listener);
  return { events, stop: () => window.removeEventListener(PAYMENT_TOKEN_TELEMETRY_EVENT, listener) };
}

describe('payment token telemetry', () => {
  it('emits a confirmed outcome without the wallet address', async () => {
    const { events, stop } = captureEvents();
    const fetchStatus = jest.fn().mockResolvedValue('whitelisted');
    renderHook(() =>
      usePaymentTokenAvailability({ address: ADDRESS, isConnected: true, tokenSymbol: 'usdc', fetchStatus }),
    );

    await waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toEqual({
      event: 'payment_token_availability',
      token: 'usdc',
      outcome: 'confirmed',
      status: 'whitelisted',
    });
    expect(JSON.stringify(events)).not.toContain(ADDRESS);
    stop();
  });

  it('emits a failed outcome without leaking the error message', async () => {
    const { events, stop } = captureEvents();
    const fetchStatus = jest.fn().mockRejectedValue(new Error(`account ${ADDRESS} not found`));
    renderHook(() =>
      usePaymentTokenAvailability({ address: ADDRESS, isConnected: true, tokenSymbol: 'xlm', fetchStatus }),
    );

    await waitFor(() => expect(events).toHaveLength(1));
    expect(events[0]).toMatchObject({ token: 'xlm', outcome: 'failed', status: 'unavailable' });
    expect(JSON.stringify(events)).not.toMatch(/GSECRET|not found/);
    stop();
  });

  it('collapses unexpected values to bounded placeholders', () => {
    expect(
      createPaymentTokenTelemetry({ token: 'CABCDEF', outcome: 'oops', status: { raw: 1 } }),
    ).toEqual({ event: 'payment_token_availability', token: 'other', outcome: 'unknown', status: 'unknown' });
  });

  it('never throws when the telemetry target fails', () => {
    const target = { dispatchEvent: () => { throw new Error('sink down'); } };
    expect(() => emitPaymentTokenTelemetry({ token: 'usdc', outcome: 'confirmed', status: 'supported' }, target)).not.toThrow();
  });
});
