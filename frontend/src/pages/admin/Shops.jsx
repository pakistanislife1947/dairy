import { useState, useEffect } from 'react';
import { Store, Plus, Pencil, Receipt, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, EmptyState } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

const emptyForm = { shop_name:'', location:'', ownership_type:'owned', owner_name:'', owner_phone:'', monthly_rent:'', rent_due_day:'' };

export default function Shops() {
  const [shops, setShops]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [selS, setSel]          = useState(null);
  const [rentHistory, setRentHistory] = useState([]);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(emptyForm);
  const [rentForm, setRentForm] = useState({ paid_for:'', paid_date: new Date().toISOString().slice(0,10), amount:'' });

  const load = () => {
    setLoading(true);
    api.get('/shops').then(r=>setShops(r.data.data||[])).finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); },[]);

  const openRent = (s) => {
    setSel(s); setModal('rent');
    setRentForm(p=>({ ...p, amount: s.monthly_rent||'' }));
    api.get(`/shops/${s.id}/rent-history`).then(r=>setRentHistory(r.data.data||[]));
  };

  const openEdit = (s) => {
    setSel(s);
    setForm({ shop_name:s.shop_name||s.name||'', location:s.location||'',
      ownership_type:s.ownership_type||'owned', owner_name:s.owner_name||'',
      owner_phone:s.owner_phone||'', monthly_rent:s.monthly_rent||'',
      rent_due_day:s.rent_due_day||'' });
    setModal('edit');
  };

  const onShop = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal==='edit') await api.put(`/shops/${selS.id}`, form);
      else await api.post('/shops', form);
      toast.success(modal==='edit'?'Shop updated':'Shop added');
      setModal(null); setForm(emptyForm); load();
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  const onRent = async (e) => {
    e.preventDefault();
    if (!rentForm.paid_for || !rentForm.amount) return toast.error('Fill all fields');
    setSaving(true);
    try {
      await api.patch(`/shops/${selS.id}/rent`, rentForm);
      toast.success('Rent payment recorded & added to expenses');
      setRentForm(p=>({...p,paid_for:'',amount:selS.monthly_rent||''}));
      api.get(`/shops/${selS.id}/rent-history`).then(r=>setRentHistory(r.data.data||[]));
      load();
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  const ShopForm = () => (
    <form onSubmit={onShop} className="space-y-4">
      <div><label className="label">Shop Name *</label>
        <input value={form.shop_name} onChange={e=>setForm(p=>({...p,shop_name:e.target.value}))}
          className="input" placeholder="Main Branch, Multan"/></div>
      <div><label className="label">Location / Address</label>
        <input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))}
          className="input" placeholder="Street, City"/></div>
      <div><label className="label">Ownership</label>
        <div className="grid grid-cols-2 gap-2">
          {['owned','rented'].map(t=>(
            <button key={t} type="button" onClick={()=>setForm(p=>({...p,ownership_type:t}))}
              className={`py-2.5 rounded-xl text-sm font-semibold border-2 capitalize transition
                ${form.ownership_type===t?'border-[#1d6faa] bg-blue-50 text-[#1d6faa]':'border-slate-200 text-slate-500'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {form.ownership_type==='rented' && (
        <div className="border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-slate-600">Owner & Rent Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Owner Name</label>
              <input value={form.owner_name} onChange={e=>setForm(p=>({...p,owner_name:e.target.value}))} className="input"/></div>
            <div><label className="label">Owner Phone</label>
              <input value={form.owner_phone} onChange={e=>setForm(p=>({...p,owner_phone:e.target.value}))} className="input"/></div>
            <div><label className="label">Monthly Rent (PKR)</label>
              <input type="number" step="100" value={form.monthly_rent}
                onChange={e=>setForm(p=>({...p,monthly_rent:e.target.value}))} className="input font-mono"/></div>
            <div><label className="label">Due Day (1-31)</label>
              <input type="number" min="1" max="31" value={form.rent_due_day}
                onChange={e=>setForm(p=>({...p,rent_due_day:e.target.value}))} className="input font-mono"/></div>
          </div>
        </div>
      )}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':modal==='edit'?'Save':'Add Shop'}</button>
      </div>
    </form>
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Shops & Locations" subtitle="Manage shops and rent payments"
        action={<button onClick={()=>{ setForm(emptyForm); setModal('add'); }} className="btn-primary"><Plus size={16}/>Add Shop</button>}/>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? [...Array(3)].map((_,i)=>(
          <div key={i} className="card animate-pulse"><div className="h-4 bg-slate-200 rounded w-3/4 mb-2"/><div className="h-3 bg-slate-100 rounded w-1/2"/></div>
        )) : shops.length===0 ? (
          <div className="col-span-3"><EmptyState icon={Store} title="No shops" description="Add your first shop or location"/></div>
        ) : shops.map(s=>(
          <div key={s.id} className={`card space-y-3 ${!s.is_active?'opacity-50':''}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-slate-800">{s.shop_name||s.name}</p>
                <p className="text-sm text-slate-500">{s.location||'—'}</p>
              </div>
              <span className={`badge text-xs ${s.ownership_type==='owned'?'badge-blue':'badge-yellow'}`}>
                {s.ownership_type}
              </span>
            </div>
            {s.ownership_type==='rented' && (
              <div className="text-xs space-y-1">
                {s.owner_name && <p className="text-slate-500">Owner: <span className="font-medium text-slate-700">{s.owner_name}</span></p>}
                {s.monthly_rent && <p className="text-amber-600 font-semibold">Rent: {fmt(s.monthly_rent)}/month{s.rent_due_day?` · Due: ${s.rent_due_day}th`:''}</p>}
                <p className="text-emerald-600">Paid: {fmt(s.total_paid)}</p>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              {s.ownership_type==='rented' && (
                <button onClick={()=>openRent(s)} className="btn-primary flex-1 text-xs py-1.5"><Receipt size={13}/>Pay Rent</button>
              )}
              <button onClick={()=>openEdit(s)} className="btn-ghost p-1.5 flex-1 flex items-center justify-center gap-1.5 text-xs"><Pencil size={13}/>Edit</button>
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={modal==='add'} onClose={()=>setModal(null)} title="Add Shop" size="sm"><ShopForm/></Modal>
      <Modal isOpen={modal==='edit'} onClose={()=>setModal(null)} title={`Edit: ${selS?.shop_name||selS?.name}`} size="sm"><ShopForm/></Modal>

      {/* Rent Payment Modal */}
      <Modal isOpen={modal==='rent'} onClose={()=>setModal(null)} title={`Rent — ${selS?.shop_name||selS?.name}`} size="sm">
        <div className="space-y-5">
          <form onSubmit={onRent} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-600">Record Rent Payment</p>
            {selS?.monthly_rent && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                Monthly rent: <span className="font-bold">{fmt(selS.monthly_rent)}</span>
                {selS.rent_due_day && ` · Due on ${selS.rent_due_day}th`}
              </div>
            )}
            <div><label className="label">For Month (YYYY-MM)</label>
              <input type="month" value={rentForm.paid_for}
                onChange={e=>setRentForm(p=>({...p,paid_for:e.target.value}))} className="input"/></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Payment Date</label>
                <input type="date" value={rentForm.paid_date}
                  onChange={e=>setRentForm(p=>({...p,paid_date:e.target.value}))} className="input"/></div>
              <div><label className="label">Amount (PKR)</label>
                <input type="number" step="100" value={rentForm.amount}
                  onChange={e=>setRentForm(p=>({...p,amount:e.target.value}))} className="input font-mono"/></div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving?'…':'Record Payment'}</button>
          </form>

          <div>
            <p className="text-sm font-semibold text-slate-600 mb-2">Payment History</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {rentHistory.length===0
                ? <p className="text-slate-400 text-sm text-center py-3">No payments yet</p>
                : rentHistory.map(r=>(
                  <div key={r.id} className="flex justify-between items-center text-sm border border-slate-100 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-mono text-[#1d6faa] text-xs">{r.paid_for}</span>
                      <span className="text-slate-400 text-xs ml-2">· {r.paid_date?.slice(0,10)}</span>
                    </div>
                    <span className="font-mono font-semibold text-emerald-600">{fmt(r.amount)}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
