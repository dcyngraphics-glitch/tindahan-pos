import { useState } from 'react';
import { type Product, fromCentavos } from '../services/db';

// Robustly parse decimal string to centavos (avoids floating-point precision issues)
function parseToCentavos(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return 0;
  // Round to 2 decimal places using string manipulation to avoid IEEE 754 issues
  const [intPart, decPart = ''] = value.split('.');
  const padded = (intPart || '0') + '.' + (decPart + '00').slice(0, 2);
  return Math.round(parseFloat(padded) * 100);
}

interface ProductFormProps {
  initial?: Product;
  barcode: string;
  onSave: (data: { barcode: string; name: string; price: number; cost: number; stock: number; category?: string; isQuickTap?: boolean }) => void;
  onCancel: () => void;
  inline?: boolean; // when true: renders flat (no modal overlay) for tablet right-pane
}

function FormBody({
  initial, barcode, onSave, onCancel,
}: Omit<ProductFormProps, 'inline'>) {
  const [name, setName] = useState(initial?.name || '');
  const [price, setPrice] = useState(initial ? fromCentavos(initial.price).toFixed(2) : '');
  const [cost, setCost] = useState(initial ? fromCentavos(initial.cost).toFixed(2) : '');
  const [stock, setStock] = useState(initial?.stock.toString() || '0');
  const [category, setCategory] = useState(initial?.category || '');
  const [isQuickTap, setIsQuickTap] = useState(initial?.isQuickTap || false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      barcode,
      name: name.trim(),
      price: parseToCentavos(price),
      cost: parseToCentavos(cost),
      stock: parseInt(stock) || 0,
      category: category.trim() || undefined,
      isQuickTap,
    });
  };

  // Display barcode unless it's an internal manual-add placeholder
  const displayBarcode = barcode.startsWith('manual-') ? '(manual entry)' : barcode;

  return (
    <>
      <div className="mb-4 p-3 bg-slate-100 rounded-lg">
        <span className="text-sm text-slate-500">Barcode</span>
        <p className="font-mono text-lg">{displayBarcode}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
            placeholder="e.g. Lucky Me! Pancit Canton"
            autoFocus
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₱</span>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                placeholder="0.00"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₱</span>
              <input
                type="number"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Stock</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. Noodles"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <input
            type="checkbox"
            id="isQuickTap"
            checked={isQuickTap}
            onChange={(e) => setIsQuickTap(e.target.checked)}
            className="w-5 h-5 text-amber-500 rounded border-slate-300 focus:ring-amber-500"
          />
          <label htmlFor="isQuickTap" className="text-sm font-medium text-slate-800 cursor-pointer">
            Pin to Quick Tap (show on Cashier screen for fast tapping)
          </label>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-xl active:scale-95 transition-transform"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl active:scale-95 transition-transform shadow-sm"
          >
            {initial ? 'Save Changes' : 'Add Product'}
          </button>
        </div>
      </form>
    </>
  );
}

export function ProductForm({ initial, barcode, onSave, onCancel, inline }: ProductFormProps) {
  if (inline) {
    // flat render — no modal overlay, sits inside the right-pane
    return (
      <div className="space-y-1">
        <FormBody initial={initial} barcode={barcode} onSave={onSave} onCancel={onCancel} />
      </div>
    );
  }

  // mobile bottom-sheet modal
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
      <div className="bg-white rounded-t-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{initial ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onCancel} className="text-slate-400 text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center">&times;</button>
        </div>
        <FormBody initial={initial} barcode={barcode} onSave={onSave} onCancel={onCancel} />
      </div>
    </div>
  );
}