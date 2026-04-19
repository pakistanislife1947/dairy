import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Users, Plus, Edit2, PowerOff, Phone, MapPin, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import {
  PageHeader, Modal, SearchInput, EmptyState,
  SkeletonRow, ConfirmDialog
} from '../../components/ui';

const fmt = n => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 });
const fmtPKR = n => `Rs ${fmt(n)}`;

const defaultValues = {
  name: '', phone: '', address: '',
  base_rate: 45, ideal_fat: 6, ideal_snf: 9,
  fat_correction: 0.5, snf_correction: 0.3,
  bank_name: '', bank_account: '',
};

export default function Farmers() {
  const [farmers, setFarmers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [total, setTotal]         = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [deactTarget, setDeact]   = useState(null);
  const [saving, setSaving]       = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({ defaultValues });

  // Live rate preview
  const [base_rate, ideal_fat, ideal_snf, fat_correction, snf_correction] =
    watch(['base_rate','ideal_fat','ideal_snf','fat_correction','snf_correction']);

  const previewRate = (actualFat = ideal_fat, actualSnf = ideal_snf) => {
    const r = parseFloat(base_rate || 0)
      + (parseFloat(actualFat) - parseFloat(ideal_fat)) * parseFloat(fat_correction || 0)
      + (parseFloat(actualSnf) - parseFloat(ideal_snf)) * parseFloat(snf_correction || 0);
    return Math.max(0, r).toFixed(2);
  };

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/farmers?search=${search}&page=${page}&limit=20`)
      .then(r => { setFarmers(r.data.data); setTotal(r.data.pagination.total); })
      .catch(() => toast.error('Failed to load farmers'))
      .finally(() => setLoading(false));
  }, [search, page]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); reset(defaultValues); setModalOpen(true); };
  const openEdit = (f) => {
    setEditing(f);
    reset({
      name: f.name, phone: f.phone, address: f.address,
      base_rate: f.base_rate, ideal_fat: f.ideal_fat, ideal_snf: f.ideal_snf,
      fat_correction: f.fat_correction, snf_correction: f.snf_correction,
      bank_name: f.bank_name || '', bank_account: f.bank_account || '',
    });
    setModalOpen(true);
  };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/farmers/${editing.id}`, data);
        toast.success('Farmer updated');
      } else {
        await api.post('/farmers', data);
        toast.success('Farmer added');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async () => {
    try {
      await api.patch(`/farmers/${deactTarget.id}/deactivate`);
      toast.success('Farmer deactivated');
      load();
    } catch {
      toast.error('Failed to deactivate');
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farmers"
        subtitle={`${total} registered farmers`}
        action={
          <button onClick={openAdd} className="btn-primary">
            <Plus size={16} /> Add Farmer
          </button>
        }
      />

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search by name…" />
        </div>

        <div className="overflow-x-auto">
          <table className="table-auto w-full">
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Phone</th>
                <th>Base Rate</th><th>Ideal FAT/SNF</th>
                <th>Total Earned</th><th>Records</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(8)].map((_, i) => <SkeletonRow key={i} cols={8} />)
                : farmers.length === 0
                  ? (
                    <tr>
                      <td colSpan={8}>
                        <EmptyState icon={Users} title="No farmers found"
                          description="Add your first farmer to get started"
                          action={<button onClick={openAdd} className="btn-primary"><Plus size={14} /> Add Farmer</button>}
                        />
                      </td>
                    </tr>
                  )
                  : farmers.map((f, i) => (
                    <motion.tr
                      key={f.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <td><span className="font-mono text-xs text-brand-400">{f.farmer_code}</span></td>
                      <td>
                        <div className="font-medium text-slate-200">{f.name}</div>
                        {f.address && (
                          <div className="flex items-center gap-1 text-xs text-muted mt-0.5">
                            <MapPin size={10} />{f.address.slice(0, 30)}…
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-1 text-xs text-muted">
                          <Phone size={11} />{f.phone}
                        </div>
                      </td>
                      <td><span className="font-mono font-semibold text-slate-200">Rs {f.base_rate}</span></td>
                      <td>
                        <div className="flex items-center gap-1 text-xs">
                          <Percent size={10} className="text-muted" />
                          <span className="text-slate-300">{f.ideal_fat}F / {f.ideal_snf}S</span>
                        </div>
                      </td>
                      <td><span className="font-mono text-emerald-400">{fmtPKR(f.total_earned)}</span></td>
                      <td><span className="text-muted">{f.total_records}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button onClick={() => openEdit(f)} className="btn-ghost p-1.5">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => setDeact(f)} className="btn-danger p-1.5">
                            <PowerOff size={14} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-ghost text-xs px-3 py-1.5">Prev</button>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-ghost text-xs px-3 py-1.5">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Farmer' : 'Add Farmer'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Full Name *</label>
              <input {...register('name', { required: 'Required' })} className="input" placeholder="Farmer name" />
              {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Phone *</label>
              <input {...register('phone', { required: 'Required' })} className="input" placeholder="03xx-xxxxxxx" />
              {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="label">Address *</label>
              <input {...register('address', { required: 'Required' })} className="input" placeholder="Village, City" />
              {errors.address && <p className="text-red-400 text-xs mt-1">{errors.address.message}</p>}
            </div>
          </div>

          {/* Pricing section */}
          <div className="border border-brand-500/20 rounded-xl p-4 bg-brand-500/5">
            <p className="text-xs font-semibold text-brand-400 uppercase tracking-wide mb-3">
              Dynamic Pricing Engine
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Base Rate (Rs/L)</label>
                <input {...register('base_rate', { required: true, valueAsNumber: true })} type="number" step="0.01" className="input font-mono" />
              </div>
              <div>
                <label className="label">Ideal FAT %</label>
                <input {...register('ideal_fat', { required: true, valueAsNumber: true })} type="number" step="0.01" className="input font-mono" />
              </div>
              <div>
                <label className="label">Ideal SNF %</label>
                <input {...register('ideal_snf', { required: true, valueAsNumber: true })} type="number" step="0.01" className="input font-mono" />
              </div>
              <div>
                <label className="label">FAT Correction</label>
                <input {...register('fat_correction', { required: true, valueAsNumber: true })} type="number" step="0.0001" className="input font-mono" />
              </div>
              <div>
                <label className="label">SNF Correction</label>
                <input {...register('snf_correction', { required: true, valueAsNumber: true })} type="number" step="0.0001" className="input font-mono" />
              </div>
              <div className="flex flex-col justify-end">
                <label className="label">At Ideal FAT/SNF</label>
                <div className="input font-mono font-bold text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                  Rs {previewRate()}/L
                </div>
              </div>
            </div>
            <p className="text-xs text-muted mt-2">
              Formula: Rate = Base + (FAT − Ideal_FAT) × FAT_Factor + (SNF − Ideal_SNF) × SNF_Factor
            </p>
          </div>

          {/* Bank details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Bank Name</label>
              <input {...register('bank_name')} className="input" placeholder="Optional" />
            </div>
            <div>
              <label className="label">Account Number</label>
              <input {...register('bank_account')} className="input" placeholder="Optional" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : editing ? 'Update Farmer' : 'Add Farmer'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deactTarget}
        onClose={() => setDeact(null)}
        onConfirm={deactivate}
        title="Deactivate Farmer"
        message={`Deactivate ${deactTarget?.name}? Their historical records will be preserved.`}
      />
    </div>
  );
}
