import { useState } from 'react';
import { useAppStore, type AppMode } from '../stores/appStore';
import { useAuthStore } from '../stores/authStore';
import { DeveloperSettingsModal } from './DeveloperSettingsModal';

interface ModeNavProps {
  isOpen: boolean;
  onClose: () => void;
  lowStockCount?: number;
}

export function ModeNav({ isOpen, onClose, lowStockCount = 0 }: ModeNavProps) {
  const { mode, setMode } = useAppStore();
  const { role } = useAuthStore();
  const [devSettingsOpen, setDevSettingsOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const cashierModes: { id: AppMode; label: string; icon: string }[] = [
    { id: 'cashier', label: 'Cashier', icon: '💰' },
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
        className="fixed inset-0 bg-black/50 z-40 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sliding Navigation Drawer */}
      <nav
        className="fixed bottom-0 left-0 top-0 h-full bg-white border-r border-slate-200 flex flex-col py-4 px-3 z-50 shadow-2xl w-64 max-w-[85vw] animate-in slide-in-from-left duration-200"
        role="navigation"
        aria-label="Main Navigation"
      >
        <div className="flex justify-between items-center px-2 mb-6 border-b pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏪</span>
            <span className="font-extrabold text-slate-800">Tindahan POS</span>
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
                <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
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

      {logoutConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Log out">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Log Out?</h3>
            <p className="text-sm text-slate-600 mb-6">You will be signed out of your account. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setLogoutConfirmOpen(false)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl min-h-[44px] transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setLogoutConfirmOpen(false);
                  useAuthStore.getState().logout();
                }}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl min-h-[44px] transition"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {devSettingsOpen && <DeveloperSettingsModal onClose={() => setDevSettingsOpen(false)} />}
    </>
  );
}
