import { chromium } from 'playwright';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PRODUCTS = [
  { id:'p-1', barcode:'4800016045321', name:'Lucky Me Pancit Canton Original', price:1500, cost:1200, stock:100, category:'Instant Noodles' },
  { id:'p-2', barcode:'4800040600123', name:'Milo Sachet 24g', price:800, cost:650, stock:150, category:'Beverages' },
  { id:'p-3', barcode:'4800016012352', name:'Lucky Me Beef Noodle Soup', price:1500, cost:1200, stock:50, category:'Instant Noodles' },
  { id:'p-4', barcode:'4800016012376', name:'Lucky Me Pork Barbecue', price:1500, cost:1200, stock:50, category:'Instant Noodles' },
  { id:'p-5', barcode:'4800092001234', name:'SkyFlakes Crackers 33g', price:800, cost:600, stock:40, category:'Snacks' },
  { id:'p-6', barcode:'4800105001234', name:'Globe Load PHP10', price:1000, cost:950, stock:200, category:'E-Load' },
  { id:'p-7', barcode:'4800011012345', name:'Century Tuna Flakes in Oil 155g', price:3500, cost:2900, stock:60, category:'Canned Goods' },
  { id:'p-8', barcode:'4800144022401', name:'Nissin Yakisoba', price:1500, cost:1200, stock:60, category:'Instant Noodles' },
  { id:'p-9', barcode:'4800112001241', name:'Delimondo Corned Beef 260g', price:20000, cost:17000, stock:10, category:'Canned Goods' },
  { id:'p-10', barcode:'4800118001241', name:'Biogesic Syrup 60ml', price:7500, cost:6200, stock:2, category:'Medicine' },
];
const txs = [
  { id:'tx-t1', items:[{productId:'p-1',barcode:'4800016045321',name:'Lucky Me Pancit Canton Original',price:1500,quantity:2},{productId:'p-2',barcode:'4800040600123',name:'Milo Sachet 24g',price:800,quantity:1}], total:3800, cashTendered:5000, change:1200, createdAt:new Date().setHours(0,0,0,0), voided:false },
  { id:'tx-t2', items:[{productId:'p-3',barcode:'4800016012352',name:'Lucky Me Beef Noodle Soup',price:1500,quantity:3}], total:4500, cashTendered:5000, change:500, createdAt:new Date().setHours(0,0,0,0), voided:false },
  { id:'tx-t3', items:[{productId:'p-7',barcode:'4800011012345',name:'Century Tuna Flakes in Oil 155g',price:3500,quantity:2}], total:7000, cashTendered:10000, change:3000, createdAt:new Date(Date.now()-86400000).setHours(0,0,0,0), voided:false },
  { id:'tx-t4', items:[{productId:'p-4',barcode:'4800016012376',name:'Lucky Me Pork Barbecue',price:1500,quantity:4}], total:6000, cashTendered:10000, change:4000, createdAt:new Date(Date.now()-7*86400000).setHours(0,0,0,0), voided:false },
  { id:'tx-t5', items:[{productId:'p-5',barcode:'4800092001234',name:'SkyFlakes Crackers 33g',price:800,quantity:2}], total:1600, cashTendered:2000, change:400, createdAt:new Date(Date.now()-35*86400000).setHours(0,0,0,0), voided:false },
  { id:'tx-t6', items:[{productId:'p-6',barcode:'4800105001234',name:'Globe Load PHP10',price:1000,quantity:1}], total:1500, cashTendered:1500, change:0, createdAt:new Date().setHours(0,0,0,0), voided:true },
];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const msgs = [];
  page.on('console', m => msgs.push(m.type() + ': ' + m.text()));
  page.on('pageerror', e => msgs.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:5173');
  await sleep(1500);
  const r = await page.evaluate(({ products, txs }) => new Promise((resolve, reject) => {
    const openReq = indexedDB.open('TindahanPOS', 1);
    openReq.onupgradeneeded = () => {
      const db = openReq.result;
      if (!db.objectStoreNames.contains('transactions')) db.createObjectStore('transactions');
      if (!db.objectStoreNames.contains('products')) db.createObjectStore('products');
    };
    openReq.onsuccess = () => {
      const db = openReq.result;
      try {
        const ct = db.transaction('transactions','readwrite');
        ct.objectStore('transactions').clear();
        ct.oncomplete = () => {
          const at = db.transaction('transactions','readwrite');
          txs.forEach(t => at.objectStore('transactions').add(t));
          at.oncomplete = () => {
            const cp = db.transaction('products','readwrite');
            cp.objectStore('products').clear();
            cp.oncomplete = () => {
              const ap = db.transaction('products','readwrite');
              products.forEach(p => ap.objectStore('products').add(p));
              ap.oncomplete = () => resolve('ok');
              ap.onerror = () => reject(ap.error);
            };
            cp.onerror = () => reject(cp.error);
          };
          at.onerror = () => reject(at.error);
        };
      } catch(e) { reject(e); }
    };
    openReq.onerror = () => reject(openReq.error);
  }), { products: PRODUCTS, txs });
  console.log('SEED:' + r);
  await page.evaluate(() => {
    localStorage.setItem('tindahan_auth', JSON.stringify({ isAuthenticated:true, role:'cashier', email:'c@pos.ph' }));
    localStorage.setItem('tindahan_app_mode', 'history');
  });
  await page.reload();
  await page.waitForSelector('h1:has-text("Transaction History")', { timeout: 10000 });
  await sleep(800);
  const counts = await page.evaluate(() => [...document.querySelectorAll('button')].filter(b => /All|Completed|Voided/.test(b.textContent)).map(b => b.textContent.trim()));
  console.log('FILTERS:' + JSON.stringify(counts));
  const cards = await page.locator('div[class*="rounded-2xl"]').count();
  console.log('CARDS:' + cards);
  const empty = await page.locator('text=No transactions found.').isVisible().catch(() => false);
  console.log('EMPTY:' + empty);
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
