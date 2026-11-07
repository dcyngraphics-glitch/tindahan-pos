import { useState, useEffect, useCallback } from 'react';
import { getProductByBarcode, getAllProducts, addProduct, updateProduct } from '../services/products';
import { type Product, SARI_SARI_SEED } from '../services/db';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { ProductForm } from '../components/ProductForm';
import { useBarcodeScannerListener } from '../hooks/useBarcodeScannerListener';

export function ScannerScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [manualCode, setManualCode] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState<string>('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    getAllProducts().then(setProducts);
  }, []);

  const handleScan = useCallback(async (barcode: string) => {
    if (!barcode) return;
    setRecentScans(prev => [barcode, ...prev.filter(b => b !== barcode)].slice(0, 10));

    const existing = products.find(p => p.barcode === barcode) || await getProductByBarcode(barcode);
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
          isQuickTap: seedItem.isQuickTap || false,
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

  const handleSave = async (data: { barcode: string; name: string; price: number; cost: number; stock: number; category?: string; isQuickTap?: boolean }) => {
    if (editingProduct && editingProduct.id) {
      await updateProduct(editingProduct.id, data);
      setSuccessMessage(`Updated product: ${data.name}`);
    } else {
      await addProduct(data);
      setSuccessMessage(`Saved new product: ${data.name}`);
    }
    setEditingProduct(null);
    setScannedBarcode('');
    const updated = await getAllProducts();
    setProducts(updated);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScan(manualCode.trim());
    setManualCode('');
  };

  const isFormOpen = !!(scannedBarcode || editingProduct);

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-y-auto pb-24">

      {successMessage && (
        <div className="m-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-bold flex items-center justify-between shadow-sm">
          <span>✅ {successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 text-sm">✕</button>
        </div>
      )}

      <div className="p-4 space-y-4 max-w-lg mx-auto w-full">
        {/* Camera Viewfinder (Inline on Scanner Tab) */}
        <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-md border border-slate-800 relative h-72 flex flex-col items-center justify-center">
          <BarcodeScanner
            onScan={handleScan}
          />
        </div>

        {/* Manual Lookup & Recent Scans */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <h2 className="text-sm font-bold text-slate-800">Manual Barcode Lookup</h2>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Type or scan barcode..."
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold rounded-xl text-sm active:scale-95 transition-transform shadow-sm"
            >
              Lookup
            </button>
          </form>
        </div>

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-700 text-sm mb-3">Recent Scans</h3>
            <div className="flex flex-wrap gap-2">
              {recentScans.map((code, idx) => (
                <button
                  key={idx}
                  onClick={() => handleScan(code)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-amber-50 hover:border-amber-300 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-700 transition"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Product Encoding Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-black text-slate-900">
                {editingProduct ? 'Edit Scanned Product' : 'Encode New Product'}
              </h3>
              <button
                onClick={() => { setEditingProduct(null); setScannedBarcode(''); }}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <ProductForm
              initial={editingProduct || undefined}
              barcode={scannedBarcode || editingProduct?.barcode || ''}
              onSave={handleSave}
              onCancel={() => { setEditingProduct(null); setScannedBarcode(''); }}
              inline
            />
          </div>
        </div>
      )}
    </div>
  );
}
