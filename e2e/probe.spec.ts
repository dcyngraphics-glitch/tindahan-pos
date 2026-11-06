import { test, expect } from '@playwright/test';

test('probe idb', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  const info = await page.evaluate(() => {
    const out: any = {
      indexedDB: typeof indexedDB,
      hasDeleteDB: typeof indexedDB.deleteDatabase,
      hasDatabses: typeof indexedDB.databases,
      origin: location.origin,
      protocol: location.protocol,
    };
    if (typeof indexedDB !== 'undefined') {
      try {
        const r = indexedDB.open('Tprobe', 1);
        out.openOk = !!r.result;
      } catch (e: any) {
        out.openErr = e.message;
      }
      try {
        indexedDB.deleteDatabase('Tprobe2');
        out.deleteOk = true;
      } catch (e: any) {
        out.deleteErr = e.message;
      }
    }
    return out;
  });
  console.log('IDB PROBE:', JSON.stringify(info));
  await expect(info.indexedDB).toBe('object');
});
