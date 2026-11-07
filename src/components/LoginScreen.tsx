import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import gsap from 'gsap';
import { db } from '../services/db';

export function LoginScreen() {
  const { login } = useAuthStore();
  const [role, setRole] = useState<'cashier' | 'inventory'>('cashier');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  // Pin stage (sign-up only)
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  // OTP stage: 'none' or 'enter-email' (OTP entry handled by Dexie Cloud dialog)
  const [otpStage, setOtpStage] = useState<'none' | 'enter-email'>('none');
  // Sign Up vs Sign In mode
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { y: 30, opacity: 0, scale: 0.95 },
        { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'power3.out' }
      );
    }
  }, []);

  const triggerShake = () => {
    if (cardRef.current) {
      gsap.to(cardRef.current, {
        x: 10,
        duration: 0.08,
        yoyo: true,
        repeat: 5,
        onComplete: () => {
          gsap.set(cardRef.current, { clearProps: 'x' });
        },
      });
    }
  };

  // NOTE: Removed mount effect that pre-set PIN stage. PIN stage only appears
  // after OTP verification during sign-up. Logout always returns to role select.

  const handleCloudLogin = async () => {
    setLoggingIn(true);
    setError('');
    setOtpStage('enter-email');
    try {
      // Trigger the built-in Dexie Cloud OTP dialog
      await db.cloud.login();
      // After OTP verification, continue based on mode
      if (mode === 'register') {
        // Sign up: go to PIN setup
        setPin('');
        setConfirmPin('');
        setOtpStage('none');
      } else {
        // Login: done (no PIN stage)
        login(role, '');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your email and try again.');
      triggerShake();
    } finally {
      setLoggingIn(false);
    }
  };

  const hashPin = async (pin: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPin = pin.trim();

    if (!/^\d{4}$/.test(trimmedPin)) {
      setError('PIN must be exactly 4 digits.');
      triggerShake();
      return;
    }

    if (mode !== 'register') {
      // Login: just verify the PIN against the stored hash
      const savedHash = localStorage.getItem('tindahan_cashier_pin_hash');
      if (!savedHash) {
        setError('No PIN set. Please use Sign Up to create an account first.');
        triggerShake();
        return;
      }
      const enteredHash = await hashPin(trimmedPin);
      if (enteredHash !== savedHash) {
        setError('Incorrect PIN. Please try again.');
        triggerShake();
        return;
      }
      // PIN verified, complete login
      login(role, '');
      return;
    }

    // Sign up: PIN setup
    if (trimmedPin !== confirmPin) {
      setError('PINs do not match. Please verify.');
      triggerShake();
      return;
    }
    // Save PIN hash (SHA-256, cryptographic)
    const pinHash = await hashPin(trimmedPin);
    localStorage.setItem('tindahan_cashier_pin_hash', pinHash);
    // NOTE: plaintext PIN removed. Only SHA-256 hash is stored.
    setOtpStage('none');
  };

  return (
    <div ref={containerRef} className="min-h-dvh bg-gradient-to-br from-amber-500 via-amber-600 to-slate-900 flex items-center justify-center p-4">
      <div ref={cardRef} className={`bg-white rounded-3xl shadow-2xl w-full border border-amber-100 ${role === 'cashier' ? 'max-w-lg p-8 sm:p-10' : 'max-w-md p-8'}`}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl mx-auto flex items-center justify-center text-3xl font-extrabold shadow-inner mb-4">
            🏪
          </div>
          <h1 className="text-2xl font-black text-slate-900">Tindahan ni Aling Puring</h1>
          <p className="text-slate-500 text-sm mt-1">Smart Sari-Sari POS & Inventory System</p>
        </div>

        {/* Stage 1: Role Selection + Mode Toggle */}
        {otpStage === 'none' && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Select Your Role
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { setRole('cashier'); setError(''); }}
                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${
                    role === 'cashier'
                      ? 'border-amber-500 bg-amber-50/50 text-slate-900 font-extrabold shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 font-medium'
                  }`}
                >
                  <span className="text-2xl">💰</span>
                  <span className="text-sm">Cashier</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setRole('inventory'); setError(''); }}
                  className={`p-3.5 rounded-2xl border-2 flex flex-col items-center gap-1 transition-all ${
                    role === 'inventory'
                      ? 'border-amber-500 bg-amber-50/50 text-slate-900 font-extrabold shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 font-medium'
                  }`}
                >
                  <span className="text-2xl">📦</span>
                  <span className="text-sm">Inventory Staff</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={() => { setMode('login'); setError(''); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  mode === 'login'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                aria-label={mode === 'login' ? 'Sign in with existing account' : 'Switch to sign up mode'}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setMode('register'); setError(''); }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  mode === 'register'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                aria-label={mode === 'register' ? 'Sign up for a new account' : 'Switch to sign in mode'}
              >
                Sign Up
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium mt-2">
              {role === 'cashier'
                ? '💡 Access to Cashier Checkout, QuickTap, Transaction History, and Receipt Printing.'
                : '📱 Access to Barcode Scanner, Inventory Catalog, and Analytics.'}
            </div>

            {error && <p className="text-red-700 text-xs font-bold bg-red-50 p-2.5 rounded-xl border border-red-200">{error}</p>}

            <button
              type="button"
              onClick={handleCloudLogin}
              disabled={loggingIn}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingIn ? 'Preparing...' : (mode === 'register' ? 'Create Account 📧' : 'Sign In 🚀')}
            </button>

            <p className="text-center text-xs text-slate-400">
              {mode === 'register'
                ? 'Already have an account? '
                : 'New to Tindahan? '}
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'register' ? 'login' : 'register');
                  setError('');
                }}
                className="text-amber-600 hover:text-amber-700 font-bold text-sm"
              >
                {mode === 'register' ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        )}

        {/* Stage 2: Enter Email (handled by Dexie Cloud dialog) */}
        {otpStage === 'enter-email' && (
          <div className="space-y-6">
            <div className="text-center">
              <p className="text-slate-600 text-sm">
                {mode === 'register'
                  ? 'Check your email for the OTP code'
                  : 'Enter the OTP sent to your email'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {mode === 'register'
                  ? 'A verification code has been sent to the email you provided'
                  : 'We sent a 4-digit code to your email address'}
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value=""
                placeholder="XXXX"
                className="w-24 h-14 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                aria-label="OTP code"
                disabled={loggingIn}
              />
            </div>
            {error && <p className="text-red-700 text-xs font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 text-center">{error}</p>}
            <button
              type="button"
              onClick={handleCloudLogin}
              disabled={loggingIn}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingIn ? 'Verifying...' : 'Verify & Continue ✓'}
            </button>
            <button
              type="button"
              onClick={() => { setOtpStage('none'); setError(''); }}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              Back to Role Selection
            </button>
          </div>
        )}

        {/* Stage 4: PIN Setup (Sign Up Only) */}
        {mode === 'register' && (
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Set 4-Digit PIN (First Time)
              </label>
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 4].map((i) => (
                  <input
                    key={i}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={pin[i - 1] || ''}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      if (val.length <= 1) {
                        const newPin = pin.split('');
                        newPin[i - 1] = val;
                        setPin(newPin.join(''));
                        if (val && i < 4) {
                          const nextInput = e.target.parentElement?.children[i];
                          if (nextInput && typeof (nextInput as any).focus === 'function') {
                            (nextInput as any).focus();
                          }
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !pin[i - 1] && i > 1) {
                        const target = e.target as HTMLInputElement;
                        const parent = target.parentElement as HTMLElement | null;
                        if (parent) {
                          const prevInput = parent.children[i - 2] as HTMLInputElement | null;
                          if (prevInput) prevInput.focus();
                        }
                      }
                    }}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    autoComplete="one-time-code"
                    required
                  />
                ))}
              </div>
              <p className="text-xs text-amber-700 mt-2 text-center">
                This PIN will protect cashier access. You can change it anytime in Settings.
              </p>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Confirm 4-Digit PIN
                </label>
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3, 4].map((i) => (
                    <input
                      key={`c${i}`}
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      value={confirmPin[i - 1] || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (val.length <= 1) {
                          const newPin = confirmPin.split('');
                          newPin[i - 1] = val;
                          setConfirmPin(newPin.join(''));
                          if (val && i < 4) {
                            (e.target.parentElement?.children[i] as HTMLInputElement)?.focus();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !confirmPin[i - 1] && i > 1) {
                          const target = e.target as HTMLInputElement;
                          const parent = target.parentElement as HTMLElement | null;
                          if (parent) {
                            const prevInput = parent.children[i - 2] as HTMLInputElement | null;
                            if (prevInput) prevInput.focus();
                          }
                        }
                      }}
                      className="w-12 h-14 text-center text-2xl font-bold border-2 border-slate-200 rounded-xl focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                      autoComplete="one-time-code"
                      required
                    />
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-red-700 text-xs font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 text-center">{error}</p>}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingIn ? 'Setting PIN...' : 'Set PIN & Continue'}
            </button>

            <button
              type="button"
              onClick={() => { setOtpStage('none'); setPin(''); setConfirmPin(''); setError(''); }}
              className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
            >
              Back to Role Selection
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
