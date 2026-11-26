import { useEffect, useState } from 'react';
import {
  JONARD_API_URL,
  JONARD_API_KEY,
  JONARD_API_SECRET,
} from '../jonard';

/**
 * Owner-approval gate. Once Dexie has told us who is signed in, ask Jonard
 * whether that email may use THIS app. Nothing here grants data access —
 * Dexie Cloud already did that — it only decides whether the app screen opens.
 */
export type AccessDecision = 'checking' | 'allowed' | 'pending' | 'denied';

export interface AccessState {
  decision: AccessDecision;
  reason: string;
  /** Call after the owner approves, or to retry a transient network error. */
  retry: () => void;
}

const MESSAGES: Record<string, string> = {
  pending_approval: 'Your access is waiting for the store owner to approve it.',
  locked: 'This account has been locked. Contact the store owner.',
  past_due: 'This account is past due. Contact the store owner.',
  canceled: 'This account has been canceled. Contact the store owner.',
  subscription_expired: 'The subscription has expired. Contact the store owner.',
  not_found: 'This email is not registered with the store owner.',
};

export function useAccessGate(email: string | null, enabled: boolean): AccessState {
  const [decision, setDecision] = useState<AccessDecision>(enabled ? 'checking' : 'allowed');
  const [reason, setReason] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !email) {
      setDecision(enabled ? 'checking' : 'allowed');
      return;
    }
    let alive = true;
    setDecision('checking');
    setReason('');

    const check = () => {
      fetch(`${JONARD_API_URL}/api/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-App-Key': JONARD_API_KEY,
          'X-App-Secret': JONARD_API_SECRET,
        },
        body: JSON.stringify({ email }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(`gate ${res.status}`);
          return res.json();
        })
        .then((data: any) => {
          if (!alive) return;
          if (data?.allowed === true) {
            setDecision('allowed');
            setReason('');
          } else {
            const r = data?.reason || 'not_allowed';
            setReason(MESSAGES[r] || r.replace(/_/g, ' '));
            setDecision(r === 'pending_approval' ? 'pending' : 'denied');
          }
        })
        .catch(() => {
          if (!alive) return;
          setReason('Could not reach the approval service. Check your connection and try again.');
          setDecision('denied');
        });
    };

    check();
    // While waiting for approval, re-check quietly so the app opens on its own
    // once the owner clicks Approve — no need to reload or log in again.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') check();
    }, 15000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [email, enabled, attempt]);

  return { decision, reason, retry: () => setAttempt((n) => n + 1) };
}
