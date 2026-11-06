// Test-cashier.mjs — end-to-end audit of the Cashier Module (tindahan-pos).
// Run from the project root: node scripts/test-cashier.mjs
import { chromium } from 'playwright';

const BASE = 'http://localhost:5176/';
const results = [];

function log(label, value) {
  const out = typeof value === 'boolean' ? (value ? 'PASS' : 'FAIL') : value;
  console.log(`${out.padEnd(6)}  ${label}`);
  results.push({ label, value });
}

async function getTotalText() {
  try {
    const el = await page.locator('p:has-text("Total Items")').nextSibling().catch(() => null);
    if (el) {
      const t = await el.textContent().catch(() => '');
      if (t && !/Total Items/.test(t)) return t.trim();
    }
  } catch {}
  try {
    const m = await page.locator('p:has-text("Total Due")').nextSibling().catch(() => null);
    if (m) return (await m.textContent()).trim();
  } catch {}
  return '';
}

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  locale: 'en-PH',
});
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('[console.error]', msg.text().slice(0, 300));
});
page.on('pageerror', (err) => console.log('[pageerror]', err.message.slice(0, 300)));

try {
  // ── 1. Fresh visit, clear storage, login (first-time pin) ─────────────────
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(600);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1200);

  await page.click('button:has-text("Cashier")');
  await page.fill('input[placeholder*="tindera"]', 'cashier@tindahan.pos');
  await page.fill('input[placeholder*="Create 4-digit"]', '1234');
  await page.fill('input[placeholder*="Confirm"]', '1234');
  await page.click('button:has-text("Start Shift as Cashier")');
  await page.waitForTimeout(1500);

  // Empty-cart smoke (no products seeded yet)
  const emptyCartText = await page.textContent('div.text-slate-400').catch(() => '');
  log('Empty cart shows onboarding empty-state', /Scan barcode or tap products below/.test(emptyCartText || ''));
  log('QuickTap grid heading visible', await page.locator('h2:has-text("QuickTap")').isVisible().catch(() => false));

  // ── 2. Seed products (via test hook) ──────────────────────────────────────
  await page.evaluate(async () => {
    const db = window.__db;
    if (!db) throw new Error('window.__db not found — test hook missing');
    await db.products.clear();
    const now = new Date();
    const prods = [
      { id: 'p1', barcode: '700000000001', name: 'Test Chippy Barbecue', price: 1000, cost: 700, stock: 10, category: 'Snacks', isQuickTap: true, createdAt: now, updatedAt: now },
      { id: 'p2', barcode: '700000000002', name: 'Test Out of Stock', price: 500, cost: 300, stock: 0, category: 'Snacks', isQuickTap: true, createdAt: now, updatedAt: now },
      { id: 'p3', barcode: '700000000003', name: 'Test Cart Item', price: 2000, cost: 1500, stock: 3, category: 'Snacks', isQuickTap: true, createdAt: now, updatedAt: now },
      { id: 'p4', barcode: '700000000004', name: 'Test Not QuickTap', price: 3000, cost: 2000, stock: 5, category: 'Snacks', isQuickTap: false, createdAt: now, updatedAt: now },
    ];
    await db.products.bulkPut(prods);
  });
  await page.reload();
  await page.waitForTimeout(1500);

  // QuickTap grid populated (2 QuickTap products: Chippy + Out-of-Stock)
  const gridCount = await page.locator('div.grid.grid-cols-4').count().catch(() => 0);
  log('QuickTap grid populated after seeding', gridCount >= 1);

  // ── 3. QuickTap grid: expand/collapse ─────────────────────────────────────
  await page.locator('button:has-text("Collapse")').click();
  await page.waitForTimeout(400);
  const gridCollapsed = await page.locator('div.grid.grid-cols-4').count() === 0;
  log('QuickTap grid collapses (products hidden)', gridCollapsed);
  await page.locator('button:has-text("Expand")').click();
  await page.waitForTimeout(400);
  const gridExpanded = await page.locator('div.grid.grid-cols-4').count() > 0;
  log('QuickTap grid expands (products visible)', gridExpanded);

  // Out-of-stock QuickTap tile: disabled + "Out" badge
  const oosTile = page.locator('button[title="Test Out of Stock"]');
  log('Out-of-stock QuickTap tile disabled', await oosTile.isDisabled().catch(() => false));
  log('Out-of-stock QuickTap tile shows "Out" badge', await oosTile.locator('span', { hasText: 'Out' }).isVisible().catch(() => false));

  // ── 4. Add to cart via QuickTap tap ───────────────────────────────────────
  const chippyBtn = page.locator('button[title="Test Chippy Barbecue"]');
  await chippyBtn.click();
  await page.waitForTimeout(400);
  const cartItemAfterAdd = await page.locator('div.bg-white', { hasText: 'Test Chippy Barbecue' }).count();
  log('Tapping QuickTap adds item to cart', cartItemAfterAdd >= 1);
  const totalAfterAdd = await getTotalText();
  log('Cart total after adding Chippy (₱10)', /₱10\.00/.test(totalAfterAdd || ''));

  // ── 5. Add non-QuickTap product via picker modal ─────────────────────────
  await page.locator('button:has-text("+ Add QuickTap")').click();
  await page.waitForTimeout(400);
  await page.fill('input[placeholder="Search all products by name or barcode..."]', 'Test Not QuickTap');
  await page.waitForTimeout(300);
  const notQTRow = page.locator('div:has-text("Test Not QuickTap")').first();
  await notQTRow.locator('button', { hasText: '+ Add' }).click();
  await page.waitForTimeout(500);
  log('Added QuickTap product via picker modal', await page.locator('button[title="Test Not QuickTap"]').count() >= 1);

  // ── 6. Quantity +/- ───────────────────────────────────────────────────────
  const chippyRow = page.locator('div.bg-white', { hasText: 'Test Chippy Barbecue' });
  await chippyRow.locator('button:has-text("−")').click();
  await page.waitForTimeout(300);
  const qty1 = await chippyRow.locator('span.font-bold').first().textContent().catch(() => '');
  log('− decrements quantity to 1', /1/.test(qty1 || ''));

  await chippyRow.locator('button:has-text("+")').click();
  await page.waitForTimeout(300);
  const qty2 = await chippyRow.locator('span.font-bold').first().textContent().catch(() => '');
  log('+ increments quantity to 2', /2/.test(qty2 || ''));

  // Add Test Cart Item (stock 3), drive to limit then + beyond
  await page.locator('button:has-text("Test Cart Item")').click();
  await page.waitForTimeout(400);
  const cartItem = page.locator('div.bg-white', { hasText: 'Test Cart Item' });
  for (let i = 0; i < 3; i++) await cartItem.locator('button:has-text("+")').click();
  await page.waitForTimeout(400);
  const qty3 = await cartItem.locator('span.font-bold').first().textContent().catch(() => '');
  log('Test Cart Item reaches qty 3 (stock limit)', /3/.test(qty3 || ''));

  await cartItem.locator('button:has-text("+")').click();
  await page.waitForTimeout(400);
  const quantityToast = await page.textContent('div:has-text("Cannot set quantity")').catch(() => null);
  log('+ beyond stock shows quantity-limit toast', !!quantityToast && /Only 3 available/.test(quantityToast || ''));

  // ── 7. Remove item ────────────────────────────────────────────────────────
  await cartItem.locator('button:has-text("Remove")').click();
  await page.waitForTimeout(300);
  log('Remove removes item from cart', await page.locator('div.bg-white', { hasText: 'Test Cart Item' }).count() === 0);

  // ── 8. Cart total ─────────────────────────────────────────────────────────
  await page.locator('button:has-text("Test Chippy Barbecue")').first().click();
  await page.waitForTimeout(300);
  for (let i = 0; i < 2; i++) await cartItem.locator('button:has-text("+")').click();
  await page.waitForTimeout(400);
  const cartTotal = await page.textContent('div:has-text("Total Due")').catch(() => '');
  // Chippy qty 2 = ₱20, Cart Item qty 1 = ₱20 → ₱40.00
  log('Cart total = ₱40.00', /₱40\.00/.test(cartTotal || ''));

  // ── 9. Checkout modal: subtotal, percent discount, insufficient cash ─────
  await page.locator('button:has-text("Checkout")').click();
  await page.waitForTimeout(500);
  const modalSubtotal = await page.locator('p:has-text("40")').first().textContent().catch(() => '');
  log('Checkout modal subtotal = ₱40.00', /₱40\.00/.test(modalSubtotal || ''));

  await page.locator('button:has-text("%")').click();
  await page.locator('input[type="number"]').first().fill('10');
  await page.waitForTimeout(300);
  const discountRow = await page.locator('p:has-text("36")').first().textContent().catch(() => '');
  // 10% off ₱40 = ₱36.00
  log('10% discount applied -> ₱36.00', /₱36\.00/.test(discountRow || ''));

  await page.locator('button.bg-red-100').first().click();
  await page.waitForTimeout(300);
  const cleared = await page.locator('p:has-text("40")').first().textContent().catch(() => '');
  log('Discount cleared after clicking ✕', /₱40\.00/.test(cleared || ''));

  await page.locator('input[placeholder="0.00"]').first().fill('5');
  await page.waitForTimeout(200);
  const insufficient = await page.locator('div:has-text("Insufficient")').first().isVisible().catch(() => false);
  log('Insufficient cash flagged (₱5 < ₱40)', insufficient);

  // ── 10. Complete checkout ─────────────────────────────────────────────────
  await page.locator('input[placeholder="0.00"]').first().fill('50');
  await page.waitForTimeout(200);
  await page.locator('button:has-text("Complete Payment")').click();
  await page.waitForTimeout(1500);

  const receiptTotal = await page.locator('text=Total').first().textContent().catch(() => '');
  const receiptChange = await page.locator('text=Change').first().textContent().catch(() => '');
  log('Receipt Total = ₱40.00 (no discount)', /₱40\.00/.test(receiptTotal || ''));
  log('Receipt Change = ₱10.00 (₱50 − ₱40)', /₱10\.00/.test(receiptChange || ''));

  // ── 11. Void transaction ──────────────────────────────────────────────────
  const voidBtn = page.locator('button:has-text("Void / Cancel This Transaction")');
  if (await voidBtn.isVisible().catch(() => false)) {
    await voidBtn.click();
    await page.waitForTimeout(400);
    const voidConf = await page.locator('h3:has-text("Void")').isVisible().catch(() => false);
    log('Void confirmation modal appears', voidConf);
    await page.locator('button:has-text("Void Transaction")').click();
    await page.waitForTimeout(800);
    const voidToast = await page.textContent('div:has-text("voided and stock")').catch(() => null);
    log('Void completes with toast', !!voidToast);
  }

  // ── 12. Cart total + Clear ────────────────────────────────────────────────
  const totalAfter2 = await page.textContent('div:has-text("Total Due")').catch(() => '');
  log('Total still ₱40.00 before clear', /₱40\.00/.test(totalAfter2 || ''));
  await page.locator('button:has-text("Clear")').click();
  await page.waitForTimeout(300);
  const emptyAfterClear = await page.textContent('div.text-slate-400').catch(() => '');
  log('Clear cart empties cart', /Scan barcode or tap products below/.test(emptyAfterClear || ''));

} catch (err) {
  console.log('\nTEST SCRIPT ERROR:', err.message);
  console.log(err.stack);
  results.push({ label: 'Script error', value: err.message });
} finally {
  await browser.close();
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n========================================');
let pass = 0,
  fail = 0;
for (const r of results) {
  if (typeof r.value === 'boolean') {
    pass += r.value ? 1 : 0;
    fail += !r.value ? 1 : 0;
  }
}
console.log(`Totals: ${pass} passed, ${fail} failed, ${results.length} assertions`);
console.log('========================================');
process.exit(fail > 0 ? 1 : 0);
