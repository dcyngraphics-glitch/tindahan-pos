import { useEffect, useState } from 'react';
import { db } from '../services/db';

export interface SyncState {
  status: 'not-started' | 'connecting' | 'connected' | 'disconnected' | 'error' | 'offline';
  phase: 'initial' | 'not-in-sync' | 'pushing' | 'pulling' | 'in-sync' | 'error' | 'offline';
  progress?: number;
  error?: Error;
}

/**
 * Tracks whether the store's data has actually reached the cloud.
 *
 * Without this, a failed upload is invisible: the app keeps saving on the
 * device and nothing tells you nothing has left it.
 */
export function useSyncStatus(): SyncState | null {
  const [state, setState] = useState<SyncState | null>(() => {
    const cloud = (db as unknown as { cloud?: any }).cloud;
    return cloud?.syncState?.getValue?.() ?? null;
  });

  useEffect(() => {
    const cloud = (db as unknown as { cloud?: any }).cloud;
    const subject = cloud?.syncState;
    if (!subject?.subscribe) return;
    const subscription = subject.subscribe((next: SyncState) => setState(next));
    return () => subscription.unsubscribe();
  }, []);

  return state;
}
