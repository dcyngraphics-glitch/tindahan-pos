import { useSyncStatus } from '../hooks/useSyncStatus';

const STYLES = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-700',
} as const;

const DOTS = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
} as const;

/**
 * Shows whether the store's data has reached the cloud. Syncing happens in the
 * background and can fail silently, so this is the only on-screen evidence that
 * the second device will see today's sales.
 */
export function SyncIndicator() {
  const state = useSyncStatus();
  if (!state) return null;

  const { status, phase } = state;

  let color: keyof typeof STYLES = 'green';
  let label = 'Synced';

  if (status === 'error' || phase === 'error') {
    color = 'red';
    label = 'Sync problem';
  } else if (status === 'offline' || status === 'disconnected' || phase === 'offline') {
    color = 'red';
    label = 'Offline';
  } else if (status === 'connected' && (phase === 'pushing' || phase === 'pulling')) {
    color = 'amber';
    label = 'Syncing…';
  } else if (status === 'connected' || phase === 'in-sync') {
    color = 'green';
    label = 'Synced';
  } else {
    color = 'amber';
    label = 'Connecting…';
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${STYLES[color]}`}
      title="Whether your sales have been uploaded to the cloud"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${DOTS[color]}`} />
      {label}
    </span>
  );
}
