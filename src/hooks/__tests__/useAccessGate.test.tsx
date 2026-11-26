import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccessGate } from '../useAccessGate';
import { JONARD_API_KEY, JONARD_API_SECRET } from '../../jonard';

type GateBody = { allowed?: boolean; reason?: string; notice?: unknown } & Record<string, unknown>;

const response = (body: GateBody, status = 200): Response => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as unknown as Response;

const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useAccessGate', () => {
  it('sends the key pair and signed-in email, and opens only on allowed:true', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ allowed: true, reason: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAccessGate('cashier@example.com', true));
    await waitFor(() => expect(result.current.decision).toBe('allowed'));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://jonard.jonard.workers.dev/api/auth/validate');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-App-Key': JONARD_API_KEY,
      'X-App-Secret': JONARD_API_SECRET,
    });
    expect(JSON.parse(init.body as string)).toEqual({ email: 'cashier@example.com' });
  });

  it('never starts an enabled gate at allowed (no app frame before the decision)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ allowed: true }));
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useAccessGate('a@example.com', enabled),
      { initialProps: { enabled: false } },
    );
    expect(result.current.decision).toBe('allowed'); // gate off (E2E)

    rerender({ enabled: true });
    // The first committed render after login is checking, not the stale allowed.
    expect(result.current.decision).toBe('checking');
    await waitFor(() => expect(result.current.decision).toBe('allowed'));
  });

  it('shows pending_approval then re-checks until the owner approves', async () => {
    vi.useFakeTimers();
    let approved = false;
    const fetchMock = vi.fn(() =>
      Promise.resolve(approved
        ? response({ allowed: true, reason: 'ok' })
        : response({ allowed: false, reason: 'pending_approval' })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAccessGate('a@example.com', true));
    await advance(0);
    expect(result.current.decision).toBe('pending');
    expect(result.current.reason).toMatch(/waiting/i);

    approved = true;
    await advance(15_000);
    expect(result.current.decision).toBe('allowed');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('denies a locked account and shows the lock reason', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ allowed: false, reason: 'locked' })));
    const { result } = renderHook(() => useAccessGate('a@example.com', true));
    await waitFor(() => expect(result.current.decision).toBe('denied'));
    expect(result.current.reason).toMatch(/locked/i);
  });

  it('does not kick an approved user out on a network blip', async () => {
    vi.useFakeTimers();
    let offline = false;
    const fetchMock = vi.fn(() => offline
      ? Promise.reject(new Error('offline'))
      : Promise.resolve(response({ allowed: true })));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAccessGate('a@example.com', true));
    await advance(0);
    expect(result.current.decision).toBe('allowed');

    offline = true;
    await advance(90_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.decision).toBe('allowed');
    expect(result.current.serviceError).toMatch(/reach the approval service/i);
  });

  it('backs off on 429 instead of denying the user', async () => {
    vi.useFakeTimers();
    let limited = false;
    const fetchMock = vi.fn(() => Promise.resolve(limited
      ? response({ error: 'Too many requests' }, 429)
      : response({ allowed: true })));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useAccessGate('a@example.com', true));
    await advance(0);
    expect(result.current.decision).toBe('allowed');

    limited = true;
    await advance(90_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.decision).toBe('allowed');
    await advance(89_000);
    expect(fetchMock).toHaveBeenCalledTimes(2); // backed off to 180s
    await advance(91_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.decision).toBe('allowed');
  });

  it('ignores a stale allowed response that lands after a newer lock decision', async () => {
    vi.useFakeTimers();
    const waiters: Array<(value: Response) => void> = [];
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => waiters.push(resolve))));

    const { result } = renderHook(() => useAccessGate('a@example.com', true));
    await advance(0);
    expect(waiters).toHaveLength(1);
    await advance(90_000); // second poll starts while the first is still in flight
    expect(waiters).toHaveLength(2);

    await act(async () => {
      waiters[1](response({ allowed: false, reason: 'locked' }));
      await Promise.resolve();
    });
    expect(result.current.decision).toBe('denied');

    await act(async () => {
      waiters[0](response({ allowed: true }));
      await Promise.resolve();
    });
    expect(result.current.decision).toBe('denied');
  });

  it('exposes the notice returned by validate and lets it be dismissed', async () => {
    const notice = {
      id: 7, title: 'Pay your dues', body: 'Please settle today',
      severity: 'warn', dismissible: true, expires_at: null,
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ allowed: true, notice })));

    const { result } = renderHook(() => useAccessGate('a@example.com', true));
    await waitFor(() => expect(result.current.notice).toEqual(notice));
    act(() => result.current.dismissNotice());
    expect(result.current.notice).toBeNull();
  });
});
