import { useState, useEffect } from 'react';
import { TrendingUp, Users, DollarSign, AlertCircle, Milk } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../api/client';
import { StatCard } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;
const COLORS = ['#1d6faa','#10b981','#f59e0b','#8b5cf6'];
const TYPE_LABELS = { bulk:'Bulk', household:'Household', cash:'Cash', walkin:'Walk-in' };

export default function Dashboard() {
  const [stats, setStats]   = useState(null);
  const [milk, setMilk]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/customers/stats/summary').catch(()=>({ data:{ data:{ todaySales:[], monthSales:[], bulkOutstanding:0 } } })),
      api.get('/dashboard').catch(()=>({ data:{ data:null } })),
    ]).then(([s, d]) => {
      setStats(s.data.data);
      setMilk(d.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const todayTotal  = stats?.todaySales?.reduce((s,r)=>s+parseFloat(r.total||0),0) || 0;
  const todayCount  = stats?.todaySales?.reduce((s,r)=>s+parseInt(r.cnt||0),0) || 0;
  const pieData     = stats?.todaySales?.map(r=>({ name: TYPE_LABELS[r.customer_type]||r.customer_type, value: parseFloat(r.total||0) })) || [];
  const monthData   = stats?.monthSales?.map(r=>({ month: r.month?.slice(5), revenue: parseFloat(r.total||0) })) || [];
  const bulkOuts    = parseFloat(stats?.bulkOutstanding||0);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_,i)=><div key={i} className="card animate-pulse h-28 bg-slate-100"/>)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString('en-PK',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Today's Sales</p>
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center"><TrendingUp size={18} className="text-[#1d6faa]"/></div>
          </div>
          <p className="text-2xl font-bold text-slate-800 font-mono">{fmt(todayTotal)}</p>
          <p className="text-xs text-slate-400 mt-1">{todayCount} transactions</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">This Month</p>
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center"><DollarSign size={18} className="text-emerald-600"/></div>
          </div>
          <p className="text-2xl font-bold text-slate-800 font-mono">{fmt(monthData[monthData.length-1]?.revenue||0)}</p>
          <p className="text-xs text-slate-400 mt-1">Current month revenue</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Bulk Outstanding</p>
            <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center"><AlertCircle size={18} className="text-red-500"/></div>
          </div>
          <p className="text-2xl font-bold text-red-500 font-mono">{fmt(bulkOuts)}</p>
          <p className="text-xs text-slate-400 mt-1">Unpaid bulk accounts</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Milk Collected</p>
            <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center"><Milk size={18} className="text-sky-600"/></div>
          </div>
          <p className="text-2xl font-bold text-slate-800 font-mono">{Number(milk?.kpi?.total_liters||0).toFixed(0)}L</p>
          <p className="text-xs text-slate-400 mt-1">This month</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Revenue trend */}
        <div className="card lg:col-span-2">
          <p className="font-semibold text-slate-700 mb-4">Monthly Revenue (Last 6 Months)</p>
          {monthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthData} barSize={28}>
                <XAxis dataKey="month" tick={{ fontSize:12, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}k`:v}/>
                <Tooltip formatter={v=>[fmt(v),'Revenue']} contentStyle={{ borderRadius:10, border:'1px solid #e2e8f0', fontSize:12 }}/>
                <Bar dataKey="revenue" fill="#1d6faa" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-slate-400 text-sm">No sales data yet</div>}
        </div>

        {/* Today by type */}
        <div className="card">
          <p className="font-semibold text-slate-700 mb-4">Today by Customer Type</p>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85}
                  dataKey="value" paddingAngle={3} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}
                  labelLine={false} fontSize={11}>
                  {pieData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip formatter={v=>[fmt(v)]}/>
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-52 flex items-center justify-center text-slate-400 text-sm">No sales today</div>}
        </div>
      </div>

      {/* Milk trend */}
      {milk?.milk_trend?.length > 0 && (
        <div className="card">
          <p className="font-semibold text-slate-700 mb-4">Milk Collection Trend</p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={milk.milk_trend}>
              <XAxis dataKey="month" tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize:11, fill:'#94a3b8' }} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{ borderRadius:10, border:'1px solid #e2e8f0', fontSize:12 }}/>
              <Line type="monotone" dataKey="liters" stroke="#1d6faa" strokeWidth={2} dot={{ r:4, fill:'#1d6faa' }} name="Liters"/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top farmers */}
      {milk?.top_farmers?.length > 0 && (
        <div className="card">
          <p className="font-semibold text-slate-700 mb-4">Top Collection Centres</p>
          <div className="space-y-3">
            {milk.top_farmers.map((f,i)=>(
              <div key={i} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center">{i+1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-slate-700">{f.name}</span>
                    <span className="font-mono text-slate-500">{Number(f.liters).toFixed(0)}L</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#1d6faa] rounded-full"
                      style={{ width:`${(f.liters/milk.top_farmers[0].liters)*100}%` }}/>
                  </div>
                </div>
                <span className="font-mono text-sm font-semibold text-slate-700 w-24 text-right">{fmt(f.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
