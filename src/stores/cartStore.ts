import { create } from 'zustand';
import { lineTotal, type TransactionItem } from '../services/db';

interface CartItem extends TransactionItem {
  cartId: string;
  availableStock?: number; // Track available stock for validation
}

type Discount = { type: 'percent' | 'fixed'; value: number };

interface CartState {
  items: CartItem[];
  discount: Discount | null;
  addItem: (item: TransactionItem & { availableStock?: number }) => void;
  removeItem: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  /** Re-weighing a crop line changes both the weight and possibly the price. */
  updateItem: (cartId: string, patch: { quantity?: number; price?: number }) => void;
  clearCart: () => void;
  getTotal: () => number;
  getDiscountedTotal: () => number;
  getItemCount: () => number;
  setDiscount: (d: Discount | null) => void;
}

export type { Discount };

let cartIdCounter = 0;

// Helper to safely parse JSON with prototype pollution protection
export function safeParseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    // Guard against prototype pollution and ensure array
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item && typeof item === 'object' && !Object.prototype.hasOwnProperty.call(item, '__proto__'));
    }
    return [];
  } catch {
    return [];
  }
}

// Load initial cart from localStorage if present
const initialItems = safeParseCart(localStorage.getItem('tindahan_active_cart'));

export const useCartStore = create<CartState>((set, get) => {
  // Sync changes to localStorage for Customer Display
  const persistAndSet = (updater: (state: CartState) => Partial<CartState> | CartState) => {
    set((state) => {
      const nextState = typeof updater === 'function' ? updater(state) : updater;
      const items = 'items' in nextState ? nextState.items : state.items;
      localStorage.setItem('tindahan_active_cart', JSON.stringify(items));
      // Native 'storage' event fires automatically in OTHER tabs — no manual dispatch needed.
      // Dispatch custom event for same-tab listeners (like CustomerDisplay)
      window.dispatchEvent(new Event('tindahan-cart-update'));
      return nextState;
    });
  };

  // Listen to storage events from other windows/tabs
  if (typeof window !== 'undefined') {
    const handleStorage = () => {
      const current = localStorage.getItem('tindahan_active_cart');
      // Apply same prototype pollution protection as initial load
      const safeItems = safeParseCart(current);
      if (safeItems.length > 0 || current === '[]') {
        set({ items: safeItems });
      }
    };
    window.addEventListener('storage', handleStorage);

    // Also listen for custom cart update events (for same-tab sync like CustomerDisplay)
    const handleCartUpdate = () => {
      const current = localStorage.getItem('tindahan_active_cart');
      const safeItems = safeParseCart(current);
      set({ items: safeItems });
    };
    window.addEventListener('tindahan-cart-update', handleCartUpdate);
  }

  return {
    items: initialItems,

    addItem: (item) => {
      const { availableStock, ...itemData } = item;
      const quantity = itemData.quantity ?? 1;
      // Weight-sold items are never merged: each weighing is its own line, so a
      // customer buying two separate lots of rice gets two readable lines.
      const existing = itemData.soldByWeight
        ? undefined
        : get().items.find(i => i.productId === itemData.productId);

      if (existing) {
        if (existing.availableStock !== undefined && existing.quantity + 1 > existing.availableStock) {
          window.dispatchEvent(new CustomEvent('tindahan-toast', { detail: `Cannot add more. Only ${existing.availableStock} available in stock.` }));
          return;
        }
        persistAndSet(state => ({
          items: state.items.map(i =>
            i.cartId === existing.cartId
              ? { ...i, quantity: i.quantity + 1 }
              : i
          ),
        }));
      } else {
        if (availableStock !== undefined && quantity > availableStock) {
          window.dispatchEvent(new CustomEvent('tindahan-toast', { detail: 'Cannot add. Item is out of stock.' }));
          return;
        }
        const cartId = `cart-${++cartIdCounter}-${Date.now()}`;
        persistAndSet(state => ({
          items: [...state.items, { ...itemData, quantity, cartId, availableStock }],
        }));
      }
    },

    removeItem: (cartId) => {
      persistAndSet(state => ({
        items: state.items.filter(i => i.cartId !== cartId),
      }));
    },

    updateQuantity: (cartId, quantity) => {
      if (quantity <= 0) {
        get().removeItem(cartId);
        return;
      }
      const item = get().items.find(i => i.cartId === cartId);
      if (item?.availableStock !== undefined && quantity > item.availableStock) {
        window.dispatchEvent(new CustomEvent('tindahan-toast', { detail: `Cannot set quantity to ${quantity}. Only ${item.availableStock} available.` }));
        return;
      }
      persistAndSet(state => ({
        items: state.items.map(i =>
          i.cartId === cartId ? { ...i, quantity } : i
        ),
      }));
    },

    updateItem: (cartId, patch) => {
      if (patch.quantity !== undefined && patch.quantity <= 0) {
        get().removeItem(cartId);
        return;
      }
      persistAndSet(state => ({
        items: state.items.map(i =>
          i.cartId === cartId ? { ...i, ...patch } : i
        ),
      }));
    },

    discount: null,

    setDiscount: (d) => set({ discount: d }),

    clearCart: () => {
      persistAndSet(() => ({ items: [] }));
      set({ discount: null });
    },

    getTotal: () => {
      return get().items.reduce((sum, item) => sum + lineTotal(item), 0);
    },

    getDiscountedTotal: () => {
      const total = get().getTotal();
      const d = get().discount;
      if (!d) return total;
      if (d.type === 'percent') return Math.round(total * Math.max(0, 1 - d.value / 100));
      return Math.max(0, total - d.value);
    },

    getItemCount: () => {
      // A weighed line counts as one item however many kilos it holds — showing
      // "1.25 items" would be meaningless at the till.
      return get().items.reduce((sum, item) => sum + (item.soldByWeight ? 1 : item.quantity), 0);
    },
  };
});
