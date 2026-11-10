import { formatPeso, type Product } from '../services/db';

interface CropsGridProps {
  products: Product[];
  onPick: (product: Product) => void;
}

/**
 * The "🌾 Crops & Feed" tab on the cashier screen.
 *
 * A crop is priced per kilo, so tapping it opens the weight keypad rather than
 * dropping a fixed quantity into the cart.
 */
export function CropsGrid({ products, onPick }: CropsGridProps) {
  const crops = products.filter(p => p.soldByWeight);

  if (crops.length === 0) {
    return (
      <div className="text-center py-12 px-6 text-slate-400">
        <p className="text-4xl mb-3">🌾</p>
        <p className="text-sm font-bold text-slate-500">No crops set up yet</p>
        <p className="text-xs mt-1 leading-relaxed">
          In Inventory, edit a product and tick <span className="font-semibold">Sold by weight</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      {crops.map(p => (
        <button
          key={p.id}
          onClick={() => onPick(p)}
          className="p-3 min-h-[72px] bg-white border border-slate-200 rounded-xl text-left active:bg-amber-50 active:border-amber-300 transition"
        >
          <p className="text-sm font-bold text-slate-900 leading-tight">{p.name}</p>
          <p className="text-xs text-amber-600 font-bold mt-1">{formatPeso(p.price)}/kg</p>
        </button>
      ))}
    </div>
  );
}
