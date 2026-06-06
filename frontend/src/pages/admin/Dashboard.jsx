import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, ShoppingCart, Package, Milk, Users, ChevronDown, ChevronUp,
  Calendar, RefreshCw, Store, Truck, Droplets, TrendingDown
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';

const fmt    = n  => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;
const fmtL   = n  => `${Number(n||0).toFixed(1)} L`;
const fmtPct = n  => `${Number(n||0).toFixed(1)}%`;
const today  = ()  => new Date().toLocaleDateString('en-PK',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

const TENURES = [
  { key:'1d',  label:'Today' },
  { key:'7d',  label:'7 Days' },
  { key:'30d', label:'30 Days' },
  { key:'custom', label:'Custom' },
];

/* ── Skeleton ─────────────────────────────────────────────────────── */
const Skeleton = ({ h='h-28', cls='' }) => (
  <div className={`animate-pulse bg-gradient-to-r from-slate-100 to-slate-200 rounded-2xl ${h} ${cls}`}/>
);

/* ── Stat Card ────────────────────────────────────────────────────── */
function StatCard({ label, value, sub, icon: Icon, color, trend, expandable, expanded, onToggle, children }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-5 transition-all duration-200
        ${expandable ? 'cursor-pointer hover:shadow-md hover:border-slate-200' : ''}`}
      onClick={expandable ? onToggle : undefined}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.bg}`}>
          <Icon size={18} className={color.text}/>
        </div>
      </div>
      <p className={`text-2xl font-bold font-mono ${color.val || 'text-slate-800'}`}>{value}</p>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-slate-400">{sub}</p>
        {expandable && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            Details {expanded ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
          </span>
        )}
      </div>
      {expandable && expanded && (
        <div className="mt-4 border-t border-slate-100 pt-4 space-y-2" onClick={e=>e.stopPropagation()}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── Custom tooltip ───────────────────────────────────────────────── */
const CustomTooltip = ({ active, payload, label, unit='' }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-600 mb-1">{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{color:p.color}} className="font-mono">
          {p.name}: {unit === 'Rs' ? fmt(p.value) : `${Number(p.value).toFixed(1)}${unit}`}
        </p>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const { user } = useAuthStore();
  const [tenure, setTenure]         = useState('1d');
  const [dateFrom, setDateFrom]     = useState('');
  const [dateTo, setDateTo]         = useState('');
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stockOpen, setStockOpen]   = useState(false);
  const [purchOpen, setPurchOpen]   = useState(false);

  const load = useCallback(async (t, df, dt) => {
    try {
      setRefreshing(true);
      let url = `/dashboard?tenure=${t}`;
      if (t === 'custom' && df && dt) url += `&date_from=${df}&date_to=${dt}`;
      const res = await api.get(url);
      setData(res.data.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(tenure, dateFrom, dateTo); }, []);

  const handleTenure = (t) => {
    setTenure(t);
    if (t !== 'custom') load(t, '', '');
  };
  const applyCustom = () => { if (dateFrom && dateTo) load('custom', dateFrom, dateTo); };

  const kpi          = data?.kpi || {};
  const shopStock    = data?.shop_stock || [];
  const purchases    = data?.purchase_breakdown || [];
  const milkTrend    = data?.milk_trend || [];
  const salesTrend   = data?.sales_trend || [];
  const topFarmers   = data?.top_farmers || [];
  const period       = data?.period || {};

  // Merge trends for combo chart
  const trendData = milkTrend.map(m => {
    const s = salesTrend.find(x => x.month === m.month) || {};
    return { month: m.month?.slice(5) || m.month, collected: +m.liters||0, sold: +s.liters||0 };
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  if (loading) return (
    <div className="space-y-6 p-1">
      <Skeleton h="h-20"/>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_,i)=><Skeleton key={i}/>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_,i)=><Skeleton key={i} h="h-56"/>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Welcome header ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#1d6faa] to-[#1557a0] rounded-2xl p-6 text-white shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-blue-200 text-sm font-medium">{greeting} 👋</p>
            <h1 className="text-2xl font-bold mt-0.5">
              Welcome Back, {user?.name || user?.username || 'Admin'}!
            </h1>
            <p className="text-blue-200 text-sm mt-1 flex items-center gap-1.5">
              <Calendar size={13}/>{today()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 text-center border border-white/20">
              <p className="text-xs text-blue-200">Period</p>
              <p className="font-semibold text-sm">
                {period.from === period.to ? period.from : `${period.from} → ${period.to}`}
              </p>
            </div>
            <button
              onClick={() => load(tenure, dateFrom, dateTo)}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition border border-white/20"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tenure Selector ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {TENURES.map(t => (
          <button key={t.key}
            onClick={() => handleTenure(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border
              ${tenure === t.key
                ? 'bg-[#1d6faa] text-white border-[#1d6faa] shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-[#1d6faa] hover:text-[#1d6faa]'}`}
          >
            {t.label}
          </button>
        ))}
        {tenure === 'custom' && (
          <div className="flex items-center gap-2 ml-1">
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1d6faa]"/>
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1d6faa]"/>
            <button onClick={applyCustom}
              className="px-4 py-2 bg-[#1d6faa] text-white rounded-xl text-sm font-semibold hover:bg-[#1557a0] transition">
              Apply
            </button>
          </div>
        )}
      </div>

      {/* ── 3 Main KPI Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

        {/* Total Sales */}
        <StatCard
          label="Total Sales"
          value={fmt(kpi.total_revenue)}
          sub={`${fmtL(kpi.sold_liters)} sold · ${kpi.transactions || 0} txns`}
          icon={TrendingUp}
          color={{ bg:'bg-emerald-50', text:'text-emerald-600', val:'text-emerald-700' }}
        />

        {/* Total Purchase — expandable */}
        <StatCard
          label="Total Purchase"
          value={fmt(kpi.purchase_cost)}
          sub={`${fmtL(kpi.total_liters)} collected from ${kpi.active_farmers || 0} farmers`}
          icon={Truck}
          color={{ bg:'bg-blue-50', text:'text-[#1d6faa]' }}
          expandable
          expanded={purchOpen}
          onToggle={() => setPurchOpen(p=>!p)}
        >
          {purchases.length === 0
            ? <p className="text-slate-400 text-xs">No purchase data in this period.</p>
            : purchases.map((p,i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                <div>
                  <p className="font-semibold text-slate-700">{p.farmer_name}</p>
                  <p className="text-slate-400">{p.location} · FAT: {fmtPct(p.avg_fat)}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-semibold text-slate-700">{fmtL(p.liters)}</p>
                  <p className="text-slate-400">{fmt(p.amount)}</p>
                </div>
              </div>
            ))
          }
        </StatCard>

        {/* Stock Left — expandable */}
        <StatCard
          label="Stock Left"
          value={fmtL(kpi.stock_liters)}
          sub="Total remaining across all shops"
          icon={Package}
          color={{ bg:'bg-amber-50', text:'text-amber-600', val: parseFloat(kpi.stock_liters) < 50 ? 'text-red-600' : 'text-amber-700' }}
          expandable
          expanded={stockOpen}
          onToggle={() => setStockOpen(p=>!p)}
        >
          {shopStock.length === 0
            ? <p className="text-slate-400 text-xs">No shop data available.</p>
            : shopStock.map((s,i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Store size={12} className="text-amber-600"/>
                  </div>
                  <p className="font-semibold text-slate-700">{s.shop_name}</p>
                </div>
                <p className="font-mono font-semibold text-slate-700">{fmtL(s.sold_liters)} sold</p>
              </div>
            ))
          }
        </StatCard>
      </div>

      {/* ── Secondary KPIs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Net Profit</p>
          <p className={`text-xl font-bold font-mono ${parseFloat(kpi.profit)>=0?'text-emerald-600':'text-red-500'}`}>
            {fmt(kpi.profit)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Margin: {fmtPct(kpi.margin)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Expenses</p>
          <p className="text-xl font-bold font-mono text-red-500">{fmt(kpi.total_expenses)}</p>
          <p className="text-xs text-slate-400 mt-1">This period</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Avg Fat %</p>
          <p className="text-xl font-bold font-mono text-[#1d6faa]">{fmtPct(kpi.avg_fat)}</p>
          <p className="text-xs text-slate-400 mt-1">SNF: {fmtPct(kpi.avg_snf)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Received</p>
          <p className="text-xl font-bold font-mono text-violet-600">{fmt(kpi.received)}</p>
          <p className="text-xs text-slate-400 mt-1">Cash collected</p>
        </div>
      </div>

      {/* ── Charts ─────────────────────────────────────────────────── */}
      {trendData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="font-semibold text-slate-700 mb-1">Collection vs Sales (Litres)</p>
            <p className="text-xs text-slate-400 mb-4">Last 6 months trend</p>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gCollect" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1d6faa" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#1d6faa" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gSold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="month" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CustomTooltip unit=" L"/>}/>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:12}}/>
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#1d6faa" strokeWidth={2} fill="url(#gCollect)" dot={{r:3,fill:'#1d6faa'}}/>
                <Area type="monotone" dataKey="sold" name="Sold" stroke="#10b981" strokeWidth={2} fill="url(#gSold)" dot={{r:3,fill:'#10b981'}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Top farmers bar */}
          {topFarmers.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <p className="font-semibold text-slate-700 mb-1">Top Collection Centres</p>
              <p className="text-xs text-slate-400 mb-4">By litres this period</p>
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={topFarmers.map(f=>({ name:f.name.split(' ')[0], liters:+f.liters, amount:+f.amount }))} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false}/>
                  <XAxis type="number" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                  <YAxis dataKey="name" type="category" tick={{fontSize:11,fill:'#64748b'}} axisLine={false} tickLine={false} width={70}/>
                  <Tooltip content={<CustomTooltip unit=" L"/>}/>
                  <Bar dataKey="liters" name="Litres" fill="#1d6faa" radius={[0,6,6,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Quick activity / info banner ───────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-100 p-5 flex flex-wrap gap-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><Milk size={18} className="text-[#1d6faa]"/></div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Records logged</p>
            <p className="font-bold text-slate-800">{kpi.record_count || 0} entries</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><Users size={18} className="text-emerald-600"/></div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Active Farmers</p>
            <p className="font-bold text-slate-800">{kpi.active_farmers || 0}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center"><Droplets size={18} className="text-violet-600"/></div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Collected</p>
            <p className="font-bold text-slate-800">{fmtL(kpi.total_liters)}</p>
          </div>
        </div>
      </div>

    </div>
  );
}
