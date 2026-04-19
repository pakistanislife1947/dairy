// ─────────────────────────────────────────────────────────────
// Sales.jsx
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Plus, Building2, FileContract, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState } from '../../components/ui';

const fmtPKR = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

export function Sales() {
  const [tab, setTab]           = useState('sales');
  const [companies, setCompanies] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [sales, setSales]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // 'company'|'contract'|'sale'
  const [saving, setSaving]     = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    Promise.all([
      api.get('/sales/companies'),
      api.get('/sales/contracts'),
      api.get('/sales/sales'),
    ]).then(([c, ct, s]) => {
      setCompanies(c.data.data);
      setContracts(ct.data.data);
      setSales(s.data.data);
    }).finally(() => setLoading(false));
  }, []);

  const reload = async () => {
    const [c, ct, s] = await Promise.all([
      api.get('/sales/companies'), api.get('/sales/contracts'), api.get('/sales/sales'),
    ]);
    setCompanies(c.data.data); setContracts(ct.data.data); setSales(s.data.data);
  };

  const openModal = (type) => { reset({}); setModal(type); };

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      if (modal === 'company') {
        await api.post('/sales/companies', data);
        toast.success('Company added');
      } else if (modal === 'contract') {
        await api.post('/sales/contracts', data);
        toast.success('Contract created');
      } else if (modal === 'sale') {
        await api.post('/sales/sales', data);
        toast.success('Sale recorded');
      }
      setModal(null);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const TABS = [
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'companies', label: 'Companies', icon: Building2 },
    { id: 'contracts', label: 'Contracts', icon: FileContract },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" subtitle="Bulk milk sales to companies"
        action={
          <div className="flex gap-2">
            <button onClick={() => openModal('company')} className="btn-ghost"><Plus size={14} />Company</button>
            <button onClick={() => openModal('contract')} className="btn-ghost"><Plus size={14} />Contract</button>
            <button onClick={() => openModal('sale')} className="btn-primary"><Plus size={16} />Record Sale</button>
          </div>
        }
      />

      {/* Tab navigation */}
      <div className="flex gap-1 bg-card border border-border rounded-xl p-1 w-fit">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-brand-600 text-white' : 'text-muted hover:text-slate-300'}`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </div>

      {/* Sales table */}
      {tab === 'sales' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <thead><tr><th>Date</th><th>Company</th><th>Qty (L)</th><th>Rate</th><th>Total</th><th>Received</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? [...Array(5)].map((_,i) => <SkeletonRow key={i} cols={7} />) :
                  sales.length === 0
                    ? <tr><td colSpan={7}><EmptyState icon={TrendingUp} title="No sales" description="Record your first bulk milk sale" /></td></tr>
                    : sales.map((s, i) => (
                      <motion.tr key={s.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.03}}>
                        <td className="font-mono text-xs">{s.sale_date?.slice(0,10)}</td>
                        <td><div className="font-medium text-slate-200">{s.company_name}</div><div className="text-xs text-muted">{s.contract_ref}</div></td>
                        <td><span className="font-mono">{parseFloat(s.quantity_liters).toFixed(1)}</span></td>
                        <td><span className="font-mono text-brand-400">Rs {s.rate_per_liter}</span></td>
                        <td><span className="font-mono font-semibold">{fmtPKR(s.total_amount)}</span></td>
                        <td><span className="font-mono text-emerald-400">{fmtPKR(s.received_amount)}</span></td>
                        <td><span className={`badge ${s.payment_status==='received'?'badge-green':s.payment_status==='partial'?'badge-yellow':'badge-red'}`}>{s.payment_status}</span></td>
                      </motion.tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Companies */}
      {tab === 'companies' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? [...Array(3)].map((_,i) => <div key={i} className="skeleton h-32 rounded-2xl" />) :
            companies.map((c, i) => (
              <motion.div key={c.id} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.06}} className="card">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-brand-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200">{c.name}</p>
                    <p className="text-xs text-muted mt-0.5">{c.contact_name} · {c.phone}</p>
                    <p className="text-xs text-emerald-400 mt-1">Sales: {fmtPKR(c.total_sold)}</p>
                  </div>
                </div>
              </motion.div>
            ))
          }
        </div>
      )}

      {/* Contracts */}
      {tab === 'contracts' && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <thead><tr><th>Company</th><th>Ref</th><th>Rate/L</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
              <tbody>
                {loading ? [...Array(4)].map((_,i) => <SkeletonRow key={i} cols={6} />) :
                  contracts.map((c, i) => (
                    <motion.tr key={c.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.03}}>
                      <td className="font-medium text-slate-200">{c.company_name}</td>
                      <td><span className="font-mono text-xs text-brand-400">{c.contract_ref || '—'}</span></td>
                      <td><span className="font-mono text-emerald-400 font-semibold">Rs {c.rate_per_liter}</span></td>
                      <td className="font-mono text-xs">{c.start_date?.slice(0,10)}</td>
                      <td className="font-mono text-xs">{c.end_date?.slice(0,10) || '—'}</td>
                      <td><span className={`badge ${c.status==='active'?'badge-green':c.status==='expired'?'badge-yellow':'badge-red'}`}>{c.status}</span></td>
                    </motion.tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal isOpen={modal === 'company'} onClose={() => setModal(null)} title="Add Company" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="label">Company Name *</label>
            <input {...register('name', {required:'Required'})} className="input" placeholder="Nestle Pakistan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Contact Person</label><input {...register('contact_name')} className="input" /></div>
            <div><label className="label">Phone</label><input {...register('phone')} className="input" /></div>
          </div>
          <div><label className="label">GSTIN</label><input {...register('gstin')} className="input" placeholder="Optional" /></div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? '…' : 'Add Company'}</button></div>
        </form>
      </Modal>

      <Modal isOpen={modal === 'contract'} onClose={() => setModal(null)} title="New Contract" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="label">Company *</label>
            <select {...register('company_id', {required:'Required'})} className="input">
              <option value="">Select…</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Rate/L *</label><input type="number" step="0.01" {...register('rate_per_liter',{required:'Required'})} className="input font-mono" /></div>
            <div><label className="label">Min Qty (L)</label><input type="number" {...register('min_quantity')} className="input font-mono" /></div>
            <div><label className="label">Start Date *</label><input type="date" {...register('start_date',{required:'Required'})} className="input" /></div>
            <div><label className="label">End Date</label><input type="date" {...register('end_date')} className="input" /></div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? '…' : 'Create Contract'}</button></div>
        </form>
      </Modal>

      <Modal isOpen={modal === 'sale'} onClose={() => setModal(null)} title="Record Sale" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="label">Contract *</label>
            <select {...register('contract_id',{required:'Required'})} className="input">
              <option value="">Select contract…</option>
              {contracts.filter(c=>c.status==='active').map(c => <option key={c.id} value={c.id}>{c.company_name} — Rs {c.rate_per_liter}/L</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Sale Date *</label><input type="date" {...register('sale_date',{required:'Required'})} className="input" /></div>
            <div><label className="label">Qty (L) *</label><input type="number" step="0.01" {...register('quantity_liters',{required:'Required',min:0.01})} className="input font-mono" /></div>
            <div><label className="label">FAT %</label><input type="number" step="0.01" {...register('fat_percentage')} className="input font-mono" /></div>
            <div><label className="label">SNF %</label><input type="number" step="0.01" {...register('snf_percentage')} className="input font-mono" /></div>
            <div><label className="label">Rate/L *</label><input type="number" step="0.01" {...register('rate_per_liter',{required:'Required'})} className="input font-mono" /></div>
            <div><label className="label">Payment Status</label>
              <select {...register('payment_status')} className="input">
                <option value="pending">Pending</option><option value="received">Received</option><option value="partial">Partial</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3"><button type="button" onClick={() => setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? '…' : 'Record Sale'}</button></div>
        </form>
      </Modal>
    </div>
  );
}

export default Sales;
