import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  Droplets, TrendingUp, DollarSign, Users,
  Package, ArrowUpRight, CalendarDays, Wheat,
} from 'lucide-react';
import api from '../../api/client';
import { StatCard, Skeleton, PageHeader } from '../../components/ui';
import { format, subMonths } from 'date-fns';

const COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899'];

const fmt = n => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const fmtPKR = n => `Rs ${fmt(n)}`;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#d1dce8] rounded-xl px-4 py-3 text-xs space-y-1 shadow-xl">
      <p className="text-slate-400 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">
          {p.name}: {typeof p.value === 'number' && p.value > 999 ? fmtPKR(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [month, setMonth]     = useState(format(new Date(), 'yyyy-MM'));

  useEffect(() => {
    setLoading(true);
    api.get(`/dashboard?month=${month}`)
      .then(r => setData(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  const kpi = data?.kpi || {};

  // Build combined trend data
  const trendData = (data?.milk_trend || []).map(m => {
    const sale = (data?.sales_trend || []).find(s => s.month === m.month);
    return {
      month: m.month.slice(5), // MM
      purchased: parseFloat(m.liters || 0),
      cost:      parseFloat(m.cost   || 0),
      sold:      parseFloat(sale?.liters  || 0),
      revenue:   parseFloat(sale?.revenue || 0),
    };
  });

  const expenseData = data?.bill_status?.map(b => ({
    name: b.status.charAt(0).toUpperCase() + b.status.slice(1),
    value: parseFloat(b.amount),
    count: b.count,
  })) || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Business overview and key metrics"
        action={
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-muted" />
            <input
              type="month"
              value={month}
              onChange={e => setMonth(e.target.value)}
              className="input text-sm py-1.5 w-40"
            />
          </div>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          loading={loading}
          title="Milk Purchased"
          value={`${fmt(kpi.total_liters)} L`}
          sub={`Cost: ${fmtPKR(kpi.purchase_cost)}`}
          icon={Droplets}
          color="brand"
        />
        <StatCard
          loading={loading}
          title="Sales Revenue"
          value={fmtPKR(kpi.total_revenue)}
          sub={`Received: ${fmtPKR(kpi.received)}`}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          loading={loading}
          title="Net Profit"
          value={fmtPKR(kpi.profit)}
          sub={`Margin: ${kpi.margin_pct}%`}
          icon={DollarSign}
          color={parseFloat(kpi.profit) >= 0 ? 'emerald' : 'red'}
        />
        <StatCard
          loading={loading}
          title="Active Farmers"
          value={fmt(kpi.active_farmers)}
          sub={`Avg FAT: ${parseFloat(kpi.avg_fat || 0).toFixed(1)}%`}
          icon={Users}
          color="purple"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Expenses',  val: fmtPKR(kpi.total_expenses), icon: Package,     color: 'amber' },
          { label: 'Sold Liters',     val: `${fmt(kpi.sold_liters)} L`, icon: ArrowUpRight, color: 'brand' },
          { label: 'Avg SNF',         val: `${parseFloat(kpi.avg_snf || 0).toFixed(1)}%`,  icon: Wheat,    color: 'emerald' },
        ].map(({ label, val, icon: Icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="card flex items-center gap-4"
          >
            {loading
              ? <div className="skeleton w-full h-8" />
              : <>
                  <Icon size={20} className={`text-${color}-400`} />
                  <div>
                    <p className="text-xs text-muted">{label}</p>
                    <p className="font-bold text-slate-800">{val}</p>
                  </div>
                </>
            }
          </motion.div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Milk vs Sales trend */}
        <div className="card xl:col-span-2">
          <h3 className="font-semibold text-slate-700 mb-4">6-Month Milk Trend (Litres)</h3>
          {loading
            ? <Skeleton className="h-52 w-full" />
            : (
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={trendData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPurch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={50} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Area type="monotone" dataKey="purchased" name="Purchased (L)" stroke="#0ea5e9" fill="url(#gradPurch)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="sold"      name="Sold (L)"      stroke="#10b981" fill="url(#gradSold)"  strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Bill status pie */}
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Bill Status</h3>
          {loading
            ? <Skeleton className="h-52 w-full" />
            : expenseData.length ? (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie
                    data={expenseData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                    paddingAngle={3} dataKey="value"
                  >
                    {expenseData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={v => fmtPKR(v)} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-52 text-muted text-sm">No bills yet</div>
            )
          }
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue vs Cost bar */}
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Revenue vs Purchase Cost (PKR)</h3>
          {loading
            ? <Skeleton className="h-48 w-full" />
            : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                  <Bar dataKey="revenue" name="Revenue" fill="#10b981" radius={[4,4,0,0]} maxBarSize={28} />
                  <Bar dataKey="cost"    name="Cost"    fill="#0ea5e9" radius={[4,4,0,0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            )
          }
        </div>

        {/* Top farmers */}
        <div className="card">
          <h3 className="font-semibold text-slate-700 mb-4">Top Farmers by Volume</h3>
          {loading
            ? <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            : (data?.top_farmers?.length ? (
              <div className="space-y-3">
                {data.top_farmers.map((f, i) => {
                  const max = parseFloat(data.top_farmers[0]?.liters || 1);
                  const pct = (parseFloat(f.liters) / max) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-muted w-4 text-right font-mono">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600 font-medium">{f.name}</span>
                          <span className="text-muted font-mono">{fmt(f.liters)} L</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ delay: i * 0.1, duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-muted font-mono w-20 text-right">{fmtPKR(f.amount)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-muted text-sm py-8">No collection records for this period</div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
