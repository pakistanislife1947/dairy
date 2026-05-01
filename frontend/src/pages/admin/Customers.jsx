import { useState, useEffect } from 'react';
import { Users, Plus, Search, Home, Banknote, ShoppingBag, CreditCard, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { Modal, PageHeader, EmptyState } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

const TYPE_CONFIG = {
  household: { label: 'Household', icon: Home,        color: 'bg-blue-100 text-blue-700',   desc: 'Monthly billing customer' },
  cash:      { label: 'Cash',      icon: Banknote,     color: 'bg-green-100 text-green-700', desc: 'Pay on delivery' },
  walkin:    { label: 'Walk-in',   icon: ShoppingBag,  color: 'bg-purple-100 text-purple-700',desc: 'Shop counter customer' },
};

export default function Customers() {
  const [customers, setCustomers]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [modal, setModal]           = useState(null); // 'add'|'sale'|'detail'
  const [selected, setSelected]     = useState(null);
  const [saving, setSaving]         = useState(false);
  const [detail, setDetail]         = useState(null);

  const [form, setForm] = useState({ name:'', phone:'', address:'', type:'household', rate_per_liter:'', credit_limit:'' });
  const [sale, setSale] = useState({ sale_date: new Date().toISOString().slice(0,10), quantity_liters:'', rate_per_liter:'', payment_mode:'cash', payment_status:'paid', notes:'' });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (typeFilter) params.set('type', typeFilter);
      const { data } = await api.get(`/customers?${params}`);
      setCustomers(data.data || []);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [search, typeFilter]);

  const openDetail = async (c) => {
    setSelected(c);
    setModal('detail');
    try {
      const { data } = await api.get(`/customers/${c.id}`);
      setDetail(data.data);
      setSale(p => ({ ...p, rate_per_liter: data.data.rate_per_liter || '' }));
    } catch { toast.error('Failed to load detail'); }
  };

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      await api.post('/customers', form);
      toast.success('Customer added!');
      setModal(null); setForm({ name:'', phone:'', address:'', type:'household', rate_per_liter:'', credit_limit:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const submitSale = async (e) => {
    e.preventDefault();
    if (!sale.quantity_liters || !sale.rate_per_liter) return toast.error('Fill all fields');
    setSaving(true);
    try {
      await api.post(`/customers/${selected.id}/sales`, sale);
      toast.success('Sale recorded!');
      setModal('detail');
      openDetail(selected);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const markPaid = async (saleId) => {
    try {
      await api.patch(`/customers/sales/${saleId}/pay`);
      toast.success('Payment recorded');
      openDetail(selected);
    } catch { toast.error('Failed'); }
  };

  const filtered = customers;
  const total_outstanding = customers.reduce((s,c) => s + parseFloat(c.outstanding||0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" subtitle="Manage household, cash and walk-in customers"
        action={<button onClick={() => setModal('add')} className="btn-primary"><Plus size={14}/>Add Customer</button>} />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
          const Icon = cfg.icon;
          const count = customers.filter(c=>c.type===type).length;
          return (
            <button key={type} onClick={() => setTypeFilter(typeFilter===type?'':type)}
              className={`card text-left transition hover:shadow-md ${typeFilter===type?'ring-2 ring-[#1d6faa]':''}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cfg.color}`}>
                  <Icon size={18}/>
                </div>
                <div>
                  <p className="font-semibold text-slate-700">{cfg.label}</p>
                  <p className="text-xs text-slate-400">{cfg.desc}</p>
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Outstanding banner */}
      {total_outstanding > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CreditCard size={18} className="text-amber-600" />
          <span className="text-sm font-medium text-amber-800">
            Total Outstanding: <span className="font-bold">{fmt(total_outstanding)}</span>
          </span>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search name or phone…" className="input pl-9" />
        </div>
        {typeFilter && (
          <button onClick={()=>setTypeFilter('')} className="btn-ghost text-sm">
            Clear filter
          </button>
        )}
      </div>

      {/* Customer list */}
      <div className="card overflow-hidden p-0">
        <table className="table-auto w-full">
          <thead><tr>
            <th>Customer</th><th>Type</th><th>Phone</th><th>Rate/L</th><th>Outstanding</th><th></th>
          </tr></thead>
          <tbody>
            {loading
              ? <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-sm">Loading…</td></tr>
              : filtered.length === 0
              ? <tr><td colSpan={6}><EmptyState icon={Users} title="No customers" description="Add your first customer" /></td></tr>
              : filtered.map(c => {
                const cfg = TYPE_CONFIG[c.type];
                const Icon = cfg.icon;
                return (
                  <tr key={c.id} className="cursor-pointer" onClick={() => openDetail(c)}>
                    <td>
                      <div className="font-medium text-slate-800">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.customer_code}</div>
                    </td>
                    <td>
                      <span className={`badge text-xs ${cfg.color}`}>
                        <Icon size={11} className="mr-1 inline"/>{cfg.label}
                      </span>
                    </td>
                    <td className="text-slate-600">{c.phone||'—'}</td>
                    <td className="font-mono">{c.rate_per_liter > 0 ? `${fmt(c.rate_per_liter)}/L` : '—'}</td>
                    <td>
                      {parseFloat(c.outstanding) > 0
                        ? <span className="text-red-600 font-semibold font-mono">{fmt(c.outstanding)}</span>
                        : <span className="text-green-600 text-xs">Clear</span>}
                    </td>
                    <td><ChevronRight size={16} className="text-slate-300" /></td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Modal: Add Customer */}
      <Modal isOpen={modal==='add'} onClose={()=>setModal(null)} title="Add Customer" size="sm">
        <form onSubmit={submitAdd} className="space-y-4">
          <div><label className="label">Customer Name *</label>
            <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}
              className="input" placeholder="Muhammad Ali" /></div>

          <div><label className="label">Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TYPE_CONFIG).map(([type,cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button key={type} type="button" onClick={()=>setForm(p=>({...p,type}))}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-medium transition
                      ${form.type===type?'border-[#1d6faa] bg-blue-50 text-[#1d6faa]':'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    <Icon size={18}/>{cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Phone</label>
              <input value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}
                className="input" placeholder="03001234567" /></div>
            <div><label className="label">Rate/Liter (PKR)</label>
              <input type="number" step="0.01" value={form.rate_per_liter}
                onChange={e=>setForm(p=>({...p,rate_per_liter:e.target.value}))}
                className="input font-mono" placeholder="0" /></div>
          </div>

          {form.type === 'household' && (
            <div><label className="label">Credit Limit (PKR)</label>
              <input type="number" value={form.credit_limit}
                onChange={e=>setForm(p=>({...p,credit_limit:e.target.value}))}
                className="input font-mono" placeholder="0" /></div>
          )}

          <div><label className="label">Address</label>
            <input value={form.address} onChange={e=>setForm(p=>({...p,address:e.target.value}))}
              className="input" /></div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':'Add Customer'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Customer Detail + Record Sale */}
      <Modal isOpen={modal==='detail'} onClose={()=>{setModal(null);setDetail(null)}} title={selected?.name||''} size="md">
        {detail ? (
          <div className="space-y-5">
            {/* Info row */}
            <div className="flex gap-4 text-sm">
              <div className="flex-1 bg-slate-50 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">Type</p>
                <p className="font-semibold">{TYPE_CONFIG[detail.type]?.label}</p>
              </div>
              <div className="flex-1 bg-slate-50 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">Phone</p>
                <p className="font-semibold">{detail.phone||'—'}</p>
              </div>
              <div className="flex-1 bg-red-50 rounded-xl p-3">
                <p className="text-slate-400 text-xs mb-1">Outstanding</p>
                <p className="font-bold text-red-600">{fmt(detail.outstanding)}</p>
              </div>
            </div>

            {/* Record Sale */}
            <div className="border border-slate-200 rounded-xl p-4">
              <p className="font-semibold text-slate-700 mb-3 text-sm">Record Sale</p>
              <form onSubmit={submitSale} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="label">Date</label>
                    <input type="date" value={sale.sale_date}
                      onChange={e=>setSale(p=>({...p,sale_date:e.target.value}))} className="input" /></div>
                  <div><label className="label">Qty (L)</label>
                    <input type="number" step="0.1" value={sale.quantity_liters}
                      onChange={e=>setSale(p=>({...p,quantity_liters:e.target.value}))} className="input font-mono" /></div>
                  <div><label className="label">Rate/L</label>
                    <input type="number" step="0.01" value={sale.rate_per_liter}
                      onChange={e=>setSale(p=>({...p,rate_per_liter:e.target.value}))} className="input font-mono" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Payment</label>
                    <select value={sale.payment_mode} onChange={e=>setSale(p=>({...p,payment_mode:e.target.value}))} className="input">
                      <option value="cash">Cash</option>
                      <option value="credit">Credit</option>
                      <option value="upi">UPI/Transfer</option>
                    </select></div>
                  <div><label className="label">Status</label>
                    <select value={sale.payment_status} onChange={e=>setSale(p=>({...p,payment_status:e.target.value}))} className="input">
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                    </select></div>
                </div>
                {sale.quantity_liters && sale.rate_per_liter && (
                  <div className="bg-blue-50 rounded-lg px-3 py-2 text-sm font-semibold text-[#1d6faa]">
                    Total: {fmt(parseFloat(sale.quantity_liters||0) * parseFloat(sale.rate_per_liter||0))}
                  </div>
                )}
                <button type="submit" disabled={saving} className="btn-primary w-full">
                  {saving?'Saving…':'Record Sale'}
                </button>
              </form>
            </div>

            {/* Sales history */}
            <div>
              <p className="font-semibold text-slate-700 text-sm mb-2">Recent Sales</p>
              {detail.sales?.length === 0
                ? <p className="text-slate-400 text-sm text-center py-4">No sales yet</p>
                : <div className="space-y-2 max-h-48 overflow-y-auto">
                  {detail.sales.map(s => (
                    <div key={s.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                      <div>
                        <span className="font-medium">{s.sale_date}</span>
                        <span className="text-slate-400 ml-2">{s.quantity_liters}L @ {s.rate_per_liter}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold font-mono">{fmt(s.total_amount)}</span>
                        {s.payment_status === 'paid'
                          ? <span className="badge-green text-xs"><CheckCircle size={10} className="mr-1"/>Paid</span>
                          : <button onClick={()=>markPaid(s.id)} className="badge-yellow text-xs cursor-pointer hover:bg-amber-200">
                              <Clock size={10} className="mr-1"/>Mark Paid
                            </button>
                        }
                      </div>
                    </div>
                  ))}
                </div>
              }
            </div>
          </div>
        ) : <div className="py-8 text-center text-slate-400">Loading…</div>}
      </Modal>
    </div>
  );
}
