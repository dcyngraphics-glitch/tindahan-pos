import {
  db,
  type Customer,
  type Product,
  type Transaction,
  type Utang,
  type UtangPayment,
} from './db';

const BACKUP_FORMAT = 'tindahan-pos-backup';
const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  counts: Record<string, number>;
  products: Product[];
  transactions: Transaction[];
  customers: Customer[];
  utang: Utang[];
  utang_payments: UtangPayment[];
}

/**
 * Everything the store needs to keep running: the catalogue, the sales, the
 * customers, the credit (utang) records and the payments against them.
 *
 * There is deliberately no settings or device state in here — those are not
 * worth carrying between devices, and including them would make a restore
 * overwrite the new device's configuration.
 */
export async function exportBackup(): Promise<BackupFile> {
  const [products, transactions, customers, utang, utang_payments] = await Promise.all([
    db.products.toArray(),
    db.transactions.toArray(),
    db.customers.toArray(),
    db.utang.toArray(),
    db.utang_payments.toArray(),
  ]);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      products: products.length,
      transactions: transactions.length,
      customers: customers.length,
      utang: utang.length,
      utang_payments: utang_payments.length,
    },
    products,
    transactions,
    customers,
    utang,
    utang_payments,
  };
}

function asDate(value: unknown): Date {
  const d = new Date(value as string | number | Date);
  // A missing or malformed date should not poison the whole restore; fall back
  // to now so the record still lands in the database.
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function restoreBackup(raw: unknown): Promise<Record<string, number>> {
  if (!raw || typeof raw !== 'object') {
    throw new Error('That file is not a Softies Store backup.');
  }
  const file = raw as Partial<BackupFile>;

  if (file.format !== BACKUP_FORMAT) {
    throw new Error('That file is not a Softies Store backup.');
  }
  if (file.version !== BACKUP_VERSION) {
    throw new Error('That backup was made by a different version of the app.');
  }

  const { products, transactions, customers, utang, utang_payments } = file;
  for (const [name, rows] of Object.entries({
    products,
    transactions,
    customers,
    utang,
    utang_payments,
  })) {
    if (!Array.isArray(rows)) throw new Error(`That backup is missing its ${name} list.`);
  }

  // A JSON round trip turns dates into strings; put them back before storing.
  const restored = {
    products: (products as Product[]).map(p => ({
      ...p,
      createdAt: asDate(p.createdAt),
      updatedAt: asDate(p.updatedAt),
    })),
    transactions: (transactions as Transaction[]).map(t => ({
      ...t,
      createdAt: asDate(t.createdAt),
    })),
    customers: (customers as Customer[]).map(c => ({
      ...c,
      createdAt: asDate(c.createdAt),
      updatedAt: asDate(c.updatedAt),
    })),
    utang: (utang as Utang[]).map(u => ({
      ...u,
      createdAt: asDate(u.createdAt),
      updatedAt: asDate(u.updatedAt),
    })),
    utang_payments: (utang_payments as UtangPayment[]).map(p => ({
      ...p,
      createdAt: asDate(p.createdAt),
    })),
  };

  // Replace everything in one transaction, so a failure halfway through cannot
  // leave the store half old and half new.
  await db.transaction(
    'rw',
    [db.products, db.transactions, db.customers, db.utang, db.utang_payments],
    async () => {
      await Promise.all([
        db.products.clear(),
        db.transactions.clear(),
        db.customers.clear(),
        db.utang.clear(),
        db.utang_payments.clear(),
      ]);
      await Promise.all([
        db.products.bulkAdd(restored.products),
        db.transactions.bulkAdd(restored.transactions),
        db.customers.bulkAdd(restored.customers),
        db.utang.bulkAdd(restored.utang),
        db.utang_payments.bulkAdd(restored.utang_payments),
      ]);
    }
  );

  return {
    products: restored.products.length,
    transactions: restored.transactions.length,
    customers: restored.customers.length,
    utang: restored.utang.length,
    utang_payments: restored.utang_payments.length,
  };
}
