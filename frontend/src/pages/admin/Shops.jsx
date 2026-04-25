import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Store, Plus, MapPin, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, EmptyState } from '../../components/ui';

const fmtPKR = n => `Rs ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

export default function Shops() {
  const [shops, setShops]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // 'shop' | 'rent'
  const [selShop, setSel]     = useState(null);
  const [saving, setSaving]   = useState(false);
  const { register, handleSubmit, watch, reset } = useForm();
  const ownerType = watch('ownership_type', 'owned');

  const load = () => {
    setLoading(true);
    api.get('/shops').then(r => setShops(r.data.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const onShop = async (data) => {
    setSaving(true);
    try {
      await api.post('/shops', data);
      toast.success('Shop added');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const onRent = async (data) => {
    setSaving(true);
    try {
      await api.post(`/shops/${selShop.id}/rent-payments`, data);
      toast.success('Rent payment recorded');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shops & Locations"
        subtitle="Owned and rented shop management"
        action={
          <button onClick={() => { reset({ ownership_type: 'owned' }); setModal('shop'); }} className="btn-primary">
            <Plus size={16} /> Add Shop
          </button>
        }
      />

      {loading
        ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
          </div>
        : shops.length === 0
          ? <EmptyState icon={Store} title="No shops added" description="Add your first owned or rented shop location" />
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shops.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }} className="card space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                      ${s.ownership_type === 'owned' ? 'bg-emerald-500/10' : 'bg-amber-500/10'}`}>
                      <Store size={18} className={s.ownership_type === 'owned' ? 'text-emerald-400' : 'text-amber-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-700 truncate">{s.shop_name}</p>
                      {s.location && (
                        <p className="text-xs text-muted mt-0.5 flex items-center gap-1">
                          <MapPin size={10} /> {s.location}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge ${s.ownership_type === 'owned' ? 'badge-green' : 'badge-yellow'}`}>
                      {s.ownership_type}
                    </span>
                    {s.monthly_rent && (
                      <span className="text-xs text-muted">{fmtPKR(s.monthly_rent)}/mo</span>
                    )}
                  </div>

                  {s.ownership_type === 'rented' && (
                    <div className="text-xs text-muted space-y-0.5 pt-1 border-t border-[#d1dce8]">
                      <p>Owner: <span className="text-slate-600">{s.owner_name || '—'}</span></p>
                      <p>Total paid: <span className="text-emerald-400 font-mono">{fmtPKR(s.total_rent_paid)}</span></p>
                    </div>
                  )}

                  {s.ownership_type === 'rented' && (
                    <button onClick={() => { setSel(s); reset({}); setModal('rent'); }}
                      className="btn-ghost w-full justify-center text-xs py-1.5">
                      <DollarSign size={12} /> Log Rent Payment
                    </button>
                  )}
                </motion.div>
              ))}
            </div>
          )
      }

      {/* Add Shop Modal */}
      <Modal isOpen={modal === 'shop'} onClose={() => setModal(null)} title="Add Shop" size="md">
        <form onSubmit={handleSubmit(onShop)} className="space-y-4">
          <div>
            <label className="label">Shop Name *</label>
            <input {...register('shop_name', { required: 'Required' })} className="input" placeholder="Main Branch" />
          </div>
          <div>
            <label className="label">Location / Address</label>
            <input {...register('location')} className="input" placeholder="Street, City" />
          </div>
          <div>
            <label className="label">Ownership Type *</label>
            <select {...register('ownership_type')} className="input">
              <option value="owned">Owned</option>
              <option value="rented">Rented</option>
            </select>
          </div>
          {ownerType === 'rented' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Owner Name</label><input {...register('owner_name')} className="input" /></div>
              <div><label className="label">Owner Phone</label><input {...register('owner_phone')} className="input" /></div>
              <div><label className="label">Monthly Rent (PKR) *</label>
                <input type="number" {...register('monthly_rent')} className="input font-mono" /></div>
              <div><label className="label">Rent Due Day (1-31)</label>
                <input type="number" min="1" max="31" {...register('rent_due_day')} className="input font-mono" /></div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Add Shop'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Rent Modal */}
      <Modal isOpen={modal === 'rent'} onClose={() => setModal(null)} title={`Log Rent — ${selShop?.shop_name}`} size="sm">
        <form onSubmit={handleSubmit(onRent)} className="space-y-4">
          <div>
            <label className="label">For Month (YYYY-MM) *</label>
            <input {...register('paid_for', { required: 'Required', pattern: { value: /^\d{4}-\d{2}$/, message: 'Format: YYYY-MM' } })}
              className="input font-mono" placeholder="2024-01" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Payment Date *</label>
              <input type="date" {...register('paid_date', { required: 'Required' })} className="input" /></div>
            <div><label className="label">Amount (PKR) *</label>
              <input type="number" step="0.01" {...register('amount', { required: 'Required', min: 0.01 })} className="input font-mono" /></div>
          </div>
          <div><label className="label">Notes</label><input {...register('notes')} className="input" /></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Record Payment'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
