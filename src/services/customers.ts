import { db, type Customer, generateId, formatPeso } from './db';

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    return await db.customers.orderBy('name').toArray();
  } catch (err) {
    console.error('Failed to get customers:', err);
    throw new Error('Failed to load customers');
  }
}

export async function getCustomerById(id: string): Promise<Customer | undefined> {
  try {
    return await db.customers.get(id);
  } catch (err) {
    console.error('Failed to get customer:', err);
    throw new Error('Failed to load customer');
  }
}

export async function addCustomer(data: {
  name: string;
  phone?: string;
  note?: string;
}): Promise<string> {
  const name = data.name.trim();
  if (!name) throw new Error('Customer name is required.');

  // The cashier finds people by name at the till, so "Aling Nena" and
  // "aling nena" are the same person — creating both splits one balance in two.
  const existing = await db.customers
    .filter(c => c.name.trim().toLowerCase() === name.toLowerCase())
    .first();
  if (existing) throw new Error(`A customer named "${existing.name}" already exists.`);

  const now = new Date();
  const id = generateId();
  await db.customers.add({
    id,
    name,
    ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
    ...(data.note?.trim() ? { note: data.note.trim() } : {}),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateCustomer(
  id: string,
  data: { name: string; phone?: string; note?: string }
): Promise<void> {
  const existing = await db.customers.get(id);
  if (!existing) throw new Error('Customer not found.');

  const name = data.name.trim();
  if (!name) throw new Error('Customer name is required.');

  await db.customers.update(id, {
    name,
    ...(data.phone?.trim() ? { phone: data.phone.trim() } : {}),
    ...(data.note?.trim() ? { note: data.note.trim() } : {}),
    updatedAt: new Date(),
  });
}

export async function deleteCustomer(id: string): Promise<void> {
  const debts = await db.utang.where('customerId').equals(id).toArray();
  const payments = debts.length
    ? await db.utang_payments.where('utangId').anyOf(debts.map(d => d.id)).toArray()
    : [];

  const paidByUtang = new Map<string, number>();
  for (const p of payments) {
    paidByUtang.set(p.utangId, (paidByUtang.get(p.utangId) ?? 0) + p.amount);
  }
  const outstanding = debts.reduce(
    (sum, d) => sum + Math.max(0, d.total - (paidByUtang.get(d.id) ?? 0)),
    0
  );

  if (outstanding > 0) {
    // Deleting a customer would orphan money that is still owed.
    throw new Error(
      `This customer still owes ${formatPeso(outstanding)}. Settle the balance before deleting them.`
    );
  }

  // Everything is settled, so the credit history has no ongoing value. Remove it
  // together with the customer so no record is left pointing at a missing person.
  // The sale itself stays in Transaction History either way.
  await db.transaction('rw', db.customers, db.utang, db.utang_payments, async () => {
    if (payments.length) await db.utang_payments.bulkDelete(payments.map(p => p.id));
    if (debts.length) await db.utang.bulkDelete(debts.map(d => d.id));
    await db.customers.delete(id);
  });
}

/**
 * Outstanding balance per customer id, for the customer list. Reuses the same
 * derived balance the utang screen shows, so the two can never disagree.
 */
export async function getOutstandingByCustomer(): Promise<Map<string, number>> {
  const [debts, payments] = await Promise.all([db.utang.toArray(), db.utang_payments.toArray()]);
  const paidByUtang = new Map<string, number>();
  for (const p of payments) {
    paidByUtang.set(p.utangId, (paidByUtang.get(p.utangId) ?? 0) + p.amount);
  }
  const result = new Map<string, number>();
  for (const d of debts) {
    const balance = Math.max(0, d.total - (paidByUtang.get(d.id) ?? 0));
    if (balance > 0) {
      result.set(d.customerId, (result.get(d.customerId) ?? 0) + balance);
    }
  }
  return result;
}
