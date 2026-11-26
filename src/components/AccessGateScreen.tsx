interface Props {
  email: string | null;
  decision: 'checking' | 'pending' | 'denied';
  reason: string;
  /** Transient service problem; the last decision still applies. */
  serviceError?: string;
  onRetry: () => void;
}

/** Shown instead of the POS until Jonard says this email may use it. */
export function AccessGateScreen({ email, decision, reason, serviceError, onRetry }: Props) {
  const pending = decision !== 'denied';
  return (
    <div className="min-h-dvh bg-gradient-to-br from-amber-500 via-amber-600 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center">
        <div className="text-4xl mb-3">{pending ? '⏳' : '⛔'}</div>
        <h1 className="text-lg font-black text-slate-900 mb-2" role="status" aria-live="polite">
          {decision === 'checking' ? 'Checking access…' : pending ? 'Waiting for approval' : 'Access unavailable'}
        </h1>
        <p className="text-sm text-slate-600">{reason || 'Checking your access with the store owner.'}</p>
        {serviceError && (
          <p className="text-xs text-amber-900 mt-2" role="status">{serviceError}</p>
        )}
        {email && <p className="text-xs text-slate-500 mt-2 break-all">Signed in as {email}</p>}
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl min-h-[44px]"
        >
          {pending ? 'Check again' : 'Try again'}
        </button>
        <p className="text-xs text-slate-500 mt-3">Once approved, this screen updates on its own.</p>
      </div>
    </div>
  );
}
