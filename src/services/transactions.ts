import { db, type Transaction, type TransactionItem, generateId } from './db';

export class InsufficientStockError extends Error {
  productId: string;
  productName: string;
  requested: number;
  available: number;

  constructor(productId: string, productName: string, requested: number, available: number) {
    super(`Insufficient stock for "${productName}": requested ${requested}, available ${available}`);
    this.name = 'InsufficientStockError';
    this.productId = productId;
    this.productName = productName;
    this.requested = requested;
    this.available = available;
  }
}

export async function getAllTransactions(): Promise<Transaction[]> {
  try {
    return await db.transactions.orderBy('createdAt').reverse().toArray();
  } catch (err) {
    console.error('Failed to get transactions:', err);
    throw new Error('Failed to load transactions');
  }
}

export async function getTransactionById(id: string): Promise<Transaction | undefined> {
  try {
    return await db.transactions.get(id);
  } catch (err) {
    console.error('Failed to get transaction:', err);
    throw new Error('Failed to load transaction');
  }
}

export async function getTodayTransactions(): Promise<Transaction[]> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await db.transactions
      .where('createdAt')
      .aboveOrEqual(today)
      .toArray();
  } catch (err) {
    console.error('Failed to get today transactions:', err);
    throw new Error('Failed to load today\'s transactions');
  }
}

export async function getTransactionsByDate(date: Date): Promise<Transaction[]> {
  try {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return await db.transactions
      .where('createdAt')
      .between(start, end)
      .toArray();
  } catch (err) {
    console.error('Failed to get transactions by date:', err);
    throw new Error('Failed to load transactions');
  }
}

export async function createTransaction(
  items: TransactionItem[],
  cashTendered: number,
  discount?: { type: 'percent' | 'fixed'; value: number } | null,
  opts?: { paymentType?: 'cash' | 'utang' }
): Promise<string> {
  const paymentType = opts?.paymentType ?? 'cash';
  let total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  let effectiveTotal = total;

  // Apply discount to the stored total so DB and receipt are consistent
  if (discount) {
    if (discount.type === 'percent') {
      effectiveTotal = Math.round(total * Math.max(0, 1 - discount.value / 100));
    } else {
      effectiveTotal = Math.max(0, total - discount.value);
    }
  }

  // A credit sale has no cash changing hands, so the tendered check only
  // applies to cash sales.
  if (paymentType === 'cash' && cashTendered < effectiveTotal) {
    throw new Error(
      `Cash tendered ($${cashTendered.toFixed(2)}) is less than effective total ($${effectiveTotal.toFixed(2)})`
    );
  }

  const change = paymentType === 'utang' ? 0 : cashTendered - effectiveTotal;
  const id = generateId();
  const now = new Date();

  // Use database transaction to ensure atomicity
  await db.transaction('rw', db.products, db.transactions, async () => {
    // First check stock for all items - collect errors first
    const stockErrors: InsufficientStockError[] = [];
    for (const item of items) {
      const product = await db.products.get(item.productId);
      if (!product) {
        throw new Error(`Product not found: ${item.name}`);
      }
      if (product.stock < item.quantity) {
        stockErrors.push(new InsufficientStockError(item.productId, item.name, item.quantity, product.stock));
      }
    }

    // If any stock insufficient, throw the first error
    if (stockErrors.length > 0) {
      throw stockErrors[0];
    }

    // All stock checks passed - atomically decrement stock using bulk modify
    // This uses a single WHERE clause to ensure atomic check-and-update
    for (const item of items) {
      const updated = await db.products
        .where('id')
        .equals(item.productId)
        .and(p => p.stock >= item.quantity) // Atomic check
        .modify(p => {
          p.stock -= item.quantity;
          p.updatedAt = now;
        });

      if (updated === 0) {
        // Race condition: stock changed between check and update
        const product = await db.products.get(item.productId);
        throw new InsufficientStockError(
          item.productId,
          item.name,
          item.quantity,
          product?.stock ?? 0
        );
      }
    }

    // Record transaction after successful stock decrements.
    // total is stored AFTER discount so the DB record matches the printed
    // receipt (which always shows the discounted total and consistent change).
    await db.transactions.add({
      id,
      items,
      total: effectiveTotal,
      cashTendered,
      change,
      createdAt: now,
      paymentType,
      ...(discount ? { discount } : {}),
    });
  });

  return id;
}

export async function voidTransaction(id: string): Promise<void> {
  await db.transaction('rw', db.transactions, db.products, db.utang, db.utang_payments, async () => {
    const tx = await db.transactions.get(id);
    if (!tx) throw new Error('Transaction not found');
    if (tx.voided) throw new Error('Transaction is already voided');

    // A credit sale that has already been paid against must be refunded first:
    // deleting the debt while money has been collected would lose that record.
    if (tx.paymentType === 'utang') {
      const debt = await db.utang.where('transactionId').equals(id).first();
      if (debt) {
        const payments = await db.utang_payments.where('utangId').equals(debt.id).toArray();
        if (payments.length > 0) {
          throw new Error('This utang already has payments recorded. Delete those payments first, then void the sale.');
        }
        await db.utang.delete(debt.id);
      }
    }

    // Restore stock for all items
    for (const item of tx.items) {
      await db.products
        .where('id')
        .equals(item.productId)
        .modify(p => {
          p.stock += item.quantity;
          p.updatedAt = new Date();
        });
    }

    // Mark as voided
    await db.transactions.update(id, { voided: true });
  });
}

export async function getSalesSummary(startDate: Date, endDate: Date): Promise<{
  totalRevenue: number;
  totalTransactions: number;
  averageTransaction: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
}> {
  try {
    const transactions = await db.transactions
      .where('createdAt')
      .between(startDate, endDate)
      .toArray();

    const totalRevenue = transactions.reduce((sum, t) => sum + t.total, 0);
    const totalTransactions = transactions.length;
    const averageTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Calculate top products
    const productStats: Record<string, { name: string; quantity: number; revenue: number }> = {};
    for (const t of transactions) {
      for (const item of t.items) {
        if (!productStats[item.productId]) {
          productStats[item.productId] = { name: item.name, quantity: 0, revenue: 0 };
        }
        productStats[item.productId].quantity += item.quantity;
        productStats[item.productId].revenue += item.price * item.quantity;
      }
    }

    const topProducts = Object.values(productStats)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return { totalRevenue, totalTransactions, averageTransaction, topProducts };
  } catch (err) {
    console.error('Failed to get sales summary:', err);
    throw new Error('Failed to load sales summary');
  }
}