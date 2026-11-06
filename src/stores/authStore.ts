import { create } from 'zustand';
import { useAppStore } from './appStore';

export type UserRole = 'cashier' | 'inventory';

export interface AuthState {
  isAuthenticated: boolean;
  role: UserRole | null;
  login: (role: UserRole, email: string) => void;
  logout: () => void;
}

// Helper to safely parse JSON with prototype pollution protection
export function safeParseAuth(raw: string | null): { isAuthenticated: boolean; role: UserRole | null } {
  if (!raw) return { isAuthenticated: false, role: null };
  try {
    const parsed = JSON.parse(raw);
    // Guard against prototype pollution
    if (parsed && typeof parsed === 'object' && !Object.prototype.hasOwnProperty.call(parsed, '__proto__') && !Object.prototype.hasOwnProperty.call(parsed, 'constructor')) {
      return {
        isAuthenticated: Boolean(parsed.isAuthenticated),
        role: parsed.role === 'cashier' || parsed.role === 'inventory' ? parsed.role : null,
      };
    }
    return { isAuthenticated: false, role: null };
  } catch {
    return { isAuthenticated: false, role: null };
  }
}

const initialAuth = safeParseAuth(localStorage.getItem('tindahan_auth'));

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: initialAuth.isAuthenticated,
  role: initialAuth.role,
  login: (role, _email) => {
    const authState = { isAuthenticated: true, role };
    localStorage.setItem('tindahan_auth', JSON.stringify(authState));
    // Inventory staff: land in Inventory list by default on mobile (scanner via nav)
    useAppStore.getState().setMode(role === 'inventory' ? 'inventory' : 'cashier');
    set(authState);
  },
  logout: () => {
    localStorage.removeItem('tindahan_auth');
    useAppStore.getState().setMode('cashier');
    set({ isAuthenticated: false, role: null });
  },
}));
