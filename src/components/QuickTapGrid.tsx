import { useState } from 'react';
import type { Product } from '../services/db';
import { useCartStore } from '../stores/cartStore';
import { updateProduct } from '../services/products';

interface QuickTapGridProps {
  products: Product[];
  onProductsUpdated?: () => void;
}

export function QuickTapGrid({ products, onProductsUpdated }: QuickTapGridProps) {
  const { addItem } = useCartStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterRecommended, setFilterRecommended] = useState(false);

  const handleTap = (product: Product) => {
    if (product.stock > 0) {
      addItem({
        productId: product.id,
        barcode: product.barcode,
        name: product.name,
        price: product.price,
        quantity: 1,
        availableStock: product.stock,
      });
    }
  };

  const toggleQuickTap = async (product: Product) => {
    const nextVal = !product.isQuickTap;
    await updateProduct(product.id, { isQuickTap: nextVal });
    onProductsUpdated?.();
  };

  const quickTapItems = products.filter(p => p.isQuickTap);

  // Filter products for the modal
  const filteredAllProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode.includes(search);
    const matchesRecommended = filterRecommended ? p.price <= 3000 : true;
    return matchesSearch && matchesRecommended;
  });

  return (
    <div className="flex-1 overflow-y-auto max-h-[calc(100vh-160px)] p-3">
      <div className="grid grid-cols-4 gap-3">
        {quickTapItems.map((product) => (
          <div key={product.id} className="relative group">
            <button
              onClick={() => handleTap(product)}
              disabled={product.stock <= 0}
              title={product.name}
              className="relative w-full flex flex-col items-center justify-between p-3 bg-white border-2 border-slate-200 hover:border-amber-400 rounded-2xl transition-all active:scale-95 shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed h-28 text-center"
            >
              {product.stock <= 0 && (
                <span className="absolute top-1 left-1 bg-red-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider shadow-sm z-10">
                  Out
                </span>
              )}
              <span className="text-xs font-bold text-slate-900 line-clamp-2 w-full leading-tight">
                {product.name}
              </span>
              <div className="w-full">
                <span className="text-sm font-black text-amber-600 block">
                  ₱{(product.price / 100).toFixed(2)}
                </span>
                <span className={`text-[10px] font-bold ${product.stock <= 0 ? 'text-red-600 font-black' : product.stock <= 5 ? 'text-red-700' : 'text-slate-400'}`}>
                  Stock: {product.stock}
                </span>
              </div>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleQuickTap(product); }}
              className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs font-bold flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition"
              title="Remove from QuickTap"
            >
              ✕
            </button>
          </div>
        ))}

        {/* + Add QuickTap Item Tile (Always at the end) */}
        <button
          onClick={() => setPickerOpen(true)}
          className="flex flex-col items-center justify-center p-3 bg-amber-50 border-2 border-dashed border-amber-400 hover:bg-amber-100 rounded-2xl transition-all active:scale-95 shadow-sm h-28 text-center text-amber-800"
          title="Add product to QuickTap"
        >
          <span className="text-2xl font-black mb-1">+</span>
          <span className="text-xs font-bold leading-tight">Add QuickTap</span>
        </button>
      </div>

      {/* Product Picker Modal to Add/Remove QuickTap Items */}
      {pickerOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Manage QuickTap Products (4x4)</h3>
                <p className="text-xs text-slate-500">Search products or view recommended budget items (₱30 & under)</p>
              </div>
              <button
                onClick={() => setPickerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products or view recommended budget items (₱30 & under)" aria-label="Search products"
                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                onClick={() => setFilterRecommended(!filterRecommended)}
                className={`px-4 py-3 rounded-xl font-bold text-xs transition ${
                  filterRecommended
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filterRecommended ? '★ Recommended (≤ ₱30)' : 'Show All'}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filteredAllProducts.map(product => {
                const isUnder30 = product.price <= 3000;
                return (
                  <div key={product.id} className="flex justify-between items-center p-3 bg-slate-50 hover:bg-slate-100 rounded-xl transition">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-800 text-sm">{product.name}</p>
                        {isUnder30 && (
                          <span className="bg-green-100 text-green-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            Recommended (≤ ₱30)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">₱{(product.price / 100).toFixed(2)} • Stock: {product.stock}</p>
                    </div>
                    <button
                      onClick={() => toggleQuickTap(product)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
                        product.isQuickTap
                          ? 'bg-red-100 text-red-700 hover:bg-red-200'
                          : 'bg-amber-500 text-slate-950 hover:bg-amber-700 shadow-sm'
                      }`}
                    >
                      {product.isQuickTap ? 'Remove ✓' : '+ Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
