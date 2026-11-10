import { useEffect, useState, useCallback } from 'react';
import { getAllProducts, searchProducts, addProduct, updateProduct, deleteProduct } from '../services/products';
import type { Product } from '../services/db';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { ProductForm } from '../components/ProductForm';
import { SARI_SARI_SEED, formatPeso } from '../services/db';
import { useIsAtLeast } from '../hooks/useResponsive';
import { useBarcodeScannerListener } from '../hooks/useBarcodeScannerListener';

const PAGE_SIZE = 50;

export function InventoryScreen() {
  const isTablet = useIsAtLeast('tablet');
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState('');
  // Debounced so typing does not re-query the table on every keystroke.
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState<string>('');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'stock-asc' | 'stock-desc'>('name-asc');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  const loadProducts = useCallback(async () => {
    const data = debouncedQuery ? await searchProducts(debouncedQuery) : await getAllProducts();
    setProducts(data);
    setLoading(false);
  }, [debouncedQuery]);

  useEffect(() => {
    loadProducts();
    setPage(1);
  }, [loadProducts]);

  // Extract unique categories
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  const filteredProducts = products.filter(p => {
    if (categoryFilter === 'all') return true;
    return p.category === categoryFilter;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    if (sortBy === 'stock-asc') return a.stock - b.stock;
    if (sortBy === 'stock-desc') return b.stock - a.stock;
    return 0;
  });

  const pageProducts = sortedProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleScan = useCallback((barcode: string) => {
    setScannerOpen(false);
    const existing = products.find(p => p.barcode === barcode);
    if (existing) {
      setEditingProduct(existing);
      setScannedBarcode('');
    } else {
      const seedItem = SARI_SARI_SEED.find(s => s.barcode === barcode);
      if (seedItem) {
        setEditingProduct({
          id: '',
          barcode: seedItem.barcode,
          name: seedItem.name,
          price: seedItem.price,
          cost: seedItem.cost,
          stock: seedItem.stock || 50,
          category: seedItem.category,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        setScannedBarcode('');
      } else {
        setScannedBarcode(barcode);
        setEditingProduct(null);
      }
    }
  }, [products]);

  useBarcodeScannerListener(handleScan);

  const handleSave = async (data: { barcode: string; name: string; price: number; cost: number; stock: number; category?: string; isQuickTap?: boolean; soldByWeight?: boolean }) => {
    if (editingProduct && editingProduct.id) {
      await updateProduct(editingProduct.id, data);
    } else {
      await addProduct(data);
    }
    setEditingProduct(null);
    setScannedBarcode('');
    loadProducts();
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      await deleteProduct(deleteConfirmId);
      setDeleteConfirmId(null);
      setDeleteConfirmName('');
      loadProducts();
    }
  };

  const formOpen = !!(scannedBarcode || editingProduct);

  return (
    <>
    <div className={`flex-1 overflow-hidden flex ${isTablet ? 'flex-row' : 'flex-col pb-32'}`}>

      {/* Left Pane (tablet): Stationary Product Form always visible at the left side */}
      {isTablet && (
        <div className="w-96 bg-slate-50 flex flex-col flex-shrink-0 sticky top-0 h-full border-r border-slate-200">
          <header className="p-4 bg-white border-b border-slate-200 flex-shrink-0 flex justify-between items-center">
            <div>
              {/* A panel label, not a page heading: the screen's h1 is "Inventory"
                  and must stay the first heading in DOM order. */}
              <div className="text-lg font-bold text-slate-900">
                {editingProduct ? '✏️ Edit Product' : '➕ Add New Product'}
              </div>
              <p className="text-xs text-slate-500">
                {editingProduct ? editingProduct.name : 'Fill in details to add item'}
              </p>
            </div>
            {editingProduct && (
              <button
                onClick={() => setEditingProduct(null)}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-lg transition"
              >
                + New
              </button>
            )}
          </header>
          <div className="p-4 overflow-y-auto flex-1">
            <ProductForm
              key={editingProduct?.id || 'new'}
              initial={editingProduct || undefined}
              barcode={editingProduct?.barcode || scannedBarcode || 'manual-' + Date.now()}
              onSave={handleSave}
              onCancel={() => setEditingProduct(null)}
              inline
            />
          </div>
          </div>
      )}

      {/* Product List Pane */}
      <div className="flex-1 flex flex-col">
        <header className="p-3 bg-white border-b border-slate-200 space-y-2">
          {/* Search + primary actions. On a phone this is the only row that
              matters, so it owns the width and gets 44px targets. */}
          <div className="flex gap-2 items-center min-w-0">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products..."
              aria-label="Search products"
              className="flex-1 min-w-0 min-h-[44px] px-4 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              onClick={() => setScannerOpen(true)}
              title="Scan barcode with camera"
              aria-label="Scan barcode with camera"
              className="shrink-0 p-2 min-w-[44px] min-h-[44px] bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-xl text-lg flex items-center justify-center transition"
            >
              📷
            </button>
            <button
              onClick={() => { setScannedBarcode('manual-' + Date.now()); setEditingProduct(null); }}
              className="shrink-0 px-3 py-2 min-h-[44px] bg-slate-900 text-white rounded-xl font-medium text-sm whitespace-nowrap"
            >
              + Add
            </button>
          </div>

          {/* Title, result count and pagination share one row — the header used
              to stack four rows and eat 191px of a phone screen. */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h1 className={`font-bold shrink-0 ${isTablet ? 'text-2xl' : 'text-lg'}`}>Inventory</h1>
            <span className="text-xs text-slate-500">
              Showing {pageProducts.length} of {sortedProducts.length} products
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg min-w-[44px] min-h-[44px] disabled:opacity-50 transition"
              >
                Prev
              </button>
              <span className="px-2 py-2 text-sm text-slate-600">Page {page} of {Math.ceil(sortedProducts.length / PAGE_SIZE)}</span>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(sortedProducts.length / PAGE_SIZE), p + 1))}
                disabled={page === Math.ceil(sortedProducts.length / PAGE_SIZE)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg min-w-[44px] min-h-[44px] disabled:opacity-50 transition"
              >
                Next
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            {categories.length > 0 && (
              <div className="flex items-center gap-1">
                <span>Category:</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                  className="max-w-full px-2 py-1 min-h-[44px] border border-slate-200 rounded-xl bg-white font-medium text-slate-800"
                >
                  <option value="all">All Categories ({products.length})</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="max-w-full px-2 py-1 min-h-[44px] border border-slate-200 rounded-xl bg-white font-medium text-slate-800"
              >
                <option value="name-asc">Alphabetical (A-Z)</option>
                <option value="name-desc">Alphabetical (Z-A)</option>
                <option value="price-asc">Price (Low → High)</option>
                <option value="price-desc">Price (High → Low)</option>
                <option value="stock-asc">Stock (Low → High)</option>
                <option value="stock-desc">Stock (High → Low)</option>
              </select>
            </div>
          </div>
        </header>

        <div className={`flex-1 overflow-y-auto ${isTablet ? 'p-4' : 'p-3'}`}>
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <p className="text-4xl mb-3">📦</p>
              <p className="mb-4">No products yet</p>
              <button
                onClick={() => { setScannedBarcode('manual-' + Date.now()); setEditingProduct(null); }}
                className="px-6 py-2 min-h-[44px] bg-slate-900 text-white rounded-xl"
              >
                Add First Product
              </button>
            </div>
          ) : isTablet ? (
            /* Tablet: table layout */
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">Barcode</th>
                  <th className="pb-3 font-medium text-right">Price</th>
                  <th className="pb-3 font-medium text-right">Cost</th>
                  <th className="pb-3 font-medium text-right">Stock</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageProducts.map((product) => (
                  <tr
                    key={product.id}
                    onClick={() => setEditingProduct(product)}
                    className={`cursor-pointer hover:bg-amber-50 transition-colors ${editingProduct?.id === product.id ? 'bg-amber-50' : ''}`}
                  >
                    <td className="py-3 font-medium">{product.name}</td>
                    <td className="py-3 text-xs font-mono text-slate-400">{product.barcode}</td>
                    <td className="py-3 text-right">{formatPeso(product.price)}</td>
                    <td className="py-3 text-right text-slate-500 text-sm">{formatPeso(product.cost)}</td>
                    <td className={`py-3 text-right font-semibold ${product.stock <= 5 ? 'text-red-700' : 'text-slate-700'}`}>
                      {product.stock}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(product.id); setDeleteConfirmName(product.name); }}
                        className="text-red-700 hover:text-red-800 p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center font-bold text-base"
                        title="Delete product"
                        aria-label="Delete product"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            /* Mobile: card list */
            <div className="space-y-2">
              {pageProducts.map((product) => (
                <div
                  key={product.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center"
                  onClick={() => setEditingProduct(product)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{product.name}</p>
                      {/* The tablet list colours stock red at <=5; the phone card
                          used to show the same number in plain grey. */}
                      {product.stock <= 0 && (
                        <span className="bg-red-600 text-white text-xs font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">Out</span>
                      )}
                      {product.stock > 0 && product.stock <= 5 && (
                        <span className="bg-red-100 text-red-700 text-xs font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">Low</span>
                      )}
                    </div>
                    <p className={`text-sm ${product.stock <= 5 ? 'text-red-700 font-bold' : 'text-slate-600'}`}>
                      {formatPeso(product.price)} · Stock: {product.stock}
                    </p>
                    <p className="text-xs text-slate-500 font-mono truncate">{product.barcode}</p>
                    {product.category && (
                      <p className="text-xs text-slate-400 mt-0.5">#{product.category}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* The card was tappable but nothing said so; the tablet row
                        only signalled it with a hover style, which never fires
                        on a phone. */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingProduct(product); }}
                      className="px-3 py-2 min-h-[44px] text-amber-700 bg-amber-50 hover:bg-amber-100 font-bold rounded-lg text-xs transition"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(product.id); setDeleteConfirmName(product.name); }}
                      className="text-red-700 p-3 min-w-[44px] min-h-[44px] inline-flex items-center justify-center font-bold text-base"
                      title="Delete product"
                      aria-label="Delete product"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
       </div>
     </div>

    {/* Delete Confirmation Modal */}
    {deleteConfirmId && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Product?</h3>
          <p className="text-sm text-slate-600 mb-6">
            Are you sure you want to delete <strong>{deleteConfirmName}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl min-h-[44px] transition"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl min-h-[44px] transition"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Mobile FAB */}
    {!isTablet && !formOpen && (
      <button
        onClick={() => { setScannedBarcode('manual-' + Date.now()); setEditingProduct(null); }}
        className="fixed bottom-24 right-4 w-14 h-14 bg-amber-500 text-white rounded-full shadow-lg text-2xl flex items-center justify-center"
      >
        +
      </button>
    )}

    {scannerOpen && <BarcodeScanner onScan={handleScan} onClose={() => setScannerOpen(false)} />}

    {!isTablet && formOpen && (
      <ProductForm
        key={editingProduct?.id || 'new'}
        initial={editingProduct || undefined}
        barcode={scannedBarcode || editingProduct?.barcode || ''}
        onSave={handleSave}
        onCancel={() => { setScannedBarcode(''); setEditingProduct(null); }}
      />
    )}

  </>
);

}