import { chromium } from 'playwright';

const BASE = 'http://localhost:5175/';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(String(err)));

// Go to login
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
await page.waitForTimeout(500);

// Click Cashier role
await page.click('button:has-text("Cashier")', { timeout: 5000 });
await page.waitForTimeout(500);

// Check PIN field visibility
const pinVisible = await page.locator('input[placeholder*="Create 4-digit"]').isVisible();
const confirmVisible = await page.locator('input[placeholder*="Confirm"]').isVisible();
const submitBtn = page.locator('button:has-text("Start Shift")');
const submitText = await submitBtn.textContent();
const submitVisible = await submitBtn.isVisible();

console.log("Pin field visible:", pinVisible);
console.log("Confirm field visible:", confirmVisible);
console.log("Submit button visible:", submitVisible);
console.log("Submit button text:", submitText);

// Fill email
await page.fill('input[placeholder*="tindera"]', 'cashier@tindahan.pos');
await page.waitForTimeout(300);

// Fill PIN
await page.fill('input[placeholder*="Create 4-digit"]', '1234');
await page.waitForTimeout(300);

// Fill confirm
await page.fill('input[placeholder*="Confirm"]', '1234');
await page.waitForTimeout(300);

// Check error state
const errorVisible = await page.locator('p.text-red-500').isVisible().catch(() => false);
console.log("Error visible:", errorVisible);

// Click submit
await submitBtn.click({ timeout: 5000 });
await page.waitForTimeout(1500);

// Check final state
const bodyText = await page.textContent('body');
const h1s = await page.locator('h1').allTextContents();
const isLogin = bodyText.includes('Select Your Role');
console.log("Still on login screen:", isLogin);
console.log("H1s:", h1s);
console.log("Console errors:", errors);

await browser.close();
