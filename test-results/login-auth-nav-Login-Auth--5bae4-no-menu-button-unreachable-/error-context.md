# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login-auth-nav.spec.ts >> Login & Auth & Navigation Flow >> S-1  Cashier on mobile: sidebar hidden, no menu button (unreachable)
- Location: e2e\login-auth-nav.spec.ts:128:3

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5179/
Call log:
  - navigating to "http://localhost:5179/", waiting until "load"

```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | // Vite dev server runs here
  4   | const BASE = 'http://localhost:5179/';
  5   | 
  6   | // Seed a persisted session WITHOUT auth so the login screen renders
  7   | // (the cashier can then enter the "remembered" PIN to unlock the till).
  8   | async function seedPinOnly(page: any, pin: string) {
  9   |   await page.evaluate(({ pin }) => {
  10  |     localStorage.setItem('tindahan_cashier_pin', pin);
  11  |   }, { pin });
  12  | }
  13  | 
  14  | // Seed a full persisted session (auth + PIN) so the app auto-logs in
  15  | // and shows the main screen directly (no login screen).
  16  | async function seedSession(page: any, role: 'cashier' | 'inventory', email: string, pin?: string) {
  17  |   await page.evaluate(({ role, email, pin }) => {
  18  |     localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated: true, role, email }));
  19  |     if (pin) localStorage.setItem('tindahan_cashier_pin', pin);
  20  |   }, { role, email, pin });
  21  | }
  22  | 
  23  | function loginAsCashier(page: any, email: string, pin: string) {
  24  |   return async () => {
  25  |     await page.click('button:has-text("Cashier")');
  26  |     await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', email);
  27  |     await page.fill('input[placeholder="Enter 4-digit PIN"]', pin);
  28  |     await page.click('button:has-text("Start Shift as Cashier")');
  29  |   };
  30  | }
  31  | 
  32  | function loginAsInventory(page: any, email: string) {
  33  |   return async () => {
  34  |     await page.click('button:has-text("Inventory Staff")');
  35  |     await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', email);
  36  |     await page.click('button:has-text("Start Shift as Inventory Staff")');
  37  |   };
  38  | }
  39  | 
  40  | async function openMenu(page: any) {
  41  |   await page.click('button:has-text("☰")');
  42  |   await expect(page.locator('nav[role="navigation"]')).toBeVisible();
  43  | }
  44  | 
  45  | test.describe('Login & Auth & Navigation Flow', () => {
  46  |   test.beforeEach(async ({ page }) => {
> 47  |     await page.goto(BASE);
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:5179/
  48  |     await page.evaluate(() => localStorage.clear());
  49  |     await page.reload();
  50  |     await page.setViewportSize({ width: 375, height: 812 });
  51  |   });
  52  | 
  53  |   // ───────────────────────── CASHIR LOGIN ─────────────────────────
  54  | 
  55  |   test('C-1  Cashier: first-time PIN setup & login', async ({ page }) => {
  56  |     await page.click('button:has-text("Cashier")');
  57  |     await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'cashier@pos.ph');
  58  |     await page.fill('input[placeholder="Create 4-digit PIN"]', '1234');
  59  |     await page.fill('input[placeholder="Confirm 4-digit PIN"]', '1234');
  60  |     await page.click('button:has-text("Start Shift as Cashier")');
  61  |     await expect(page.locator('h1:has-text("Cashier POS")')).toBeVisible();
  62  |     await expect(page.locator('text=cashier@pos.ph')).toBeVisible();
  63  |   });
  64  | 
  65  |   test('C-2  Cashier: PIN remembered (second login, no auth in store)', async ({ page }) => {
  66  |     await seedPinOnly(page, '5678');
  67  |     await page.goto(BASE);
  68  |     await loginAsCashier(page, 'cashier2@pos.ph', '5678')();
  69  |     await expect(page.locator('h1:has-text("Cashier POS")')).toBeVisible();
  70  |   });
  71  | 
  72  |   test('C-3  Cashier: invalid email NOT accepted (form does not submit)', async ({ page }) => {
  73  |     await page.click('button:has-text("Cashier")');
  74  |     await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'not-an-email');
  75  |     await page.click('button:has-text("Start Shift as Cashier")');
  76  |     // type="email" + required native validation blocks submission; login screen stays
  77  |     await expect(page.locator('h1:has-text("Tindahan ni Aling Puring")')).toBeVisible();
  78  |   });
  79  | 
  80  |   test('C-4  Cashier: wrong PIN rejected', async ({ page }) => {
  81  |     await seedPinOnly(page, '1111');
  82  |     await page.goto(BASE);
  83  |     await loginAsCashier(page, 'cashier3@pos.ph', '9999')();
  84  |     await expect(page.locator('text=Incorrect Cashier PIN. Please try again.')).toBeVisible();
  85  |   });
  86  | 
  87  |   test('C-5  Cashier: empty email NOT accepted (form does not submit)', async ({ page }) => {
  88  |     await page.click('button:has-text("Cashier")');
  89  |     await page.click('button:has-text("Start Shift as Cashier")');
  90  |     // native validation blocks submission for empty required email
  91  |     await expect(page.locator('h1:has-text("Tindahan ni Aling Puring")')).toBeVisible();
  92  |   });
  93  | 
  94  |   test('C-6  Cashier: auto-login from persisted session (no login screen)', async ({ page }) => {
  95  |     await seedSession(page, 'cashier', 'cashier6@pos.ph', '1234');
  96  |     await page.goto(BASE);
  97  |     // Should land straight on the main screen, no login screen
  98  |     await expect(page.locator('h1:has-text("Tindahan ni Aling Puring")')).not.toBeVisible();
  99  |     await expect(page.locator('h1:has-text("Cashier POS")')).toBeVisible();
  100 |   });
  101 | 
  102 |   // ───────────────────────── INVENTORY LOGIN ─────────────────────────
  103 | 
  104 |   test('I-1  Inventory staff: login without PIN', async ({ page }) => {
  105 |     await page.click('button:has-text("Inventory Staff")');
  106 |     await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'inv@pos.ph');
  107 |     await page.click('button:has-text("Start Shift as Inventory Staff")');
  108 |     await expect(page.locator('h1:has-text("Inventory Portal")')).toBeVisible();
  109 |   });
  110 | 
  111 |   test('I-2  Inventory staff: invalid email NOT accepted (form does not submit)', async ({ page }) => {
  112 |     await page.click('button:has-text("Inventory Staff")');
  113 |     await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'bad-email');
  114 |     await page.click('button:has-text("Start Shift as Inventory Staff")');
  115 |     // native validation blocks submission
  116 |     await expect(page.locator('h1:has-text("Tindahan ni Aling Puring")')).toBeVisible();
  117 |   });
  118 | 
  119 |   test('I-3  Inventory staff: no PIN field rendered', async ({ page }) => {
  120 |     await page.click('button:has-text("Inventory Staff")');
  121 |     await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'inv2@pos.ph');
  122 |     const pinFields = page.locator('input[placeholder*="PIN"]');
  123 |     await expect(pinFields).toHaveCount(0);
  124 |   });
  125 | 
  126 |   // ───────────────────────── SIDEBAR BEHAVIOR ─────────────────────────
  127 | 
  128 |   test('S-1  Cashier on mobile: sidebar hidden, no menu button (unreachable)', async ({ page }) => {
  129 |     await page.click('button:has-text("Cashier")');
  130 |     await page.fill('input[placeholder="e.g. tindera@sarisari.ph"]', 'cashier@pos.ph');
  131 |     await page.fill('input[placeholder="Create 4-digit PIN"]', '1234');
  132 |     await page.fill('input[placeholder="Confirm 4-digit PIN"]', '1234');
  133 |     await page.click('button:has-text("Start Shift as Cashier")');
  134 |     await expect(page.locator('nav[role="navigation"]')).toBeHidden();
  135 |     await expect(page.locator('button[aria-label="Open menu"]')).toHaveCount(0);
  136 |   });
  137 | 
  138 |   test('S-2  Cashier on tablet: sidebar collapsible (menu button toggles)', async ({ page }) => {
  139 |     await page.setViewportSize({ width: 820, height: 1100 });
  140 |     await seedPinOnly(page, '1234');
  141 |     await page.goto(BASE);
  142 |     await loginAsCashier(page, 'cashierT@pos.ph', '1234')();
  143 |     // menu button present on tablet
  144 |     await expect(page.locator('button[aria-label="Open menu"]')).toBeVisible();
  145 |     // sidebar hidden by default
  146 |     await expect(page.locator('nav[role="navigation"]')).toBeHidden();
  147 |     // open
```