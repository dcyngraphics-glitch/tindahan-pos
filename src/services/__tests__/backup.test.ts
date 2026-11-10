import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { exportBackup, restoreBackup } from '../backup';
import { createTransaction } from '../transactions';

const ALL_TABLES = () =>
  Promise.all([
    db.products.clear(),
    db.transactions.clear(),
    db.customers.clear(),
    db.utang.clear(),
    db.utang_payments.clear(),
  ]);

beforeEach(ALL_TABLES);

async function seed() {
  await db.products.add({
    id: 'p1',
    barcode: 'b1',
    name: 'Pancit Canton',
    price: 1500,
    cost: 1200,
    stock: 10,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });
  await db.customers.add({
    id: 'c1',
    name: 'Aling Nena',
    phone: '0917',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });
  await db.utang.add({
    id: 'u1',
    customerId: 'c1',
    transactionId: 't1',
    items: [{ productId: 'p1', barcode: 'b1', name: 'Pancit Canton', price: 1500, quantity: 2 }],
    total: 3000,
    createdBy: 'test@example.com',
    createdAt: new Date('2026-01-02T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  });
  await db.utang_payments.add({
    id: 'pay1',
    utangId: 'u1',
    amount: 1000,
    createdBy: 'test@example.com',
    createdAt: new Date('2026-01-03T00:00:00Z'),
  });
  await db.transactions.add({
    id: 't1',
    items: [{ productId: 'p1', barcode: 'b1', name: 'Pancit Canton', price: 1500, quantity: 2 }],
    total: 3000,
    cashTendered: 0,
    change: 0,
    paymentType: 'utang',
    createdAt: new Date('2026-01-02T00:00:00Z'),
  });
}

describe('backup', () => {
  it('round-trips every table, dates included', async () => {
    await seed();
    // JSON round trip is what actually happens when a file is saved and re-read.
    const file = JSON.parse(JSON.stringify(await exportBackup()));

    await ALL_TABLES();
    expect(await db.products.count()).toBe(0);

    const counts = await restoreBackup(file);

    expect(counts).toEqual({
      products: 1,
      transactions: 1,
      customers: 1,
      utang: 1,
      utang_payments: 1,
    });

    const product = await db.products.get('p1');
    expect(product?.name).toBe('Pancit Canton');
    expect(product?.createdAt).toBeInstanceOf(Date);
    expect(product?.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');

    const payment = await db.utang_payments.get('pay1');
    expect(payment?.createdAt).toBeInstanceOf(Date);

    const tx = await db.transactions.get('t1');
    expect(tx?.paymentType).toBe('utang');
  });

  it('rejects a file that is not a Tindahan POS backup', async () => {
    await expect(restoreBackup({ hello: 'world' })).rejects.toThrow(/not a Tindahan POS backup/i);
    await expect(restoreBackup(null)).rejects.toThrow(/not a Tindahan POS backup/i);
  });

  it('rejects a backup from a different version', async () => {
    await expect(
      restoreBackup({ format: 'tindahan-pos-backup', version: 99 })
    ).rejects.toThrow(/different version/i);
  });

  it('rejects a backup with a missing table', async () => {
    await expect(
      restoreBackup({ format: 'tindahan-pos-backup', version: 1 })
    ).rejects.toThrow(/missing its products list/i);
  });

  it('leaves the store untouched when the restore fails', async () => {
    await seed();
    const before = await db.products.count();

    await expect(restoreBackup({ format: 'nope' })).rejects.toThrow();

    expect(await db.products.count()).toBe(before);
  });

  it('refuses a credit sale with no customer', async () => {
    await db.products.add({
      id: 'p1',
      barcode: 'b1',
      name: 'Item',
      price: 1000,
      cost: 500,
      stock: 5,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      createTransaction(
        [{ productId: 'p1', barcode: 'b1', name: 'Item', price: 1000, quantity: 1 }],
        0,
        null,
        { paymentType: 'utang', utang: { customerId: '', createdBy: 't' } }
      )
    ).rejects.toThrow(/customer/i);

    // Nothing was written: the whole sale is all-or-nothing.
    expect(await db.transactions.count()).toBe(0);
    expect(await db.utang.count()).toBe(0);
    expect((await db.products.get('p1'))!.stock).toBe(5);
  });
});
