import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatPeso, lineTotal, formatWeight, type Customer, type TransactionItem } from '../services/db';
import {
  getAllCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getOutstandingByCustomer,
} from '../services/customers';
import {
  getAllUtang,
  getUtangById,
  addPayment,
  deletePayment,
  type UtangWithBalance,
  type UtangStatus,
} from '../services/utang';
import { useCloudSession } from '../hooks/useCloudSession';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Tab = 'debts' | 'customers';
type Filter = 'all' | UtangStatus;

const STATUS_LABEL: Record<UtangStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};

function daysAgo(date: Date): string {
  const ms = Date.now() - new Date(date).getTime();
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

export function UtangScreen() {
  const { email } = useCloudSession();
  const [tab, setTab] = useState<Tab>('debts');
  const [debts, setDebts] = useState<UtangWithBalance[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [outstanding, setOutstanding] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Detail modal
  const [openDebt, setOpenDebt] = useState<UtangWithBalance | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [actionError, setActionError] = useState('');

  // Customer editor
  const [customerModal, setCustomerModal] = useState<{
    mode: 'add' | 'edit';
    customer?: Customer;
  } | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [customerError, setCustomerError] = useState('');

  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, c, o] = await Promise.all([getAllUtang(), getAllCustomers(), getOutstandingByCustomer()]);
      setDebts(d);
      setCustomers(c);
      setOutstanding(o);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load);
  }, [load]);

  const customerById = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of customers) map.set(c.id, c);
    return map;
  }, [customers]);

  const customerNameOf = useCallback(
    (id: string) => customerById.get(id)?.name ?? 'Unknown customer',
    [customerById]
  );

  const visibleDebts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return debts
      .filter(d => (filter === 'all' ? true : d.status === filter))
      .filter(d => (q ? customerNameOf(d.customerId).toLowerCase().includes(q) : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [debts, filter, search, customerNameOf]);

  const visibleCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter(c => (q ? `${c.name} ${c.phone ?? ''}`.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [customers, search]);

  const totalOutstanding = useMemo(
    () => debts.reduce((sum, d) => sum + d.balance, 0),
    [debts]
  );

  const refreshDebt = useCallback(async (id: string) => {
    const fresh = await getUtangById(id);
    if (!fresh) return;
    setOpenDebt(fresh);
    setDebts(prev => prev.map(d => (d.id === id ? fresh : d)));
  }, []);

  const handlePayment = async () => {
    if (!openDebt) return;
    const amount = Math.round(parseFloat(payAmount) * 100);
    setActionError('');
    try {
      await addPayment(openDebt.id, amount, payNote, email ?? 'unknown');
      setPayAmount('');
      setPayNote('');
      await refreshDebt(openDebt.id);
    } catch (err: any) {
      setActionError(err?.message || 'Could not record the payment.');
    }
  };

  const handleDeletePayment = (paymentId: string) => {
    if (!openDebt) return;
    setConfirm({
      title: 'Delete this payment?',
      message: 'The amount will be added back to the balance.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await deletePayment(paymentId);
          await refreshDebt(openDebt.id);
        } catch (err: any) {
          setActionError(err?.message || 'Could not delete the payment.');
        }
      },
    });
  };

  const openCustomerModal = (mode: 'add' | 'edit', customer?: Customer) => {
    setCustomerModal({ mode, customer });
    setCustomerName(customer?.name ?? '');
    setCustomerPhone(customer?.phone ?? '');
    setCustomerNote(customer?.note ?? '');
    setCustomerError('');
  };

  const handleSaveCustomer = async () => {
    if (!customerModal) return;
    const data = { name: customerName, phone: customerPhone, note: customerNote };
    setCustomerError('');
    try {
      if (customerModal.mode === 'add') {
        await addCustomer(data);
      } else if (customerModal.customer) {
        await updateCustomer(customerModal.customer.id, data);
      }
      setCustomerModal(null);
      await load();
    } catch (err: any) {
      setCustomerError(err?.message || 'Could not save the customer.');
    }
  };

  const handleDeleteCustomer = (customer: Customer) => {
    setConfirm({
      title: `Delete ${customer.name}?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirm(null);
        try {
          await deleteCustomer(customer.id);
          await load();
        } catch (err: any) {
          setCustomerError(err?.message || 'Could not delete the customer.');
          setCustomerModal({ mode: 'edit', customer });
        }
      },
    });
  };

  const statusBadge = (status: UtangStatus) => {
    const cls =
      status === 'paid'
        ? 'bg-emerald-100 text-emerald-700'
        : status === 'partial'
          ? 'bg-amber-100 text-amber-800'
          : 'bg-red-100 text-red-700';
    return `inline-block px-2 py-0.5 rounded-full text-xs font-bold ${cls}`;
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      <header className="p-4 border-b border-slate-200 flex-shrink-0 bg-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">📒 Utang</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Outstanding: <span className="font-bold text-slate-800">{formatPeso(totalOutstanding)}</span>
            </p>
          </div>
          <button
            onClick={() => openCustomerModal('add')}
            className="shrink-0 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-sm font-bold min-h-[44px]"
          >
            + Add Customer
          </button>
        </div>

        <div className="flex gap-2 mt-4">
          {(['debts', 'customers'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setSearch('');
              }}
              className={`px-4 py-2 rounded-xl text-sm font-bold capitalize min-h-[44px] ${
                tab === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={tab === 'debts' ? 'Search by customer name' : 'Search customers'}
          className="w-full mt-3 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />

        {tab === 'debts' && (
          <div className="flex gap-1.5 mt-3 flex-wrap">
            {(['all', 'unpaid', 'partial', 'paid'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold min-h-[44px] ${
                  filter === f ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {f === 'all' ? 'All' : STATUS_LABEL[f]}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {loading ? (
          <p className="text-center text-slate-400 py-12 text-sm">Loading…</p>
        ) : tab === 'debts' ? (
          visibleDebts.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-5xl mb-4">📒</p>
              <p className="text-lg">No utang records</p>
              <p className="text-sm mt-2">
                Record a sale on credit from the cashier and it will appear here.
              </p>
            </div>
          ) : (
            visibleDebts.map(d => (
              <button
                key={d.id}
                onClick={() => {
                  setOpenDebt(d);
                  setPayAmount('');
                  setPayNote('');
                  setActionError('');
                }}
                className="w-full text-left bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{customerNameOf(d.customerId)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {d.items.reduce((n, i) => n + (i.soldByWeight ? 1 : i.quantity), 0)} item
                        {d.items.reduce((n, i) => n + (i.soldByWeight ? 1 : i.quantity), 0) === 1 ? '' : 's'} ·{' '}
                      {daysAgo(d.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-slate-900">{formatPeso(d.balance)}</p>
                    <span className={statusBadge(d.status)}>{STATUS_LABEL[d.status]}</span>
                  </div>
                </div>
              </button>
            ))
          )
        ) : visibleCustomers.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-5xl mb-4">👥</p>
            <p className="text-lg">No customers yet</p>
            <p className="text-sm mt-2">Add a customer to start recording utang.</p>
          </div>
        ) : (
          visibleCustomers.map(c => (
            <div
              key={c.id}
              className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                {c.phone && <p className="text-xs text-slate-500 mt-0.5">📞 {c.phone}</p>}
                {c.note && <p className="text-xs text-slate-400 mt-0.5">{c.note}</p>}
                {(outstanding.get(c.id) ?? 0) > 0 && (
                  <p className="text-xs font-bold text-red-600 mt-1">
                    Owes {formatPeso(outstanding.get(c.id)!)}
                  </p>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openCustomerModal('edit', c)}
                  className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold min-h-[44px]"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteCustomer(c)}
                  className="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-bold min-h-[44px]"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Debt detail */}
      {openDebt && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-5 border-b border-slate-200 flex justify-between items-start gap-3">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900 truncate">
                  {customerNameOf(openDebt.customerId)}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {daysAgo(openDebt.createdAt)} ·{' '}
                  {openDebt.items.reduce((n, i) => n + (i.soldByWeight ? 1 : i.quantity), 0)} items
                </p>
              </div>
              <button
                onClick={() => setOpenDebt(null)}
                aria-label="Close"
                className="w-11 h-11 shrink-0 rounded-full bg-slate-100 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">
              <div className="bg-slate-50 rounded-2xl p-4 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-600">Balance</span>
                <span
                  className={`text-2xl font-black ${
                    openDebt.balance === 0 ? 'text-emerald-600' : 'text-slate-900'
                  }`}
                >
                  {formatPeso(openDebt.balance)}
                </span>
              </div>
              <p className="text-xs text-slate-500 -mt-3">
                Total {formatPeso(openDebt.total)} · Paid {formatPeso(openDebt.paid)}
              </p>

              <div>
                <p className="text-xs font-bold text-slate-600 uppercase mb-2">Items</p>
                <div className="space-y-1.5">
                  {openDebt.items.map((i: TransactionItem, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-slate-700 truncate mr-3">
                        {i.soldByWeight ? `${formatWeight(i.quantity)} ${i.name}` : `${i.quantity}× ${i.name}`}
                      </span>
                      <span className="font-bold text-slate-900 shrink-0">
                        {formatPeso(lineTotal(i))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 uppercase mb-2">
                  Payments ({openDebt.payments.length})
                </p>
                {openDebt.payments.length === 0 ? (
                  <p className="text-sm text-slate-400">No payments yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {openDebt.payments.map(p => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900">{formatPeso(p.amount)}</p>
                          <p className="text-xs text-slate-400">
                            {new Date(p.createdAt).toLocaleString()}
                            {p.note ? ` · ${p.note}` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeletePayment(p.id)}
                          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold min-h-[44px]"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {actionError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{actionError}</p>
              )}
            </div>

            {openDebt.balance > 0 && (
              <div className="p-5 border-t border-slate-200 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    placeholder="Amount"
                    className="flex-1 min-w-0 px-4 py-3 rounded-xl border-2 border-slate-200 font-bold focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setPayAmount((openDebt.balance / 100).toFixed(2))}
                    className="px-4 py-3 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-sm font-bold min-h-[44px]"
                  >
                    Full
                  </button>
                </div>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="Note (optional)"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={handlePayment}
                  disabled={!payAmount || parseFloat(payAmount) <= 0}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-lg rounded-2xl disabled:opacity-40"
                >
                  Record Payment
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer editor */}
      {customerModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">
                {customerModal.mode === 'add' ? 'Add Customer' : 'Edit Customer'}
              </h3>
              <button
                onClick={() => setCustomerModal(null)}
                aria-label="Close"
                className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Name *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder="e.g. Aling Nena"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Phone
              </label>
              <input
                type="text"
                value={customerPhone}
                onChange={e => setCustomerPhone(e.target.value)}
                placeholder="Optional"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1.5">
                Note
              </label>
              <input
                type="text"
                value={customerNote}
                onChange={e => setCustomerNote(e.target.value)}
                placeholder="Optional"
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            {customerError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{customerError}</p>
            )}

            <button
              onClick={handleSaveCustomer}
              disabled={!customerName.trim()}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-lg rounded-2xl disabled:opacity-40"
            >
              {customerModal.mode === 'add' ? 'Add Customer' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel ?? 'Confirm'}
        onConfirm={() => confirm?.onConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
