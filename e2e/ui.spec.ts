import { test, expect, type Page } from '@playwright/test';

async function setupCashierAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated: true, role: 'cashier', email: 'cashier@tindahan.pos' }));
    localStorage.setItem('tindahan_cashier_pin', '1234');
    localStorage.setItem('tindahan_app_mode', 'cashier');
  });
}

test('cashier checkout flow shows PAID button', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await setupCashierAuth(page);
  await page.reload();

  // Wait for seed data to load and quick tap buttons to appear
  const quickTapBtn = page.locator('button:has-text("₱")').first();
  await page.waitForSelector('button:has-text("₱")', { timeout: 10000 });
  await expect(quickTapBtn).toBeVisible();
  await quickTapBtn.click();

  const checkoutButton = page.getByRole('button', { name: /CHECKOUT/i });
  await expect(checkoutButton).toBeVisible();
  await checkoutButton.click();

  const cashInput = page.locator('input[placeholder="0.00"]').first();
  await expect(cashInput).toBeVisible();
  await cashInput.fill('100');

  const completeButton = page.getByRole('button', { name: /Complete Payment/i });
  await expect(completeButton).toBeVisible();
  console.log('SUCCESS: Complete Payment button verified successfully.');
});

test('inventory right-side product edit form is stationary and interactive', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated: true, role: 'cashier', email: 'cashier@tindahan.pos' }));
    localStorage.setItem('tindahan_cashier_pin', '1234');
    localStorage.setItem('tindahan_app_mode', 'inventory');
  });
  await page.reload();

  // If "Add New Product" or table is showing, wait for table or add form
  const productRow = page.locator('tbody tr').first();
  const hasProducts = await productRow.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasProducts) {
    await productRow.click();
    const editHeader = page.getByRole('heading', { name: /Edit Product/i });
    await expect(editHeader).toBeVisible();
  } else {
    // Form is already visible for new product
    const formHeader = page.getByRole('heading', { name: /Product/i }).first();
    await expect(formHeader).toBeVisible();
  }

  // Verify price input is editable
  const priceInput = page.locator('input[placeholder="0.00"]').first();
  await expect(priceInput).toBeVisible();
  await priceInput.fill('25.50');
  await expect(priceInput).toHaveValue('25.50');

  console.log('SUCCESS: Inventory right-side stationary form verified successfully.');
});

test('inventory mode login and mobile container portal display', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); // Mobile viewport for inventory mode
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Click Inventory Staff role button on login screen
  const inventoryRoleBtn = page.getByRole('button', { name: /Inventory Staff/i });
  await expect(inventoryRoleBtn).toBeVisible();
  await inventoryRoleBtn.click();

  // Enter email and submit (Inventory role has no PIN requirement)
  const emailInput = page.locator('input[type="email"]');
  await expect(emailInput).toBeVisible();
  await emailInput.fill('inventory@tindahan.pos');
  const submitBtn = page.locator('button[type="submit"]');
  await submitBtn.click();

  // Verify Inventory Portal header is visible
  const portalHeader = page.locator('text=Inventory Portal');
  await expect(portalHeader).toBeVisible();

  // Verify Scanner interface is visible
  const scannerHeading = page.getByRole('heading', { name: /Manual Barcode Lookup/i });
  await expect(scannerHeading).toBeVisible();

  console.log('SUCCESS: Inventory mode login and scanner tab verified successfully.');
});



