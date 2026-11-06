import { test, expect, type Page } from '@playwright/test';

test('probe idb access', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForSelector('h1');
  const r = await page.evaluate(() => {
    return indexedDB !== undefined ? 'indexedDB OK' : 'indexedDB MISSING';
  });
  console.log('PROBE RESULT:', r);
  expect(r).toBe('indexedDB OK');
});
