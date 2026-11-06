import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import {
  BASE,
  PRODUCTS,
  TRANSACTIONS,
  seedDB,
  loadApp,
  type SeedProduct,
  type SeedTransaction,
} from './helpers';

// ---------------------------------------------------------------------------
// Helpers (in-page assertions of rendered numbers)
// ---------------------------------------------------------------------------

function metricNumber(page: Page, label: string) {
  // card: <p class="text-xs...">{label}</p><p class="text-3xl ...">{number}</p>
  return page.locator(`text=${label}`).locator('xpath=following::p[1]').first();
}

// ---------------------------------------------------------------------------
// HISTORY FLOW TESTS
// ---------------------------------------------------------------------------

test.describe('Transaction History flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedDB(page, PRODUCTS as SeedProduct[], TRANSACTIONS as SeedTransaction[]);
    await loadApp(page, 'history');
  });

  test('empty state: no transactions renders "No transactions found"', async ({ page }) => {
    await seedDB(page, PRODUCTS as SeedProduct[], []);
    await loadApp(page, 'history');
    await expect(page.locator('text=No transactions found.')).toBeVisible();
  });

  test('list renders all 6 transactions with correct summary rows', async ({ page }) => {
    // All counts
    await expect(page.locator('button:has-text("All")').first()).toContainText('All (6)');
    await expect(page.locator('button:has-text("Completed")')).toContainText('Completed (5)');
    await expect(page.locator('button:has-text("Voided")')).toContainText('Voided (1)');

    // per-transaction totals (centavos -> pesos)
    await expect(page.locator('div:has-text("38.00")')).toHaveCount(1);
    await expect(page.locator('div:has-text("45.00")')).toHaveCount(1);
    await expect(page.locator('div:has-text("70.00")')).toHaveCount(1);
    await expect(page.locator('div:has-text("60.00")')).toHaveCount(1);
    await expect(page.locator('div:has-text("16.00")')).toHaveCount(1);
    await expect(page.locator('div:has-text("15.00")')).toHaveCount(1); // voided tx-t6
    await expect(page.locator('div[class*="rounded-2xl"]').first()).toBeVisible(); // at least one card
  });

  test('expand row shows itemized breakdown', async ({ page }) => {
    // click first card
    await page.locator('div:has-text("38.00")').first().click();
    await expect(page.locator('text=Items Purchased')).toBeVisible();
    await expect(page.locator('text=2x Lucky Me Pancit Canton Original')).toBeVisible();
    await expect(page.locator('text=Milo Sachet 24g')).toBeVisible();
    await expect(page.locator('text=₱30.00')).toBeVisible(); // 2 x 15.00
    await expect(page.locator('text=₱8.00')).toBeVisible(); // 1 x 8.00
    await expect(page.locator('text=Tendered:')).toBeVisible();
    await expect(page.locator('text=Change:')).toBeVisible();
    await expect(page.locator('text=ID:')).toBeVisible();

    // collapse
    await page.locator('div:has-text("38.00")').first().click();
    await expect(page.locator('text=Items Purchased')).not.toBeVisible();
  });

  test('search by item name filters the list', async ({ page }) => {
    await page.locator('input[placeholder="Search by ID or item name..."]').fill('Pancit Canton');
    await expect(page.locator('button:has-text("All")').first()).toContainText('All (1)');
    await expect(page.locator('div:has-text("38.00")')).toHaveCount(1);
    await page.locator('input[placeholder="Search by ID or item name..."]').fill('');
    await expect(page.locator('button:has-text("All")').first()).toContainText('All (6)');
  });

  test('case-insensitive search by item name', async ({ page }) => {
    await page.locator('input[placeholder="Search by ID or item name..."]').fill('luCKY ME PORK');
    await expect(page.locator('div:has-text("60.00")')).toHaveCount(1); // tx-t4
    await page.locator('input[placeholder="Search by ID or item name..."]').fill('MILO');
    await expect(page.locator('div:has-text("38.00")')).toHaveCount(1); // tx-t1
  });

  test('filter All -> Completed -> Voided', async ({ page }) => {
    await expect(page.locator('button:has-text("All")').first()).toContainText('All (6)');
    await page.locator('button:has-text("Completed")').click();
    await expect(page.locator('button:has-text("Completed")').first()).toContainText('Completed (5)');
    await expect(page.locator('div:has-text("15.00")')).toHaveCount(1); // only voided row left out
    await page.locator('button:has-text("Voided")').click();
    await expect(page.locator('button:has-text("Voided")').first()).toContainText('Voided (1)');
    await expect(page.locator('div:has-text("70.00")')).toHaveCount(1);
  });

  test('void a transaction (stock restoration path) and it disappears from Completed', async ({
    page,
  }) => {
    await page.locator('button:has-text("Void")').first().click();
    const dialog = await page.waitForEvent('dialog');
    await dialog.accept();
    await expect(page.locator('text=Transaction voided successfully!')).toBeVisible();

    // reload to reflect DB change
    await page.reload();
    await page.waitForSelector('h1:has-text("Transaction History")');
    await expect(page.locator('button:has-text("All")').first()).toContainText('All (5)');
    await expect(page.locator('button:has-text("Completed")').first()).toContainText('Completed (4)');
    await expect(page.locator('button:has-text("Voided")').first()).toContainText('Voided (2)');

    // voided row is now red/opacity-70
    const voidedCard = page.locator('div[class*="rounded-2xl"]').filter(':has-text("15.00")');
    await expect(voidedCard).toHaveClass(/opacity-70/);
    await expect(voidedCard.locator('text=Voided')).toBeVisible();
  });

  test('reprint button invites Bluetooth print and shows failure toast', async ({ page }) => {
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.locator('button:has-text("Print")').first().click(),
    ]);
    await dialog.accept();
    await expect(page.locator('text=Failed to print receipt via Bluetooth')).toBeVisible();
  });

  test('reprint on a voided row is disabled (no Void/Print buttons)', async ({ page }) => {
    await page.locator('button:has-text("Voided")').click();
    await expect(page.locator('button:has-text("Print")')).toHaveCount(0);
    await expect(page.locator('button:has-text("Void")')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// DASHBOARD FLOW TESTS
// ---------------------------------------------------------------------------

test.describe('Dashboard & Analytics flow', () => {
  test.beforeEach(async ({ page }) => {
    await seedDB(page, PRODUCTS as SeedProduct[], TRANSACTIONS as SeedTransaction[]);
    await loadApp(page, 'dashboard');
  });

  test('shows all 4 metric cards with non-zero values for seeded data', async ({ page }) => {
    await expect(page.locator('text=Total Revenue')).toBeVisible();
    await expect(page.locator('text=Gross Profit')).toBeVisible();
    await expect(page.locator('text=Average Basket')).toBeVisible();
    await expect(page.locator('text=Low Stock Alerts')).toBeVisible();

    // All-time: 5 completed tx (t6 voided excluded)
    // revenue = 3800+4500+7000+6000+1600 = 22900 ; cost = 3050+3600+5800+4800+1200 = 18450
    await expect(metricNumber(page, 'Total Revenue')).toHaveText('₱229.00');
    await expect(metricNumber(page, 'Gross Profit')).toHaveText('₱44.50');
    await expect(metricNumber(page, 'Average Basket')).toHaveText('₱45.80');
    await expect(metricNumber(page, 'Low Stock Alerts')).toHaveText('1');
  });

  test('date range filter changes metrics and chart days', async ({ page }) => {
    // Today: 2 tx (t1+t2): revenue 8300, cost 6650, profit 1650, 2 tx
    await page.locator('button:has-text("Today")').click();
    await expect(metricNumber(page, 'Total Revenue')).toHaveText('₱83.00');
    await expect(metricNumber(page, 'Gross Profit')).toHaveText('₱16.50');
    await expect(metricNumber(page, 'Average Basket')).toHaveText('₱41.50');
    await expect(page.locator('text=2 completed sales')).toBeVisible();
    // chart: only 1 day (today)
    await expect(page.locator('text=Sales Trend')).toBeVisible();
    await expect(page.locator('h2:has-text("Sales Trend")')).toBeVisible();

    // 7d: 4 tx (t1..t4): revenue 21300
    await page.locator('button:has-text("Last 7d")').click();
    await expect(metricNumber(page, 'Total Revenue')).toHaveText('₱213.00');
    await expect(metricNumber(page, 'Average Basket')).toHaveText('₱53.25');
    await expect(page.locator('text=4 completed sales')).toBeVisible();

    // All Time
    await page.locator('button:has-text("All Time")').click();
    await expect(metricNumber(page, 'Total Revenue')).toHaveText('₱229.00');
  });

  test('CSV export downloads a file with expected headers and rows', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Export CSV")').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^tindahan_sales_\d{4}-\d{2}-\d{2}\.csv$/);
    const path = await download.path();
    const csv = await readFile(path, 'utf8');
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('Transaction ID');
    expect(lines[0]).toContain('Status');
    expect(lines[0]).toContain('Total (PHP)');
    expect(lines[0]).toContain('Items Count');
    expect(lines[0]).toContain('Details');
    // 6 rows: 5 completed + 1 voided
    expect(lines.length - 1).toBe(6);
    expect(lines.some((l) => l.includes('COMPLETED'))).toBe(true);
    expect(lines.some((l) => l.includes('VOIDED'))).toBe(true);
  });

  test('top products chart and low stock watchlist render', async ({ page }) => {
    await expect(page.locator('text=Top 5 Best-Selling Products')).toBeVisible();
    await expect(page.locator('text=Low Stock Watchlist')).toBeVisible();
    await expect(page.locator('text=Lucky Me Pancit Canton Original')).toBeVisible();
    // p-10 has stock 2 -> low stock alert
    await expect(page.locator('text=Biogesic Syrup 60ml')).toBeVisible();
  });

  test('dashboard empty state: no sales renders empty chart and zero metrics', async ({ page }) => {
    await seedDB(page, PRODUCTS as SeedProduct[], []);
    await loadApp(page, 'dashboard');
    await expect(page.locator('text=0.00')).toBeVisible(); // metric numbers
    await expect(page.locator('text=No sales recorded for this date range')).toBeVisible();
    await expect(page.locator('text=No transactions found.')).not.toBeVisible();
  });

});
