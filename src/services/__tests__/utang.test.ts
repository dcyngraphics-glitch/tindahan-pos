import { describe, it, expect, beforeEach } from 'vitest';
import { db, type UtangPayment } from '../db';
import {
  computeBalance,
  createUtang,
  addPayment,
  deletePayment,
  getAllUtang,
  getOutstandingTotal,
} from '../utang';
import { addCustomer, deleteCustomer, getOutstandingByCustomer } from '../customers';

function payment(amount: number, utangId = 'u1', id = `p-${amount}`): UtangPayment {
  return { id, utangId, amount, createdBy: 'test@example.com', createdAt: new Date() };
}

async function seedUtang(total = 1000) {
  return createUtang({
    customerId: 'c1',
    items: [{ productId: 'p1', barcode: 'b1', name: 'Test Item', price: total, quantity: 1 }],
    total,
    createdBy: 'test@example.com',
  });
}

beforeEach(async () => {
  await Promise.all([db.utang.clear(), db.utang_payments.clear(), db.customers.clear()]);
});

describe('computeBalance', () => {
  it('is unpaid when nothing has been paid', () => {
    expect(computeBalance(1000, [])).toEqual({ paid: 0, balance: 1000, status: 'unpaid' });
  });

  it('is partial when only some has been paid', () => {
    expect(computeBalance(1000, [payment(400)])).toEqual({ paid: 400, balance: 600, status: 'partial' });
  });

  it('is paid once the full amount is covered', () => {
    expect(computeBalance(1000, [payment(600), payment(400)])).toEqual({
      paid: 1000,
      balance: 0,
      status: 'paid',
    });
  });

  it('never reports a negative balance, even if a customer overpays', () => {
    // addPayment blocks this at the UI layer, but the derived balance must still
    // be safe if the data ever contains one.
    expect(computeBalance(1000, [payment(1500)]).balance).toBe(0);
  });
});

describe('createUtang', () => {
  it('records the debt and derives a zero-paid balance', async () => {
    const id = await seedUtang(2500);
    const all = await getAllUtang();
    const debt = all.find(d => d.id === id);

    expect(debt).toBeDefined();
    expect(debt!.total).toBe(2500);
    expect(debt!.paid).toBe(0);
    expect(debt!.balance).toBe(2500);
    expect(debt!.status).toBe('unpaid');
  });

  it('refuses a sale with no customer', async () => {
    await expect(
      createUtang({ customerId: '', items: [], total: 100, createdBy: 't' })
    ).rejects.toThrow(/customer/i);
  });

  it('refuses a sale with no items', async () => {
    await expect(
      createUtang({ customerId: 'c1', items: [], total: 100, createdBy: 't' })
    ).rejects.toThrow(/items/i);
  });

  it('refuses a zero-total sale', async () => {
    await expect(seedUtang(0)).rejects.toThrow(/zero/i);
  });
});

describe('addPayment', () => {
  it('reduces the balance by the amount paid', async () => {
    const id = await seedUtang(1000);
    await addPayment(id, 400, undefined, 't');

    const [debt] = await getAllUtang();
    expect(debt.paid).toBe(400);
    expect(debt.balance).toBe(600);
    expect(debt.status).toBe('partial');
    expect(debt.payments).toHaveLength(1);
  });

  it('marks the debt paid once the balance is cleared', async () => {
    const id = await seedUtang(1000);
    await addPayment(id, 400, undefined, 't');
    await addPayment(id, 600, undefined, 't');

    const [debt] = await getAllUtang();
    expect(debt.balance).toBe(0);
    expect(debt.status).toBe('paid');
  });

  it('rejects a payment larger than the remaining balance', async () => {
    const id = await seedUtang(1000);
    await expect(addPayment(id, 1200, undefined, 't')).rejects.toThrow(/more than/i);

    const [debt] = await getAllUtang();
    expect(debt.balance).toBe(1000);
  });

  it('rejects a zero or negative amount', async () => {
    const id = await seedUtang(1000);
    await expect(addPayment(id, 0, undefined, 't')).rejects.toThrow(/greater than zero/i);
    await expect(addPayment(id, -50, undefined, 't')).rejects.toThrow(/greater than zero/i);
  });

  it('adds the amount back when a payment is deleted', async () => {
    const id = await seedUtang(1000);
    await addPayment(id, 400, undefined, 't');
    const [before] = await getAllUtang();

    await deletePayment(before.payments[0].id);

    const [after] = await getAllUtang();
    expect(after.balance).toBe(1000);
    expect(after.status).toBe('unpaid');
    expect(after.payments).toHaveLength(0);
  });
});

describe('getOutstandingTotal', () => {
  it('sums only the balances still owed', async () => {
    const a = await seedUtang(1000);
    await seedUtang(500);
    await addPayment(a, 1000, undefined, 't');

    expect(await getOutstandingTotal()).toBe(500);
  });
});

describe('customers', () => {
  it('adds a customer and reports no balance', async () => {
    const id = await addCustomer({ name: 'Aling Nena' });
    const outstanding = await getOutstandingByCustomer();
    expect(outstanding.get(id) ?? 0).toBe(0);
  });

  it('blocks a duplicate name that differs only by case', async () => {
    await addCustomer({ name: 'Aling Nena' });
    await expect(addCustomer({ name: 'aling nena' })).rejects.toThrow(/already exists/i);
  });

  it('blocks deleting a customer who still owes money', async () => {
    const id = await addCustomer({ name: 'Aling Nena' });
    await createUtang({
      customerId: id,
      items: [{ productId: 'p1', barcode: 'b1', name: 'Item', price: 800, quantity: 1 }],
      total: 800,
      createdBy: 't',
    });

    await expect(deleteCustomer(id)).rejects.toThrow(/still owes/i);
  });

  it('allows deleting a customer whose balance is settled', async () => {
    const id = await addCustomer({ name: 'Aling Nena' });
    const debtId = await createUtang({
      customerId: id,
      items: [{ productId: 'p1', barcode: 'b1', name: 'Item', price: 800, quantity: 1 }],
      total: 800,
      createdBy: 't',
    });
    await addPayment(debtId, 800, undefined, 't');

    await deleteCustomer(id);
    expect(await db.customers.get(id)).toBeUndefined();
  });

  it('sums a customer outstanding across several debts', async () => {
    const id = await addCustomer({ name: 'Aling Nena' });
    await createUtang({
      customerId: id,
      items: [{ productId: 'p1', barcode: 'b1', name: 'Item', price: 1000, quantity: 1 }],
      total: 1000,
      createdBy: 't',
    });
    await createUtang({
      customerId: id,
      items: [{ productId: 'p2', barcode: 'b2', name: 'Item 2', price: 250, quantity: 1 }],
      total: 250,
      createdBy: 't',
    });

    const outstanding = await getOutstandingByCustomer();
    expect(outstanding.get(id)).toBe(1250);
  });
});
