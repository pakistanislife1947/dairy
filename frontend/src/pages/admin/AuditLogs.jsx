import { useState, useEffect, useRef } from 'react';
import {
  Shield, Clock, User, Filter, Search, ChevronDown, ChevronUp,
  Plus, Pencil, Trash2, LogIn, RefreshCw, AlertCircle
} from 'lucide-react';
import api from '../../api/client';
import { PageHeader } from '../../components/ui';

const ACTION_META = {
  CREATE:   { label:'Added',    color:'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Plus },
  UPDATE:   { label:'Edited',   color:'bg-amber-100 text-amber-700 border-amber-200',       icon: Pencil },
  DELETE:   { label:'Deleted',  color:'bg-red-100 text-red-600 border-red-200',             icon: Trash2 },
  LOGIN:    { label:'Logged In',color:'bg-blue-100 text-blue-700 border-blue-200',          icon: LogIn },
  LOGOUT:   { label:'Logged Out',color:'bg-slate-100 text-slate-600 border-slate-200',      icon: LogIn },
  REGISTER: { label:'Registered',color:'bg-violet-100 text-violet-700 border-violet-200',   icon: Plus },
};

const MODULE_LABELS = {
  milk_records:'Milk Collection', farmers:'Collection Centre', milk_sales:'Sales',
  walkin_sales:'Shop Sales', expenses:'Expenses', bills:'Bills',
  billing_periods:'Billing', payroll:'Payroll', users:'Users',
  shops:'Shops', vehicles:'Vehicles', customers:'Customers', products:'Products',
};

const MODULES = Object.keys(MODULE_LABELS);

function timeAgo(ts) {
  const sec = Math.floor((Date.now() - new Date(ts)) / 1000);
  if (sec < 60)   return 'just now';
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  if (sec < 86400)return `${Math.floor(sec/3600)}h ago`;
  return `${Math.floor(sec/86400)}d ago`;
}

function fmtFull(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-PK',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true});
}

function InitialBadge({ name }) {
  const colors = ['bg-[#1d6faa]','bg-emerald-500','bg-violet-500','bg-amber-500','bg-pink-500'];
  const idx    = (name?.charCodeAt(0) || 0) % colors.length;
  return (
    <div className={`w-8 h-8 rounded-full ${colors[idx]} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

function DiffTable({ diff }) {
  if (!diff?.length) return <p className="text-slate-400 text-xs">No field-level changes recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-100 text-slate-500 uppercase text-[10px] tracking-wide">
            <th className="px-3 py-2 text-left rounded-tl-lg">Field</th>
            <th className="px-3 py-2 text-left text-red-500">Before</th>
            <th className="px-3 py-2 text-left text-emerald-600 rounded-tr-lg">After</th>
          </tr>
        </thead>
        <tbody>
          {diff.map((r, i) => (
            <tr key={i} className={i%2===0?'bg-white':'bg-slate-50/60'}>
              <td className="px-3 py-2 font-semibold text-slate-600 capitalize">{r.field}</td>
              <td className="px-3 py-2 font-mono text-red-500 line-through">
                {r.old === null ? <span className="text-slate-300 no-underline" style={{textDecoration:'none'}}>—</span> : String(r.old)}
              </td>
              <td className="px-3 py-2 font-mono text-emerald-600 font-semibold">
                {r.new === null ? <span className="text-slate-300">—</span> : String(r.new)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogRow({ log }) {
  const [open, setOpen] = useState(false);
  const meta     = ACTION_META[log.action] || ACTION_META.UPDATE;
  const ActionIcon = meta.icon;
  const hasDiff  = log.diff?.length > 0;

  return (
    <div className="border-b border-slate-50 last:border-0">
      <div
        className={`flex items-start gap-3 px-5 py-4 hover:bg-slate-50/60 transition ${hasDiff ? 'cursor-pointer' : ''}`}
        onClick={() => hasDiff && setOpen(o => !o)}
      >
        {/* Avatar */}
        <InitialBadge name={log.user_name}/>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-slate-800 text-sm">{log.user_name || 'System'}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold border ${meta.color}`}>
              <ActionIcon size={10}/>{meta.label}
            </span>
            {log.table_name && (
              <span className="text-xs bg-slate-100 text-[#1d6faa] font-semibold px-2 py-0.5 rounded-lg">
                {MODULE_LABELS[log.table_name] || log.table_name}
              </span>
            )}
            {log.record_id && (
              <span className="text-xs text-slate-400 font-mono">#{log.record_id}</span>
            )}
          </div>

          {/* Human sentence */}
          <p className="text-sm text-slate-600 leading-snug">{log.sentence}</p>

          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock size={10}/>{fmtFull(log.created_at)}
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{timeAgo(log.created_at)}</span>
            {log.user_email && (
              <>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">{log.user_email}</span>
              </>
            )}
            {log.ip_address && (
              <>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400 font-mono">IP: {log.ip_address}</span>
              </>
            )}
            {hasDiff && (
              <span className="text-xs text-[#1d6faa] font-semibold flex items-center gap-0.5 ml-auto">
                {open ? <><ChevronUp size={11}/>Hide changes</> : <><ChevronDown size={11}/>{log.diff.length} field{log.diff.length>1?'s':''} changed</>}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Diff panel */}
      {open && hasDiff && (
        <div className="px-5 pb-4 pt-0 ml-11">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
            <DiffTable diff={log.diff}/>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditLogs() {
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ table_name:'', action:'', date_from:'', date_to:'' });
  const [spinning, setSpinning] = useState(false);
  const debounce = useRef(null);

  const load = (p = 1, f = filters, s = search) => {
    setLoading(true);
    const clean = Object.fromEntries(Object.entries(f).filter(([,v]) => v));
    if (s) clean.user_search = s;
    const q = new URLSearchParams({ ...clean, page: p, limit: 50 }).toString();
    api.get(`/audit?${q}`)
      .then(r => { setLogs(r.data.data || []); setTotal(r.data.pagination?.total || 0); })
      .catch(() => {})
      .finally(() => { setLoading(false); setSpinning(false); });
  };

  useEffect(() => { load(1); }, []);

  // Debounced search
  const handleSearch = val => {
    setSearch(val);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => { setPage(1); load(1, filters, val); }, 500);
  };

  const applyFilters = () => { setPage(1); load(1, filters, search); };

  const clearAll = () => {
    const f = { table_name:'', action:'', date_from:'', date_to:'' };
    setFilters(f); setSearch(''); setPage(1); load(1, f, '');
  };

  const refresh = () => { setSpinning(true); load(page, filters, search); };

  const goPage = p => { setPage(p); load(p, filters, search); };
  const pages  = Math.ceil(total / 50);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Audit Logs"
          subtitle={`${total.toLocaleString()} total events · admin only`}
        />
        <button onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-[#1d6faa] hover:text-[#1d6faa] transition shadow-sm">
          <RefreshCw size={14} className={spinning ? 'animate-spin' : ''}/>Refresh
        </button>
      </div>

      {/* ── Filters ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">

          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Search by user</label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={e => handleSearch(e.target.value)}
                placeholder="Name or email…"
                className="pl-8 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1d6faa]"/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Module</label>
            <select value={filters.table_name} onChange={e => setFilters(f => ({...f,table_name:e.target.value}))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1d6faa]">
              <option value="">All Modules</option>
              {MODULES.map(t => <option key={t} value={t}>{MODULE_LABELS[t]}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">Action</label>
            <select value={filters.action} onChange={e => setFilters(f => ({...f,action:e.target.value}))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#1d6faa]">
              <option value="">All Actions</option>
              {Object.entries(ACTION_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">From</label>
            <input type="date" value={filters.date_from} onChange={e => setFilters(f => ({...f,date_from:e.target.value}))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1d6faa]"/>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">To</label>
            <input type="date" value={filters.date_to} onChange={e => setFilters(f => ({...f,date_to:e.target.value}))}
              className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#1d6faa]"/>
          </div>

          <div className="flex gap-2">
            <button onClick={applyFilters}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1d6faa] text-white rounded-xl text-sm font-semibold hover:bg-[#1557a0] transition">
              <Filter size={13}/>Apply
            </button>
            <button onClick={clearAll}
              className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-sm font-semibold hover:border-slate-300 transition">
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* ── Feed ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* Stats bar */}
        <div className="flex items-center gap-4 px-5 py-3 bg-slate-50 border-b border-slate-100 text-xs text-slate-400">
          {Object.entries(ACTION_META).slice(0,4).map(([k,v]) => {
            const count = logs.filter(l => l.action === k).length;
            if (!count) return null;
            return (
              <span key={k} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold border ${v.color}`}>
                {count} {v.label}
              </span>
            );
          })}
          <span className="ml-auto">{logs.length} shown of {total.toLocaleString()}</span>
        </div>

        {loading ? (
          <div className="space-y-0 divide-y divide-slate-50">
            {[...Array(8)].map((_,i) => (
              <div key={i} className="flex items-start gap-3 px-5 py-4 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0"/>
                <div className="flex-1 space-y-2 pt-1">
                  <div className="flex gap-2">
                    <div className="h-3 w-24 bg-slate-100 rounded-full"/>
                    <div className="h-3 w-16 bg-slate-100 rounded-full"/>
                  </div>
                  <div className="h-3 w-64 bg-slate-100 rounded-full"/>
                  <div className="h-2.5 w-40 bg-slate-100 rounded-full"/>
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle size={32} className="text-slate-200 mb-3"/>
            <p className="font-semibold text-slate-400">No activity found</p>
            <p className="text-xs text-slate-300 mt-1">Try clearing filters or expanding the date range</p>
          </div>
        ) : (
          <div>
            {logs.map(log => <LogRow key={log.id} log={log}/>)}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50">
            <span className="text-xs text-slate-400">
              Page {page} of {pages} · {total.toLocaleString()} total events
            </span>
            <div className="flex gap-1">
              {page > 1 && (
                <button onClick={() => goPage(page-1)}
                  className="px-3 h-8 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition">
                  ← Prev
                </button>
              )}
              {[...Array(Math.min(pages, 7))].map((_, i) => {
                const pg = i + 1;
                return (
                  <button key={pg} onClick={() => goPage(pg)}
                    className={`w-8 h-8 rounded-lg text-xs font-semibold transition
                      ${page===pg ? 'bg-[#1d6faa] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
                    {pg}
                  </button>
                );
              })}
              {page < pages && (
                <button onClick={() => goPage(page+1)}
                  className="px-3 h-8 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 transition">
                  Next →
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
