import { useEffect, useRef, useState } from "react";
import { useAppStore, type AppMode } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { useAuth } from '../context/AuthContext';
import { useCloudSession } from '../hooks/useCloudSession';
import { DeveloperSettingsModal } from './DeveloperSettingsModal';
import { ConfirmDialog } from "./ConfirmDialog";
import { useGSAP, registerGsap, MOTION, gsap } from "../lib/motion";

interface ModeNavProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockCount?: number;
}

export function ModeNav({ isOpen, onClose, lowStockCount = 0 }: ModeNavProps) {
  const { mode, setMode } = useAppStore();
  const { role } = useAuthStore();
  const { email: accountEmail } = useCloudSession();
  const { signOut } = useAuth();
  const [devSettingsOpen, setDevSettingsOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const cashierModes: { id: AppMode; label: string; icon: string }[] = [
    { id: 'cashier', label: 'Cashier', icon: '💰' },
    { id: 'utang', label: 'Utang', icon: '📒' },
    { id: 'scanner', label: 'Scanner', icon: '📷' },
    { id: 'history', label: 'History', icon: '🧾' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  ];

  const inventoryModes: { id: AppMode; label: string; icon: string }[] = [
    { id: 'scanner', label: 'Scanner', icon: '📷' },
    { id: 'inventory', label: 'Inventory', icon: '📦' },
    { id: 'history', label: 'History', icon: '🧾' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  ];

  const activeModes = role === "inventory" ? inventoryModes : cashierModes;

  const navRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const isMountedRef = useRef(false);

  // Register the motion system once per component.
  useGSAP(() => {
    registerGsap();
  });

  // Smooth drawer + backdrop transitions. The nav always stays mounted (it
  // lives off-screen when closed); GSAP drives the slide + fade so it never
  // "pops" in/out. We kill the previous tween before starting a new one so a
  // mid-open drag never overlaps.
  useGSAP(() => {
    const nav = navRef.current;
    const backdrop = backdropRef.current;
    if (!nav) return;

    // Kill any running tween so we never overlap.
    tweenRef.current?.kill();

    // First run: apply the current state instantly instead of animating, so
    // nothing flashes on screen before the first toggle. This must cover the
    // backdrop as well — React StrictMode double-invokes effects in dev, which
    // masked a stuck, fully opaque backdrop in production builds.
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      gsap.set(nav, {
        x: isOpen ? 0 : "-100%",
        autoAlpha: isOpen ? 1 : 0,
        overwrite: "auto",
      });
      if (backdrop) {
        gsap.set(backdrop, { autoAlpha: isOpen ? 1 : 0, overwrite: "auto" });
      }
      return;
    }

    if (isOpen) {
      // Force off-screen start, then slide in (prevents a flash when the
      // drawer re-opens after being closed).
      gsap.set(nav, { x: "-100%", autoAlpha: 0, overwrite: "auto" });
      tweenRef.current = gsap.to(nav, {
        x: 0,
        autoAlpha: 1,
        duration: MOTION.standard,
        ease: MOTION.easeOut,
        overwrite: "auto",
      });
    } else {
      tweenRef.current = gsap.to(nav, {
        x: "-100%",
        autoAlpha: 0,
        duration: MOTION.standard,
        ease: MOTION.easeIn,
        overwrite: "auto",
      });
    }

    // Backdrop follows the drawer — fast fade out on close so nothing blocks
    // the cashier's next tap (see Atlassian motion guidance: exit faster
    // than entrance).
    if (backdrop) {
      const dur = isOpen ? MOTION.standard : 0.12;
      const ease = isOpen ? MOTION.easeOut : MOTION.easeNone;
      tweenRef.current = gsap.to(backdrop, {
        autoAlpha: isOpen ? 1 : 0,
        duration: dur,
        ease,
        overwrite: "auto",
      });
    }
  }, [isOpen]);

  // Mark mounted so the first run only applies the closed position.
  useEffect(() => {
    isMountedRef.current = true;
  }, []);

  return (
    <>
      {/* Backdrop overlay — always mounted so GSAP can fade it. */}
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sliding Navigation Drawer — always mounted, off-screen when closed. */}
      <nav
        ref={navRef}
        className="fixed bottom-0 left-0 top-0 h-full bg-white border-r border-slate-200 flex flex-col py-4 px-3 z-50 shadow-2xl w-64 max-w-[85vw]"
        role="navigation"
        aria-label="Main Navigation"
      >
        <div className="flex justify-between items-center px-2 mb-6 border-b pb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">🏪</span>
            <div className="min-w-0">
              <span className="font-extrabold text-slate-800">Softies Store</span>
              {accountEmail && (
                <div className="text-xs text-slate-500 truncate max-w-[180px]" title={accountEmail}>
                  ✉ {accountEmail}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold min-h-[44px] min-w-[44px] transition"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 flex-1">
          {activeModes.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                onClose();
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                mode === m.id
                  ? 'bg-amber-500 text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 font-semibold'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{m.icon}</span>
                <span className="text-sm">{m.label}</span>
              </div>
              {m.id === 'inventory' && lowStockCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-black px-2 py-0.5 rounded-full shadow-xs">
                  {lowStockCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="pt-4 border-t border-slate-200 space-y-2">
          {role === 'cashier' ? (
            <button
              onClick={() => {
                setDevSettingsOpen(true);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-amber-700 hover:bg-amber-50 font-bold transition"
            >
              <span className="text-2xl">🛠️</span>
              <span className="text-sm">Dev Settings</span>
            </button>
          ) : (
            <button
              onClick={() => setLogoutConfirmOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-600 hover:bg-red-50 font-bold transition"
            >
              <span className="text-2xl">🚪</span>
              <span className="text-sm">Log Out</span>
            </button>
          )}
        </div>
      </nav>

      <ConfirmDialog
        open={logoutConfirmOpen}
        title="Log Out?"
        message={
          logoutError ||
          'You will be signed out of your account on this device. Anything not yet uploaded is uploaded first.'
        }
        confirmLabel="Log Out"
        onConfirm={() => {
          // signOut() uploads pending changes before signing out. If it cannot,
          // stay signed in and say why — logging out anyway would risk
          // discarding sales that were never uploaded.
          void signOut().catch((err: unknown) => {
            setLogoutError(err instanceof Error ? err.message : 'Could not sign out. Please try again.');
          });
        }}
        onCancel={() => {
          setLogoutError('');
          setLogoutConfirmOpen(false);
        }}
      />

      {devSettingsOpen && <DeveloperSettingsModal onClose={() => setDevSettingsOpen(false)} />}
    </>
  );
}
