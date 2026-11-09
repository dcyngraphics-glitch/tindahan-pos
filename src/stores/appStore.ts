import { create } from 'zustand';

export type AppMode = 'inventory' | 'cashier' | 'dashboard' | 'scanner' | 'history' | 'utang';

const MODES: AppMode[] = ['inventory', 'cashier', 'dashboard', 'scanner', 'history', 'utang'];

interface AppState {
  mode: AppMode;
  /**
   * @param opts.updateUrl Pass false when the mode is being set *because* the
   *   URL changed (Back/Forward, hash edit), so history is not written again.
   */
  setMode: (mode: AppMode, opts?: { updateUrl?: boolean }) => void;
}

/**
 * The current screen lives in the URL hash (`#/cashier`) so reloads, shared
 * links and the browser Back button behave the way a user expects. Returns null
 * when the hash is absent or is not a mode (e.g. `#customer`).
 */
export function modeFromLocation(): AppMode | null {
  try {
    const hash = window.location.hash;
    if (!hash.startsWith('#/')) return null;
    const candidate = hash.slice(2);
    return (MODES as string[]).includes(candidate) ? (candidate as AppMode) : null;
  } catch {
    return null;
  }
}

function loadMode(): AppMode {
  const fromUrl = modeFromLocation();
  if (fromUrl) return fromUrl;
  try {
    const saved = window.localStorage.getItem('tindahan_app_mode');
    if (saved === 'inventory' || saved === 'cashier' || saved === 'dashboard' || saved === 'scanner' || saved === 'history' || saved === 'utang') {
      return saved;
    }
  } catch {
    // localStorage unavailable (private browsing, storage quota) — use default
  }
  return 'cashier';
}

export const useAppStore = create<AppState>((set) => ({
  mode: loadMode(),
  setMode: (mode, opts) => {
    try {
      window.localStorage.setItem('tindahan_app_mode', mode);
    } catch {
      // localStorage unavailable (private browsing, storage quota) — in-memory only
    }
    if (opts?.updateUrl !== false) {
      try {
        // pushState (not replaceState) so Back walks back through the screens the
        // user actually visited. pushState fires neither hashchange nor popstate.
        window.history.pushState(null, '', '#/' + mode);
      } catch {
        // history API unavailable — the mode still switches in-memory
      }
    }
    set({ mode });
  },
}));