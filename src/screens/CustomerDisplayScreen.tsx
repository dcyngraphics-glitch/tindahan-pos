import { useEffect, useState } from 'react';
import { useCartStore } from '../stores/cartStore';
import { formatPeso, lineTotal, formatWeight } from '../services/db';

// Read store name directly from localStorage — this screen may run in a separate tab
function getStoreName(): string {
  try {
    const raw = localStorage.getItem('tindahan_receipt_config');
    if (!raw) return 'Softies Store';
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.storeName === 'string') return parsed.storeName;
  } catch { /* ignore */ }
  return 'Softies Store';
}

/**
 * The customer-facing screen.
 *
 * The idle state is dark text on the amber gradient on purpose: white on
 * amber-500..700 measured 2.15:1 at the light end, which fails WCAG AA for the
 * one surface the customer actually reads from across the counter.
 */
export function CustomerDisplay() {
  const { items, getTotal } = useCartStore();
  const [, setTick] = useState(0);
  const [storeName] = useState(getStoreName);

  useEffect(() => {
    const handleStorage = () => setTick(t => t + 1);
    const handleCartUpdate = () => setTick(t => t + 1);
    // Listen for storage events from OTHER tabs
    window.addEventListener('storage', handleStorage);
    // Listen for custom events from SAME tab (cashier actions)
    window.addEventListener('tindahan-cart-update', handleCartUpdate);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('tindahan-cart-update', handleCartUpdate);
    };
  }, []);

  const total = getTotal();

  if (items.length === 0) {
    return (
      <div className="min-h-dvh bg-gradient-to-br from-amber-400 to-amber-600 flex flex-col items-center justify-center text-slate-900">
        <div className="text-8xl mb-6">🏪</div>
        <h1 className="text-4xl font-black">{storeName}</h1>
        <p className="text-xl mt-2 text-slate-800">Welcome! Kumusta po?</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 text-white z-50 flex flex-col justify-between p-8">
      <header className="text-center">
        <h1 className="text-3xl font-bold text-amber-400">{storeName}</h1>
        <p className="text-slate-400 text-lg">Salamat po sa pagbili!</p>
      </header>

      <div className="flex-1 my-6 overflow-y-auto space-y-4 max-w-2xl mx-auto w-full">
        {items.map((item) => (
          <div key={item.cartId} className="flex justify-between items-center bg-slate-800 p-6 rounded-2xl text-xl">
            <div>
              <p className="font-semibold">{item.name}</p>
              <p className="text-sm text-slate-400">{item.soldByWeight ? `${formatWeight(item.quantity)} ${formatPeso(item.price)}/kg` : `${item.quantity}x ${formatPeso(item.price)}`}</p>
            </div>
            <p className="font-bold text-amber-400">{formatPeso(lineTotal(item))}</p>
          </div>
        ))}
      </div>

      <footer className="bg-slate-800 p-8 rounded-3xl flex justify-between items-center max-w-2xl mx-auto w-full">
        <span className="text-2xl text-slate-300">Total Amount Due</span>
        <span className="text-5xl font-extrabold text-amber-400">{formatPeso(total)}</span>
      </footer>
    </div>
  );
}
