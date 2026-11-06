import { chromium } from 'playwright';

const BASE = 'http://localhost:5175/';

async function run() {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
  const results = [];

  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(1500);

  // Login as cashier (tablet/PC view)
  await page.click('button:has-text("Cashier Staff")');
  await page.fill('input[placeholder*="tindera"]', 'cashier@tindahan.pos');
  await page.click('button:has-text("Start Shift as Cashier")');
  await page.waitForTimeout(2000);

  // Check initial state
  const headerText = await page.locator('header.bg-white').textContent().catch(() => 'n/a');
  results.push(["Header text", (await page.locator('h1').textContent().catch(() => ''))?.trim() || 'n/a']);

  // Check total items bar (sticky footer)
  const totalBar = page.locator('div:has-text("Total Items")');
  const totalBarVisible = await totalBar.isVisible().catch(() => false);
  const totalBarBottom = await page.locator('div:has-text("Total Items")').boundingBox().then(bb => bb ? bb.y : -1);
  results.push(["Total Items bar visible", totalBarVisible]);

  // Scroll down
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(500);
  const totalBarAfterScroll = await page.locator('div:has-text("Total Items")').isVisible().catch(() => false);
  const totalBarBottomAfter = await page.locator('div:has-text("Total Items")').boundingBox().then(bb => bb ? bb.y : -1);
  results.push(["Total Items bar visible after scroll", totalBarAfterScroll]);
  results.push(["Total Items bar Y after scroll", totalBarBottomAfter]);

  // Check item list is scrollable
  const itemList = page.locator('div.flex-1.overflow-y-auto');
  const itemListScrollable = await itemList.isVisible().catch(() => false);
  const itemCount = await page.locator('div.bg-slate-50').count().catch(() => 0);
  results.push(["Item list scrollable", itemListScrollable]);
  results.push(["Item count", itemCount]);

  // Check footer is still visible at bottom after scroll
  const footerY = await page.locator('div:has-text("Total Items")').boundingBox().then(bb => bb ? bb.y : -1);
  results.push(["Footer Y after scroll", footerY]);

  for (const [label, value] of results) {
    console.log(`${typeof value === 'boolean' ? (value ? 'VISIBLE' : 'HIDDEN') : value}  ${label}`);
  }

  await browser.close();
}

run().catch(err => { console.error(err); process.exit(1); });
