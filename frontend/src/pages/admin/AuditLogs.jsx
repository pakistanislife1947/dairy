import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';
import api from '../../api/client';
import { PageHeader, SkeletonRow, EmptyState } from '../../components/ui';

const ACTION_BADGE = {
  CREATE:   'badge-green',
  UPDATE:   'badge-yellow',
  DELETE:   'badge-red',
  LOGIN:    'badge-blue',
  REGISTER: 'badge-blue',
};

const TABLES = ['farmers','milk_records','bills','billing_periods','expenses','users','milk_sales','vehicles','shops','payroll'];

export default function AuditLogs() {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [filters, setFilters] = useState({ table_name: '', date_from: '', date_to: '' });

  const load = () => {
    setLoading(true);
    const clean = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''));
    const q = new URLSearchParams({ ...clean, page, limit: 50 }).toString();
    api.get(`/audit?${q}`)
      .then(r => { setLogs(r.data.data); setTotal(r.data.pagination.total); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        subtitle={`${total.toLocaleString()} total events tracked`}
      />

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Table</label>
          <select className="input" value={filters.table_name}
            onChange={e => setFilters(f => ({ ...f, table_name: e.target.value }))}>
            <option value="">All Tables</option>
            {TABLES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">From</label>
          <input type="date" className="input" value={filters.date_from}
            onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
        </div>
        <div>
          <label className="label">To</label>
          <input type="date" className="input" value={filters.date_to}
            onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
        </div>
        <button onClick={() => { setPage(1); load(); }} className="btn-primary">Filter</button>
        <button onClick={() => { setFilters({ table_name:'', date_from:'', date_to:'' }); setPage(1); }} className="btn-ghost">Clear</button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-auto w-full">
            <thead>
              <tr><th>Time</th><th>User</th><th>Action</th><th>Table</th><th>Record</th><th>Changes</th></tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(10)].map((_, i) => <SkeletonRow key={i} cols={6} />)
                : logs.length === 0
                  ? <tr><td colSpan={6}>
                      <EmptyState icon={Shield} title="No audit logs" description="Actions will appear here as users interact with the system" />
                    </td></tr>
                  : logs.map((l, i) => (
                    <motion.tr key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}>
                      <td className="font-mono text-xs text-muted whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString('en-PK', { dateStyle:'short', timeStyle:'short' })}
                      </td>
                      <td>
                        <div className="text-sm text-slate-300 font-medium">{l.user_name || 'System/Trigger'}</div>
                        <div className="text-xs text-muted">{l.user_email}</div>
                      </td>
                      <td>
                        <span className={ACTION_BADGE[l.action] || 'badge-gray'}>
                          {l.action}
                        </span>
                      </td>
                      <td><span className="font-mono text-xs text-brand-400">{l.table_name}</span></td>
                      <td><span className="font-mono text-xs text-muted">#{l.record_id}</span></td>
                      <td>
                        {(l.new_values || l.old_values) && (
                          <details className="text-xs">
                            <summary className="text-muted cursor-pointer hover:text-slate-300 select-none">
                              View diff
                            </summary>
                            <pre className="mt-1 text-slate-400 text-xs max-w-xs overflow-auto bg-slate-800/80 rounded-lg p-2 border border-border">
                              {JSON.stringify(
                                JSON.parse(l.new_values || l.old_values || '{}'),
                                null, 2
                              )}
                            </pre>
                          </details>
                        )}
                      </td>
                    </motion.tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {Math.ceil(total / 50) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted">Page {page} of {Math.ceil(total / 50)}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-ghost text-xs px-3 py-1.5">Prev</button>
              <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)} className="btn-ghost text-xs px-3 py-1.5">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
