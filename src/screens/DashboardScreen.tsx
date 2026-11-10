import { useEffect, useState, useCallback, useMemo } from 'react';
import { getAllTransactions } from '../services/transactions';
import { getAllProducts } from '../services/products';
import { formatPeso, lineTotal, formatWeight, type Transaction, type Product } from '../services/db';
import { getOutstandingTotal } from '../services/utang';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from 'recharts';

export function DashboardScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('all');
  const [topSortBy, setTopSortBy] = useState<'qty' | 'rev'>('qty');
  const [outstandingUtang, setOutstandingUtang] = useState(0);
  // 'Today' is a moving target: captured once at mount, the dashboard kept
  // showing yesterday's range if the app was left open overnight.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    const onFocus = () => setNow(new Date());
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const txs = await getAllTransactions();
      const prods = await getAllProducts();
      setTransactions(txs);
      setProducts(prods);
      setOutstandingUtang(await getOutstandingTotal());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(loadData);
  }, [loadData, refreshKey]);

  // Product cost map for profit calculation
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.id, p.cost);
    }
    return map;
  }, [products]);

  // Filter transactions by date range
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const txDate = new Date(t.createdAt);
      if (dateRange === 'today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return txDate >= startOfToday;
      }
      if (dateRange === '7d') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return txDate >= sevenDaysAgo;
      }
      if (dateRange === '30d') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return txDate >= thirtyDaysAgo;
      }
      return true;
    });
  }, [transactions, dateRange, now]);

  // Active (non-voided) transactions for metrics
  const activeTransactions = useMemo(() => {
    return filteredTransactions.filter(t => !t.voided);
  }, [filteredTransactions]);

  // Calculate business intelligence metrics
  const totalRevenue = useMemo(() => {
    return activeTransactions.reduce((sum, t) => sum + t.total, 0);
  }, [activeTransactions]);

  const totalCost = useMemo(() => {
    return activeTransactions.reduce((sum, t) => {
      let txCost = 0;
      for (const item of t.items) {
        const unitCost = productCostMap.get(item.productId) ?? 0;
        txCost += unitCost * item.quantity;
      }
      return sum + txCost;
    }, 0);
  }, [activeTransactions, productCostMap]);

  const totalProfit = totalRevenue - totalCost;
  const profitMarginPercent = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';
  const totalTransactionsCount = activeTransactions.length;
  const averageTransaction = totalTransactionsCount > 0 ? totalRevenue / totalTransactionsCount : 0;
  const lowStockProducts = products.filter(p => !p.soldByWeight && p.stock <= 5);

  // Daily sales aggregation for chart
  const chartData = useMemo(() => {
    const map: Record<string, { date: string; revenue: number; timestamp: number }> = {};
    for (const t of activeTransactions) {
      const d = new Date(t.createdAt);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayTimestamp = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

      if (!map[key]) {
        map[key] = { date: key, revenue: 0, timestamp: dayTimestamp };
      }
      map[key].revenue += t.total / 100;
    }
    return Object.values(map).sort((a, b) => a.timestamp - b.timestamp);
  }, [activeTransactions]);

  // Top products aggregation
  const topProductsData = useMemo(() => {
    const map: Record<string, { name: string; qty: number; rev: number }> = {};
    for (const t of activeTransactions) {
      for (const item of t.items) {
        if (!map[item.productId]) {
          map[item.productId] = { name: item.name, qty: 0, rev: 0 };
        }
        map[item.productId].qty += item.quantity;
        map[item.productId].rev += lineTotal(item) / 100;
      }
    }
    return Object.values(map)
      .sort((a, b) => (topSortBy === 'qty' ? b.qty - a.qty : b.rev - a.rev))
      .slice(0, 5);
  }, [activeTransactions, topSortBy]);

  // Export transactions to CSV
  const exportToCSV = () => {
    if (transactions.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const headers = ['Transaction ID', 'Date & Time', 'Status', 'Total (PHP)', 'Items Count', 'Details'];
    const rows = transactions.map(t => {
      const dateStr = new Date(t.createdAt).toLocaleString('en-PH');
      const status = t.voided ? 'VOIDED' : 'COMPLETED';
      const totalPhp = (t.total / 100).toFixed(2);
      const itemsCount = t.items.reduce((s, i) => s + (i.soldByWeight ? 1 : i.quantity), 0);
      const itemsDetail = t.items.map(i => `${i.soldByWeight ? formatWeight(i.quantity) : `${i.quantity}x`} ${i.name} (P${(i.price / 100).toFixed(2)})`).join('; ');

      return [
        `"${t.id}"`,
        `"${dateStr}"`,
        `"${status}"`,
        `"${totalPhp}"`,
        `"${itemsCount}"`,
        `"${itemsDetail.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `tindahan_sales_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center pb-20">
        <p className="text-slate-400">Loading analytics...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 pb-32 overflow-y-auto bg-slate-50">
      <header className="p-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard & Analytics</h1>
          <p className="text-sm text-slate-500">Real-time profit, sales trends, and inventory health</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportToCSV}
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
          >
            📥 Export CSV
          </button>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            disabled={loading}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      <div className="p-4 space-y-6 max-w-7xl mx-auto">
        {/* Date Range Selector */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Time Range:</span>
          <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-bold">
            {(['today', '7d', '30d', 'all'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 rounded-lg transition capitalize ${
                  dateRange === range ? 'bg-white shadow text-slate-900' : 'text-slate-600'
                }`}
              >
                {range === 'all' ? 'All Time' : range === 'today' ? 'Today' : `Last ${range}`}
              </button>
            ))}
          </div>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Revenue</p>
            <p className="text-3xl font-extrabold text-emerald-600 mt-1">{formatPeso(totalRevenue)}</p>
            <p className="text-xs text-slate-500 mt-1">{totalTransactionsCount} completed sales</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Gross Profit</p>
            <p className="text-3xl font-extrabold text-amber-600 mt-1">{formatPeso(totalProfit)}</p>
            <p className="text-xs text-amber-700 font-bold mt-1">
              {profitMarginPercent}% margin
            </p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Average Basket</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-1">{formatPeso(averageTransaction)}</p>
            <p className="text-xs text-slate-500 mt-1">Per transaction average</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Low Stock Alerts</p>
            <p className={`text-3xl font-extrabold mt-1 ${lowStockProducts.length > 0 ? 'text-red-700' : 'text-slate-900'}`}>
              {lowStockProducts.length}
            </p>
            <p className="text-xs text-slate-500 mt-1">Products with ≤ 5 units</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
            <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">Outstanding Utang</p>
            <p className={`text-3xl font-extrabold mt-1 ${outstandingUtang > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {formatPeso(outstandingUtang)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Sold on credit, not yet collected</p>
          </div>
        </div>

        {/* Sales Trend Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-4">Sales Trend (Revenue over Time)</h2>
          {chartData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₱${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: any) => [`₱${Number(value || 0).toFixed(2)}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              No sales recorded for this date range yet.
            </div>
          )}
        </div>

        {/* Two-Column Grid: Top Products & Low Stock */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Selling Products */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h2 className="text-base font-bold text-slate-900">Top 5 Best-Selling Products</h2>
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setTopSortBy('qty')}
                  className={`px-2.5 py-1 rounded-md transition ${topSortBy === 'qty' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-500'}`}
                >
                  By Quantity
                </button>
                <button
                  onClick={() => setTopSortBy('rev')}
                  className={`px-2.5 py-1 rounded-md transition ${topSortBy === 'rev' ? 'bg-white shadow text-slate-900 font-bold' : 'text-slate-500'}`}
                >
                  By Revenue
                </button>
              </div>
            </div>
            {topProductsData.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProductsData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#334155' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      formatter={(value: any) => [
                        topSortBy === 'qty' ? `${value} units` : `₱${Number(value || 0).toFixed(2)}`,
                        topSortBy === 'qty' ? 'Units Sold' : 'Revenue',
                      ]}
                    />
                    <Bar dataKey={topSortBy === 'qty' ? 'qty' : 'rev'} fill="#f59e0b" radius={[0, 8, 8, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                No product sales data yet.
              </div>
            )}
          </div>

          {/* Low Stock Watchlist */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center justify-between">
              <span>⚠️ Low Stock Watchlist</span>
              <span className="text-xs font-normal text-slate-400">Stock ≤ 5</span>
            </h2>
            {lowStockProducts.length > 0 ? (
              <div className="overflow-y-auto max-h-64 space-y-2 pr-1">
                {lowStockProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-center p-3 bg-red-50/50 border border-red-100 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500">₱{(p.price / 100).toFixed(2)} · {p.category || 'Uncategorized'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-1 text-xs font-black rounded-lg ${
                        p.soldByWeight ? 'bg-emerald-100 text-emerald-700' : p.stock <= 0 ? 'bg-red-600 text-white' : 'bg-red-100 text-red-700'
                      }`}>
                        {p.soldByWeight ? 'per kg' : p.stock <= 0 ? 'Out of Stock' : `${p.stock} left`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <span className="text-3xl mb-2">🎉</span>
                <p className="text-sm font-medium text-slate-600">All products are well stocked!</p>
                <p className="text-xs text-slate-400 mt-1">No items currently below 5 units.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
