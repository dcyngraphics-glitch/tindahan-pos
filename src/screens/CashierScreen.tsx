import { useState, useEffect, useCallback } from 'react';
import { useCartStore } from '../stores/cartStore';
import { getProductByBarcode, getAllProducts, addProduct } from '../services/products';
import { createTransaction, voidTransaction } from '../services/transactions';
import { QuickTapGrid } from '../components/QuickTapGrid';
import { CropsGrid } from '../components/CropsGrid';
import { WeightPanel } from '../components/WeightPanel';
import { ProductForm } from '../components/ProductForm';
import { useBarcodeScannerListener } from '../hooks/useBarcodeScannerListener';
import { useScannerDetection } from '../hooks/useScannerDetection';
import { useBluetoothStatus } from '../hooks/useBluetoothStatus';
import { useIsAtLeast } from '../hooks/useResponsive';
import { printViaBluetooth } from '../services/printer';
import { formatPeso, lineTotal, formatWeight, seedCatalogIfEmpty, SARI_SARI_SEED, type TransactionItem, type Product, type Customer } from '../services/db';
import { getAllCustomers, addCustomer } from '../services/customers';
import { useCloudSession } from '../hooks/useCloudSession';

// React Compiler false positive: this only runs from event handlers, never during render.
const receiptDate = () => new Date();

export function CashierScreen() {
  const isTabletOrLarger = useIsAtLeast('tablet');
  const isDesktopOrLarger = useIsAtLeast('desktop');
  const { items, addItem, removeItem, updateQuantity, updateItem, clearCart, getTotal, getDiscountedTotal, getItemCount, discount, setDiscount } = useCartStore();
  const { isConnected: scannerConnected, activityCount: scannerActivity } = useScannerDetection();
  const { isConnected: printerConnected, printerName, connectPrinter } = useBluetoothStatus();

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cashTendered, setCashTendered] = useState('');
  const [receipt, setReceipt] = useState<{ id: string; items: TransactionItem[]; total: number; change: number; cashTendered: number; paymentType: 'cash' | 'utang' } | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  // When a scanned barcode is not in the store's catalogue but IS in the reference
  // catalogue, the form opens pre-filled so the cashier only adjusts price and stock.
  const [seedPrefill, setSeedPrefill] = useState<Product | null>(null);
  const [printing, setPrinting] = useState(false);
  const [quickTapExpanded, setQuickTapExpanded] = useState(isDesktopOrLarger);
  const [products, setProducts] = useState<Product[]>([]);
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);

  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');

  // Credit (utang) checkout state
  const { email: accountEmail } = useCloudSession();
  const [paymentType, setPaymentType] = useState<'cash' | 'utang'>('cash');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // "🌾 Crops & Feed" tab + the weight keypad for crops sold by the kilo.
  const [cashierTab, setCashierTab] = useState<'quicktap' | 'crops'>('quicktap');
  const [weighing, setWeighing] = useState<Product | null>(null);
  const [editingCartLine, setEditingCartLine] = useState<string | null>(null);

  const total = getDiscountedTotal();
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) ?? null;

  // Load products for quick-tap grid
  useEffect(() => {
    seedCatalogIfEmpty()
      .then(() => getAllProducts())
      .then(setProducts)
      .catch(err => console.error('Failed to load products:', err));
  }, []);

  // Customers are only needed for credit sales, so load them when checkout opens.
  useEffect(() => {
    if (!checkoutOpen) return;
    getAllCustomers()
      .then(setCustomers)
      .catch(err => console.error('Failed to load customers:', err));
  }, [checkoutOpen]);

  const matchingCustomers = useCallback(() => {
    const q = customerSearch.trim().toLowerCase();
    const sorted = [...customers].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(c => `${c.name} ${c.phone ?? ''}`.toLowerCase().includes(q));
  }, [customers, customerSearch]);

  /** Open the weight keypad for a crop. */
  const openWeigh = (product: Product) => {
    setEditingCartLine(null);
    setWeighing(product);
  };

  /** Re-open the keypad for a weighed line already in the cart. */
  const openEditWeigh = (item: TransactionItem & { cartId: string }) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return;
    setEditingCartLine(item.cartId);
    setWeighing(product);
  };

  const handleWeighed = (weightKg: number, pricePerKgCents: number) => {
    if (!weighing) return;
    if (editingCartLine) {
      updateItem(editingCartLine, { quantity: weightKg, price: pricePerKgCents });
    } else {
      addItem({
        productId: weighing.id,
        barcode: weighing.barcode,
        name: weighing.name,
        price: pricePerKgCents,
        quantity: weightKg,
        soldByWeight: true,
      });
    }
    setWeighing(null);
    setEditingCartLine(null);
  };

  const chooseCustomer = async (data: { name: string; phone?: string }) => {
    // Adding a customer inline from the till should not lose the sale in progress.
    try {
      const id = await addCustomer(data);
      const all = await getAllCustomers();
      setCustomers(all);
      setSelectedCustomerId(id);
      setShowNewCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setCheckoutError('');
    } catch (err: any) {
      setCheckoutError(err?.message || 'Could not add the customer.');
    }
  };

  /**
   * Discounts are clamped so a sale can never reach ₱0.00 by typing 100% (or a
   * fixed amount at or above the subtotal) — that used to complete silently.
   */
  const applyDiscountInput = (raw: string) => {
    setDiscountValue(raw);
    const v = parseFloat(raw);
    if (isNaN(v) || v <= 0) {
      setDiscount(null);
      return;
    }
    if (discountType === 'percent') {
      setDiscount({ type: 'percent', value: Math.min(99, v) });
      return;
    }
    const subtotal = getTotal();
    const capped = subtotal > 0 ? Math.min(Math.round(v * 100), subtotal - 1) : 0;
    setDiscount(capped > 0 ? { type: 'fixed', value: capped } : null);
  };

  const closeCheckout = useCallback(() => {
    setCheckoutOpen(false);
    setDiscount(null);
    setDiscountValue('');
  }, [setDiscount]);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Handle escape key to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeCheckout();
        setReceipt(null);
        setNotFound(null);
        setSeedPrefill(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const handleToastEvent = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        showToast(customEvent.detail);
      }
    };
    window.addEventListener('tindahan-toast', handleToastEvent);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('tindahan-toast', handleToastEvent);
    };
  }, [closeCheckout, showToast]);

  const handleScan = useCallback(async (barcode: string) => {
    setNotFound(null);
    setSeedPrefill(null);

    const product = await getProductByBarcode(barcode);
    if (product) {
      // Crops are not stock-tracked, so they must not fall into the out-of-stock
      // branch — scanning one opens the weight keypad instead.
      if (product.soldByWeight) {
        setWeighing(product);
      } else if (product.stock > 0) {
        addItem({
          productId: product.id,
          barcode: product.barcode,
          name: product.name,
          price: product.price,
          quantity: 1,
        });
      } else {
        showToast('Product out of stock');
      }
    } else {
      // Same pre-fill the Inventory and Scanner screens already do: match the
      // scanned barcode against the reference catalogue and hand the details to
      // the form, so the till does not make the cashier type a known product.
      const seedItem = SARI_SARI_SEED.find(s => s.barcode === barcode);
      setSeedPrefill(seedItem ? {
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
      } : null);
      setNotFound(barcode);
    }
  }, [addItem, showToast]);

  const handleSaveNewProduct = async (data: { barcode: string; name: string; price: number; cost: number; stock: number; category?: string; isQuickTap?: boolean; soldByWeight?: boolean }) => {
    const newId = await addProduct(data);
    const updatedProducts = await getAllProducts();
    setProducts(updatedProducts);
    setNotFound(null);
    setSeedPrefill(null);

    addItem({
      productId: newId,
      barcode: data.barcode,
      name: data.name,
      price: data.price,
      quantity: 1,
    });
  };

  // Wire up global barcode scanner listener to handleScan
  useBarcodeScannerListener(handleScan);

  const resetCheckout = () => {
    setCheckoutOpen(false);
    setCashTendered('');
    setPaymentType('cash');
    setCustomerSearch('');
    setSelectedCustomerId(null);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setShowNewCustomer(false);
    setCheckoutError('');
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      showToast('Add items to checkout first.');
      return;
    }
    // A zero-total sale is never a real sale; block it rather than silently
    // recording one.
    if (total <= 0) {
      showToast('The sale total is zero. Add items before checkout.');
      return;
    }

    const cash = parseFloat(cashTendered);
    const cashCents = Math.round(cash * 100);

    if (paymentType === 'cash') {
      if (isNaN(cash) || cashCents < total) {
        showToast('Insufficient cash');
        return;
      }
    } else if (!selectedCustomerId) {
      // A credit sale without a customer would leave the debt unattributed.
      setCheckoutError('Choose a customer, or add a new one.');
      return;
    }

    setCheckoutError('');

    try {
      const transactionItems = items.map(i => ({
        productId: i.productId,
        barcode: i.barcode,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        // Without this the saved sale loses its weight: it would be charged at
        // the unrounded centavo and the stock check would run against a crop.
        soldByWeight: i.soldByWeight,
      }));

      const transactionId = await createTransaction(
        transactionItems,
        paymentType === 'cash' ? cashCents : 0,
        discount,
        {
          paymentType,
          // The debt is written inside the same transaction as the sale, so a
          // crash can no longer leave a credit sale with no debt behind it.
          ...(paymentType === 'utang'
            ? { utang: { customerId: selectedCustomerId!, createdBy: accountEmail ?? 'unknown' } }
            : {}),
        }
      );

      const completedReceipt = {
        id: transactionId,
        items: [...items],
        total,
        cashTendered: paymentType === 'cash' ? cashCents : 0,
        change: paymentType === 'cash' ? cashCents - total : 0,
        paymentType,
      };

      setReceipt(completedReceipt);
      clearCart(); // also clears store discount
      setDiscountValue('');
      resetCheckout();

      // Auto-print on Bluetooth printer after checkout
      if (printerConnected) {
        setPrinting(true);
        try {
          await printViaBluetooth({
            items: completedReceipt.items,
            total: completedReceipt.total,
            cashTendered: completedReceipt.cashTendered,
            change: completedReceipt.change,
            date: receiptDate(),
          });
          showToast('✅ Receipt printed successfully! 💳');
        } catch (e) {
          console.error(e);
          showToast('⚠️ Receipt printed but printer may need attention. Check connection.');
        } finally {
          setPrinting(false);
        }
      } else {
        showToast('⚡ Printer not connected. Connect Bluetooth printer to print receipts.');
      }
    } catch (err: any) {
      showToast(err.message || 'Checkout failed');
    }
  };

  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);

  const buildReceiptText = () => {
    if (!receipt) return '';
    const r = receipt;
    const line = '--------------------------------';
    const rows = r.items.map(i => {
      const label = i.soldByWeight ? `${formatWeight(i.quantity)} ${i.name}` : `x${i.quantity} ${i.name}`;
      return `${label.slice(0, 24).padEnd(24)} ${formatPeso(lineTotal(i))}`;
    });
    return [
      '         TINDAHAN POS         ',
      line,
      ...rows,
      line,
      `TOTAL:          ${formatPeso(r.total)}`,
      `CASH:           ${formatPeso(r.cashTendered)}`,
      `CHANGE:         ${formatPeso(r.change)}`,
      line,
      '     Salamat po sa pagbili!   ',
    ].join('\n');
  };

  const handlePrintReceipt = async () => {
    if (!receipt) return;
    setReceiptPreviewOpen(true);
  };

  const handleConfirmPrint = async () => {
    if (!receipt) return;
    setReceiptPreviewOpen(false);
    setPrinting(true);
    try {
      await printViaBluetooth({
        items: receipt.items,
        total: receipt.total,
        cashTendered: receipt.cashTendered,
        change: receipt.change,
        date: new Date(),
      });
      showToast('Receipt printed successfully');
    } catch (e) {
      console.error(e);
      showToast('Printing failed');
    } finally {
      setPrinting(false);
    }
  };

  const handleVoidCurrentReceipt = async () => {
    if (!receipt) return;
    setVoidConfirmOpen(true);
  };

  const closeReceipt = () => {
    setReceipt(null);
  };

  if (isTabletOrLarger) {
    return (
      <div className="flex-1 flex flex-row overflow-hidden min-h-0">
        {/* Left Pane: Cart & Quick Actions */}
        <div className="flex-1 flex flex-col min-h-0 self-stretch overflow-hidden border-r border-slate-200 bg-white">
          <header className="p-4 border-b border-slate-200 flex justify-between items-center gap-3 flex-shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div>
                <h1 className="text-xl font-bold">Cashier</h1>
                <div className="flex items-center gap-3 text-xs mt-0.5">
                  <span className={`inline-flex items-center gap-1 font-medium ${scannerConnected ? 'text-green-600' : 'text-slate-500'}`}>
                    <span className={`w-2 h-2 rounded-full ${scannerConnected ? 'bg-green-500' : 'bg-slate-300'}`} />
                    📷 Scanner {scannerConnected ? `Active · ${scannerActivity} scans` : 'Idle · no scans yet'}
                  </span>
                  <button
                    onClick={() => connectPrinter()}
                    title="Click to pair/connect Bluetooth printer"
                    className={`inline-flex items-center gap-1 font-medium hover:underline cursor-pointer ${printerConnected ? 'text-green-600' : 'text-red-600'}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${printerConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                    🖨️ {printerConnected ? (printerName || 'Printer Connected') : 'Printer Disconnected'}
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setQuickTapExpanded(!quickTapExpanded)}
              aria-expanded={quickTapExpanded}
              className="shrink-0 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold hover:bg-amber-100 transition min-h-[44px]"
            >
              ⚡ QuickTap {quickTapExpanded ? 'On' : 'Off'}
            </button>
          </header>

          {notFound && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-slate-800">
                    {seedPrefill ? 'Product Recognised' : 'New Barcode Detected'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Barcode <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-600">{notFound}</code>{' '}
                    {seedPrefill
                      ? 'matched our catalogue. Check the price and stock, then save:'
                      : 'is not in your inventory yet. Fill in details to add it instantly:'}
                  </p>
                </div>
                <ProductForm
                  key={seedPrefill ? seedPrefill.barcode : 'blank'}
                  barcode={notFound}
                  initial={seedPrefill || undefined}
                  onSave={handleSaveNewProduct}
                  onCancel={() => { setNotFound(null); setSeedPrefill(null); }}
                />
              </div>
            </div>
          )}

          {/* The cart list scrolls on its own; the checkout footer below it is a
              plain flex child, so it stays pinned to the bottom of the pane. */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-50">
              {items.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-5xl mb-4">🛒</p>
                  <p className="text-lg">Scan barcode or tap products below</p>
                  <p className="text-sm mt-2">Use barcode scanner or click items to add</p>
                </div>
              ) : (
                items.map((item) => (
                  <div key={item.cartId} className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4 border border-slate-100">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                      <p className="text-sm text-slate-500">
                        {item.soldByWeight
                          ? `${formatWeight(item.quantity)} × ${formatPeso(item.price)}/kg`
                          : `${formatPeso(item.price)} each`}
                      </p>
                    </div>
                    {item.soldByWeight ? (
                      <button
                        onClick={() => openEditWeigh(item)}
                        aria-label={`Change weight for ${item.name}`}
                        className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-bold rounded-lg min-h-[44px]"
                      >
                        {formatWeight(item.quantity)}
                      </button>
                    ) : (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                          className="w-11 h-11 bg-slate-100 border border-slate-200 rounded-lg text-xl font-bold active:bg-slate-200 flex-shrink-0"
                        >
                          −
                        </button>
                        <span className="w-12 text-center font-bold text-lg">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                          className="w-11 h-11 bg-slate-100 border border-slate-200 rounded-lg text-xl font-bold active:bg-slate-200 flex-shrink-0"
                        >
                          +
                        </button>
                      </div>
                    )}
                    <div className="text-right w-24">
                      <p className="font-bold text-lg text-slate-900">{formatPeso(lineTotal(item))}</p>
                      <button
                        onClick={() => removeItem(item.cartId)}
                        aria-label={`Remove ${item.name} from cart`}
                        className="p-2 text-xs text-red-700 hover:underline mt-1 font-medium inline-block"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Checkout Footer - pinned to the bottom of the pane */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center flex-shrink-0 shadow-2xl">
              <div>
                <p className="text-sm text-slate-500">Total Items: {getItemCount()}</p>
                <p className="text-3xl font-black text-slate-900">{formatPeso(total)}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={clearCart}
                  disabled={items.length === 0}
                  className="px-5 py-3 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                >
                  Clear Cart
                </button>
                <button
                  onClick={() => setCheckoutOpen(true)}
                  disabled={items.length === 0}
                  className="px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-lg shadow-md disabled:opacity-40 transition"
                >
                  Checkout 💳
                </button>
              </div>
            </div>
        </div>

        {/* Right Pane: QuickTap Grid. Only rendered while expanded, so the cart
            takes the full width when it is collapsed — a permanent pane at
            tablet widths would either starve the cart or push the checkout
            footer down the screen. */}
        {quickTapExpanded && (
          <div className="w-[400px] lg:w-[480px] flex flex-col border-l border-slate-200 overflow-hidden flex-shrink-0 bg-slate-50">
            <div className="p-3 border-b border-slate-200 bg-white flex-shrink-0">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => setCashierTab('quicktap')}
                    className={`px-3 py-2 rounded-md text-xs font-bold min-h-[44px] ${cashierTab === 'quicktap' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    ⚡ QuickTap
                  </button>
                  <button
                    onClick={() => setCashierTab('crops')}
                    className={`px-3 py-2 rounded-md text-xs font-bold min-h-[44px] ${cashierTab === 'crops' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                  >
                    🌾 Crops & Feed
                  </button>
                </div>
                <button
                  onClick={() => setQuickTapExpanded(false)}
                  className="text-xs text-amber-600 font-bold hover:underline min-h-[44px]"
                >
                  Hide
                </button>
              </div>
              {cashierTab === 'quicktap' && (
                <p className="text-xs text-slate-400">Click '+ Add QuickTap' to pin products</p>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {cashierTab === 'quicktap' ? (
                <QuickTapGrid products={products} onProductsUpdated={() => getAllProducts().then(setProducts)} onWeightProduct={openWeigh} />
              ) : (
                <CropsGrid products={products} onPick={openWeigh} />
              )}
            </div>
          </div>
        )}

        {/* Checkout Modal */}
        {checkoutOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6">
              <div className="flex justify-between items-center border-b pb-4">
                <h3 className="text-xl font-bold text-slate-900">Process Checkout</h3>
                <button onClick={closeCheckout} aria-label="Close checkout" className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center font-bold">✕</button>
              </div>

              <div>
                <p className="text-sm text-slate-500 mb-1">Subtotal</p>
                <p className={`text-4xl font-extrabold ${discount ? 'text-slate-400 line-through text-2xl' : 'text-amber-600'}`}>{formatPeso(getTotal())}</p>
                {discount && <p className="text-4xl font-extrabold text-amber-600">{formatPeso(total)}</p>}
              </div>

              {/* Payment type: cash now, or on credit (utang) */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Payment</label>
                <div className="flex gap-2">
                  {(['cash', 'utang'] as const).map(pt => (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => {
                        setPaymentType(pt);
                        setCheckoutError('');
                      }}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm min-h-[44px] ${
                        paymentType === pt ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {pt === 'cash' ? '💵 Cash' : '📒 Utang'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Discount row */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Discount (optional)</label>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`min-h-[44px] px-4 py-2 rounded-xl font-bold border transition-colors ${discountType === 'percent' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                  >%</button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`min-h-[44px] px-4 py-2 rounded-xl font-bold border transition-colors ${discountType === 'fixed' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                  >₱</button>
                  <input
                    type="number"
                    min="0"
                    value={discountValue}
                    onChange={e => applyDiscountInput(e.target.value)}
                    placeholder={discountType === 'percent' ? '0%' : '0.00'}
                    className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border-2 border-slate-200 font-bold focus:outline-none focus:border-amber-500"
                  />
                  {discount && (
                    <button type="button" onClick={() => { setDiscount(null); setDiscountValue(''); }} className="min-h-[44px] px-3 py-2 rounded-xl bg-red-100 text-red-600 font-bold">✕</button>
                  )}
                </div>
              </div>

              {paymentType === 'cash' ? (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Cash Tendered (PHP)</label>
                    <div className="relative mb-2">
                      <span className="absolute left-4 top-3.5 text-xl font-bold text-slate-400">₱</span>
                      <input
                        type="number"
                        value={cashTendered}
                        onChange={e => setCashTendered(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && cashTendered && Math.round(parseFloat(cashTendered) * 100) >= total) {
                            handleCheckout();
                          }
                        }}
                        placeholder="0.00"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-slate-200 text-2xl font-bold focus:outline-none focus:border-amber-500"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[20, 50, 100, 200, 500, 1000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setCashTendered(amt.toString())}
                          className="min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-700 font-bold text-sm rounded-xl border border-slate-200 transition-colors"
                        >
                          ₱{amt}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCashTendered((total / 100).toFixed(2))}
                        className="min-h-[44px] px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-sm rounded-xl border border-amber-200 transition-colors"
                      >
                        Exact
                      </button>
                    </div>
                  </div>

                  {cashTendered && !isNaN(parseFloat(cashTendered)) && (
                    <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center">
                      <span className="font-bold text-slate-600">Change</span>
                      <span className={`text-2xl font-black ${Math.round(parseFloat(cashTendered) * 100) >= total ? 'text-green-600' : 'text-red-700'}`}>
                        {Math.round(parseFloat(cashTendered) * 100) >= total ? formatPeso(Math.round(parseFloat(cashTendered) * 100) - total) : 'Insufficient Cash'}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Customer</label>
                  {selectedCustomer ? (
                    <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate">{selectedCustomer.name}</p>
                        {selectedCustomer.phone && (
                          <p className="text-xs text-slate-500">📞 {selectedCustomer.phone}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedCustomerId(null)}
                        className="shrink-0 px-3 py-2 rounded-lg bg-white text-slate-700 text-xs font-bold min-h-[44px]"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        placeholder="Search customers"
                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-amber-500"
                      />
                      <div className="max-h-44 overflow-y-auto space-y-1.5 mt-2">
                        {matchingCustomers().map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setCheckoutError('');
                            }}
                            className="w-full text-left px-4 py-3 rounded-xl bg-slate-100 hover:bg-amber-100 min-h-[44px]"
                          >
                            <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                            {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                          </button>
                        ))}
                        {matchingCustomers().length === 0 && (
                          <p className="text-sm text-slate-400 text-center py-3">No customers found.</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowNewCustomer(v => !v)}
                        className="mt-3 w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-bold text-sm min-h-[44px]"
                      >
                        + New Customer
                      </button>
                      {showNewCustomer && (
                        <div className="mt-3 space-y-2">
                          <input
                            type="text"
                            value={newCustomerName}
                            onChange={e => setNewCustomerName(e.target.value)}
                            placeholder="Customer name"
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-amber-500"
                          />
                          <input
                            type="text"
                            value={newCustomerPhone}
                            onChange={e => setNewCustomerPhone(e.target.value)}
                            placeholder="Phone (optional)"
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => chooseCustomer({ name: newCustomerName, phone: newCustomerPhone })}
                            disabled={!newCustomerName.trim()}
                            className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm disabled:opacity-40 min-h-[44px]"
                          >
                            Add & Select
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  <p className="text-xs text-slate-500 mt-3">
                    This sale is added to the customer's balance. No cash is collected.
                  </p>
                </div>
              )}

              {checkoutError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{checkoutError}</p>
              )}
              
              <button
                onClick={handleCheckout}
                disabled={
                  paymentType === 'cash'
                    ? !cashTendered || Math.round(parseFloat(cashTendered) * 100) < total
                    : !selectedCustomerId
                }
                className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold text-lg rounded-2xl shadow-lg disabled:opacity-40 transition"
              >
                {paymentType === 'cash' ? 'Complete Payment' : 'Record Utang'}
              </button>
            </div>
          </div>
        )}

        {/* Receipt Modal */}
        {receipt && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
            <div className="printable-receipt bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6">
              <div className="text-center border-b pb-4">
                <p className="text-4xl mb-2">🎉</p>
                <h3 className="text-2xl font-black text-slate-900">Transaction Complete!</h3>
                <p className="text-xs text-slate-400">Receipt #{receipt.id.slice(0, 8)}</p>
                {receipt.paymentType === 'utang' && (
                  <p className="mt-2 inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-black">
                    📒 UTANG — {formatPeso(receipt.total)} ON RECORD
                  </p>
                )}
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
                {receipt.items.map((i, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{i.soldByWeight ? `${formatWeight(i.quantity)} ${i.name}` : `${i.quantity}x ${i.name}`}</span>
                    <span className="font-bold">{formatPeso(lineTotal(i))}</span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-1 text-sm font-medium">
                <div className="flex justify-between text-lg font-black">
                  <span>Total</span>
                  <span>{formatPeso(receipt.total)}</span>
                </div>
                {receipt.paymentType === 'utang' ? (
                  <div className="flex justify-between text-amber-700 font-bold">
                    <span>Balance on record</span>
                    <span>{formatPeso(receipt.total)}</span>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-slate-500">
                      <span>Cash Tendered</span>
                      <span>{formatPeso(receipt.cashTendered)}</span>
                    </div>
                    <div className="flex justify-between text-green-600 font-bold">
                      <span>Change</span>
                      <span>{formatPeso(receipt.change)}</span>
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                <button
                  onClick={handlePrintReceipt}
                  disabled={printing}
                  className="w-full py-3 bg-slate-900 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  {printing ? 'Connecting...' : '🖨️ Web Bluetooth Print'}
                </button>
                <button
                  onClick={() => window.print()}
                  className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
                >
                  🖨️ Windows / System Print (All Printers)
                </button>
                <button onClick={closeReceipt} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold rounded-xl transition">
                  Next Customer →
                </button>
                <button
                  onClick={handleVoidCurrentReceipt}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 text-sm transition"
                >
                  ⚠️ Void Transaction
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Receipt Preview Modal (tablet) */}
        {receiptPreviewOpen && receipt && (
          <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Receipt Preview</h3>
              <pre className="font-mono text-xs bg-slate-900 text-green-400 p-4 rounded-xl overflow-auto max-h-64 whitespace-pre-wrap">
                {buildReceiptText()}
              </pre>
              <div className="flex gap-3">
                <button
                  onClick={handleConfirmPrint}
                  disabled={printing}
                  className="flex-1 min-h-[44px] py-3 bg-slate-900 text-white font-semibold rounded-xl disabled:opacity-50"
                >
                  {printing ? 'Printing...' : '🖨️ Print'}
                </button>
                <button
                  onClick={() => setReceiptPreviewOpen(false)}
                  className="flex-1 min-h-[44px] py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Weight keypad for crops sold by the kilo */}
        {weighing && (
          <WeightPanel
            product={weighing}
            initialWeight={editingCartLine ? items.find(i => i.cartId === editingCartLine)?.quantity : undefined}
            initialPricePerKg={editingCartLine ? items.find(i => i.cartId === editingCartLine)?.price : undefined}
            onCancel={() => { setWeighing(null); setEditingCartLine(null); }}
            onAdd={handleWeighed}
          />
        )}
      </div>
    );
  }

  // Mobile Layout
  return (
    <div className="flex-1 flex flex-col relative pb-32">
      <header className="p-4 bg-white border-b border-slate-200">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Cashier</h1>
            <div className="flex items-center gap-3 text-xs mt-0.5">
              <span className={`inline-flex items-center gap-1 font-medium ${scannerConnected ? 'text-green-600' : 'text-slate-500'}`}>
                <span className={`w-2 h-2 rounded-full ${scannerConnected ? 'bg-green-500' : 'bg-slate-300'}`} />
                📷 Scanner {scannerConnected ? `Active · ${scannerActivity} scans` : 'Idle · no scans yet'}
              </span>
              <button
                onClick={() => connectPrinter()}
                className={`inline-flex items-center gap-1 font-medium ${printerConnected ? 'text-green-600' : 'text-red-600'}`}
              >
                <span className={`w-2 h-2 rounded-full ${printerConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                🖨️ {printerConnected ? (printerName || 'Printer Connected') : 'Printer Disconnected'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {notFound && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-slate-800">
                {seedPrefill ? 'Product Recognised' : 'New Barcode Detected'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Barcode <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono font-bold text-amber-600">{notFound}</code>{' '}
                {seedPrefill
                  ? 'matched our catalogue. Check the price and stock, then save:'
                  : 'is not in your inventory yet. Fill in details to add it instantly:'}
              </p>
            </div>
            <ProductForm
              key={seedPrefill ? seedPrefill.barcode : 'blank'}
              barcode={notFound}
              initial={seedPrefill || undefined}
              onSave={handleSaveNewProduct}
              onCancel={() => { setNotFound(null); setSeedPrefill(null); }}
            />
          </div>
        </div>
      )}

      {/* Cart Items - add pb-24 to prevent overlap with fixed footer */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {items.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-5xl mb-4">🛒</p>
            <p className="text-lg">Scan barcode or tap products below</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.cartId} className="bg-white p-4 rounded-xl shadow-sm flex items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">
                  {item.soldByWeight
                    ? `${formatWeight(item.quantity)} × ${formatPeso(item.price)}/kg`
                    : `${formatPeso(item.price)} each`}
                </p>
              </div>
              {item.soldByWeight ? (
                <button
                  onClick={() => openEditWeigh(item)}
                  aria-label={`Change weight for ${item.name}`}
                  className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-bold rounded-lg min-h-[44px]"
                >
                  {formatWeight(item.quantity)}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.cartId, item.quantity - 1)}
                    aria-label={`Decrease ${item.name} quantity`}
                    className="w-11 h-11 bg-slate-100 rounded-lg text-lg font-bold"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-bold">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.cartId, item.quantity + 1)}
                    aria-label={`Increase ${item.name} quantity`}
                    className="w-11 h-11 bg-slate-100 rounded-lg text-lg font-bold"
                  >
                    +
                  </button>
                </div>
              )}
              <div className="text-right">
                <p className="font-bold">{formatPeso(lineTotal(item))}</p>
                <button
                  onClick={() => removeItem(item.cartId)}
                  className="text-xs text-red-700 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* QuickTap / Crops grid - make flex-1 to fill space, add pb-24 to prevent overlap with fixed footer */}
      <div className="flex-1 overflow-hidden pb-24 flex flex-col">
        <div className="px-4 pt-3 flex gap-1 bg-white border-b border-slate-200">
          <button
            onClick={() => setCashierTab('quicktap')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-t-lg min-h-[44px] ${cashierTab === 'quicktap' ? 'text-slate-900 border-b-2 border-amber-500' : 'text-slate-400'}`}
          >
            ⚡ QuickTap
          </button>
          <button
            onClick={() => setCashierTab('crops')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-t-lg min-h-[44px] ${cashierTab === 'crops' ? 'text-slate-900 border-b-2 border-amber-500' : 'text-slate-400'}`}
          >
            🌾 Crops & Feed
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {cashierTab === 'quicktap' ? (
            <QuickTapGrid products={products} onProductsUpdated={() => getAllProducts().then(setProducts)} onWeightProduct={openWeigh} />
          ) : (
            <CropsGrid products={products} onPick={openWeigh} />
          )}
        </div>
      </div>

      {/* Checkout Footer */}
      <div className="p-4 bg-white border-t border-slate-200 shadow-2xl flex justify-between items-center fixed bottom-0 left-0 right-0 z-30">
        <div>
          <p className="text-xs text-slate-500">Total Due</p>
          <p className="text-2xl font-black text-slate-900">{formatPeso(total)}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearCart}
            disabled={items.length === 0}
            className="px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 disabled:opacity-40 min-h-[44px]"
          >
            Clear
          </button>
          <button
            onClick={() => setCheckoutOpen(true)}
            disabled={items.length === 0}
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold text-sm shadow-md disabled:opacity-40 transition min-h-[44px]"
          >
            Checkout 💳
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b pb-4">
              <h3 className="text-xl font-bold text-slate-900">Process Checkout</h3>
              <button onClick={closeCheckout} aria-label="Close checkout" className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center font-bold">✕</button>
            </div>

            <div>
              <p className="text-sm text-slate-500 mb-1">Subtotal</p>
              <p className={`text-4xl font-extrabold ${discount ? 'text-slate-400 line-through text-2xl' : 'text-amber-600'}`}>{formatPeso(getTotal())}</p>
              {discount && <p className="text-4xl font-extrabold text-amber-600">{formatPeso(total)}</p>}
            </div>

            {/* Payment type: cash now, or on credit (utang) */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Payment</label>
              <div className="flex gap-2">
                {(['cash', 'utang'] as const).map(pt => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => {
                      setPaymentType(pt);
                      setCheckoutError('');
                    }}
                    className={`flex-1 py-3 rounded-xl font-bold text-sm min-h-[44px] ${
                      paymentType === pt ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {pt === 'cash' ? '💵 Cash' : '📒 Utang'}
                  </button>
                ))}
              </div>
            </div>

            {/* Discount row */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Discount (optional)</label>
              <div className="flex gap-2 items-center">
                <button
                  type="button"
                  onClick={() => setDiscountType('percent')}
                  className={`min-h-[44px] px-4 py-2 rounded-xl font-bold border transition-colors ${discountType === 'percent' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                >%</button>
                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  className={`min-h-[44px] px-4 py-2 rounded-xl font-bold border transition-colors ${discountType === 'fixed' ? 'bg-amber-500 text-white border-amber-500' : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                >₱</button>
                <input
                  type="number"
                  min="0"
                  value={discountValue}
                  onChange={e => applyDiscountInput(e.target.value)}
                  placeholder={discountType === 'percent' ? '0%' : '0.00'}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-xl border-2 border-slate-200 font-bold focus:outline-none focus:border-amber-500"
                />
                {discount && (
                  <button type="button" onClick={() => { setDiscount(null); setDiscountValue(''); }} className="min-h-[44px] px-3 py-2 rounded-xl bg-red-100 text-red-600 font-bold">✕</button>
                )}
              </div>
            </div>

            {paymentType === 'cash' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Cash Tendered (PHP)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3.5 text-xl font-bold text-slate-400">₱</span>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={e => setCashTendered(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border-2 border-slate-200 text-2xl font-bold focus:outline-none focus:border-amber-500"
                      autoFocus
                    />
                  </div>
                </div>

                {cashTendered && !isNaN(parseFloat(cashTendered)) && (
                  <div className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center">
                    <span className="font-bold text-slate-600">Change</span>
                    <span className={`text-2xl font-black ${Math.round(parseFloat(cashTendered) * 100) >= total ? 'text-green-600' : 'text-red-700'}`}>
                      {Math.round(parseFloat(cashTendered) * 100) >= total ? formatPeso(Math.round(parseFloat(cashTendered) * 100) - total) : 'Insufficient Cash'}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Customer</label>
                {selectedCustomer ? (
                  <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{selectedCustomer.name}</p>
                      {selectedCustomer.phone && (
                        <p className="text-xs text-slate-500">📞 {selectedCustomer.phone}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerId(null)}
                      className="shrink-0 px-3 py-2 rounded-lg bg-white text-slate-700 text-xs font-bold min-h-[44px]"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={e => setCustomerSearch(e.target.value)}
                      placeholder="Search customers"
                      className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-amber-500"
                    />
                    <div className="max-h-44 overflow-y-auto space-y-1.5 mt-2">
                      {matchingCustomers().map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId(c.id);
                            setCheckoutError('');
                          }}
                          className="w-full text-left px-4 py-3 rounded-xl bg-slate-100 hover:bg-amber-100 min-h-[44px]"
                        >
                          <p className="font-bold text-slate-900 text-sm">{c.name}</p>
                          {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
                        </button>
                      ))}
                      {matchingCustomers().length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-3">No customers found.</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowNewCustomer(v => !v)}
                      className="mt-3 w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-600 font-bold text-sm min-h-[44px]"
                    >
                      + New Customer
                    </button>
                    {showNewCustomer && (
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={newCustomerName}
                          onChange={e => setNewCustomerName(e.target.value)}
                          placeholder="Customer name"
                          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                        <input
                          type="text"
                          value={newCustomerPhone}
                          onChange={e => setNewCustomerPhone(e.target.value)}
                          placeholder="Phone (optional)"
                          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => chooseCustomer({ name: newCustomerName, phone: newCustomerPhone })}
                          disabled={!newCustomerName.trim()}
                          className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold text-sm disabled:opacity-40 min-h-[44px]"
                        >
                          Add & Select
                        </button>
                      </div>
                    )}
                  </>
                )}
                <p className="text-xs text-slate-500 mt-3">
                  This sale is added to the customer's balance. No cash is collected.
                </p>
              </div>
            )}

            {checkoutError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{checkoutError}</p>
            )}
            
            <button
              onClick={handleCheckout}
              disabled={
                paymentType === 'cash'
                  ? !cashTendered || Math.round(parseFloat(cashTendered) * 100) < total
                  : !selectedCustomerId
              }
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold text-lg rounded-2xl shadow-lg disabled:opacity-40 transition"
            >
              {paymentType === 'cash' ? 'Complete Payment' : 'Record Utang'}
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="printable-receipt bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6">
            <div className="text-center border-b pb-4">
              <p className="text-4xl mb-2">🎉</p>
              <h3 className="text-2xl font-black text-slate-900">Transaction Complete!</h3>
              <p className="text-xs text-slate-400">Receipt #{receipt.id.slice(0, 8)}</p>
              {receipt.paymentType === 'utang' && (
                <p className="mt-2 inline-block px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-black">
                  📒 UTANG — {formatPeso(receipt.total)} ON RECORD
                </p>
              )}
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto text-sm">
              {receipt.items.map((i, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{i.soldByWeight ? `${formatWeight(i.quantity)} ${i.name}` : `${i.quantity}x ${i.name}`}</span>
                  <span className="font-bold">{formatPeso(lineTotal(i))}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-1 text-sm font-medium">
              <div className="flex justify-between text-lg font-black">
                <span>Total</span>
                <span>{formatPeso(receipt.total)}</span>
              </div>
              {receipt.paymentType === 'utang' ? (
                <div className="flex justify-between text-amber-700 font-bold">
                  <span>Balance on record</span>
                  <span>{formatPeso(receipt.total)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-slate-500">
                    <span>Cash Tendered</span>
                    <span>{formatPeso(receipt.cashTendered)}</span>
                  </div>
                  <div className="flex justify-between text-green-600 font-bold">
                    <span>Change</span>
                    <span>{formatPeso(receipt.change)}</span>
                  </div>
                </>
              )}
            </div>
            <div className="space-y-2">
              <button
                onClick={handlePrintReceipt}
                disabled={printing}
                className="w-full py-3 bg-slate-900 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                {printing ? 'Connecting...' : '🖨️ Web Bluetooth Print'}
              </button>
              <button
                onClick={() => window.print()}
                className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
              >
                🖨️ Windows / System Print (All Printers)
              </button>
              <button onClick={closeReceipt} className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold rounded-xl transition">
                Next Customer →
              </button>
              <button
                onClick={handleVoidCurrentReceipt}
                className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-xl border border-red-200 text-sm transition"
              >
                ⚠️ Void Transaction
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Receipt Preview Modal (mobile) */}
      {receiptPreviewOpen && receipt && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Receipt Preview</h3>
            <pre className="font-mono text-xs bg-slate-900 text-green-400 p-4 rounded-xl overflow-auto max-h-64 whitespace-pre-wrap">
              {buildReceiptText()}
            </pre>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmPrint}
                disabled={printing}
                className="flex-1 min-h-[44px] py-3 bg-slate-900 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                {printing ? 'Printing...' : '🖨️ Print'}
              </button>
              <button
                onClick={() => setReceiptPreviewOpen(false)}
                className="flex-1 min-h-[44px] py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Void Confirmation Modal */}
      {voidConfirmOpen && receipt && (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl">
          <h3 className="text-lg font-bold text-slate-900 mb-2">⚠️ Confirm Void Transaction</h3>
          <p className="text-sm text-slate-500 mb-4">
            This will void this transaction and restore all stock. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setVoidConfirmOpen(false)}
              className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setVoidConfirmOpen(false);
                voidTransaction(receipt.id).then(() => {
                  showToast('Transaction voided and stock restored!');
                  setReceipt(null);
                  getAllProducts().then(setProducts);
                }).catch(err => {
                  showToast(err.message || 'Failed to void transaction');
                  setVoidConfirmOpen(false);
                });
              }}
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl"
            >
              ✅ Void Transaction
            </button>
          </div>
        </div>
      </div>
      )}
      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-xl text-sm font-semibold">
          {toast}
        </div>
      )}

      {/* Weight keypad for crops sold by the kilo */}
      {weighing && (
        <WeightPanel
          product={weighing}
          initialWeight={editingCartLine ? items.find(i => i.cartId === editingCartLine)?.quantity : undefined}
          initialPricePerKg={editingCartLine ? items.find(i => i.cartId === editingCartLine)?.price : undefined}
          onCancel={() => { setWeighing(null); setEditingCartLine(null); }}
          onAdd={handleWeighed}
        />
      )}
    </div>
  );
}
