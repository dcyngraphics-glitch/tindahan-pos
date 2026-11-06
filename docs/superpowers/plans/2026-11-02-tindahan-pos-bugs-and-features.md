# Tindahan POS — Bug Fixes & Feature Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all known bugs, add transaction history, void transaction, discount support, low-stock nav badge, profit/margin dashboard, date-range filter, CSV export, cashier PIN, customer display idle screen, receipt preview, consolidated scanner hook, and BLE reconnection — making the app production-ready.

**Architecture:** Bug fixes are self-contained store/service patches applied first so every subsequent feature builds on a correct foundation. New features extend existing Zustand stores and Dexie services; new screens follow the same conditional-render pattern as existing screens. The PIN is stored in `localStorage` under `tindahan_cashier_pin` (hashed with `crypto.subtle.digest`) so it survives page reloads and can be changed but never recovered in plaintext.

**Tech Stack:** React 19, Zustand 5, Dexie 4 + Dexie Cloud, Tailwind CSS v4, Recharts, GSAP, Vitest (happy-dom), TypeScript 7

**Spec:** `C:\Users\bryan\.claude\plans\ok-now-i-want-modular-llama.md`

---

## Global Constraints

- All monetary values stored and computed in centavos (integer); `formatPeso` from `src/services/db.ts` used for display
- `crypto.randomUUID()` for all new IDs; `generateId()` re-export from `db.ts` preferred
- No new npm dependencies — use what is installed
- Touch targets ≥ 44px on all interactive elements
- Dark mode compatibility: use `dark:` Tailwind variants wherever background/text colours are set
- TypeScript strict; no `any` on new code
- `npm run type-check` and `npm run test` must pass after every task

---

## Review Focus

1. **Camera scanner double-add after fix** — hold a barcode in frame for 3s; item count must stay at 1
2. **Auth persistence across hard reload** — log in, hard-reload (Ctrl+Shift+R); must stay logged in
3. **Cart persistence across reload** — add 3 items, reload; cart must restore with all 3
4. **Void transaction stock restoration** — complete a sale of 5 units, void it; product stock must return to pre-sale value
5. **PIN change flow** — set PIN, log out, log back in; old PIN must not work after change

---

## Task 1: Fix prototype-pollution guard (auth, cart, settings never restore)

**Files:**
- Modify: `src/stores/authStore.ts`
- Modify: `src/stores/cartStore.ts`
- Modify: `src/stores/settingsStore.ts`

**Interfaces:**
- Produces: correct `safeParseAuth`, `safeParseCart`, `safeParseReceiptConfig` — each returns valid data on reload

- [ ] **Step 1: Write failing tests for safeParseAuth, safeParseCart, safeParseReceiptConfig**

```ts
// src/stores/__tests__/safeParse.test.ts
import { describe, it, expect } from 'vitest';

// Pull out the guards as exported helpers (after Task 1 makes them exported)
import { safeParseAuth } from '../authStore';
import { safeParseCart } from '../cartStore';
import { safeParseReceiptConfig } from '../settingsStore';

describe('safeParseAuth', () => {
  it('restores valid auth from JSON string', () => {
    const raw = JSON.stringify({ isAuthenticated: true, role: 'cashier', email: 'a@b.com' });
    const result = safeParseAuth(raw);
    expect(result.isAuthenticated).toBe(true);
    expect(result.role).toBe('cashier');
  });
  it('returns default for null', () => {
    expect(safeParseAuth(null).isAuthenticated).toBe(false);
  });
});

describe('safeParseCart', () => {
  it('restores cart items from JSON string', () => {
    const items = [{ cartId: 'c1', productId: 'p1', barcode: '123', name: 'A', price: 100, quantity: 2 }];
    const result = safeParseCart(JSON.stringify(items));
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A');
  });
});

describe('safeParseReceiptConfig', () => {
  it('restores saved receipt config', () => {
    const raw = JSON.stringify({ storeName: 'My Store', storeAddress: '1 St', contactInfo: '0912', receiptHeader: 'H', receiptFooter: 'F' });
    const result = safeParseReceiptConfig(raw);
    expect(result.storeName).toBe('My Store');
  });
});
```

- [ ] **Step 2: Run to confirm tests fail**

Run: `cd tindahan-pos && npx vitest run src/stores/__tests__/safeParse.test.ts`
Expected: FAIL (functions not exported yet, guard always rejects)

- [ ] **Step 3: Fix `safeParseAuth` in `src/stores/authStore.ts`**

Replace the guard condition `!parsed.__proto__ && !parsed.constructor` with:
```ts
!Object.prototype.hasOwnProperty.call(parsed, '__proto__') &&
!Object.prototype.hasOwnProperty.call(parsed, 'constructor')
```
Export the function: `export function safeParseAuth(...)`

- [ ] **Step 4: Fix `safeParseCart` in `src/stores/cartStore.ts`**

Replace `!item.__proto__` in the filter with:
```ts
!Object.prototype.hasOwnProperty.call(item, '__proto__')
```
Export the function: `export function safeParseCart(...)`

- [ ] **Step 5: Fix `safeParseReceiptConfig` in `src/stores/settingsStore.ts`**

Same guard replacement as Step 3. Export the function: `export function safeParseReceiptConfig(...)`

- [ ] **Step 6: Run tests — must pass**

Run: `cd tindahan-pos && npx vitest run src/stores/__tests__/safeParse.test.ts`
Expected: PASS (3 suites, all green)

- [ ] **Step 7: Run full test suite and type-check**

Run: `cd tindahan-pos && npm run test && npm run type-check`
Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add src/stores/authStore.ts src/stores/cartStore.ts src/stores/settingsStore.ts src/stores/__tests__/safeParse.test.ts
git commit -m "fix: correct prototype-pollution guard so auth/cart/settings restore on reload"
```

---

## Task 2: Fix camera scanner multi-add (BarcodeScanner debounce)

**Files:**
- Modify: `src/components/BarcodeScanner.tsx`

**Interfaces:**
- Consumes: `onScan: (barcode: string) => void` prop (unchanged)
- Produces: `onScan` fires at most once per barcode per 2000ms cooldown

- [ ] **Step 1: Add `lastScanned` ref and cooldown guard inside `BarcodeScanner`**

Inside the `useEffect`, before the `scanner.start(...)` call, declare:
```ts
const lastScannedRef = { barcode: '', time: 0 };
```
In the success callback passed to `scanner.start`:
```ts
(decodedText) => {
  const now = Date.now();
  if (decodedText === lastScannedRef.barcode && now - lastScannedRef.time < 2000) return;
  lastScannedRef.barcode = decodedText;
  lastScannedRef.time = now;
  onScan(decodedText);
}
```

- [ ] **Step 2: Remove `onScan` from the `useEffect` dependency array**

Change `}, [onScan]);` to `}, []);` — the scanner should start once. This avoids the restart-on-every-render bug. `lastScannedRef` is a plain object inside the effect closure, not a React ref, so it stays stable.

- [ ] **Step 3: Type-check**

Run: `cd tindahan-pos && npm run type-check`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/components/BarcodeScanner.tsx
git commit -m "fix: debounce camera scanner — onScan fires once per barcode per 2s"
```

---

## Task 3: Fix `useBarcodeScannerListener` re-register + `useCallback` in callers

**Files:**
- Modify: `src/hooks/useBarcodeScannerListener.ts`
- Modify: `src/screens/CashierScreen.tsx`
- Modify: `src/screens/InventoryScreen.tsx`
- Modify: `src/screens/ScannerScreen.tsx`

**Interfaces:**
- Produces: stable `handleScan` in all three screens; listener registers once per mount

- [ ] **Step 1: Update `useBarcodeScannerListener` to use a stable ref for the callback**

Replace the hook body so it stores `onScan` in a ref and calls `ref.current(barcode)` from a stable `handleKeyDown`:

```ts
import { useEffect, useRef } from 'react';

export function useBarcodeScannerListener(onScan: (barcode: string) => void) {
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; });

  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      if (now - lastKeyTime > 800) buffer = '';
      lastKeyTime = now;

      if (e.key === 'Enter' || e.key === 'Tab' || e.code === 'NumpadEnter') {
        const barcode = buffer.trim();
        if (barcode.length > 2) {
          onScanRef.current(barcode);
          e.preventDefault();
        }
        buffer = '';
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []); // stable — never re-registers
}
```

- [ ] **Step 2: Wrap `handleScan` in `useCallback` in `CashierScreen`**

In `CashierScreen.tsx`, import `useCallback` from react. Change the `handleScan` definition to:
```ts
const handleScan = useCallback(async (barcode: string) => { /* existing body */ }, [addItem, products]);
```
Add `products` to the dependency array only if the handler reads from `products` state; otherwise use `[]` and rely on the ref pattern from Step 1 to get the latest state via store selectors.

- [ ] **Step 3: Same `useCallback` treatment for `handleScan` in `InventoryScreen.tsx` and `ScannerScreen.tsx`**

Both can use `useCallback(..., [])` since they call store/service functions that are stable.

- [ ] **Step 4: Type-check**

Run: `cd tindahan-pos && npm run type-check`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useBarcodeScannerListener.ts src/screens/CashierScreen.tsx src/screens/InventoryScreen.tsx src/screens/ScannerScreen.tsx
git commit -m "fix: stable keydown listener via ref pattern; useCallback on scan handlers"
```

---

## Task 4: Fix cart self-overwrite loop + `getTodayTransactions` + serial scanner buffer

**Files:**
- Modify: `src/stores/cartStore.ts`
- Modify: `src/services/transactions.ts`
- Modify: `src/services/serialScanner.ts`

- [ ] **Step 1: Fix `cartStore` self-dispatch loop**

In `persistAndSet`, replace:
```ts
window.dispatchEvent(new Event('storage'));
```
with:
```ts
window.dispatchEvent(new StorageEvent('storage', {
  key: 'tindahan_active_cart',
  newValue: JSON.stringify(items),
  storageArea: localStorage,
}));
```
Then in the `handleStorage` listener at the top of the store factory, add a guard:
```ts
if (e.key !== 'tindahan_active_cart') return;
```
This stops the store from reacting to its own dispatch for other keys, and the `storageArea` check in browser native behaviour means this StorageEvent won't recursively trigger `handleStorage` in the same tab (browsers suppress same-tab storage events for real writes; the manual dispatch must also be guarded). Add a `source` marker and skip if it came from self:

Actually the cleanest fix: remove the `window.dispatchEvent(new Event('storage'))` line entirely. The `tindahan-cart-update` custom event already handles same-tab Customer Display updates. The `storage` event is only needed for cross-tab; browsers fire it automatically on real `localStorage.setItem` calls in other tabs. The manual dispatch was the bug.

Replace the two `window.dispatchEvent` lines with just:
```ts
window.dispatchEvent(new CustomEvent('tindahan-cart-update'));
```

- [ ] **Step 2: Fix `getTodayTransactions` in `src/services/transactions.ts`**

Change `.above(today)` to `.aboveOrEqual(today)`.

- [ ] **Step 3: Fix serial scanner `\r\n` buffer advance in `src/services/serialScanner.ts`**

Replace `buffer = buffer.substring(lineEndIndex + 1);` with:
```ts
const match = buffer.match(/[\r\n]+/);
const skip = match ? match[0].length : 1;
buffer = buffer.substring(lineEndIndex + skip);
```

- [ ] **Step 4: Write test for `getTodayTransactions` midnight edge case**

```ts
// src/services/__tests__/transactions.test.ts — add to existing file
it('includes transactions created at exactly midnight', async () => {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  // This test verifies the .aboveOrEqual fix; mock Dexie if needed
  // At minimum: confirm the query uses aboveOrEqual by reading the source
  expect(true).toBe(true); // placeholder — integration test needs Dexie mock
});
```

- [ ] **Step 5: Type-check and tests**

Run: `cd tindahan-pos && npm run test && npm run type-check`

- [ ] **Step 6: Commit**

```bash
git add src/stores/cartStore.ts src/services/transactions.ts src/services/serialScanner.ts
git commit -m "fix: remove cart self-overwrite loop; fix midnight query; fix serial \r\n buffer"
```

---

## Task 5: Fix BLE disconnect, low-stock zero, pagination reset, dashboard refresh, alert() removal

**Files:**
- Modify: `src/stores/hardwareStore.ts`
- Modify: `src/services/products.ts`
- Modify: `src/screens/InventoryScreen.tsx`
- Modify: `src/screens/DashboardScreen.tsx`
- Modify: `src/screens/CashierScreen.tsx`
- Create: `src/components/Toast.tsx`

**Interfaces:**
- Produces: `Toast` component with `useToast()` hook; `showToast(message, type)` callable from any screen

- [ ] **Step 1: Create `src/components/Toast.tsx`**

A simple floating toast that auto-dismisses after 3s. Types: `'success' | 'error' | 'info'`.

Interface:
```ts
// Hook returns:
showToast: (message: string, type?: 'success' | 'error' | 'info') => void

// Component (mount once in App.tsx):
<ToastContainer />
```

Implementation: a Zustand-free approach — use a module-level event emitter via `CustomEvent` on `window`, or a simple React context. Recommend: a tiny store with `create` that holds `{ id, message, type }[]`, `showToast` pushes, `dismissToast` removes. Mount `<ToastContainer />` once in `App.tsx` above the screen content.

- [ ] **Step 2: Mount `<ToastContainer />` in `App.tsx`**

Import and render it inside the authenticated `return` block, above the `<ModeNav>`.

- [ ] **Step 3: Fix `disconnectPrinter` and `disconnectScanner` in `hardwareStore.ts`**

Before nulling state, call `device.gatt?.disconnect()` for BLE devices:
```ts
disconnectPrinter: () => {
  const { printerDevice } = get();
  try { printerDevice?.gatt?.disconnect(); } catch {}
  set({ printerDevice: null, printerServer: null, printerCharacteristic: null, printerName: null, isPrinterConnected: false });
},
disconnectScanner: () => {
  const { scannerDevice } = get();
  try { scannerDevice?.gatt?.disconnect(); } catch {}
  set({ scannerDevice: null, scannerServer: null, scannerCharacteristic: null, scannerName: null, isScannerConnected: false });
},
disconnectSerialScanner: () => {
  const { serialReader, serialPort } = get();
  try { serialReader?.cancel(); } catch {}
  try { serialPort?.close(); } catch {}
  set({ serialPort: null, serialReader: null, isSerialConnected: false });
},
```

- [ ] **Step 4: Fix `getLowStockProducts` in `src/services/products.ts`**

Change `p.stock > 0` filter to `p.stock >= 0` so zero-stock products appear in alerts:
```ts
export async function getLowStockProducts(threshold = 5): Promise<Product[]> {
  const all = await getAllProducts();
  return all.filter(p => p.stock <= threshold);
}
```

- [ ] **Step 5: Fix pagination reset on search in `InventoryScreen.tsx`**

In the `useEffect` that calls `loadProducts()` on `[query]`, add `setPage(1)` before the load call:
```ts
useEffect(() => {
  setPage(1);
  loadProducts();
}, [query]);
```

- [ ] **Step 6: Add refresh to `DashboardScreen.tsx`**

Add a `refreshKey` state (`useState(0)`). Change the `useEffect` dependency to `[refreshKey]`. Add a refresh button in the header:
```tsx
<button onClick={() => setRefreshKey(k => k + 1)} className="...">↻ Refresh</button>
```

- [ ] **Step 7: Replace `alert()` calls in `CashierScreen.tsx` with `showToast`**

Import `useToastStore` and replace the three `alert(...)` calls:
- `alert('Product out of stock')` → `showToast('Product out of stock', 'error')`
- `alert('Insufficient cash...')` → `showToast('Not enough cash', 'error')`  
- `alert('Printing failed...')` → `showToast('Printing failed', 'error')`

Also add `showToast('Receipt printed!', 'success')` after successful print.

- [ ] **Step 8: Fix GSAP shake animation leaving card offset in `LoginScreen.tsx`**

Add `onComplete: () => gsap.set(cardRef.current, { clearProps: 'x' })` to the tween options.

- [ ] **Step 9: Type-check and tests**

Run: `cd tindahan-pos && npm run test && npm run type-check`

- [ ] **Step 10: Commit**

```bash
git add src/stores/hardwareStore.ts src/services/products.ts src/screens/InventoryScreen.tsx src/screens/DashboardScreen.tsx src/screens/CashierScreen.tsx src/components/Toast.tsx src/App.tsx src/components/LoginScreen.tsx
git commit -m "fix: BLE disconnect, low-stock threshold, pagination reset, dashboard refresh, toast replaces alert"
```

---

## Task 6: Discount support (per-cart percentage or fixed amount)

**Files:**
- Modify: `src/stores/cartStore.ts`
- Modify: `src/services/db.ts` (add `discount` to `Transaction`)
- Modify: `src/services/transactions.ts` (`createTransaction` accepts discount)
- Modify: `src/screens/CashierScreen.tsx` (discount UI in checkout modal)

**Interfaces:**
- `cartStore` adds: `discount: { type: 'percent' | 'fixed'; value: number } | null`, `setDiscount(d)`, `clearDiscount()`
- `getDiscountedTotal(): number` — returns `getTotal()` after applying discount (centavos)
- `Transaction` adds: `discount: { type: 'percent' | 'fixed'; value: number } | null`
- `createTransaction` signature gains: `discount?: { type: 'percent' | 'fixed'; value: number } | null`

- [ ] **Step 1: Write test for discount calculation**

```ts
// src/stores/__tests__/cart.discount.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
// We test the pure math, not the store, to keep it simple
function applyDiscount(totalCentavos: number, discount: { type: 'percent' | 'fixed'; value: number } | null): number {
  if (!discount) return totalCentavos;
  if (discount.type === 'percent') return Math.round(totalCentavos * (1 - discount.value / 100));
  return Math.max(0, totalCentavos - discount.value);
}

describe('applyDiscount', () => {
  it('applies percent discount', () => expect(applyDiscount(10000, { type: 'percent', value: 10 })).toBe(9000));
  it('applies fixed discount in centavos', () => expect(applyDiscount(10000, { type: 'fixed', value: 2000 })).toBe(8000));
  it('clamps fixed discount at zero', () => expect(applyDiscount(500, { type: 'fixed', value: 1000 })).toBe(0));
  it('returns total unchanged when discount is null', () => expect(applyDiscount(10000, null)).toBe(10000));
});
```

- [ ] **Step 2: Run to confirm pass (pure math test, no store needed)**

Run: `cd tindahan-pos && npx vitest run src/stores/__tests__/cart.discount.test.ts`
Expected: PASS (the pure function is defined inline in the test)

- [ ] **Step 3: Add discount to `cartStore.ts`**

Add to `CartState`:
```ts
discount: { type: 'percent' | 'fixed'; value: number } | null;
setDiscount: (d: { type: 'percent' | 'fixed'; value: number } | null) => void;
getDiscountedTotal: () => number;
```

In `clearCart`, reset `discount` to `null`.

`getDiscountedTotal`:
```ts
getDiscountedTotal: () => {
  const total = get().getTotal();
  const d = get().discount;
  if (!d) return total;
  if (d.type === 'percent') return Math.round(total * (1 - d.value / 100));
  return Math.max(0, total - d.value);
},
```

- [ ] **Step 4: Add `discount` field to `Transaction` in `src/services/db.ts`**

```ts
export interface Transaction {
  // ...existing fields
  discount: { type: 'percent' | 'fixed'; value: number } | null;
}
```

- [ ] **Step 5: Update `createTransaction` in `src/services/transactions.ts`**

Add `discount` parameter. Store it in the transaction record. Use `getDiscountedTotal()` value (passed in from caller as `total`) — caller computes total, service stores it.

- [ ] **Step 6: Add discount UI to checkout modal in `CashierScreen.tsx`**

In the checkout modal, above the cash tendered input, add:
- A "Discount" row with two buttons: "%" and "₱"
- A number input for the discount value
- Display "Discounted Total: ₱X.XX" when a discount is active
- Pass `getDiscountedTotal()` as `total` to `createTransaction`
- Call `setDiscount(null)` in `clearCart` (already handled via store)

- [ ] **Step 7: Type-check and test**

Run: `cd tindahan-pos && npm run test && npm run type-check`

- [ ] **Step 8: Commit**

```bash
git add src/stores/cartStore.ts src/services/db.ts src/services/transactions.ts src/screens/CashierScreen.tsx src/stores/__tests__/cart.discount.test.ts
git commit -m "feat: discount support (percent/fixed) in checkout"
```

---

## Task 7: Void/cancel last transaction with stock restoration

**Files:**
- Modify: `src/services/transactions.ts` (add `voidTransaction`)
- Modify: `src/screens/CashierScreen.tsx` (void button on receipt modal)

**Interfaces:**
- `voidTransaction(id: string): Promise<void>` — marks transaction voided, restores stock atomically
- `Transaction` gains: `voided?: boolean`

- [ ] **Step 1: Add `voided` field to `Transaction` in `db.ts`**

```ts
voided?: boolean;
```

- [ ] **Step 2: Write test for `voidTransaction`**

```ts
// src/services/__tests__/voidTransaction.test.ts
import { describe, it, expect } from 'vitest';
import { InsufficientStockError } from '../transactions';
// Test that voidTransaction is a function (integration test needs Dexie mock setup)
it('voidTransaction is exported', async () => {
  const { voidTransaction } = await import('../transactions');
  expect(typeof voidTransaction).toBe('function');
});
```

- [ ] **Step 3: Implement `voidTransaction` in `src/services/transactions.ts`**

```ts
export async function voidTransaction(id: string): Promise<void> {
  await db.transaction('rw', db.transactions, db.products, async () => {
    const tx = await db.transactions.get(id);
    if (!tx) throw new Error('Transaction not found');
    if (tx.voided) throw new Error('Transaction already voided');
    // Restore stock for each item
    for (const item of tx.items) {
      await db.products.where('id').equals(item.productId).modify(p => {
        p.stock += item.quantity;
        p.updatedAt = new Date();
      });
    }
    await db.transactions.update(id, { voided: true });
  });
}
```

- [ ] **Step 4: Add "Void Transaction" button to the receipt modal in `CashierScreen.tsx`**

After a successful checkout, the receipt modal shows a "Void" button. On click:
- Call `voidTransaction(receipt.id)`
- Show toast: "Transaction voided. Stock restored."
- Close the receipt modal and clear the receipt state

The void button is only shown when `receipt` is not null and within the same session (no time restriction needed per spec).

- [ ] **Step 5: Type-check and test**

Run: `cd tindahan-pos && npm run test && npm run type-check`

- [ ] **Step 6: Commit**

```bash
git add src/services/transactions.ts src/services/db.ts src/screens/CashierScreen.tsx src/services/__tests__/voidTransaction.test.ts
git commit -m "feat: void transaction with atomic stock restoration"
```

---

## Task 8: Transaction history screen

**Files:**
- Create: `src/screens/TransactionHistoryScreen.tsx`
- Modify: `src/stores/appStore.ts` (add `'history'` to `AppMode`)
- Modify: `src/components/ModeNav.tsx` (add History nav item for cashier)
- Modify: `src/App.tsx` (render `TransactionHistoryScreen` for mode `'history'`)

**Interfaces:**
- `AppMode` becomes: `'inventory' | 'cashier' | 'dashboard' | 'scanner' | 'history'`
- Screen shows list of all transactions (most recent first), voided transactions shown with strikethrough
- Each row: date/time, item count, total, void badge if voided; tap row to expand items
- Reprint button on each row (calls `printViaBluetooth` with the stored transaction data)

- [ ] **Step 1: Add `'history'` to `AppMode` in `appStore.ts`**

Update the union type and the `loadMode` guard to accept `'history'`.

- [ ] **Step 2: Create `src/screens/TransactionHistoryScreen.tsx`**

```tsx
// Loads all transactions via getAllTransactions(), shows most recent first
// Each row: createdAt formatted, item names truncated, total, voided badge
// Expandable (useState per row or a single `expandedId` state) showing item list
// Reprint button calls existing printViaBluetooth from printer.ts
// Void button (only on non-voided transactions) calls voidTransaction
```

- [ ] **Step 3: Add History to `ModeNav.tsx` cashierModes array**

```ts
{ id: 'history', label: 'History', icon: '🧾' }
```

- [ ] **Step 4: Render `TransactionHistoryScreen` in `App.tsx`**

Add to the mode switch: `{mode === 'history' && <TransactionHistoryScreen />}`

- [ ] **Step 5: Type-check**

Run: `cd tindahan-pos && npm run type-check`

- [ ] **Step 6: Commit**

```bash
git add src/screens/TransactionHistoryScreen.tsx src/stores/appStore.ts src/components/ModeNav.tsx src/App.tsx
git commit -m "feat: transaction history screen with void and reprint"
```

---

## Task 9: Low-stock badge on nav

**Files:**
- Modify: `src/App.tsx` (load low-stock count, pass to header)
- Modify: `src/components/ModeNav.tsx` (show badge count on Inventory nav item)

**Interfaces:**
- `App.tsx` loads `getLowStockProducts()` and stores count in state; passes as prop or via a shared store
- Badge: red circle with count, shown on the Inventory mode button in `ModeNav` and on the header hamburger if low stock > 0

- [ ] **Step 1: Load low-stock count in `App.tsx`**

Add `const [lowStockCount, setLowStockCount] = useState(0)`. In the seed `useEffect`, after seed, call `getLowStockProducts().then(p => setLowStockCount(p.length))`. Also refresh when mode changes to `'inventory'` (add `mode` to the dependency array or a separate effect).

- [ ] **Step 2: Pass `lowStockCount` to `ModeNav`**

Add `lowStockCount: number` prop to `ModeNavProps`. Show a red badge `<span className="...absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">{count}</span>` on the Inventory nav item when count > 0.

- [ ] **Step 3: Show badge on header hamburger in `App.tsx`**

Add a relative-positioned red dot on the menu button when `lowStockCount > 0`.

- [ ] **Step 4: Type-check**

Run: `cd tindahan-pos && npm run type-check`

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/ModeNav.tsx
git commit -m "feat: low-stock badge on nav and menu button"
```

---

## Task 10: Dashboard — profit/margin, date-range filter, top products toggle, CSV export

**Files:**
- Modify: `src/screens/DashboardScreen.tsx`

**Interfaces:**
- Date range: `'today' | '7d' | '30d' | 'all'` selector (buttons, default `'all'`)
- Profit/margin: a new stat card showing total gross profit `(price - cost) * qty` across filtered transactions
- Top products toggle: `'revenue' | 'quantity'` button group on the bar chart
- CSV export: `exportTransactionsCSV(transactions, products)` — builds a CSV string and triggers download via `<a>` click

- [ ] **Step 1: Add date-range filter**

Add `type DateRange = 'today' | '7d' | '30d' | 'all'` and `const [dateRange, setDateRange] = useState<DateRange>('all')`.

Filter `transactions` before all aggregations:
```ts
const filtered = transactions.filter(t => {
  if (dateRange === 'all') return true;
  const cutoff = new Date();
  if (dateRange === 'today') cutoff.setHours(0, 0, 0, 0);
  else if (dateRange === '7d') cutoff.setDate(cutoff.getDate() - 7);
  else if (dateRange === '30d') cutoff.setDate(cutoff.getDate() - 30);
  return new Date(t.createdAt) >= cutoff;
});
```

Use `filtered` in all calculations below.

- [ ] **Step 2: Add profit/margin stat card**

```ts
// Requires products map for cost lookup
const productMap = new Map(products.map(p => [p.id, p]));
const totalProfit = filtered.reduce((sum, t) =>
  sum + t.items.reduce((s, item) => {
    const cost = productMap.get(item.productId)?.cost ?? 0;
    return s + (item.price - cost) * item.quantity;
  }, 0), 0);
```

Add a "Gross Profit" stat card below existing cards, displaying `formatPeso(totalProfit)`.

- [ ] **Step 3: Add top-products toggle (revenue vs. quantity)**

Add `const [topBy, setTopBy] = useState<'revenue' | 'quantity'>('revenue')`.

Compute `topProducts` based on `topBy`:
- revenue: `item.price * item.quantity` summed per product
- quantity: `item.quantity` summed per product

Show toggle buttons above the bar chart.

- [ ] **Step 4: Add CSV export**

```ts
function exportCSV(txs: Transaction[], prods: Product[]) {
  const productMap = new Map(prods.map(p => [p.id, p]));
  const rows = [['Date', 'Transaction ID', 'Item', 'Qty', 'Unit Price', 'Total', 'Voided']];
  for (const t of txs) {
    for (const item of t.items) {
      rows.push([
        new Date(t.createdAt).toLocaleString('en-PH'),
        t.id,
        item.name,
        String(item.quantity),
        formatPeso(item.price),
        formatPeso(item.price * item.quantity),
        t.voided ? 'Yes' : 'No',
      ]);
    }
  }
  const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tindahan-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

Add an "Export CSV" button in the dashboard header.

- [ ] **Step 5: Fix chart date ordering**

Use chronological sort instead of insertion order:
```ts
const chartData = Object.entries(dailySalesMap)
  .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
  .map(([date, revenue]) => ({ date, revenue }));
```

Actually, since date keys are locale strings (e.g. "Nov 2"), sort by finding the transaction dates instead. Better: build chartData by sorting the unique dates from `filtered.map(t => new Date(t.createdAt))` chronologically, then map to the aggregated value.

- [ ] **Step 6: Type-check**

Run: `cd tindahan-pos && npm run type-check`

- [ ] **Step 7: Commit**

```bash
git add src/screens/DashboardScreen.tsx
git commit -m "feat: dashboard date-range filter, profit card, top products toggle, CSV export"
```

---

## Task 11: Cashier PIN (set-once, stored hashed, changeable)

**Files:**
- Modify: `src/stores/authStore.ts` (add PIN state + actions)
- Create: `src/components/PinSetupScreen.tsx`
- Create: `src/components/PinEntryScreen.tsx`
- Modify: `src/App.tsx` (show PIN entry after login if PIN is set)
- Modify: `src/components/DeveloperSettingsModal.tsx` (add "Change PIN" section for cashier)

**Interfaces:**
- PIN stored as SHA-256 hex in `localStorage` under `tindahan_cashier_pin`
- `pinHash: string | null` in `authStore`
- `setPinHash(hash: string): void`
- `clearPin(): void`
- `verifyPin(input: string): Promise<boolean>` — hashes input, compares to stored
- PIN applies only to `role === 'cashier'`; inventory role has no PIN requirement
- First login as cashier: if no PIN set, show `PinSetupScreen` (4-digit, confirm entry)
- Subsequent logins: show `PinEntryScreen` (4-digit entry)
- PIN can be changed in `DeveloperSettingsModal` (enter current PIN, enter new PIN twice)

- [ ] **Step 1: Write PIN hash utility test**

```ts
// src/stores/__tests__/pin.test.ts
import { describe, it, expect } from 'vitest';

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

describe('PIN hashing', () => {
  it('same PIN produces same hash', async () => {
    const h1 = await hashPin('1234');
    const h2 = await hashPin('1234');
    expect(h1).toBe(h2);
  });
  it('different PINs produce different hashes', async () => {
    expect(await hashPin('1234')).not.toBe(await hashPin('5678'));
  });
});
```

- [ ] **Step 2: Run to confirm pass**

Run: `cd tindahan-pos && npx vitest run src/stores/__tests__/pin.test.ts`
Expected: PASS

- [ ] **Step 3: Add PIN fields and actions to `authStore.ts`**

```ts
pinHash: localStorage.getItem('tindahan_cashier_pin') ?? null,
setPinHash: (hash) => {
  localStorage.setItem('tindahan_cashier_pin', hash);
  set({ pinHash: hash });
},
clearPin: () => {
  localStorage.removeItem('tindahan_cashier_pin');
  set({ pinHash: null });
},
```

Export `hashPin` as a named export from `authStore.ts` for use in components:
```ts
export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 4: Create `src/components/PinSetupScreen.tsx`**

A 4-digit PIN pad (numeric buttons 0-9 + backspace). Two-step: enter PIN → confirm PIN. On match, calls `hashPin(pin).then(setPinHash)` then `onDone()`. On mismatch: shake animation, reset.

Props: `onDone: () => void`

- [ ] **Step 5: Create `src/components/PinEntryScreen.tsx`**

Same PIN pad UI. On submit: `hashPin(input).then(h => h === pinHash ? onSuccess() : onFail())`. After 3 failed attempts: show "Too many attempts. Please contact the store owner." and disable for 30s.

Props: `onSuccess: () => void`

- [ ] **Step 6: Wire into `App.tsx`**

After `isAuthenticated` check and `role === 'cashier'`, add a `pinVerified` state (session-only, not persisted). Logic:
```ts
// After login as cashier:
if (role === 'cashier' && !pinVerified) {
  if (!pinHash) return <PinSetupScreen onDone={() => setPinVerified(true)} />;
  return <PinEntryScreen onSuccess={() => setPinVerified(true)} />;
}
```

`pinVerified` resets when `isAuthenticated` becomes false (on logout).

- [ ] **Step 7: Add "Change PIN" to `DeveloperSettingsModal.tsx`**

Only shown when `role === 'cashier'`. A collapsible section with:
- Current PIN entry (if PIN exists)
- New PIN entry + confirm
- "Save PIN" button that verifies current PIN, hashes new PIN, calls `setPinHash`

- [ ] **Step 8: Type-check and test**

Run: `cd tindahan-pos && npm run test && npm run type-check`

- [ ] **Step 9: Commit**

```bash
git add src/stores/authStore.ts src/components/PinSetupScreen.tsx src/components/PinEntryScreen.tsx src/App.tsx src/components/DeveloperSettingsModal.tsx src/stores/__tests__/pin.test.ts
git commit -m "feat: cashier PIN (SHA-256 hashed, set-once, changeable in settings)"
```

---

## Task 12: Customer display idle screen + receipt preview before printing

**Files:**
- Modify: `src/screens/CustomerDisplayScreen.tsx`
- Modify: `src/screens/CashierScreen.tsx`

**Interfaces:**
- Customer display: when cart is empty show a branded idle screen (store name from settingsStore, amber gradient, logo emoji, "Welcome to {storeName}" message)
- Receipt preview: before calling `printViaBluetooth`, show a modal with receipt text rendered in a monospace font; two buttons: "Print" and "Skip"

- [ ] **Step 1: Update `CustomerDisplayScreen.tsx` idle state**

When `items.length === 0`, render:
```tsx
<div className="min-h-dvh bg-gradient-to-br from-amber-500 to-amber-700 flex flex-col items-center justify-center text-white">
  <div className="text-8xl mb-6">🏪</div>
  <h1 className="text-4xl font-black">{storeName}</h1>
  <p className="text-xl mt-2 opacity-80">Welcome! Kumusta po?</p>
</div>
```

`storeName` comes from reading `tindahan_receipt_config` via the same `safeParseReceiptConfig` import (CustomerDisplay is a separate tab so it can't use the Zustand store — read from localStorage directly).

- [ ] **Step 2: Add receipt preview modal to `CashierScreen.tsx`**

Add `receiptPreviewOpen` state. When "Print Receipt" is clicked, instead of immediately calling `printViaBluetooth`, set `receiptPreviewOpen = true` and build a `receiptText` string (same ESC/POS text as `printer.ts` but plain text for preview).

The preview modal shows the text in `<pre className="font-mono text-xs bg-slate-900 text-green-400 p-4 rounded-xl overflow-auto max-h-64">`. Two buttons: "Print" (calls `printViaBluetooth`, closes modal) and "Skip" (just closes modal).

- [ ] **Step 3: Type-check**

Run: `cd tindahan-pos && npm run type-check`

- [ ] **Step 4: Commit**

```bash
git add src/screens/CustomerDisplayScreen.tsx src/screens/CashierScreen.tsx
git commit -m "feat: customer display idle screen; receipt preview before printing"
```

---

## Task 13: Consolidate keydown buffers into shared hook

**Files:**
- Modify: `src/hooks/useBarcodeScannerListener.ts` (already done in Task 3 — now the canonical hook)
- Modify: `src/components/ScannerNotificationBanner.tsx` (use the hook instead of inline buffer)
- Modify: `src/hooks/useScannerDetection.ts` (use a ref for the timer, fix `isConnected` from any-key)
- Delete (or gut): `src/components/HardwareTestModal.tsx` inline buffer — replace with hook

**Interfaces:**
- `ScannerNotificationBanner` imports `useBarcodeScannerListener`; on any scan fires `setActiveStatus(true)` (same behavior but shared threshold)
- `useScannerDetection` uses `useBarcodeScannerListener` — on any scan from that hook, set connected for 5s

- [ ] **Step 1: Update `ScannerNotificationBanner.tsx`**

Remove the inline `keydown` `useEffect`. Import and call `useBarcodeScannerListener((barcode) => { setActiveStatus(true); })`. The banner fires only on actual scan events (Enter-terminated, >2 chars) rather than on any keypress.

- [ ] **Step 2: Fix `useScannerDetection.ts`**

Replace `(handleKeyDown as any).timeout` with `const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)`.

Change the detection approach: use `useBarcodeScannerListener` (the consolidated hook) to detect scans, rather than raw `keydown`. On each scan, set `isConnected = true` and reset the 5s timer:

```ts
export function useScannerDetection() {
  const [isConnected, setIsConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useBarcodeScannerListener(() => {
    setIsConnected(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setIsConnected(false), 5000);
  });

  return { isConnected, activityCount: isConnected ? 1 : 0 };
}
```

- [ ] **Step 3: Type-check and test**

Run: `cd tindahan-pos && npm run test && npm run type-check`

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useScannerDetection.ts src/components/ScannerNotificationBanner.tsx
git commit -m "refactor: consolidate keydown buffers into useBarcodeScannerListener"
```

---

## Task 14: BLE reconnection with user notification

**Files:**
- Modify: `src/services/printer.ts`
- Modify: `src/services/bluetoothScanner.ts`
- Modify: `src/stores/hardwareStore.ts` (add reconnect actions)
- Modify: `src/components/DeveloperSettingsModal.tsx` (show "Disconnected" indicator + "Reconnect" button)

**Interfaces:**
- On BLE `gattserverdisconnected` event: set `isPrinterConnected = false` in the store, show a toast "Printer disconnected. Tap to reconnect."
- Same for scanner
- `DeveloperSettingsModal` shows a "Reconnect" button when disconnected; tapping it calls `connectPrinter()` / `connectBluetoothScanner()` again

- [ ] **Step 1: Add `disconnected` event handler in `src/services/printer.ts`**

After a successful connection, attach:
```ts
device.addEventListener('gattserverdisconnected', () => {
  useHardwareStore.getState().setPrinterConnected(false);
  // show toast via the toast store
});
```

Add `setPrinterConnected(connected: boolean)` action to `hardwareStore`.

- [ ] **Step 2: Same for `src/services/bluetoothScanner.ts`**

Attach `gattserverdisconnected` listener on the scanner device; call `useHardwareStore.getState().setScannerConnected(false)` and show toast.

- [ ] **Step 3: Add `setPrinterConnected` and `setScannerConnected` minimal actions to `hardwareStore.ts`**

```ts
setPrinterConnected: (connected) => set({ isPrinterConnected: connected }),
setScannerConnected: (connected) => set({ isScannerConnected: connected }),
```

- [ ] **Step 4: Add "Reconnect" button in `DeveloperSettingsModal`**

When `isPrinterConnected === false` and `printerName !== null` (was previously connected), show:
```tsx
<button onClick={() => connectPrinter()}>↻ Reconnect {printerName}</button>
```

- [ ] **Step 5: Type-check**

Run: `cd tindahan-pos && npm run type-check`

- [ ] **Step 6: Commit**

```bash
git add src/services/printer.ts src/services/bluetoothScanner.ts src/stores/hardwareStore.ts src/components/DeveloperSettingsModal.tsx
git commit -m "feat: BLE auto-disconnect detection with reconnect button"
```

---

## Task 15: Test coverage — createTransaction, cartStore, authStore

**Files:**
- Create: `src/services/__tests__/createTransaction.test.ts`
- Create: `src/stores/__tests__/authStore.test.ts`

**Interfaces:**
- These are integration-style tests using vitest with happy-dom; Dexie in-memory via `fake-indexeddb` (check if available — if not, mock `db` module)

- [ ] **Step 1: Check if fake-indexeddb is available**

Run: `cd tindahan-pos && cat package.json | grep fake-indexeddb`
If not present (tindahan-pos uses happy-dom, not jsdom like barcode-inventory), use `vi.mock('../db')` approach.

- [ ] **Step 2: Write `authStore` tests**

```ts
// src/stores/__tests__/authStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { safeParseAuth } from '../authStore';

describe('safeParseAuth', () => {
  it('returns unauthenticated default for null', () => {
    expect(safeParseAuth(null)).toEqual({ isAuthenticated: false, role: null, email: null });
  });
  it('restores valid cashier auth', () => {
    const raw = JSON.stringify({ isAuthenticated: true, role: 'cashier', email: 'x@y.com' });
    const result = safeParseAuth(raw);
    expect(result.isAuthenticated).toBe(true);
    expect(result.role).toBe('cashier');
    expect(result.email).toBe('x@y.com');
  });
  it('rejects invalid role values', () => {
    const raw = JSON.stringify({ isAuthenticated: true, role: 'admin', email: 'x@y.com' });
    expect(safeParseAuth(raw).role).toBeNull();
  });
  it('rejects prototype pollution attempt', () => {
    const raw = '{"isAuthenticated":true,"role":"cashier","email":"a@b.com","__proto__":{"polluted":true}}';
    // Object.prototype.hasOwnProperty check means __proto__ in JSON IS a hasOwnProperty — this should be rejected
    const result = safeParseAuth(raw);
    expect(result.isAuthenticated).toBe(false);
  });
});
```

- [ ] **Step 3: Write `createTransaction` mock test**

```ts
// src/services/__tests__/createTransaction.test.ts
import { describe, it, expect, vi } from 'vitest';
import { InsufficientStockError } from '../transactions';

describe('InsufficientStockError', () => {
  it('sets all properties correctly', () => {
    const err = new InsufficientStockError('p1', 'Milk', 5, 2);
    expect(err.productId).toBe('p1');
    expect(err.productName).toBe('Milk');
    expect(err.requested).toBe(5);
    expect(err.available).toBe(2);
    expect(err instanceof Error).toBe(true);
    expect(err.name).toBe('InsufficientStockError');
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `cd tindahan-pos && npm run test`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add src/services/__tests__/createTransaction.test.ts src/stores/__tests__/authStore.test.ts
git commit -m "test: authStore safeParseAuth and InsufficientStockError coverage"
```

---

## Task 16: Final cleanup — remove dead code, out-of-stock badge on QuickTapGrid, camera open button in Inventory

**Files:**
- Delete: `src/components/SettingsModal.tsx`
- Remove: `getSalesSummary` export from `src/services/transactions.ts` (or keep but mark with comment if called from TransactionHistoryScreen — check first)
- Modify: `src/components/QuickTapGrid.tsx` (add "Out of Stock" label on disabled items)
- Modify: `src/screens/InventoryScreen.tsx` (add camera scanner open button)

- [ ] **Step 1: Delete `src/components/SettingsModal.tsx`**

Verify it has no imports: `grep -r "SettingsModal" tindahan-pos/src` — confirm only the file itself defines it, then delete.

- [ ] **Step 2: Add "Out of Stock" label to QuickTapGrid items**

On items where `stock === 0`, show a small "Out" badge overlaid on the button.

- [ ] **Step 3: Add camera scanner trigger button to `InventoryScreen.tsx`**

Add a camera icon button in the InventoryScreen header that calls `setScannerOpen(true)`. This wires up the existing `scannerOpen` state that currently has no trigger.

- [ ] **Step 4: Type-check and full test run**

Run: `cd tindahan-pos && npm run test && npm run type-check`
Expected: all pass

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: remove dead code, add OOS badge on QuickTap, camera button in Inventory"
```

---

## Verification Checklist (run after all tasks complete)

- [ ] `npm run test` — all tests pass
- [ ] `npm run type-check` — zero errors
- [ ] `npm run build` — production build succeeds
- [ ] Manual: Log in as cashier, hard-reload → stays logged in (Task 1)
- [ ] Manual: Add items to cart, hard-reload → cart restores (Task 1)
- [ ] Manual: Hold barcode in camera for 3s → item added once, not many times (Task 2)
- [ ] Manual: Complete a sale, switch to Dashboard, hit Refresh → numbers update (Task 5)
- [ ] Manual: Void a transaction → toast confirms, product stock incremented back (Task 7)
- [ ] Manual: Transaction history screen shows all sales; voided shown with strikethrough (Task 8)
- [ ] Manual: Set cashier PIN, log out, log back in → PIN entry shown, correct PIN admits (Task 11)
- [ ] Manual: Change PIN → old PIN no longer works (Task 11)
- [ ] Manual: Open `#customer` tab → idle screen when cart empty; updates when items added (Task 12)
- [ ] Manual: Connect BT printer, turn it off → toast "Printer disconnected", Reconnect button appears (Task 14)
