import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Receipt, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState, ConfirmDialog } from '../../components/ui';

const fmtPKR = n => `Rs ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

export default function Expenses() {
  const [expenses, setExpenses]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [delTarget, setDel]         = useState(null);
  const [filters, setFilters]       = useState({ category_id: '', date_from: '', date_to: '' });
  const { register, handleSubmit, reset } = useForm();

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== ''))
    ).toString();
    Promise.all([
      api.get(`/expenses?${q}&limit=100`),
      api.get('/expenses/categories'),
    ]).then(([e, c]) => {
      setExpenses(e.data.data);
      setCategories(c.data.data);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onExpense = async (data) => {
    setSaving(true);
    try {
      await api.post('/expenses', data);
      toast.success('Expense recorded');
      setModal(false);
      reset({});
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const deleteExpense = async () => {
    try {
      await api.delete(`/expenses/${delTarget.id}`);
      toast.success('Expense deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  const totalShown = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        subtitle="Centralized expense ledger"
        action={
          <button onClick={() => { reset({}); setModal(true); }} className="btn-primary">
            <Plus size={16} /> Add Expense
          </button>
        }
      />

      {/* Category summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {categories.slice(0, 4).map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }} className="card">
            <p className="text-xs text-muted truncate">{c.name}</p>
            <p className="font-bold text-lg font-mono text-slate-100 mt-1">{fmtPKR(c.total_spent)}</p>
            <p className="text-xs text-muted">{c.entry_count} entries</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Category</label>
          <select className="input" value={filters.category_id}
            onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        <button onClick={load} className="btn-primary">Apply</button>
        <div className="ml-auto text-right">
          <p className="text-xs text-muted">Showing total</p>
          <p className="font-bold text-red-400 font-mono text-lg">{fmtPKR(totalShown)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-auto w-full">
            <thead>
              <tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>By</th><th></th></tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(8)].map((_, i) => <SkeletonRow key={i} cols={6} />)
                : expenses.length === 0
                  ? <tr><td colSpan={6}><EmptyState icon={Receipt} title="No expenses" description="Add your first expense entry" /></td></tr>
                  : expenses.map((e, i) => (
                    <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      <td className="font-mono text-xs">{e.expense_date?.slice(0, 10)}</td>
                      <td><span className="badge badge-blue">{e.category_name}</span></td>
                      <td className="text-sm text-muted max-w-xs truncate">{e.description || '—'}</td>
                      <td><span className="font-mono text-red-400 font-semibold">{fmtPKR(e.amount)}</span></td>
                      <td className="text-xs text-muted">{e.created_by_name}</td>
                      <td>
                        <button onClick={() => setDel(e)} className="btn-danger p-1.5">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </motion.tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Add Expense" size="sm">
        <form onSubmit={handleSubmit(onExpense)} className="space-y-4">
          <div>
            <label className="label">Category *</label>
            <select {...register('category_id', { required: 'Select a category' })} className="input">
              <option value="">Select category…</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" {...register('expense_date', { required: 'Required' })} className="input" />
            </div>
            <div>
              <label className="label">Amount (PKR) *</label>
              <input type="number" step="0.01" {...register('amount', { required: 'Required', min: 0.01 })} className="input font-mono" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input {...register('description')} className="input" placeholder="Optional details…" />
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!delTarget}
        onClose={() => setDel(null)}
        onConfirm={deleteExpense}
        title="Delete Expense"
        message={`Delete ${delTarget?.category_name} expense of ${fmtPKR(delTarget?.amount)}? This cannot be undone.`}
      />
    </div>
  );
}
