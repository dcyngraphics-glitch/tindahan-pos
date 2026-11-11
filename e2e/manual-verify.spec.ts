import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5179/';

function loginAsCashier(page, email, pin) {
  return async () => {
    await page.click('button:has-text("Cashier")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', email);
    await page.fill('input[placeholder="Create 4-digit PIN"]', pin);
    await page.click('button:has-text("Start Shift as Cashier")');
  };
}
function loginAsInventory(page, email) {
  return async () => {
    await page.click('button:has-text("Inventory Staff")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', email);
    await page.click('button:has-text("Start Shift as Inventory Staff")');
  };
}

test('M-1  Cashier: mode switching on tablet (820px)', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1100 });
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loginAsCashier(page, 'cashierM@pos.ph', '1234')();
  const menuBtn = page.locator('button[aria-label="Open menu"]');
  await expect(menuBtn).toBeVisible();
  for (const [label, expectText] of [
    ['Cashier', 'QuickTap 4x4 Products'],
    ['History', 'Transaction History'],
    ['Inventory', 'Inventory'],
    ['Dashboard', 'Dashboard & Analytics'],
  ]) {
    await page.click('button[aria-label="Open menu"]');
    const btn = page.locator('nav[role="navigation"] button:has-text("' + label + '")');
    await btn.click();
    const marker = page.locator('text=' + expectText);
    await expect(marker).toBeVisible();
    console.log(`  M1 mode ${label} -> visible: ${expectText}`);
  }
});

test('M-2  Inventory: mode switching on mobile (375px)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loginAsInventory(page, 'invM@pos.ph')();
  console.log('  M2 sidebar visible by default:', await page.locator('nav[role="navigation"]').isVisible());
  for (const [label, expectText] of [
    ['Scanner', 'Manual Barcode Lookup'],
    ['Inventory', 'Inventory'],
    ['History', 'Transaction History'],
    ['Dashboard', 'Dashboard & Analytics'],
  ]) {
    const btn = page.locator('nav[role="navigation"] button:has-text("' + label + '")');
    await btn.click();
    const marker = page.locator('text=' + expectText);
    await expect(marker).toBeVisible();
    console.log(`  M2 mode ${label} -> visible: ${expectText}`);
  }
});

test('L-1  Cashier logout (tablet)', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1100 });
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loginAsCashier(page, 'logout@pos.ph', '1234')();
  await page.click('button[aria-label="Open menu"]');
  await expect(page.locator('nav[role="navigation"]')).toBeVisible();
  await page.click('button:has-text("Log Out")');
  await expect(page.locator('h3:has-text("Log Out?")')).toBeVisible();
  await page.click('button:has-text("Log Out")');
  await expect(page.locator('h1:has-text("Softies Store")')).toBeVisible();
  console.log('  L1 logout OK -> back to login');
});

test('L-2  Logout from Dev Settings modal (tablet)', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1100 });
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await loginAsCashier(page, 'logoutDev@pos.ph', '1234')();
  await page.click('button:has-text("Dev Settings")');
  await expect(page.locator('h2:has-text("Developer & Hardware Settings")')).toBeVisible();
  await page.click('button:has-text("Log Out 🚪")');
  await expect(page.locator('h3:has-text("Log Out?")')).toBeVisible();
  await page.click('button:has-text("Log Out")');
  await expect(page.locator('h1:has-text("Softies Store")')).toBeVisible();
  console.log('  L2 logout from Dev Settings OK -> back to login');
});
