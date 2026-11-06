import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  await page.goto('http://localhost:5173');
  await sleep(1500);
  // mimic seedDB
  const r = await page.evaluate(({ products, txs }) => {
    return new Promise((resolve, reject) => {
      const openReq = indexedDB.open('TindahanPOS', 1);
      openReq.onupgradeneeded = () => {
        const db = openReq.result;
        if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions');
        if (!db.objectStoreNames.contains('products')) db.createObjectStore('products');
      };
      openReq.onsuccess = () => {
        const db = openReq.result;
        const clearT = db.transaction('transactions', 'readwrite');
        clearT.objectStore('transactions').clear();
        clearT.oncomplete = () => {
          const addT = db.transaction('transactions', 'readwrite');
          txs.forEach(t => addT.objectStore('transactions').add(t));
          addT.oncomplete = () => {
            const clearP = db.transaction('products', 'readwrite');
            clearP.objectStore('products').clear();
            clearP.oncomplete = () => {
              const addP = db.transaction('products', 'readwrite');
              products.forEach(p => addP.objectStore('products').add(p));
              addP.oncomplete = () => resolve('seeded OK');
              addP.onerror = () => reject(addP.error);
            };
            clearP.onerror = () => reject(clearP.error);
          };
          addT.onerror = () => reject(addT.error);
        };
      };
      openReq.onerror = () => reject(openReq.error);
    });
  }, { products: [], txs: [] });
  console.log('SEED RESULT:', r);
} catch (e) {
  console.log('EVAL ERROR:', e.message);
}
await browser.close();
