import { chromium } from 'playwright';

const BASE = 'http://localhost:5175/';
const results = [];

async function login(page, role, email, pin) {
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(500);
  // Select role
  await page.click(`button:has-text("${role}")`);
  await page.fill('input[placeholder*="tindera"]', email);
  if (role === 'cashier') {
    await page.fill('input[placeholder*="Create 4-digit"]', pin || '1234');
    await page.fill('input[placeholder*="Confirm"]', pin || '1234');
  }
  await page.click('button:has-text("Start Shift")');
  await page.waitForTimeout(1500);
}

async function checkScreen(label, check) {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(String(err)));
  await check(page);
  const bodyText = await page.textContent('body');
  results.push({ label, errorCount: errors.length, errors: errors.slice(0, 2), bodySnippet: bodyText.slice(0, 120).replace(/\n/g, ' ') });
  await browser.close();
}

await checkScreen('login-screen', async page => { await login(page, 'Cashier', 'cashier@tindahan.pos', '1234'); });
await checkScreen('cashier-screen', async page => { await login(page, 'Cashier', 'cashier@tindahan.pos', '1234'); await page.waitForTimeout(2000); });
await checkScreen('inventory-screen', async page => { await login(page, 'Inventory Staff', 'inventory@tindahan.pos', '1234'); await page.waitForTimeout(2000); });
await checkScreen('customer-display', async page => { await page.goto('http://localhost:5175/#customer', { waitUntil: 'networkidle', timeout: 15000 }); await page.waitForTimeout(1000); });

console.log(JSON.stringify(results, null, 2));
