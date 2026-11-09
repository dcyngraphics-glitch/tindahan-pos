import { db, type Utang, type UtangPayment, type TransactionItem, generateId } from './db';

export type UtangStatus = 'unpaid' | 'partial' | 'paid';

export interface UtangWithBalance extends Utang {
  paid: number;
  balance: number;
  status: UtangStatus;
  payments: UtangPayment[];
}

export interface NewUtang {
  customerId: string;
  transactionId?: string;
  items: TransactionItem[];
  total: number;
  createdBy: string;
}

/**
 * Balance and status are always derived from the payments, never stored on the
 * record. A stored balance is a second source of truth that eventually drifts
 * from the payments; deriving it means the two cannot disagree.
 */
export function computeBalance(
  total: number,
  payments: UtangPayment[]
): { paid: number; balance: number; status: UtangStatus } {
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, total - paid);
  const status: UtangStatus = paid <= 0 ? 'unpaid' : balance <= 0 ? 'paid' : 'partial';
  return { paid, balance, status };
}

function withBalance(u: Utang, payments: UtangPayment[]): UtangWithBalance {
  const { paid, balance, status } = computeBalance(u.total, payments);
  return {
    ...u,
    paid,
    balance,
    status,
    payments: [...payments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ),
  };
}

export async function getAllUtang(): Promise<UtangWithBalance[]> {
  try {
    const [all, payments] = await Promise.all([db.utang.toArray(), db.utang_payments.toArray()]);
    const byUtang = new Map<string, UtangPayment[]>();
    for (const p of payments) {
      const list = byUtang.get(p.utangId);
      if (list) list.push(p);
      else byUtang.set(p.utangId, [p]);
    }
    return all.map(u => withBalance(u, byUtang.get(u.id) ?? []));
  } catch (err) {
    console.error('Failed to get utang:', err);
    throw new Error('Failed to load utang');
  }
}

export async function getUtangById(id: string): Promise<UtangWithBalance | undefined> {
  try {
    const u = await db.utang.get(id);
    if (!u) return undefined;
    const payments = await db.utang_payments.where('utangId').equals(id).toArray();
    return withBalance(u, payments);
  } catch (err) {
    console.error('Failed to get utang:', err);
    throw new Error('Failed to load utang');
  }
}

export async function getUtangByCustomer(customerId: string): Promise<UtangWithBalance[]> {
  const all = await getAllUtang();
  return all.filter(u => u.customerId === customerId);
}

export async function createUtang(data: NewUtang): Promise<string> {
  if (!data.customerId) throw new Error('Choose a customer before recording utang.');
  if (!data.items.length) throw new Error('Add items before recording utang.');
  if (data.total <= 0) throw new Error('The utang amount is zero. Add items first.');

  const now = new Date();
  const id = generateId();
  await db.utang.add({
    id,
    customerId: data.customerId,
    ...(data.transactionId ? { transactionId: data.transactionId } : {}),
    items: data.items,
    total: data.total,
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function addPayment(
  utangId: string,
  amount: number,
  note: string | undefined,
  createdBy: string
): Promise<void> {
  const u = await db.utang.get(utangId);
  if (!u) throw new Error('Utang record not found.');

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter an amount greater than zero.');
  }

  const payments = await db.utang_payments.where('utangId').equals(utangId).toArray();
  const { balance } = computeBalance(u.total, payments);
  if (amount > balance) {
    throw new Error(`That is more than the remaining balance of ₱${(balance / 100).toFixed(2)}.`);
  }

  await db.utang_payments.add({
    id: generateId(),
    utangId,
    amount,
    ...(note?.trim() ? { note: note.trim() } : {}),
    createdBy,
    createdAt: new Date(),
  });
  await db.utang.update(utangId, { updatedAt: new Date() });
}

export async function deletePayment(paymentId: string): Promise<void> {
  const payment = await db.utang_payments.get(paymentId);
  if (!payment) throw new Error('Payment not found.');
  await db.utang_payments.delete(paymentId);
  await db.utang.update(payment.utangId, { updatedAt: new Date() });
}

/** Total still owed across every customer. Used by the dashboard card. */
export async function getOutstandingTotal(): Promise<number> {
  const all = await getAllUtang();
  return all.reduce((sum, u) => sum + u.balance, 0);
}
