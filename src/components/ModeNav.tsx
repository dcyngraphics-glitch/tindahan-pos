import { useState } from 'react';
import { useAppStore, type AppMode } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { useAuth } from '../context/AuthContext';
import { useCloudSession } from '../hooks/useCloudSession';
import { DeveloperSettingsModal } from './DeveloperSettingsModal';
import { ConfirmDialog } from './ConfirmDialog';

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

  const activeModes = role === 'inventory' ? inventoryModes : cashierModes;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sliding Navigation Drawer */}
      <nav
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
