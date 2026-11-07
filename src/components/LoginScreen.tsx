import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAuthStore, type UserRole } from '../stores/authStore';
import gsap from 'gsap';

/**
 * The signed-out screen.
 *
 * It does not collect the email or the one-time code itself: Dexie Cloud runs that
 * whole conversation and asks for each value through db.cloud.userInteraction, which
 * <UserInteractionPrompt /> renders on top of this card. So this screen is only the
 * entry point — pick a role, press Sign In, and whatever went wrong last time.
 */
export function LoginScreen() {
  const { cloudLogin, cloudError } = useAuth();
  const { login } = useAuthStore();
  const [role, setRole] = useState<UserRole>('cashier');

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

  const handleSignIn = () => {
    // Remember the role locally now; the cloud session is the real gate, and
    // useCloudSession() decides when the app swaps this screen for the main one.
    login(role);
    cloudLogin();
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

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Select Your Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('cashier')}
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
                onClick={() => setRole('inventory')}
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

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600 font-medium">
            {role === 'cashier'
              ? '💡 Access to Cashier Checkout, QuickTap, Transaction History, and Receipt Printing.'
              : '📱 Access to Barcode Scanner, Inventory Catalog, and Analytics.'}
          </div>

          {cloudError && (
            <p className="text-red-700 text-xs font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 text-center">
              {cloudError}
            </p>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-2xl shadow-lg transition-transform active:scale-95"
          >
            Sign In 🚀
          </button>

          <p className="text-center text-xs text-slate-400">
            We&apos;ll email you a one-time code — no password to remember. Your account is
            created the first time you sign in.
          </p>
        </div>
      </div>
    </div>
  );
}
