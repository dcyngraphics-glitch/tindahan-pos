import { create } from 'zustand';

export type AppMode = 'inventory' | 'cashier' | 'dashboard' | 'scanner' | 'history';

interface AppState {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

function loadMode(): AppMode {
  if (typeof window === 'undefined') return 'cashier';
  const saved = window.localStorage.getItem('tindahan_app_mode');
  if (saved === 'inventory' || saved === 'cashier' || saved === 'dashboard' || saved === 'scanner' || saved === 'history') {
    return saved;
  }
  return 'cashier';
}

export const useAppStore = create<AppState>((set) => ({
  mode: loadMode(),
  setMode: (mode) => {
    try {
      window.localStorage.setItem('tindahan_app_mode', mode);
    } catch {
      // localStorage unavailable (private browsing, storage quota) — in-memory only
    }
    set({ mode });
  },
}));