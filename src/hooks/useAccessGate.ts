import { useEffect, useRef, useState } from 'react';
import {
  JONARD_API_URL,
  JONARD_API_KEY,
  JONARD_API_SECRET,
} from '../jonard';

/**
 * Owner-approval gate. Once Dexie has told us who is signed in, ask Jonard
 * whether that email may use THIS app. Nothing here grants data access —
 * Dexie Cloud already did that — it only decides whether the app screen opens.
 *
 * The worker answers `{ allowed, reason, notice }`. Only a real `allowed:true`
 * opens the app. A network failure, 429 or 5xx is never treated as a denial:
 * the last decision is kept and the check is retried with backoff.
 */
export type AccessDecision = 'checking' | 'allowed' | 'pending' | 'denied';

/** An active message from the Jonard console's "Remind them" page. */
export interface GateNotice {
  id: number;
  title: string;
  body: string;
  severity: 'info' | 'warn' | 'block';
  dismissible: boolean;
  expires_at: string | null;
}

export interface AccessState {
  decision: AccessDecision;
  reason: string;
  /** Transient service problem; the last decision still applies. */
  serviceError: string;
  notice: GateNotice | null;
  /** Re-check now (used by the gate screen's button). */
  retry: () => void;
  /** Hide a dismissible notice for this page session. */
  dismissNotice: () => void;
}

interface Snapshot {
  key: string;
  decision: AccessDecision;
  reason: string;
  serviceError: string;
  notice: GateNotice | null;
}

const MESSAGES: Record<string, string> = {
  pending_approval: 'Your access is waiting for the store owner to approve it.',
  locked: 'This account has been locked. Contact the store owner.',
  past_due: 'This account is past due. Contact the store owner.',
  canceled: 'This account has been canceled. Contact the store owner.',
  subscription_expired: 'The subscription has expired. Contact the store owner.',
  not_found: 'This email is not registered with the store owner.',
  no_email: 'The approval service did not receive an email address.',
  not_allowed: 'This account may not use the app. Contact the store owner.',
};

// The worker rate-limits validate to 30 calls per 15 minutes per IP. A pending
// user checks every 15s, an approved user more slowly so an owner lock is still
// noticed without burning the quota. Failures back off exponentially to 5 min.
const PENDING_POLL_MS = 15_000;
const IDLE_POLL_MS = 90_000;
const MAX_POLL_MS = 5 * 60_000;
const HIDDEN_TAB_MS = 5_000;

function freshSnapshot(key: string, enabled: boolean): Snapshot {
  return {
    key,
    // Never start an enabled gate at 'allowed': that would let MainApp mount
    // for a frame before the first decision comes back.
    decision: enabled ? 'checking' : 'allowed',
    reason: '',
    serviceError: '',
    notice: null,
  };
}

/** Accept only the shape the worker's `validate` response actually uses. */
function readNotice(value: unknown): GateNotice | null {
  if (!value || typeof value !== 'object') return null;
  const n = value as Record<string, unknown>;
  if (typeof n.title !== 'string' || typeof n.body !== 'string') return null;
  const severity: GateNotice['severity'] =
    n.severity === 'block' || n.severity === 'warn' ? n.severity : 'info';
  return {
    id: typeof n.id === 'number' ? n.id : 0,
    title: n.title,
    body: n.body,
    severity,
    // The console sends block notices with dismissible:false; enforce that here
    // even if the row was created some other way.
    dismissible: n.dismissible !== false && severity !== 'block',
    expires_at: typeof n.expires_at === 'string' ? n.expires_at : null,
  };
}

export function useAccessGate(email: string | null, enabled: boolean): AccessState {
  const [attempt, setAttempt] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);
  const key = enabled ? `on:${email ?? ''}:${attempt}` : 'off';
  const [snapshot, setSnapshot] = useState<Snapshot>(() => freshSnapshot(key, enabled));

  // Adjusting state during render (before commit) is what removes the
  // one-frame app flash when a Dexie session resolves: the first committed
  // render of an enabled gate is already 'checking', never the old 'allowed'.
  if (snapshot.key !== key) {
    setSnapshot(freshSnapshot(key, enabled));
  }

  const decision = snapshot.decision;
  // Monotonic request id: a slow older response must never overwrite a newer
  // decision (e.g. an in-flight "allowed" landing after the owner locks them).
  const genRef = useRef(0);

  useEffect(() => {
    if (!enabled || !email) {
      genRef.current += 1;
      return;
    }

    let stopped = false;
    let failures = 0;
    // Kept as a local, not a ref of React state: the setTimeout scheduled right
    // after a response must see THAT response's decision, not the not-yet-
    // committed render value. Otherwise a pending user waits 90s, not 15s.
    let pendingNow = false;

    const apply = (change: (prev: Snapshot) => Snapshot): void => {
      if (stopped) return;
      setSnapshot((prev) => (prev.key === key ? change(prev) : prev));
    };

    const check = async (): Promise<void> => {
      const gen = (genRef.current += 1);
      try {
        const res = await fetch(`${JONARD_API_URL}/api/auth/validate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-App-Key': JONARD_API_KEY,
            'X-App-Secret': JONARD_API_SECRET,
          },
          body: JSON.stringify({ email }),
        });
        if (stopped || gen !== genRef.current) return;
        if (!res.ok) throw new Error(`gate ${res.status}`);
        const data: unknown = await res.json();
        if (stopped || gen !== genRef.current) return;

        failures = 0;
        const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        if (body.allowed === true) {
          pendingNow = false;
          apply(() => ({
            key,
            decision: 'allowed',
            reason: '',
            serviceError: '',
            notice: readNotice(body.notice),
          }));
        } else {
          const code = typeof body.reason === 'string' ? body.reason : 'not_allowed';
          pendingNow = code === 'pending_approval';
          apply(() => ({
            key,
            decision: code === 'pending_approval' ? 'pending' : 'denied',
            reason: MESSAGES[code] ?? code.replace(/_/g, ' '),
            serviceError: '',
            notice: null,
          }));
        }
      } catch {
        if (stopped || gen !== genRef.current) return;
        failures += 1;
        // A network problem or a 429 is NOT a denial. Never flip an approved
        // user out of the app because of a blip, and never show a pending user
        // "Access unavailable" when the service is merely unreachable.
        apply((prev) => ({
          ...prev,
          serviceError: failures > 1
            ? 'Still trying to reach the approval service. Your last access check still applies.'
            : 'Could not reach the approval service. Retrying…',
        }));
      }
    };

    // A fixed heartbeat is safer than chaining setTimeout on the fetch result:
    // a hung request must not stop the re-checks that unlock an approved user.
    // nextCheckAt is set BEFORE each request, so in-flight calls cannot stack up.
    let nextCheckAt = 0;
    const pollDelay = (): number => {
      const base = pendingNow ? PENDING_POLL_MS : IDLE_POLL_MS;
      return Math.min(base * 2 ** failures, MAX_POLL_MS);
    };
    const tick = (): void => {
      if (stopped || document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now < nextCheckAt) return;
      nextCheckAt = now + pollDelay();
      void check().then(() => {
        if (stopped) return;
        nextCheckAt = Math.min(nextCheckAt, Date.now() + pollDelay());
      });
    };

    const onVisible = (): void => {
      if (stopped || document.visibilityState !== 'visible') return;
      nextCheckAt = 0;
      tick();
    };

    tick();
    const interval = window.setInterval(tick, HIDDEN_TAB_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      genRef.current += 1;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [key, enabled, email]);

  const notice = snapshot.notice && !dismissedIds.includes(snapshot.notice.id)
    ? snapshot.notice
    : null;

  return {
    decision,
    reason: snapshot.reason,
    serviceError: snapshot.serviceError,
    notice,
    retry: () => setAttempt((n) => n + 1),
    dismissNotice: () => {
      const current = snapshot.notice;
      if (current) setDismissedIds((ids) => [...ids, current.id]);
    },
  };
}
