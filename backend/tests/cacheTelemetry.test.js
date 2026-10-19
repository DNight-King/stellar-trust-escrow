/**
 * Cache Telemetry Tests
 *
 * Verifies that the response cache emits bounded metrics (outcome + scope
 * labels only) and correlated logs without tenant identifiers, cache keys,
 * paths, or error messages, and that telemetry failures never break requests.
 */

import { jest } from '@jest/globals';

const mockCache = {
  get: jest.fn(async () => null),
  setWithTags: jest.fn(async () => {}),
};
const counter = { inc: jest.fn() };
const logs = [];
const log = {
  debug: jest.fn((entry) => logs.push(entry)),
  warn: jest.fn((entry) => logs.push(entry)),
};

jest.unstable_mockModule('../lib/cache.js', () => ({ default: mockCache }));
jest.unstable_mockModule('../lib/metrics.js', () => ({ httpCacheRequestsTotal: counter }));
jest.unstable_mockModule('../config/logger.js', () => ({ createModuleLogger: () => log }));

const { cacheResponse } = await import('../api/middleware/cache.js');

const TENANT = { id: 'tid-secret-123', slug: 'acme-secret' };
const SENSITIVE = /tid-secret|acme-secret|GABC|t:|\/api\//;

function makeReq(tenant = TENANT) {
  return { method: 'GET', path: '/api/reputation/GABCWALLET', query: {}, tenant };
}

function makeRes() {
  const res = { statusCode: 200, setHeader: jest.fn(), json: jest.fn(() => res), on: jest.fn() };
  return res;
}

function emitted() {
  return JSON.stringify({ metrics: counter.inc.mock.calls, logs });
}

beforeEach(() => {
  jest.clearAllMocks();
  logs.length = 0;
  counter.inc.mockImplementation(() => {});
});

test('records miss and store with tenant scope, then hit on the next request', async () => {
  const mw = cacheResponse({ tags: ['reputation'] });
  const res = makeRes();
  await mw(makeReq(), res, jest.fn());
  await res.json({ score: 1 });

  mockCache.get.mockResolvedValueOnce({ score: 1 });
  await mw(makeReq(), makeRes(), jest.fn());

  expect(counter.inc.mock.calls.map(([labels]) => labels)).toEqual([
    { outcome: 'miss', scope: 'tenant' },
    { outcome: 'store', scope: 'tenant' },
    { outcome: 'hit', scope: 'tenant' },
  ]);
  expect(emitted()).not.toMatch(SENSITIVE);
});

test('records bypass with global scope for tenantless skipped requests', async () => {
  const mw = cacheResponse({ skip: () => true });
  const next = jest.fn();
  await mw(makeReq(undefined), makeRes(), next);

  expect(next).toHaveBeenCalled();
  expect(counter.inc).toHaveBeenCalledWith({ outcome: 'bypass', scope: 'global' });
  expect(mockCache.get).not.toHaveBeenCalled();
});

test('records cache read errors without leaking the error message', async () => {
  mockCache.get.mockRejectedValueOnce(new Error('redis down for t:acme-secret:http:GET'));
  const mw = cacheResponse();

  await expect(mw(makeReq(), makeRes(), jest.fn())).rejects.toThrow('redis down');
  expect(counter.inc).toHaveBeenCalledWith({ outcome: 'error', scope: 'tenant' });
  expect(log.warn).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'cache.outcome', outcome: 'error', errorName: 'Error' }),
  );
  expect(emitted()).not.toMatch(SENSITIVE);
});

test('records store errors from the response interceptor', async () => {
  mockCache.setWithTags.mockRejectedValueOnce(new Error('write failed'));
  const mw = cacheResponse();
  const res = makeRes();
  await mw(makeReq(), res, jest.fn());

  await expect(res.json({ ok: true })).rejects.toThrow('write failed');
  expect(counter.inc).toHaveBeenLastCalledWith({ outcome: 'store_error', scope: 'tenant' });
});

test('telemetry failures do not break the request', async () => {
  counter.inc.mockImplementation(() => {
    throw new Error('registry broken');
  });
  const mw = cacheResponse();
  const res = makeRes();
  const next = jest.fn();

  await mw(makeReq(), res, next);
  expect(next).toHaveBeenCalled();
  expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
});
