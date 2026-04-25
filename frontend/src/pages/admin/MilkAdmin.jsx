import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Milk, Plus, Edit2, Trash2, Sun, Moon, Calculator } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState, ConfirmDialog } from '../../components/ui';

const fmtPKR = n => `Rs ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

export default function MilkAdmin() {
  const [records, setRecords]   = useState([]);
  const [farmers, setFarmers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModal]   = useState(false);
  const [editing, setEditing]   = useState(null);
  const [deleteTarget, setDel]  = useState(null);
  const [saving, setSaving]     = useState(false);
  const [preview, setPreview]   = useState(null);
  const [page, setPage]         = useState(1);
  const [total, setTotal]       = useState(0);
  const [filters, setFilters]   = useState({
    date_from: format(new Date(), 'yyyy-MM-01'),
    date_to:   format(new Date(), 'yyyy-MM-dd'),
    shift: '',
  });

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      farmer_id: '', collection_date: format(new Date(), 'yyyy-MM-dd'),
      shift: 'morning', quantity_liters: '', fat_percentage: '', snf_percentage: '', notes: '',
    },
  });

  const [watchFarmer, watchFat, watchSnf, watchQty] = watch(['farmer_id','fat_percentage','snf_percentage','quantity_liters']);

  // Live rate preview
  useEffect(() => {
    if (!watchFarmer || !watchFat || !watchQty) { setPreview(null); return; }
    const t = setTimeout(() => {
      api.post('/milk/preview-rate', {
        farmer_id: watchFarmer,
        fat_percentage: parseFloat(watchFat),
        snf_percentage: watchSnf ? parseFloat(watchSnf) : null,
        quantity_liters: parseFloat(watchQty),
      }).then(r => setPreview(r.data.data)).catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(t);
  }, [watchFarmer, watchFat, watchSnf, watchQty]);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({ ...filters, page, limit: 30 }).toString();
    api.get(`/milk?${q}`)
      .then(r => { setRecords(r.data.data); setTotal(r.data.pagination.total); })
      .finally(() => setLoading(false));
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/farmers?limit=200&active=1').then(r => setFarmers(r.data.data)); }, []);

  const openAdd = () => {
    setEditing(null);
    reset({ farmer_id: '', collection_date: format(new Date(), 'yyyy-MM-dd'), shift: 'morning', quantity_liters: '', fat_percentage: '', snf_percentage: '', notes: '' });
    setPreview(null);
    setModal(true);
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/milk/${editing.id}`, data);
        toast.success('Record updated');
      } else {
        const r = await api.post('/milk', data);
        toast.success(`Saved! Rate: Rs ${r.data.data.computed_rate}/L`);
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async () => {
    try {
      await api.delete(`/milk/${deleteTarget.id}`);
      toast.success('Record deleted');
      load();
    } catch { toast.error('Delete failed'); }
  };

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Milk Collection"
        subtitle={`${total} records`}
        action={<button onClick={openAdd} className="btn-primary"><Plus size={16} />Add Record</button>}
      />

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
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
        <div>
          <label className="label">Shift</label>
          <select className="input" value={filters.shift}
            onChange={e => setFilters(f => ({ ...f, shift: e.target.value }))}>
            <option value="">All Shifts</option>
            <option value="morning">Morning</option>
            <option value="evening">Evening</option>
          </select>
        </div>
        <button onClick={load} className="btn-primary">Apply</button>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Date</th><th>Farmer</th><th>Shift</th>
                <th>Qty (L)</th><th>FAT%</th><th>SNF%</th>
                <th>Rate</th><th>Amount</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(10)].map((_, i) => <SkeletonRow key={i} cols={9} />)
                : records.length === 0
                  ? (
                    <tr><td colSpan={9}>
                      <EmptyState icon={Milk} title="No records" description="Add milk collection entries above" />
                    </td></tr>
                  )
                  : records.map((r, i) => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      <td className="font-mono text-xs">{r.collection_date?.slice(0,10)}</td>
                      <td>
                        <div className="font-medium text-slate-700 text-sm">{r.farmer_name}</div>
                        <div className="text-xs text-muted font-mono">{r.farmer_code}</div>
                      </td>
                      <td>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full
                          ${r.shift === 'morning' ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-600/40 text-slate-400'}`}>
                          {r.shift === 'morning' ? <Sun size={10} /> : <Moon size={10} />}
                          {r.shift}
                        </span>
                      </td>
                      <td><span className="font-mono font-semibold">{parseFloat(r.quantity_liters).toFixed(1)}</span></td>
                      <td><span className="font-mono text-blue-400">{parseFloat(r.fat_percentage).toFixed(1)}%</span></td>
                      <td><span className="font-mono text-purple-400">{r.snf_percentage ? parseFloat(r.snf_percentage).toFixed(1) + '%' : '—'}</span></td>
                      <td><span className="font-mono text-brand-400">Rs {parseFloat(r.computed_rate).toFixed(2)}</span></td>
                      <td><span className="font-mono text-emerald-400 font-semibold">{fmtPKR(r.total_amount)}</span></td>
                      <td>
                        <div className="flex gap-2">
                          <button onClick={() => setDel(r)} className="btn-danger p-1.5"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#d1dce8]">
            <span className="text-xs text-muted">Page {page} of {totalPages} · {total} records</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-ghost text-xs px-3 py-1.5">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-ghost text-xs px-3 py-1.5">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModal(false)} title={editing ? 'Edit Record' : 'Add Milk Collection'} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Farmer *</label>
            <select {...register('farmer_id', { required: 'Select farmer' })} className="input">
              <option value="">Select farmer…</option>
              {farmers.map(f => <option key={f.id} value={f.id}>{f.name} ({f.farmer_code})</option>)}
            </select>
            {errors.farmer_id && <p className="text-red-400 text-xs mt-1">{errors.farmer_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date *</label>
              <input type="date" {...register('collection_date', { required: 'Required' })} className="input" />
            </div>
            <div>
              <label className="label">Shift *</label>
              <select {...register('shift')} className="input">
                <option value="morning">☀️ Morning</option>
                <option value="evening">🌙 Evening</option>
              </select>
            </div>
            <div>
              <label className="label">Quantity (Litres) *</label>
              <input type="number" step="0.01" {...register('quantity_liters', { required: 'Required', min: 0.01 })} className="input font-mono" placeholder="0.00" />
            </div>
            <div>
              <label className="label">FAT % *</label>
              <input type="number" step="0.01" {...register('fat_percentage', { required: 'Required', min: 0 })} className="input font-mono" placeholder="0.00" />
            </div>
            <div>
              <label className="label">SNF % (optional)</label>
              <input type="number" step="0.01" {...register('snf_percentage')} className="input font-mono" placeholder="0.00" />
            </div>
            <div>
              <label className="label">Notes</label>
              <input {...register('notes')} className="input" placeholder="Optional" />
            </div>
          </div>

          {/* Live rate preview */}
          {preview && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
            >
              <div className="flex items-center gap-2 text-sm text-emerald-400">
                <Calculator size={16} />
                <span>Computed Rate</span>
              </div>
              <div className="text-right">
                <p className="font-bold text-emerald-400 font-mono">Rs {preview.computed_rate}/L</p>
                <p className="text-xs text-emerald-500">Total: Rs {Number(preview.total_amount).toLocaleString()}</p>
              </div>
            </motion.div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-[#d1dce8]">
            <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Record'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDel(null)}
        onConfirm={deleteRecord}
        title="Delete Record"
        message="This will permanently delete this milk record. Audit log will capture the deletion."
      />
    </div>
  );
}
