import { useState, useEffect } from 'react';
import { Shield, Clock, User, Database, Search, Filter } from 'lucide-react';
import api from '../../api/client';
import { PageHeader, SkeletonRow, EmptyState } from '../../components/ui';

const ACTION_COLOR = {
  CREATE: 'bg-emerald-100 text-emerald-700',
  UPDATE: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-600',
  LOGIN:  'bg-blue-100 text-blue-700',
  REGISTER:'bg-blue-100 text-blue-700',
};

const ACTION_LABEL = {
  CREATE:'Added', UPDATE:'Edited', DELETE:'Removed', LOGIN:'Logged In', REGISTER:'Registered',
};

const TABLES = [
  'farmers','milk_records','bills','billing_periods','expenses',
  'users','milk_sales','vehicles','shops','payroll','walkin_sales',
];

const TABLE_LABELS = {
  farmers:'Farmers', milk_records:'Milk Records', bills:'Bills',
  billing_periods:'Billing', expenses:'Expenses', users:'Users',
  milk_sales:'Sales', vehicles:'Vehicles', shops:'Shops',
  payroll:'Payroll', walkin_sales:'Shop Sales',
};

function fmtTime(ts) {
  const d = new Date(ts);
  return {
    date: d.toLocaleDateString('en-PK',{day:'2-digit',month:'short',year:'numeric'}),
    time: d.toLocaleTimeString('en-PK',{hour:'2-digit',minute:'2-digit',hour12:true}),
  };
}

export default function AuditLogs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [search, setSearch]   = useState('');
  const [filters, setFilters] = useState({ table_name:'', action:'', date_from:'', date_to:'' });
  const [expanded, setExpanded] = useState(null);

  const load = (p=page) => {
    setLoading(true);
    const clean = Object.fromEntries(Object.entries(filters).filter(([,v])=>v));
    if (search) clean.user_search = search;
    const q = new URLSearchParams({ ...clean, page:p, limit:50 }).toString();
    api.get(`/audit?${q}`)
      .then(r => { setLogs(r.data.data); setTotal(r.data.pagination?.total || 0); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  const applyFilters = () => { setPage(1); load(1); };
  const clearFilters = () => {
    setFilters({ table_name:'', action:'', date_from:'', date_to:'' });
    setSearch('');
    setPage(1);
    setTimeout(() => load(1), 50);
  };

  const pages = Math.ceil(total / 50);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit Logs" subtitle={`${total.toLocaleString()} total events — admin view only`}/>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Search by user */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-semibold text-slate-500 mb-1">Search User</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={e=>setSearch(e.target.value)}
                placeholder="Name or email…"
                className="pl-8 border border-slate-200 rounded-xl px-3 py-2 text-sm w-full focus:outline-none focus:border-[#1d6faa]"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Module</label>
            <select value={filters.table_name}
              onChange={e=>setFilters(f=>({...f,table_name:e.target.value}))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1d6faa] bg-white">
              <option value="">All Modules</option>
              {TABLES.map(t=><option key={t} value={t}>{TABLE_LABELS[t]||t}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Action</label>
            <select value={filters.action}
              onChange={e=>setFilters(f=>({...f,action:e.target.value}))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1d6faa] bg-white">
              <option value="">All Actions</option>
              {['CREATE','UPDATE','DELETE','LOGIN'].map(a=><option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">From</label>
            <input type="date" value={filters.date_from}
              onChange={e=>setFilters(f=>({...f,date_from:e.target.value}))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1d6faa]"/>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">To</label>
            <input type="date" value={filters.date_to}
              onChange={e=>setFilters(f=>({...f,date_to:e.target.value}))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1d6faa]"/>
          </div>

          <button onClick={applyFilters}
            className="flex items-center gap-2 px-5 py-2 bg-[#1d6faa] text-white rounded-xl text-sm font-semibold hover:bg-[#1557a0] transition">
            <Filter size={14}/> Filter
          </button>
          <button onClick={clearFilters}
            className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-sm font-semibold hover:border-slate-400 transition">
            Clear
          </button>
        </div>
      </div>

      {/* ── Log cards ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left">When</th>
                <th className="px-5 py-3 text-left">Who</th>
                <th className="px-5 py-3 text-left">What</th>
                <th className="px-5 py-3 text-left">Module</th>
                <th className="px-5 py-3 text-left">Record</th>
                <th className="px-5 py-3 text-left">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading
                ? [...Array(10)].map((_,i)=><SkeletonRow key={i} cols={6}/>)
                : logs.length === 0
                  ? <tr><td colSpan={6}>
                      <EmptyState icon={Shield} title="No audit logs" description="User actions will appear here"/>
                    </td></tr>
                  : logs.map((l,i) => {
                    const t = fmtTime(l.created_at);
                    const isOpen = expanded === l.id;
                    return (
                      <tr key={l.id} className={i%2===0?'bg-white':'bg-slate-50/30'}>

                        {/* When */}
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-slate-300"/>
                            <div>
                              <p className="font-mono text-xs text-slate-700 font-semibold">{t.time}</p>
                              <p className="text-xs text-slate-400">{t.date}</p>
                            </div>
                          </div>
                        </td>

                        {/* Who */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1d6faa]/10 flex items-center justify-center">
                              <User size={12} className="text-[#1d6faa]"/>
                            </div>
                            <div>
                              <p className="font-semibold text-slate-700 text-xs">{l.user_name || 'System'}</p>
                              <p className="text-slate-400 text-xs">{l.user_email || '—'}</p>
                            </div>
                          </div>
                        </td>

                        {/* What */}
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${ACTION_COLOR[l.action]||'bg-slate-100 text-slate-600'}`}>
                            {ACTION_LABEL[l.action] || l.action}
                          </span>
                        </td>

                        {/* Module */}
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <Database size={12} className="text-slate-300"/>
                            <span className="font-mono text-xs text-[#1d6faa] font-semibold">
                              {TABLE_LABELS[l.table_name] || l.table_name}
                            </span>
                          </div>
                        </td>

                        {/* Record ID */}
                        <td className="px-5 py-3">
                          <span className="font-mono text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">
                            #{l.record_id}
                          </span>
                        </td>

                        {/* Changes diff */}
                        <td className="px-5 py-3">
                          {(l.new_values || l.old_values) ? (
                            <button
                              onClick={() => setExpanded(isOpen ? null : l.id)}
                              className="text-xs text-[#1d6faa] hover:underline font-medium"
                            >
                              {isOpen ? 'Hide' : 'View diff'}
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                          {isOpen && (
                            <pre className="mt-2 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-xl p-3 max-w-xs overflow-auto leading-relaxed">
                              {JSON.stringify(
                                JSON.parse(l.new_values || l.old_values || '{}'),
                                null, 2
                              )}
                            </pre>
                          )}
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-400">
              Showing {((page-1)*50)+1}–{Math.min(page*50,total)} of {total.toLocaleString()} events
            </span>
            <div className="flex gap-1">
              {[...Array(Math.min(pages,5))].map((_,i) => {
                const pg = i+1;
                return (
                  <button key={pg} onClick={()=>setPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition
                      ${page===pg ? 'bg-[#1d6faa] text-white' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {pg}
                  </button>
                );
              })}
              {pages > 5 && page < pages && (
                <button onClick={()=>setPage(pages)}
                  className="px-3 h-8 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100">
                  …{pages}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
