import { test, expect } from '@playwright/test';

// Vite dev server runs here
const BASE = 'http://localhost:5179/';

// Seed a persisted session WITHOUT auth so the login screen renders
// (the cashier can then enter the "remembered" PIN to unlock the till).
async function seedPinOnly(page: any, pin: string) {
  await page.evaluate(({ pin }) => {
    localStorage.setItem('tindahan_cashier_pin', pin);
  }, { pin });
}

// Seed a full persisted session (auth + PIN) so the app auto-logs in
// and shows the main screen directly (no login screen).
async function seedSession(page: any, role: 'cashier' | 'inventory', email: string, pin?: string) {
  await page.evaluate(({ role, email, pin }) => {
    localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated: true, role, email }));
    if (pin) localStorage.setItem('tindahan_cashier_pin', pin);
  }, { role, email, pin });
}

function loginAsCashier(page: any, email: string, pin: string) {
  return async () => {
    await page.click('button:has-text("Cashier")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', email);
    await page.fill('input[placeholder="Enter 4-digit PIN"]', pin);
    await page.click('button:has-text("Start Shift as Cashier")');
  };
}

function loginAsInventory(page: any, email: string) {
  return async () => {
    await page.click('button:has-text("Inventory Staff")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', email);
    await page.click('button:has-text("Start Shift as Inventory Staff")');
  };
}

async function openMenu(page: any) {
  await page.click('button:has-text("☰")');
  await expect(page.locator('nav[role="navigation"]')).toBeVisible();
}

test.describe('Login & Auth & Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.setViewportSize({ width: 375, height: 812 });
  });

  // ───────────────────────── CASHIR LOGIN ─────────────────────────

  test('C-1  Cashier: first-time PIN setup & login', async ({ page }) => {
    await page.click('button:has-text("Cashier")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'cashier@pos.ph');
    await page.fill('input[placeholder="Create 4-digit PIN"]', '1234');
    await page.fill('input[placeholder="Confirm 4-digit PIN"]', '1234');
    await page.click('button:has-text("Start Shift as Cashier")');
    await expect(page.locator('h1:has-text("Cashier POS")')).toBeVisible();
    await expect(page.locator('text=cashier@pos.ph')).toBeVisible();
  });

  test('C-2  Cashier: PIN remembered (second login, no auth in store)', async ({ page }) => {
    await seedPinOnly(page, '5678');
    await page.goto(BASE);
    await loginAsCashier(page, 'cashier2@pos.ph', '5678')();
    await expect(page.locator('h1:has-text("Cashier POS")')).toBeVisible();
  });

  test('C-3  Cashier: invalid email NOT accepted (form does not submit)', async ({ page }) => {
    await page.click('button:has-text("Cashier")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'not-an-email');
    await page.click('button:has-text("Start Shift as Cashier")');
    // type="email" + required native validation blocks submission; login screen stays
    await expect(page.locator('h1:has-text("Tindahan ni Aling Puring")')).toBeVisible();
  });

  test('C-4  Cashier: wrong PIN rejected', async ({ page }) => {
    await seedPinOnly(page, '1111');
    await page.goto(BASE);
    await loginAsCashier(page, 'cashier3@pos.ph', '9999')();
    await expect(page.locator('text=Incorrect Cashier PIN. Please try again.')).toBeVisible();
  });

  test('C-5  Cashier: empty email NOT accepted (form does not submit)', async ({ page }) => {
    await page.click('button:has-text("Cashier")');
    await page.click('button:has-text("Start Shift as Cashier")');
    // native validation blocks submission for empty required email
    await expect(page.locator('h1:has-text("Tindahan ni Aling Puring")')).toBeVisible();
  });

  test('C-6  Cashier: auto-login from persisted session (no login screen)', async ({ page }) => {
    await seedSession(page, 'cashier', 'cashier6@pos.ph', '1234');
    await page.goto(BASE);
    // Should land straight on the main screen, no login screen
    await expect(page.locator('h1:has-text("Tindahan ni Aling Puring")')).not.toBeVisible();
    await expect(page.locator('h1:has-text("Cashier POS")')).toBeVisible();
  });

  // ───────────────────────── INVENTORY LOGIN ─────────────────────────

  test('I-1  Inventory staff: login without PIN', async ({ page }) => {
    await page.click('button:has-text("Inventory Staff")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'inv@pos.ph');
    await page.click('button:has-text("Start Shift as Inventory Staff")');
    await expect(page.locator('h1:has-text("Inventory Portal")')).toBeVisible();
  });

  test('I-2  Inventory staff: invalid email NOT accepted (form does not submit)', async ({ page }) => {
    await page.click('button:has-text("Inventory Staff")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'bad-email');
    await page.click('button:has-text("Start Shift as Inventory Staff")');
    // native validation blocks submission
    await expect(page.locator('h1:has-text("Tindahan ni Aling Puring")')).toBeVisible();
  });

  test('I-3  Inventory staff: no PIN field rendered', async ({ page }) => {
    await page.click('button:has-text("Inventory Staff")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'inv2@pos.ph');
    const pinFields = page.locator('input[placeholder*="PIN"]');
    await expect(pinFields).toHaveCount(0);
  });

  // ───────────────────────── SIDEBAR BEHAVIOR ─────────────────────────

  test('S-1  Cashier on mobile: sidebar hidden, no menu button (unreachable)', async ({ page }) => {
    await page.click('button:has-text("Cashier")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'cashier@pos.ph');
    await page.fill('input[placeholder="Create 4-digit PIN"]', '1234');
    await page.fill('input[placeholder="Confirm 4-digit PIN"]', '1234');
    await page.click('button:has-text("Start Shift as Cashier")');
    await expect(page.locator('nav[role="navigation"]')).toBeHidden();
    await expect(page.locator('button[aria-label="Open menu"]')).toHaveCount(0);
  });

  test('S-2  Cashier on tablet: sidebar collapsible (menu button toggles)', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1100 });
    await seedPinOnly(page, '1234');
    await page.goto(BASE);
    await loginAsCashier(page, 'cashierT@pos.ph', '1234')();
    // menu button present on tablet
    await expect(page.locator('button[aria-label="Open menu"]')).toBeVisible();
    // sidebar hidden by default
    await expect(page.locator('nav[role="navigation"]')).toBeHidden();
    // open
    await openMenu(page);
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
    // close
    await page.click('button[aria-label="Close navigation menu"]');
    await expect(page.locator('nav[role="navigation"]')).toBeHidden();
    // reopen
    await openMenu(page);
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
  });

  test('S-3  Inventory on mobile: sidebar visible by default; collapsible', async ({ page }) => {
    await page.click('button:has-text("Inventory Staff")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'invMobile@pos.ph');
    await page.click('button:has-text("Start Shift as Inventory Staff")');
    // sidebar open by default
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
    // close it
    await page.click('button[aria-label="Close navigation menu"]');
    await expect(page.locator('nav[role="navigation"]')).toBeHidden();
    // menu button now appears
    await expect(page.locator('button:has-text("☰")')).toBeVisible();
    // reopen
    await openMenu(page);
    await expect(page.locator('nav[role="navigation"]')).toBeVisible();
  });

  test('S-4  Inventory on tablet: sidebar hidden with no way to open (BUG: unreachable)', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1100 });
    await page.click('button:has-text("Inventory Staff")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'invTab@pos.ph');
    await page.click('button:has-text("Start Shift as Inventory Staff")');
    // sidebar closed by default (only inventory-on-mobile auto-opens)
    await expect(page.locator('nav[role="navigation"]')).toBeHidden();
    // NO menu button exists → cannot open nav
    await expect(page.locator('button:has-text("☰")')).toHaveCount(0);
  });

  // ───────────────────────── MODE SWITCHING ─────────────────────────

  test('M-1  Cashier: mode switching via sidebar (tablet)', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 1100 });
    await seedPinOnly(page, '1234');
    await page.goto(BASE);
    await loginAsCashier(page, 'cashierM@pos.ph', '1234')();

    // cashier modes: Cashier, History, Inventory, Dashboard
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
      await expect(page.locator('h1')).toContainText(mode.expect);
    }
  });

  test('M-2  Inventory: mode switching via sidebar (mobile)', async ({ page }) => {
    await page.click('button:has-text("Inventory Staff")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'invM@pos.ph');
    await page.click('button:has-text("Start Shift as Inventory Staff")');
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
      await expect(page.locator('h1')).toContainText(mode.expect);
    }
  });

  // ───────────────────────── LOGOUT ─────────────────────────

  test('L-1  Cashier logout: confirm, clears session, returns to login', async ({ page }) => {
    await page.click('button:has-text("Cashier")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'logout@pos.ph');
    await page.fill('input[placeholder="Create 4-digit PIN"]', '1234');
    await page.fill('input[placeholder="Confirm 4-digit PIN"]', '1234');
    await page.click('button:has-text("Start Shift as Cashier")');

    await expect(page.locator('text=logout@pos.ph')).toBeVisible();
    await expect(page.locator('button:has-text("Logout")')).toBeVisible();

    // open nav
    await openMenu(page);
    // logout
    await page.click('button:has-text("Log Out")');
    await expect(page.locator('h3:has-text("Log Out?")')).toBeVisible();
    await page.click('button:has-text("Log Out")');
    // back to login
    await expect(page.locator('h1:has-text("Tindahan ni Aling Puring")')).toBeVisible();
    await expect(page.locator('text=logout@pos.ph')).not.toBeVisible();
    const auth = await page.evaluate(() => localStorage.getItem('tindahan_auth'));
    expect(auth).toBeNull();
  });

  test('L-2  Logout from Dev Settings modal also logs out', async ({ page }) => {
    await page.click('button:has-text("Cashier")');
    await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'logoutDev@pos.ph');
    await page.fill('input[placeholder="Create 4-digit PIN"]', '1234');
    await page.fill('input[placeholder="Confirm 4-digit PIN"]', '1234');
    await page.click('button:has-text("Start Shift as Cashier")');

    await page.click('button:has-text("Dev Settings")');
    await expect(page.locator('h2:has-text("Developer & Hardware Settings")')).toBeVisible();

    await page.click('button:has-text("Log Out 🚪")');
    await expect(page.locator('h3:has-text("Log Out?")')).toBeVisible();
    await page.click('button:has-text("Log Out")');

    await expect(page.locator('h1:has-text("Tindahan ni Aling Puring")')).toBeVisible();
  });
});
