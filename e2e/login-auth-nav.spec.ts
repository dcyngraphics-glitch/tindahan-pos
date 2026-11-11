import { test, expect, type Page } from '@playwright/test';

// Vite dev server runs here. `/` redirects to `/tindahan-pos/` (the Vite base).
const BASE = 'http://localhost:5173';

/**
 * Sign in the way the app's own e2e bypass expects.
 *
 * The app gates on a Dexie Cloud session, and a real sign-in cannot be completed from a
 * test — the one-time code is emailed. So the authenticated specs seed the persisted
 * role and load with `?e2e=1`, which is honoured only in dev builds (see E2E_MODE in
 * src/services/db.ts).
 */
async function signIn(page: Page, role: 'cashier' | 'inventory') {
  await page.goto(BASE + '/?e2e=1');
  await page.evaluate(
    (r) => {
      localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated: true, role: r }));
    },
    role
  );
  await page.reload();
}

async function openMenu(page: Page) {
  const nav = page.locator('nav[role="navigation"]');
  // On mobile the inventory sidebar starts open, and its backdrop covers the menu
  // button — so only click when the drawer is actually closed.
  if (!(await nav.isVisible())) {
    await page.click('button[aria-label="Open menu"]');
  }
  await expect(nav).toBeVisible();
}

test.describe('Login & Auth & Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.setViewportSize({ width: 375, height: 812 });
  });

  // ───────────────────────── CASHIER ─────────────────────────

  test('C-1  Cashier sign-in lands on the POS', async ({ page }) => {
    await signIn(page, 'cashier');
    await expect(page.locator('h1:has-text("Cashier POS")')).toBeVisible();
    await expect(page.locator('header span:has-text("cashier")')).toBeVisible();
  });

  test('C-2  Login screen offers both roles and no PIN', async ({ page }) => {
    await expect(page.locator('h1:has-text("Softies Store")')).toBeVisible();
    await expect(page.locator('button:has-text("Cashier")')).toBeVisible();
    await expect(page.locator('button:has-text("Inventory Staff")')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();

    // The PIN stage went away when the flow moved to Dexie Cloud OTP.
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  test('C-3  Sign In opens the Dexie Cloud email prompt', async ({ page }) => {
    await page.click('button:has-text("Cashier")');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('#interaction-email')).toBeVisible();
  });

  test('C-4  Auto-login from a persisted session (no login screen)', async ({ page }) => {
    await signIn(page, 'cashier');
    await expect(page.locator('h1:has-text("Softies Store")')).not.toBeVisible();
    await expect(page.locator('h1:has-text("Cashier POS")')).toBeVisible();
  });

  // ───────────────────────── INVENTORY ─────────────────────────

  test('I-1  Inventory staff sign-in lands on the Inventory portal', async ({ page }) => {
    await signIn(page, 'inventory');
    await expect(page.locator('h1:has-text("Inventory Portal")')).toBeVisible();
    await expect(page.locator('header span:has-text("inventory")')).toBeVisible();
  });

  test('I-2  Inventory sign-in needs no PIN', async ({ page }) => {
    await page.click('button:has-text("Inventory Staff")');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('#interaction-email')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });

  // ───────────────────────── SIDEBAR BEHAVIOR ─────────────────────────

  test('S-1  Cashier on mobile: menu button visible, sidebar toggle works', async ({ page }) => {
    await signIn(page, 'cashier');
    await expect(page.locator('button[aria-label="Open menu"]')).toBeVisible();
    await expect(page.locator('nav[role="navigation"]')).toBeHidden();
    await openMenu(page);
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
  });

  test('S-2  Cashier on tablet: sidebar collapsible (menu button toggles)', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1100 });
    await signIn(page, 'cashier');
    await expect(page.locator('button[aria-label="Open menu"]')).toBeVisible();
    await expect(page.locator('nav[role="navigation"]')).toBeHidden();
    await openMenu(page);
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
    await page.click('button[aria-label="Close navigation menu"]');
    await expect(page.locator('nav[role="navigation"]')).toBeHidden();
    await openMenu(page);
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
  });

  test('S-3  Inventory on mobile: sidebar visible by default; collapsible', async ({ page }) => {
    await signIn(page, 'inventory');
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
    await page.click('button[aria-label="Close navigation menu"]');
    await expect(page.locator('nav[role="navigation"]')).toBeHidden();
    await expect(page.locator('button[aria-label="Open menu"]')).toBeVisible();
    await openMenu(page);
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
  });

  test('S-4  Inventory on tablet: sidebar collapsible with menu button', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1100 });
    await signIn(page, 'inventory');
    await expect(page.locator('nav[role="navigation"]')).toBeHidden();
    await expect(page.locator('button[aria-label="Open menu"]')).toBeVisible();
  });

  // ───────────────────────── MODE SWITCHING ─────────────────────────

  test('M-1  Cashier: mode switching via sidebar (tablet)', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1100 });
    await signIn(page, 'cashier');

    const cashierModes = [
      { label: 'Cashier', expect: 'QuickTap' },
      { label: 'History', expect: 'Transaction History' },
      { label: 'Inventory', expect: 'Inventory' },
      { label: 'Dashboard', expect: 'Dashboard & Analytics' },
    ];

    for (const mode of cashierModes) {
      await openMenu(page);
      const btn = page.locator('nav[role="navigation"] button:has-text("' + mode.label + '")');
      await btn.click();
      await expect(page.locator('main')).toContainText(mode.expect);
    }
  });

  test('M-2  Inventory: mode switching via sidebar (mobile)', async ({ page }) => {
    await signIn(page, 'inventory');
    // sidebar open by default
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();

    const inventoryModes = [
      { label: 'Scanner', expect: 'Manual Barcode Lookup' },
      { label: 'Inventory', expect: 'Inventory' },
      { label: 'History', expect: 'Transaction History' },
      { label: 'Dashboard', expect: 'Dashboard & Analytics' },
    ];

    for (const mode of inventoryModes) {
      await openMenu(page);
      const btn = page.locator('nav[role="navigation"] button:has-text("' + mode.label + '")');
      await btn.click();
      await expect(page.locator('main')).toContainText(mode.expect);
    }
  });

  // ───────────────────────── LOGOUT ─────────────────────────

  test('L-1  Inventory logout: confirm, clears session, returns to login', async ({ page }) => {
    await signIn(page, 'inventory');
    await expect(page.locator('h1:has-text("Inventory Portal")')).toBeVisible();

    await openMenu(page);
    await page.click('nav[role="navigation"] button:has-text("Log Out")');
    await expect(page.locator('h3:has-text("Log Out?")')).toBeVisible();
    await page.click('div[role="dialog"] button:has-text("Log Out")');

    await expect(page.locator('h1:has-text("Softies Store")')).toBeVisible();
    const auth = await page.evaluate(() => localStorage.getItem('tindahan_auth'));
    expect(auth).toBeNull();
  });

  test('L-2  Logout from Dev Settings modal also logs out', async ({ page }) => {
    await signIn(page, 'cashier');
    await openMenu(page);
    await page.click('nav[role="navigation"] button:has-text("Dev Settings")');
    await expect(page.locator('h2:has-text("Developer & Hardware Settings")')).toBeVisible();

    await page.click('button:has-text("Log Out 🚪")');

    await expect(page.locator('h1:has-text("Softies Store")')).toBeVisible();
    const auth = await page.evaluate(() => localStorage.getItem('tindahan_auth'));
    expect(auth).toBeNull();
  });

  test('L-3  Header logout returns to the login screen', async ({ page }) => {
    await signIn(page, 'cashier');
    await page.click('header button:has-text("Logout")');
    await expect(page.locator('h1:has-text("Softies Store")')).toBeVisible();
  });
});
