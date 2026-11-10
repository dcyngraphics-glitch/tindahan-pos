import { useMemo, useState } from 'react';
import { formatPeso, type Product } from '../services/db';

interface WeightPanelProps {
  product: Product;
  /** Set when re-weighing a line already in the cart. */
  initialWeight?: number;
  /** Set when re-weighing, so the till can show the price actually charged. */
  initialPricePerKg?: number;
  onCancel: () => void;
  onAdd: (weightKg: number, pricePerKgCents: number) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

function formatWeightText(text: string): string {
  if (!text) return '0 kg';
  // 1.50 -> "1.5 kg", 2.00 -> "2 kg"
  const n = parseFloat(text);
  if (isNaN(n)) return '0 kg';
  return `${parseFloat(n.toFixed(2))} kg`;
}

/**
 * The weight keypad for crops sold by the kilo.
 *
 * The cashier reads the number off the scale and types it in — one field, one
 * Add tap. The price per kilo is shown and editable in case a price is ever
 * negotiated. Totals round to the nearest peso, matching the store's cash
 * practice.
 */
export function WeightPanel({ product, initialWeight, initialPricePerKg, onCancel, onAdd }: WeightPanelProps) {
  const [weightText, setWeightText] = useState(() =>
    initialWeight !== undefined ? String(initialWeight) : ''
  );
  const [priceText, setPriceText] = useState(() => {
    const cents = initialPricePerKg !== undefined ? initialPricePerKg : product.price;
    return (cents / 100).toFixed(2);
  });
  const [error, setError] = useState('');

  const weightKg = parseFloat(weightText);
  const priceCents = useMemo(() => {
    const n = parseFloat(priceText);
    if (isNaN(n) || n < 0) return 0;
    return Math.round(n * 100);
  }, [priceText]);

  const valid = weightText !== '' && !isNaN(weightKg) && weightKg > 0 && priceCents > 0;
  // Same rounding rule as the cart: nearest peso, per line.
  const totalCents = valid ? Math.round((priceCents * weightKg) / 100) * 100 : 0;

  const press = (key: (typeof KEYS)[number]) => {
    setError('');
    setWeightText(prev => {
      if (key === 'back') return prev.slice(0, -1);
      if (key === '.') return prev.includes('.') ? prev : prev === '' ? '0.' : prev + '.';
      // Keep at most 2 decimal places (10g) and 5 characters total.
      const next = prev + key;
      const [intPart, decPart] = next.split('.');
      if (intPart.length > 3) return prev;
      if (decPart && decPart.length > 2) return prev;
      return next;
    });
  };

  const handleAdd = () => {
    if (!valid) {
      setError(weightText === '' || isNaN(weightKg) || weightKg <= 0
        ? 'Enter the weight from the scale.'
        : 'Enter a price per kilo greater than ₱0.00.');
      return;
    }
    onAdd(weightKg, priceCents);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-3xl w-full max-w-sm p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={`Weigh ${product.name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900 truncate">{product.name}</h3>
            <p className="text-xs text-slate-500">Sold by weight</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close weight panel"
            className="w-10 h-10 shrink-0 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500"
          >
            ✕
          </button>
        </div>

        <label htmlFor="weight-per-kg" className="block text-xs font-medium text-slate-500 mb-1">
          Price per kilo
        </label>
        <div className="relative mb-3">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₱</span>
          <input
            id="weight-per-kg"
            type="number"
            step="0.01"
            min="0"
            value={priceText}
            onChange={(e) => setPriceText(e.target.value)}
            className="w-full pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <label htmlFor="weight-value" className="block text-xs font-medium text-slate-500 mb-1">
          Weight (kg) — from the scale
        </label>
        <div
          id="weight-value"
          className="w-full px-4 py-3 mb-3 bg-amber-50 border border-amber-200 rounded-xl text-2xl font-black text-slate-900 text-right tabular-nums"
        >
          {formatWeightText(weightText)}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {KEYS.map((key) => (
            <button
              key={key}
              onClick={() => press(key)}
              aria-label={key === 'back' ? 'Backspace' : key}
              className="h-12 rounded-xl bg-slate-100 border border-slate-200 text-xl font-bold text-slate-800 active:bg-slate-200"
            >
              {key === 'back' ? '⌫' : key}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-3 text-xs font-bold text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between py-3 border-t border-slate-200">
          <span className="text-sm text-slate-500">
            {valid ? `${formatWeightText(weightText)} × ${formatPeso(priceCents)}` : '—'}
          </span>
          <span className="text-2xl font-black text-amber-600">{formatPeso(totalCents)}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!valid}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold disabled:opacity-40"
          >
            Add to cart
          </button>
        </div>
      </div>
    </div>
  );
}
