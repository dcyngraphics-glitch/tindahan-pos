// Helpers for seeding the app's IndexedDB (Dexie 'TindahanPOS') so E2E tests
// run against a deterministic dataset. The app itself never seeds products
// (hidden catalog feature), so we populate a realistic subset directly.
import { expect, type Page } from '@playwright/test';

export const BASE = 'http://localhost:5173';

export interface SeedProduct {
  id: string;
  barcode: string;
  name: string;
  price: number; // centavos
  cost: number; // centavos
  stock: number;
  category?: string;
}

export interface SeedTransaction {
  id: string;
  items: Array<{ productId: string; barcode: string; name: string; price: number; quantity: number }>;
  total: number; // centavos
  cashTendered: number;
  change: number;
  voided?: boolean;
  createdAt: string; // local midnight epoch ms as string
}

function localMidnight(daysFromNow: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

export function seedDB(page: Page, products: SeedProduct[], txs: SeedTransaction[]) {
  return page.evaluate(
    ({ products, txs }) =>
      new Promise<void>((resolve, reject) => {
        // Open the app's IndexedDB (same origin, version 1 = app's schema) and
        // clear both tables so each test starts deterministically. Deleting
        // the database while the app holds an open connection throws
        // SecurityError in some contexts, so we truncate only.
        const openReq = indexedDB.open('TindahanPOS-zo7vbabeq', 10);
        openReq.onsuccess = () => {
          const db = openReq.result;
          try {
            const clearT = db.transaction('transactions', 'readwrite');
            clearT.objectStore('transactions').clear();
            clearT.oncomplete = () => {
              const addT = db.transaction('transactions', 'readwrite');
              txs.forEach((t: any) => addT.objectStore('transactions').add(t));
              addT.oncomplete = () => {
                const clearP = db.transaction('products', 'readwrite');
                clearP.objectStore('products').clear();
                clearP.oncomplete = () => {
                  const addP = db.transaction('products', 'readwrite');
                  products.forEach((p: any) => addP.objectStore('products').add(p));
                  addP.oncomplete = () => resolve();
                  addP.onerror = () => reject(addP.error);
                };
                clearP.onerror = () => reject(clearP.error);
              };
              addT.onerror = () => reject(addT.error);
            };
          } catch (e: any) {
            reject(e);
          }
        };
        openReq.onerror = () => reject(openReq.error);
      }),
    { products, txs }
  );
}

export function loginAsCashier(page: Page) {
  return page.evaluate(() => {
    localStorage.setItem(
      'tindahan_auth',
      JSON.stringify({ isAuthenticated: true, role: 'cashier', email: 'c@pos.ph' })
    );
    localStorage.setItem('tindahan_app_mode', 'history');
  });
}

export function loginAsDashboard(page: Page) {
  return page.evaluate(() => {
    localStorage.setItem(
      'tindahan_auth',
      JSON.stringify({ isAuthenticated: true, role: 'cashier', email: 'c@pos.ph' })
    );
    localStorage.setItem('tindahan_app_mode', 'dashboard');
  });
}

export async function loadApp(page: Page, mode: 'history' | 'dashboard') {
  await page.goto(BASE + '/');
  await loginAsCashier(page);
  await page.evaluate((m) => { localStorage.setItem('tindahan_app_mode', m); }, mode);
  await page.reload();
  await page.waitForSelector('h1:has-text("Transaction History")', { timeout: 10000 }).catch(() =>
    page.waitForSelector('h1:has-text("Dashboard & Analytics")', { timeout: 10000 })
  );
}

export const PRODUCTS: SeedProduct[] = [
  { id: 'p-1', barcode: '4800016045321', name: 'Lucky Me Pancit Canton Original', price: 1500, cost: 1200, stock: 100, category: 'Instant Noodles' },
  { id: 'p-2', barcode: '4800040600123', name: 'Milo Sachet 24g', price: 800, cost: 650, stock: 150, category: 'Beverages' },
  { id: 'p-3', barcode: '4800016012352', name: 'Lucky Me Beef Noodle Soup', price: 1500, cost: 1200, stock: 50, category: 'Instant Noodles' },
  { id: 'p-4', barcode: '4800016012376', name: 'Lucky Me Pork Barbecue', price: 1500, cost: 1200, stock: 50, category: 'Instant Noodles' },
  { id: 'p-5', barcode: '4800092001234', name: 'SkyFlakes Crackers 33g', price: 800, cost: 600, stock: 40, category: 'Snacks' },
  { id: 'p-6', barcode: '4800105001234', name: 'Globe Load ₱10', price: 1000, cost: 950, stock: 200, category: 'E-Load' },
  { id: 'p-7', barcode: '4800011012345', name: 'Century Tuna Flakes in Oil 155g', price: 3500, cost: 2900, stock: 60, category: 'Canned Goods' },
  { id: 'p-8', barcode: '4800144022401', name: 'Nissin Yakisoba', price: 1500, cost: 1200, stock: 60, category: 'Instant Noodles' },
  { id: 'p-9', barcode: '4800112001241', name: 'Delimondo Corned Beef 260g', price: 20000, cost: 17000, stock: 10, category: 'Canned Goods' },
  { id: 'p-10', barcode: '4800118001241', name: 'Biogesic Syrup 60ml', price: 7500, cost: 6200, stock: 2, category: 'Medicine' },
];

// t1,t2 = today; t3 = yesterday; t4 = 7 days ago; t5 = 35 days ago (outside 30d);
// t6 = today but voided.
export const TRANSACTIONS: SeedTransaction[] = [
  {
    id: 'tx-t1', items: [
      { productId: 'p-1', barcode: '4800016045321', name: 'Lucky Me Pancit Canton Original', price: 1500, quantity: 2 },
      { productId: 'p-2', barcode: '4800040600123', name: 'Milo Sachet 24g', price: 800, quantity: 1 },
    ],
    total: 3800, cashTendered: 5000, change: 1200,
    createdAt: localMidnight(0).getTime().toString(),
  },
  {
    id: 'tx-t2', items: [
      { productId: 'p-3', barcode: '4800016012352', name: 'Lucky Me Beef Noodle Soup', price: 1500, quantity: 3 },
    ],
    total: 4500, cashTendered: 5000, change: 500,
    createdAt: localMidnight(0).getTime().toString(),
  },
  {
    id: 'tx-t3', items: [
      { productId: 'p-7', barcode: '4800011012345', name: 'Century Tuna Flakes in Oil 155g', price: 3500, quantity: 2 },
    ],
    total: 7000, cashTendered: 10000, change: 3000,
    createdAt: localMidnight(-1).getTime().toString(),
  },
  {
    id: 'tx-t4', items: [
      { productId: 'p-4', barcode: '4800016012376', name: 'Lucky Me Pork Barbecue', price: 1500, quantity: 4 },
    ],
    total: 6000, cashTendered: 10000, change: 4000,
    createdAt: localMidnight(-7).getTime().toString(),
  },
  {
    id: 'tx-t5', items: [
      { productId: 'p-5', barcode: '4800092001234', name: 'SkyFlakes Crackers 33g', price: 800, quantity: 2 },
    ],
    total: 1600, cashTendered: 2000, change: 400,
    createdAt: localMidnight(-35).getTime().toString(),
  },
  {
    id: 'tx-t6', items: [
      { productId: 'p-6', barcode: '4800105001234', name: 'Globe Load ₱10', price: 1000, quantity: 1 },
    ],
    total: 1500, cashTendered: 1500, change: 0,
    voided: true,
    createdAt: localMidnight(0).getTime().toString(),
  },
];
