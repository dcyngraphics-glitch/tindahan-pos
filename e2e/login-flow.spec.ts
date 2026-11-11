import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

// The app's own login screen only collects the ROLE. Dexie Cloud then drives the
// email + one-time-code conversation through db.cloud.userInteraction, which
// <UserInteractionPrompt /> renders — so `#interaction-email` / `#interaction-otp`
// are that component's inputs, not the app's.
//
// A sign-in cannot be completed from a test: the code is emailed. `.test` is a
// reserved TLD (RFC 2606), so these addresses send nothing anywhere.
const E2E_EMAIL = 'e2e@tindahan-pos.test';

test.describe('Login Flow Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('TC-1: role selection + Sign In reaches the emailed OTP step', async ({ page }) => {
    await expect(page.locator('h1:has-text("Softies Store")')).toBeVisible();

    await page.click('button:has-text("Cashier")');
    await page.click('button:has-text("Sign In")');

    await expect(page.locator('#interaction-email')).toBeVisible();
    await page.fill('#interaction-email', E2E_EMAIL);
    await page.click('form button[type="submit"]');

    await expect(page.locator('#interaction-otp')).toBeVisible();
    await expect(
      page.locator(`text=A One-Time password has been sent to ${E2E_EMAIL}`)
    ).toBeVisible();
  });

  test('TC-2: the selected role is persisted before the OTP is verified', async ({ page }) => {
    await page.click('button:has-text("Inventory Staff")');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('#interaction-email')).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('tindahan_auth'));
    expect(JSON.parse(stored ?? '{}').role).toBe('inventory');
  });

  test('TC-3: cancelling the prompt returns to the login screen', async ({ page }) => {
    await page.click('button:has-text("Cashier")');
    await page.click('button:has-text("Sign In")');
    await expect(page.locator('#interaction-email')).toBeVisible();

    await page.click('button:has-text("Cancel")');

    await expect(page.locator('h1:has-text("Softies Store")')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('TC-4: a malformed email is not submitted', async ({ page }) => {
    await page.click('button:has-text("Cashier")');
    await page.click('button:has-text("Sign In")');
    await page.fill('#interaction-email', 'not-an-email');
    await page.click('form button[type="submit"]');

    // The input is type="email", so native validation blocks the submit and the
    // email prompt is still the one on screen.
    await expect(page.locator('#interaction-email')).toBeVisible();
    await expect(page.locator('#interaction-otp')).toHaveCount(0);
  });

  test('TC-5: the e2e bypass renders the main app from the seeded role', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'tindahan_auth',
        JSON.stringify({ isAuthenticated: true, role: 'cashier' })
      );
    });
    await page.goto(BASE + '/?e2e=1');

    await expect(page.locator('h1:has-text("Cashier POS")')).toBeVisible();
  });
});
