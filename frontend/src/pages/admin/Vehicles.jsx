import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Truck, Plus, Fuel, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState } from '../../components/ui';

const fmtPKR = n => `Rs ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // 'vehicle' | 'expense'
  const [selVehicle, setSel]    = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [saving, setSaving]     = useState(false);
  const { register, handleSubmit, watch, reset } = useForm();
  const ownershipType = watch('ownership_type', 'owned');

  const load = () => {
    setLoading(true);
    api.get('/vehicles').then(r => setVehicles(r.data.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const loadExpenses = (v) => {
    setSel(v);
    api.get(`/vehicles/${v.id}/expenses`).then(r => setExpenses(r.data.data));
  };

  const onVehicle = async (data) => {
    setSaving(true);
    try {
      await api.post('/vehicles', data);
      toast.success('Vehicle added');
      setModal(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const onExpense = async (data) => {
    setSaving(true);
    try {
      await api.post(`/vehicles/${selVehicle.id}/expenses`, data);
      toast.success('Expense recorded');
      setModal(null);
      loadExpenses(selVehicle);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vehicles"
        subtitle="Fleet management and expense tracking"
        action={
          <button onClick={() => { reset({ ownership_type: 'owned' }); setModal('vehicle'); }} className="btn-primary">
            <Plus size={16} /> Add Vehicle
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicles list */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="font-semibold text-slate-200 text-sm">Fleet ({vehicles.length})</h3>
          </div>
          {loading
            ? <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
            : vehicles.length === 0
              ? <EmptyState icon={Truck} title="No vehicles" description="Add your first vehicle to start tracking" />
              : (
                <div className="divide-y divide-border">
                  {vehicles.map(v => (
                    <button key={v.id} onClick={() => loadExpenses(v)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-700/30 transition-colors
                        ${selVehicle?.id === v.id ? 'bg-brand-500/10 border-l-2 border-brand-500' : ''}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                            ${v.ownership_type === 'owned' ? 'bg-brand-500/10' : 'bg-amber-500/10'}`}>
                            <Truck size={15} className={v.ownership_type === 'owned' ? 'text-brand-400' : 'text-amber-400'} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-200 text-sm">{v.reg_number}</p>
                            <p className="text-xs text-muted">{v.make_model || '—'} · {v.ownership_type}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-red-400 font-mono">{fmtPKR(v.total_expenses)}</p>
                          <p className="text-xs text-muted">{v.expense_count} entries</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )
          }
        </div>

        {/* Expenses panel */}
        <div className="space-y-3">
          {selVehicle ? (
            <>
              <div className="card flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-100">{selVehicle.reg_number}</h3>
                  <p className="text-xs text-muted">{selVehicle.make_model}</p>
                </div>
                <button onClick={() => { reset({}); setModal('expense'); }} className="btn-primary text-xs py-1.5 px-3">
                  <Plus size={14} /> Add Expense
                </button>
              </div>
              <div className="card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="table-auto w-full">
                    <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>KM</th></tr></thead>
                    <tbody>
                      {expenses.length === 0
                        ? <tr><td colSpan={4}><EmptyState icon={Fuel} title="No expenses yet" description="Log fuel, service, or rent costs" /></td></tr>
                        : expenses.map((e, i) => (
                          <motion.tr key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                            <td className="font-mono text-xs">{e.expense_date?.slice(0, 10)}</td>
                            <td>
                              <span className={`badge ${e.expense_type === 'diesel' ? 'badge-yellow' : e.expense_type === 'service' ? 'badge-blue' : 'badge-gray'}`}>
                                {e.expense_type === 'diesel' ? <Fuel size={10} /> : <Wrench size={10} />}
                                {' '}{e.expense_type}
                              </span>
                            </td>
                            <td><span className="font-mono text-red-400 font-semibold">{fmtPKR(e.amount)}</span></td>
                            <td className="text-muted text-xs font-mono">{e.odometer_km || '—'}</td>
                          </motion.tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card flex items-center justify-center h-48 text-muted text-sm">
              ← Select a vehicle to view its expenses
            </div>
          )}
        </div>
      </div>

      {/* Add Vehicle Modal */}
      <Modal isOpen={modal === 'vehicle'} onClose={() => setModal(null)} title="Add Vehicle" size="sm">
        <form onSubmit={handleSubmit(onVehicle)} className="space-y-4">
          <div>
            <label className="label">Registration Number *</label>
            <input {...register('reg_number', { required: 'Required' })} className="input" placeholder="ABC-123" />
          </div>
          <div>
            <label className="label">Make / Model</label>
            <input {...register('make_model')} className="input" placeholder="Toyota Hilux 2020" />
          </div>
          <div>
            <label className="label">Ownership Type *</label>
            <select {...register('ownership_type')} className="input">
              <option value="owned">Self-Owned</option>
              <option value="rented">Rented</option>
            </select>
          </div>
          {ownershipType === 'rented' && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Owner Name</label><input {...register('owner_name')} className="input" /></div>
              <div><label className="label">Owner Phone</label><input {...register('owner_phone')} className="input" /></div>
              <div className="col-span-2"><label className="label">Monthly Rent (PKR)</label>
                <input type="number" {...register('monthly_rent')} className="input font-mono" /></div>
            </div>
          )}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Add Vehicle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Expense Modal */}
      <Modal isOpen={modal === 'expense'} onClose={() => setModal(null)} title={`Log Expense — ${selVehicle?.reg_number}`} size="sm">
        <form onSubmit={handleSubmit(onExpense)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date *</label>
              <input type="date" {...register('expense_date', { required: 'Required' })} className="input" /></div>
            <div><label className="label">Type *</label>
              <select {...register('expense_type')} className="input">
                <option value="diesel">Diesel</option>
                <option value="service">Service / Repair</option>
                <option value="rent">Rent</option>
                <option value="insurance">Insurance</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div><label className="label">Amount (PKR) *</label>
              <input type="number" step="0.01" {...register('amount', { required: 'Required', min: 0.01 })} className="input font-mono" /></div>
            <div><label className="label">Odometer (km)</label>
              <input type="number" {...register('odometer_km')} className="input font-mono" /></div>
          </div>
          <div><label className="label">Notes</label><input {...register('notes')} className="input" placeholder="Optional" /></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Save Expense'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
