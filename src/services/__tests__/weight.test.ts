import { describe, it, expect, beforeEach } from 'vitest';
import { db, lineTotal, formatWeight, type TransactionItem } from '../db';
import { addProduct } from '../products';
import { createTransaction } from '../transactions';

const RICE = {
  barcode: '4801234500001',
  name: 'Rice (Premium)',
  price: 5200, // ₱52.00 per kilo, in centavos
  cost: 4500,
  stock: 0, // crops are not stock-tracked
  category: 'Crops',
  soldByWeight: true,
};

function weighed(price: number, quantity: number): TransactionItem {
  return {
    productId: 'crop-1',
    barcode: RICE.barcode,
    name: RICE.name,
    price,
    quantity,
    soldByWeight: true,
  };
}

function piece(price: number, quantity: number): TransactionItem {
  return { productId: 'p1', barcode: 'b1', name: 'Soap', price, quantity };
}

beforeEach(async () => {
  await Promise.all([db.products.clear(), db.transactions.clear(), db.utang.clear()]);
});

describe('lineTotal', () => {
  it('rounds a weighed line to the nearest peso', () => {
    // 0.83 kg x ₱52.00 = ₱43.16 -> ₱43.00
    expect(lineTotal(weighed(5200, 0.83))).toBe(4300);
  });

  it('rounds up when the centavos are 50 or more', () => {
    // 0.50 kg x ₱52.00 = ₱26.00 exactly
    expect(lineTotal(weighed(5200, 0.5))).toBe(2600);
    // 0.75 kg x ₱51.00 = ₱38.25 -> ₱38.00
    expect(lineTotal(weighed(5100, 0.75))).toBe(3800);
    // 0.76 kg x ₱51.00 = ₱38.76 -> ₱39.00
    expect(lineTotal(weighed(5100, 0.76))).toBe(3900);
  });

  it('leaves normal lines at the centavo', () => {
    expect(lineTotal(piece(1250, 2))).toBe(2500);
    expect(lineTotal(piece(333, 3))).toBe(999);
  });

  it('treats a missing flag as a normal line', () => {
    const legacy = { ...weighed(5200, 0.83) };
    delete legacy.soldByWeight;
    expect(lineTotal(legacy)).toBeCloseTo(4316, 0);
  });
});

describe('formatWeight', () => {
  it('drops trailing zeros', () => {
    expect(formatWeight(1.5)).toBe('1.5 kg');
    expect(formatWeight(2)).toBe('2 kg');
    expect(formatWeight(1.25)).toBe('1.25 kg');
  });
});

describe('selling a crop by weight', () => {
  it('stores the weight as the quantity and keeps the price per kilo', async () => {
    const id = await addProduct(RICE);
    const saved = await db.products.get(id);
    expect(saved?.soldByWeight).toBe(true);

    await createTransaction([{ ...weighed(5200, 1.25), productId: id }], 10000);
    const tx = await db.transactions.toCollection().first();
    expect(tx?.items[0].quantity).toBe(1.25);
    expect(tx?.items[0].soldByWeight).toBe(true);
    // 1.25 kg x ₱52.00 = ₱65.00 exactly
    expect(tx?.total).toBe(6500);
  });

  it('does not touch stock for a weighed line', async () => {
    const id = await addProduct(RICE);
    await createTransaction([{ ...weighed(5200, 2), productId: id }], 20000);
    const saved = await db.products.get(id);
    expect(saved?.stock).toBe(0);
  });

  it('mixes weighed and normal lines in one sale', async () => {
    const cropId = await addProduct(RICE);
    const soapId = await addProduct({
      barcode: 'soap-1', name: 'Soap', price: 3500, cost: 2000, stock: 10,
    });

    await createTransaction(
      [
        { ...weighed(5200, 0.83), productId: cropId },   // ₱43.00 after rounding
        { ...piece(3500, 2), productId: soapId },        // ₱70.00
      ],
      20000
    );

    const tx = await db.transactions.toCollection().first();
    expect(tx?.total).toBe(11300);
    // Only the soap was decremented.
    expect((await db.products.get(soapId))?.stock).toBe(8);
    expect((await db.products.get(cropId))?.stock).toBe(0);
  });

  it('applies the sale discount after the per-line rounding', async () => {
    const id = await addProduct(RICE);
    await createTransaction([{ ...weighed(5200, 0.83), productId: id }], 10000, {
      type: 'percent',
      value: 10,
    });
    const tx = await db.transactions.toCollection().first();
    // 43.00 less 10% = 38.70
    expect(tx?.total).toBe(3870);
  });
});
