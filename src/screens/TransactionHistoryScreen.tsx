import { useState, useEffect, useCallback } from 'react';
import { getAllTransactions, voidTransaction } from '../services/transactions';
import { printViaBluetooth } from '../services/printer';
import { formatPeso, type Transaction } from '../services/db';

export function TransactionHistoryScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'valid' | 'voided'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllTransactions();
      setTransactions(data);
    } catch (err) {
      console.error(err);
      showToast('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const handleVoid = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to VOID this transaction? This will restore stock.')) {
      return;
    }
    try {
      await voidTransaction(id);
      showToast('Transaction voided successfully!');
      loadTransactions();
    } catch (err: any) {
      showToast(err.message || 'Failed to void transaction');
    }
  };

  const handleReprint = async (tx: Transaction, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await printViaBluetooth({
        items: tx.items,
        total: tx.total,
        cashTendered: tx.cashTendered,
        change: tx.change,
        date: new Date(tx.createdAt),
      });
      showToast('Receipt printed!');
    } catch (err) {
      console.error(err);
      showToast('Failed to print receipt via Bluetooth');
    }
  };

  const filtered = transactions.filter(tx => {
    if (filter === 'valid' && tx.voided) return false;
    if (filter === 'voided' && !tx.voided) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchId = tx.id.toLowerCase().includes(q);
      const matchItem = tx.items.some(i => i.name.toLowerCase().includes(q));
      return matchId || matchItem;
    }
    return true;
  });

  return (
    <div className="flex-1 pb-32 overflow-y-auto bg-slate-50">
      <header className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transaction History</h1>
          <p className="text-sm text-slate-500">View past sales, reprint receipts, and void transactions</p>
        </div>
        <button
          onClick={loadTransactions}
          disabled={loading}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-sm font-medium rounded-xl transition"
        >
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </header>

      <div className="p-4 max-w-5xl mx-auto space-y-4">
        {/* Search & Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by ID or item name..."
            className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-bold">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition ${filter === 'all' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
            >
              All ({transactions.length})
            </button>
            <button
              onClick={() => setFilter('valid')}
              className={`px-3 py-1.5 rounded-lg transition ${filter === 'valid' ? 'bg-white shadow text-slate-900' : 'text-slate-600'}`}
            >
              Completed ({transactions.filter(t => !t.voided).length})
            </button>
            <button
              onClick={() => setFilter('voided')}
              className={`px-3 py-1.5 rounded-lg transition ${filter === 'voided' ? 'bg-white shadow text-red-600' : 'text-slate-600'}`}
            >
              Voided ({transactions.filter(t => t.voided).length})
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading transactions...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center text-slate-400">
            No transactions found.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(tx => {
              const isExpanded = expandedId === tx.id;
              const dateStr = new Date(tx.createdAt).toLocaleString('en-PH', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              });

              return (
                <div
                  key={tx.id}
                  onClick={() => setExpandedId(isExpanded ? null : tx.id)}
                  className={`bg-white rounded-2xl border transition shadow-xs cursor-pointer ${
                    tx.voided ? 'border-red-200 opacity-70 bg-red-50/20' : 'border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${tx.voided ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-700'}`}>
                        {tx.voided ? '✕' : '✓'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {formatPeso(tx.total)}
                          </span>
                          {tx.voided && (
                            <span className="bg-red-100 text-red-600 text-xs font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                              Voided
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400">
                          {dateStr} · {tx.items.reduce((sum, i) => sum + i.quantity, 0)} items
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleReprint(tx, e)}
                        title="Reprint Receipt"
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition"
                      >
                        🖨️ Print
                      </button>
                      {!tx.voided && (
                        <button
                          onClick={(e) => handleVoid(tx.id, e)}
                          title="Void Transaction"
                          className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold border border-red-200 transition"
                        >
                          Void
                        </button>
                      )}
                      <span className="text-slate-400 text-xs pl-1">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Expanded Breakdown */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50/60 rounded-b-2xl space-y-2">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Items Purchased
                      </p>
                      <div className="space-y-1.5">
                        {tx.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-slate-700">
                            <span>
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-medium text-slate-900">
                              {formatPeso(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between text-xs font-bold text-slate-600">
                        <span>Tendered: {formatPeso(tx.cashTendered)}</span>
                        <span>Change: {formatPeso(tx.change)}</span>
                      </div>
                      <p className="text-xs text-slate-500 pt-1 font-mono">
                        ID: {tx.id}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
