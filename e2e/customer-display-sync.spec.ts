import { test, expect, type Page, type BrowserContext } from '@playwright/test';

/**
 * E2E tests for the Customer Display & Multi-tab Sync flow.
 * Runs two tabs (pages) in the same origin so localStorage + storage events
 * exercise the real cross-tab sync path.
 */
test.describe('Customer Display & Multi-tab Sync', () => {
  test('empty state, store name from localStorage, total display, second-tab sync, storage-event sync', async ({ browser }) => {
    const context = await browser.newContext();
    const pageA = await context.newPage(); // Customer Display tab
    const pageB = await context.newPage(); // Cashier tab (writes the cart)

    try {
      // --- Page A: Customer Display ---
      await pageA.goto('/#customer');

      // 1) Empty state
      await expect(pageA.locator('text=Welcome! Kumusta po?')).toBeVisible();
      await expect(pageA.locator('text=🏪')).toBeVisible();

      // 2) Store name comes from localStorage (read at mount via useState(getStoreName))
      await pageA.evaluate(() => {
        localStorage.setItem(
          'tindahan_receipt_config',
          JSON.stringify({ storeName: 'Test Tindahan', storeAddress: '1 St.', contactInfo: '0917' })
        );
      });
      await pageA.reload();
      await expect(pageA.locator('h1:has-text("Test Tindahan")')).toBeVisible();

      // 3) Capture storage events in page A so we can assert the mechanism fired
      const storageEvents: { key: string | null; newValue: string | null }[] = [];
      await pageA.evaluate(() => {
        const handler = (e: StorageEvent) => {
          storageEvents.push({ key: e.key, newValue: e.newValue });
        };
        window.addEventListener('storage', handler);
        (window as unknown as Record<string, unknown>).__cartStorageEvents = storageEvents;
      });

      // --- Page B: cashier, add items ---
      await pageB.goto('/');
      await pageB.evaluate(() => {
        localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated: true, role: 'cashier', email: 'c@pos.ph' }));
        localStorage.setItem('tindahan_cashier_pin', '1234');
      });
      await pageB.reload();

      const prodBtn = pageB.locator('button:has-text("Lucky Me Pancit Canton Original")').first();
      await expect(prodBtn).toBeVisible({ timeout: 10000 });
      await prodBtn.click(); // qty 1
      await prodBtn.click(); // qty 2  -> 2 x ₱15.00 = ₱30.00

      // --- Page A syncs in real-time ---
      // Items appear on the second tab as soon as the cashier writes to localStorage
      await pageA.waitForSelector('text=Lucky Me Pancit Canton Original', { timeout: 10000 });
      await expect(pageA.locator('text=Total Amount Due').locator('xpath=following::span[1]')).toHaveText('₱30.00');

      // 4) storage event fired in page A (cross-tab mechanism)
      const events = await pageA.evaluate(() => {
        const list = (window as unknown as Record<string, unknown>).__cartStorageEvents;
        return Array.isArray(list) ? list : null;
      });
      expect(events).not.toBeNull();
      expect(events!).toContainEqual({ key: 'tindahan_active_cart', newValue: expect.any(String) });

      // 5) second-tab sync: quantity change in page B updates page A's total too
      await prodBtn.click(); // qty 3 -> 3 x ₱15.00 = ₱45.00
      await pageA.waitForFunction(
        () => document.body.innerText.includes('₱45.00'),
        { timeout: 10000 }
      );
      await expect(pageA.locator('text=Total Amount Due').locator('xpath=following::span[1]')).toHaveText('₱45.00');

      // Cleanup (pageA reload would also clear, but do it explicitly for the shared context)
      await pageB.evaluate(() => localStorage.setItem('tindahan_active_cart', JSON.stringify([])));
    } finally {
      await context.close();
    }
  });
});
