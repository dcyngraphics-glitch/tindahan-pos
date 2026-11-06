import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
let err = null;
try {
  await page.goto('http://localhost:5173');
  const info = await page.evaluate(() => ({
    indexedDB: typeof indexedDB,
    indexedDBDef: !!indexedDB,
    secureContext: typeof window !== 'undefined' && (window.isSecureContext ?? false),
    origin: typeof location !== 'undefined' ? location.origin : null,
  }));
  console.log('PAGE INFO:', JSON.stringify(info, null, 2));
} catch (e) {
  err = e;
  console.log('EVAL ERROR:', e.message);
}
await browser.close();
console.log('DONE', err ? err.stack : 'no-error');
