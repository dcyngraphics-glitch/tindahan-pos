import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../db';
import { InsufficientStockError, voidTransaction, createTransaction } from '../transactions';
import { createUtang, addPayment } from '../utang';

describe('voidTransaction', () => {
  beforeEach(async () => {
    await Promise.all([
      db.utang.clear(),
      db.utang_payments.clear(),
      db.transactions.clear(),
      db.products.clear(),
    ]);
  });

  it('is exported as a function', () => {
    expect(typeof voidTransaction).toBe('function');
  });

  it('InsufficientStockError carries product info', () => {
    const err = new InsufficientStockError('p1', 'Chippy', 5, 2);
    expect(err.productId).toBe('p1');
    expect(err.productName).toBe('Chippy');
    expect(err.requested).toBe(5);
    expect(err.available).toBe(2);
    expect(err.name).toBe('InsufficientStockError');
    expect(err.message).toMatch(/Chippy/);
  });

  it('removes the debt when voiding an unpaid credit sale', async () => {
    await db.products.add({
      id: 'p1',
      barcode: 'b1',
      name: 'Item',
      price: 1000,
      cost: 500,
      stock: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const txId = await createTransaction(
      [{ productId: 'p1', barcode: 'b1', name: 'Item', price: 1000, quantity: 1 }],
      0,
      null,
      { paymentType: 'utang' }
    );
    await createUtang({
      customerId: 'c1',
      transactionId: txId,
      items: [{ productId: 'p1', barcode: 'b1', name: 'Item', price: 1000, quantity: 1 }],
      total: 1000,
      createdBy: 't',
    });

    await voidTransaction(txId);

    expect(await db.utang.count()).toBe(0);
    expect((await db.transactions.get(txId))!.voided).toBe(true);
    // Stock comes back.
    expect((await db.products.get('p1'))!.stock).toBe(10);
  });

  it('blocks voiding a credit sale that has payments recorded', async () => {
    await db.products.add({
      id: 'p1',
      barcode: 'b1',
      name: 'Item',
      price: 1000,
      cost: 500,
      stock: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const txId = await createTransaction(
      [{ productId: 'p1', barcode: 'b1', name: 'Item', price: 1000, quantity: 1 }],
      0,
      null,
      { paymentType: 'utang' }
    );
    const debtId = await createUtang({
      customerId: 'c1',
      transactionId: txId,
      items: [{ productId: 'p1', barcode: 'b1', name: 'Item', price: 1000, quantity: 1 }],
      total: 1000,
      createdBy: 't',
    });
    await addPayment(debtId, 500, undefined, 't');

    await expect(voidTransaction(txId)).rejects.toThrow(/payments recorded/i);
    // The debt and its payment are left untouched.
    expect(await db.utang.count()).toBe(1);
    expect(await db.utang_payments.count()).toBe(1);
  });
});
