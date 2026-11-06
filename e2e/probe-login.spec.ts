import { test, expect } from '@playwright/test';
test('probe pin placeholder', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('http://localhost:5179/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('button:has-text("Cashier")');
  const phs = await page.evaluate(() => Array.from(document.querySelectorAll('input')).map(i => i.placeholder));
  console.log('placeholders:', JSON.stringify(phs));
  // try filling with Enter 4-digit PIN selector (as original C-1 does)
  try {
    await page.fill('input[placeholder="Enter 4-digit PIN"]', '1234');
    console.log('fill Enter 4-digit PIN -> OK');
  } catch (e) {
    console.log('fill Enter 4-digit PIN -> ERR:', e.message.split('\n')[0]);
  }
  // try filling with Create 4-digit PIN selector
  try {
    await page.fill('input[placeholder="Create 4-digit PIN"]', '1234');
    console.log('fill Create 4-digit PIN -> OK');
  } catch (e) {
    console.log('fill Create 4-digit PIN -> ERR:', e.message.split('\n')[0]);
  }
});
