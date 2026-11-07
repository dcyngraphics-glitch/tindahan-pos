import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { db } from '../services/db';
import { useAuthStore } from '../stores/authStore';

/**
 * Sign-in actions only.
 *
 * The signed-in USER is deliberately not here: `useCloudSession()` owns that, and
 * duplicating the db.cloud.currentUser subscription in two places created two sources
 * of truth for the same fact.
 */
interface AuthContextValue {
  /** Last sign-in failure, in plain language. Cleared when a new attempt starts. */
  cloudError: string;
  /**
   * Starts the Dexie Cloud email-OTP sign-in.
   *
   * Deliberately returns void and is NOT awaited: the addon keeps the underlying
   * promise pending while it asks for the email and then the one-time code through
   * db.cloud.userInteraction, and resolves only once the code is verified. Signed-in
   * state is read from useCloudSession(); failures surface in `cloudError`.
   */
  cloudLogin: () => void;
  cloudLogout: () => Promise<void>;
  /**
   * Signs out of Dexie Cloud and clears the locally persisted role.
   *
   * Rejects when the addon's "you have unsynced changes" confirmation is dismissed —
   * the caller must keep the session in that case, so nothing is cleared here until
   * `cloudLogout` resolves.
   */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [cloudError, setCloudError] = useState('');

  const cloudLogin = useCallback((): void => {
    const cloud = (db as any).cloud;
    if (!cloud) {
      setCloudError('Sign-in is unavailable in this build.');
      return;
    }
    // cloud.options is null until configure() has run. Without this check the addon
    // throws an opaque "Cannot read properties of null (reading 'databaseUrl')".
    if (!cloud.options) {
      setCloudError('Sign-in is not configured in this build.');
      return;
    }

    setCloudError('');

    // One call, with no `intent`, and never a follow-up carrying an `otp`:
    //  - intent:'login' tells Dexie Cloud to accept only already-registered users, so a
    //    first-ever sign-in is refused with USER_NOT_REGISTERED no matter what the
    //    database's user policy says. Omitting it lets the server register a new user
    //    on first sign-in.
    //  - Dexie Cloud verifies a code against an `otp_id` the server returns alongside
    //    the emailed code, and the addon does not expose it — so a second
    //    login({ email, otp }) cannot verify anything and only requests a fresh code.
    // grant_type:'otp' asks for the email prompt rather than the provider chooser.
    cloud
      .login({ grant_type: 'otp' })
      .then(() => {
        // requireAuth is false (see services/db.ts), so the addon's ready handler already
        // ran its initial sync BEFORE this user existed — unauthenticated, so it could
        // not produce a serverRevision, and the WebSocket refuses to connect until one
        // exists. login() does fire its own resync, but that goes through the local sync
        // worker with the schema it captured at startup. Pull explicitly now that we
        // actually hold a token, so the first sync and the socket both come up.
        return cloud.sync({ purpose: 'pull', wait: true });
      })
      .catch((err: any) => {
        if (err?.name === 'OAuthRedirectError') return; // page is redirecting for OAuth
        if (err?.name === 'AbortError') return; // the user dismissed the prompt
        setCloudError(err?.message || 'Sign in failed. Please try again.');
      });
  }, []);

  const cloudLogout = useCallback(async (): Promise<void> => {
    const cloud = (db as any).cloud;
    if (!cloud) return;
    await cloud.logout();
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    await cloudLogout();
    // Clear the locally persisted role only after the cloud session is really gone,
    // so a cancelled logout does not leave the app half-signed-out.
    useAuthStore.getState().logout();
  }, [cloudLogout]);

  return (
    <AuthContext.Provider value={{ cloudError, cloudLogin, cloudLogout, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
