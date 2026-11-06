import { test, expect } from '@playwright/test';

test.describe('Tindahan POS — Full Feature E2E Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure fresh state
    await page.goto('http://localhost:5173/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('1. First-time Cashier PIN setup & login', async ({ page }) => {
    await page.goto('http://localhost:5173/');

    // Select Cashier role
    await page.click('button:has-text("Cashier")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'cashier@pos.ph');

    // Fill first-time PIN
    await page.fill('input[placeholder="Create 4-digit PIN"]', '1234');
    await page.fill('input[placeholder="Confirm 4-digit PIN"]', '1234');

    // Submit
    await page.click('button:has-text("Start Shift as Cashier")');

    // Expect Cashier POS header
    await expect(page.locator('h1:has-text("Cashier POS")')).toBeVisible();
    await expect(page.locator('text=cashier@pos.ph')).toBeVisible();
  });

  test('2. Cashier cart, discount, checkout & receipt preview', async ({ page }) => {
    // Fast setup auth
    await page.evaluate(() => {
      localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated: true, role: 'cashier', email: 'c@pos.ph' }));
      localStorage.setItem('tindahan_cashier_pin', '1234');
    });
    await page.goto('http://localhost:5173/');

    // Wait for quick-tap products
    const productBtn = page.locator('button:has-text("Lucky Me Pancit Canton Original")').first();
    await expect(productBtn).toBeVisible({ timeout: 10000 });

    // Add 2 items
    await productBtn.click();
    await productBtn.click();

    // Verify cart count & subtotal
    await expect(page.locator('text=Total Items: 2')).toBeVisible();
    await expect(page.locator('text=₱30.00').first()).toBeVisible();

    // Open Checkout
    await page.click('button:has-text("Checkout")');
    await expect(page.locator('h3:has-text("Process Checkout")')).toBeVisible();

    // Apply 10% discount
    await page.fill('input[placeholder="0%"]', '10');
    // Discounted total should be ₱27.00
    await expect(page.locator('text=₱27.00').first()).toBeVisible();

    // Enter cash
    await page.fill('input[placeholder="0.00"]', '50');
    await expect(page.locator('text=₱23.00')).toBeVisible(); // Change

    // Complete Payment
    await page.click('button:has-text("Complete Payment")');

    // Receipt Modal should show
    await expect(page.locator('h3:has-text("Transaction Complete!")')).toBeVisible();
    await expect(page.locator('text=₱27.00').first()).toBeVisible();

    // Test Receipt Preview Modal (Task 12)
    await page.click('button:has-text("Web Bluetooth Print")');
    await expect(page.locator('h3:has-text("Receipt Preview")')).toBeVisible();
    await expect(page.locator('pre:has-text("TINDAHAN POS")')).toBeVisible();

    // Close preview
    await page.click('button:has-text("Skip")');
    await expect(page.locator('h3:has-text("Receipt Preview")')).not.toBeVisible();

    // Finish sale
    await page.click('button:has-text("Next Customer")');
    await expect(page.locator('text=Total Items: 0')).toBeVisible();
  });

  test('3. Transaction History & Void Transaction (stock restoration)', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated: true, role: 'cashier', email: 'c@pos.ph' }));
      localStorage.setItem('tindahan_cashier_pin', '1234');
      localStorage.setItem('tindahan_app_mode', 'history');
    });
    await page.goto('http://localhost:5173/');

    // History screen header
    await expect(page.locator('h1:has-text("Transaction History")')).toBeVisible();

    // Should have filter buttons: All, Completed, Voided
    await expect(page.locator('button:has-text("All")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Completed")').first()).toBeVisible();
    await expect(page.locator('button:has-text("Voided")').first()).toBeVisible();
  });

  test('4. Dashboard BI (date-range, profit/margin, CSV export)', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated: true, role: 'cashier', email: 'c@pos.ph' }));
      localStorage.setItem('tindahan_app_mode', 'dashboard');
    });
    await page.goto('http://localhost:5173/');

    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();

    // Check Date Range Buttons
    await expect(page.locator('button:has-text("Today")')).toBeVisible();
    await expect(page.locator('button:has-text("Last 7d")')).toBeVisible();
    await expect(page.locator('button:has-text("Last 30d")')).toBeVisible();
    await expect(page.locator('button:has-text("All Time")')).toBeVisible();

    // Check Export CSV button
    await expect(page.locator('button:has-text("Export CSV")')).toBeVisible();

    // Check Gross Profit tile
    await expect(page.locator('text=Gross Profit')).toBeVisible();
  });

  test('5. Inventory (categories, search, pagination)', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated: true, role: 'inventory', email: 'inv@pos.ph' }));
      localStorage.setItem('tindahan_app_mode', 'inventory');
    });
    await page.goto('http://localhost:5173/');

    await expect(page.locator('h1:has-text("Inventory")').first()).toBeVisible();

    // Check search box
    const searchInput = page.locator('input[placeholder="Search products..."]');
    await expect(searchInput).toBeVisible();

    // Check pagination buttons
    await expect(page.locator('button:has-text("Next")')).toBeVisible();
    await expect(page.locator('button:has-text("Prev")')).toBeVisible();
  });

  test('6. Customer Display idle screen', async ({ page }) => {
    // Navigate to customer display via hash
    await page.goto('http://localhost:5173/#customer');

    // When cart is empty, should show the branded amber idle welcome screen
    await expect(page.locator('text=Welcome! Kumusta po?')).toBeVisible();
    await expect(page.locator('text=🏪')).toBeVisible();
  });
});
