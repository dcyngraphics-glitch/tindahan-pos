import { useState, type ReactNode } from 'react';
import { getCashierPinHash, hashPin } from '../services/cashierPin';

/**
 * Locks the cashier role behind the 4-digit shift PIN.
 *
 * The PIN used to be written to localStorage and never read by anything, so the
 * "Cashier Security PIN" setting did nothing. It is now required every time the
 * app is opened as a cashier — there is no shift switcher to reach it later.
 */
export function CashierPinGate({ children }: { children: ReactNode }) {
  const [hash] = useState(getCashierPinHash);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!hash || unlocked) return <>{children}</>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError('Enter the 4-digit PIN.');
      return;
    }
    if ((await hashPin(pin)) === hash) {
      setError('');
      setUnlocked(true);
    } else {
      setError('Incorrect PIN. Try again.');
      setPin('');
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-to-br from-amber-500 via-amber-600 to-slate-900 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center">
        <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center text-3xl font-extrabold shadow-inner mb-4">
          🔒
        </div>
        <h1 className="text-xl font-black text-slate-900">Cashier Shift Locked</h1>
        <p className="text-slate-500 text-sm mt-1 mb-6">Enter your 4-digit PIN to start the shift.</p>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          autoFocus
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ''));
            setError('');
          }}
          placeholder="••••"
          aria-label="Cashier PIN"
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-center font-mono text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        {error && <p className="mt-3 text-xs font-bold text-red-700">{error}</p>}
        <button
          type="submit"
          className="mt-6 w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl transition"
        >
          Unlock Shift
        </button>
      </form>
    </div>
  );
}
