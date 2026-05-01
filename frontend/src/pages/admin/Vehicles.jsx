import { useState, useEffect } from 'react';
import { Truck, Plus, Fuel, Wrench, CreditCard, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

export default function Vehicles() {
  const [vehicles, setVehicles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [modal, setModal]         = useState(null);
  const [selVehicle, setSel]      = useState(null);
  const [expenses, setExpenses]   = useState([]);
  const [saving, setSaving]       = useState(false);

  const [vForm, setVForm] = useState({
    reg_number:'', make_model:'', use_type:'commercial', ownership_type:'owned',
    owner_name:'', owner_phone:'', monthly_rent:'', capacity_liters:'',
    purchase_price:'', payment_type:'full', installment_months:'', installment_paid:'0',
  });
  const [expForm, setExpForm] = useState({
    expense_date: new Date().toISOString().slice(0,10),
    expense_type:'diesel', amount:'', notes:'',
  });

  const load = () => {
    setLoading(true);
    api.get('/vehicles').then(r=>setVehicles(r.data.data||[])).finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); },[]);

  const loadExpenses = (v) => {
    setSel(v);
    api.get(`/vehicles/${v.id}/expenses`).then(r=>setExpenses(r.data.data||[]));
    setModal('expenses');
  };

  const onVehicle = async (e) => {
    e.preventDefault();
    if (!vForm.reg_number) return toast.error('Registration number required');
    setSaving(true);
    try {
      await api.post('/vehicles', vForm);
      toast.success('Vehicle added');
      setModal(null);
      setVForm({ reg_number:'', make_model:'', use_type:'commercial', ownership_type:'owned',
        owner_name:'', owner_phone:'', monthly_rent:'', capacity_liters:'', purchase_price:'', payment_type:'full', installment_months:'', installment_paid:'0' });
      load();
    } catch (err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const onExpense = async (e) => {
    e.preventDefault();
    if (!expForm.amount) return toast.error('Amount required');
    setSaving(true);
    try {
      await api.post(`/vehicles/${selVehicle.id}/expenses`, expForm);
      toast.success('Expense recorded');
      setExpForm(p=>({...p, amount:'', notes:''}));
      api.get(`/vehicles/${selVehicle.id}/expenses`).then(r=>setExpenses(r.data.data||[]));
    } catch (err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const monthlyInstallment = vForm.payment_type === 'installment' && vForm.purchase_price && vForm.installment_months
    ? (parseFloat(vForm.purchase_price) / parseInt(vForm.installment_months)).toFixed(0)
    : null;

  const paidInstallments = parseInt(vForm.installment_paid || 0);
  const totalInstallments = parseInt(vForm.installment_months || 0);
  const remainingPayment  = monthlyInstallment ? (totalInstallments - paidInstallments) * parseFloat(monthlyInstallment) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicles" subtitle="Fleet management"
        action={<button onClick={()=>setModal('vehicle')} className="btn-primary"><Plus size={16}/>Add Vehicle</button>}/>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? [...Array(3)].map((_,i)=>(
          <div key={i} className="card animate-pulse"><div className="h-4 bg-slate-200 rounded w-3/4 mb-3"/><div className="h-3 bg-slate-100 rounded w-1/2"/></div>
        )) : vehicles.length===0 ? (
          <div className="col-span-3"><EmptyState icon={Truck} title="No vehicles" description="Add your fleet"/></div>
        ) : vehicles.map(v => (
          <div key={v.id} className="card hover:shadow-md transition cursor-pointer" onClick={()=>loadExpenses(v)}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-bold text-slate-800">{v.reg_number}</p>
                <p className="text-sm text-slate-500">{v.make_model||'—'}</p>
              </div>
              <span className={`badge text-xs ${v.ownership_type==='owned'?'badge-blue':'badge-yellow'}`}>
                {v.ownership_type}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
              <span>Use: <b className="text-slate-700">{v.use_type||'—'}</b></span>
              <span>Capacity: <b className="text-slate-700">{v.capacity_liters ? `${v.capacity_liters}L` : '—'}</b></span>
              {v.ownership_type==='rented' && v.monthly_rent && (
                <span className="col-span-2 text-amber-600">Rent: {fmt(v.monthly_rent)}/month</span>
              )}
            </div>
            <p className="text-xs text-[#1d6faa] mt-3">Click to view expenses →</p>
          </div>
        ))}
      </div>

      {/* Add Vehicle Modal */}
      <Modal isOpen={modal==='vehicle'} onClose={()=>setModal(null)} title="Add Vehicle" size="md">
        <form onSubmit={onVehicle} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Reg Number *</label>
              <input value={vForm.reg_number} onChange={e=>setVForm(p=>({...p,reg_number:e.target.value}))}
                className="input" placeholder="LEA-1234"/></div>
            <div><label className="label">Make / Model</label>
              <input value={vForm.make_model} onChange={e=>setVForm(p=>({...p,make_model:e.target.value}))}
                className="input" placeholder="Shehzore 2022"/></div>
          </div>

          {/* Use type */}
          <div><label className="label">Use Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {['commercial','residential'].map(t=>(
                <button key={t} type="button" onClick={()=>setVForm(p=>({...p,use_type:t}))}
                  className={`py-2.5 rounded-xl text-sm font-medium border-2 capitalize transition
                    ${vForm.use_type===t?'border-[#1d6faa] bg-blue-50 text-[#1d6faa]':'border-slate-200 text-slate-500'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div><label className="label">Capacity (Liters)</label>
            <input type="number" step="0.1" value={vForm.capacity_liters}
              onChange={e=>setVForm(p=>({...p,capacity_liters:e.target.value}))}
              className="input font-mono" placeholder="e.g. 500"/></div>

          {/* Ownership */}
          <div><label className="label">Ownership *</label>
            <div className="grid grid-cols-2 gap-2">
              {['owned','rented'].map(t=>(
                <button key={t} type="button" onClick={()=>setVForm(p=>({...p,ownership_type:t}))}
                  className={`py-2.5 rounded-xl text-sm font-medium border-2 capitalize transition
                    ${vForm.ownership_type===t?'border-[#1d6faa] bg-blue-50 text-[#1d6faa]':'border-slate-200 text-slate-500'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Owned — purchase info */}
          {vForm.ownership_type==='owned' && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-600">Purchase Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Invoice Amount (PKR)</label>
                  <input type="number" step="1000" value={vForm.purchase_price}
                    onChange={e=>setVForm(p=>({...p,purchase_price:e.target.value}))}
                    className="input font-mono" placeholder="1500000"/></div>
                <div></div>
              </div>
              <div><label className="label">Payment Type *</label>
                <div className="grid grid-cols-2 gap-2">
                  {[['full','Full Payment'],['installment','Installments']].map(([t,l])=>(
                    <button key={t} type="button" onClick={()=>setVForm(p=>({...p,payment_type:t}))}
                      className={`py-2 rounded-xl text-sm font-medium border-2 transition
                        ${vForm.payment_type===t?'border-[#1d6faa] bg-blue-50 text-[#1d6faa]':'border-slate-200 text-slate-500'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {vForm.payment_type==='installment' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Total Months</label>
                      <input type="number" min="1" value={vForm.installment_months}
                        onChange={e=>setVForm(p=>({...p,installment_months:e.target.value}))}
                        className="input font-mono" placeholder="12"/></div>
                    <div><label className="label">Months Already Paid</label>
                      <input type="number" min="0" value={vForm.installment_paid}
                        onChange={e=>setVForm(p=>({...p,installment_paid:e.target.value}))}
                        className="input font-mono" placeholder="0"/></div>
                  </div>
                  {monthlyInstallment && (
                    <div className="bg-blue-50 rounded-lg px-3 py-2.5 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-slate-600">Monthly installment:</span><span className="font-bold text-[#1d6faa] font-mono">{fmt(monthlyInstallment)}</span></div>
                      <div className="flex justify-between"><span className="text-slate-600">Remaining ({totalInstallments-paidInstallments} months):</span><span className="font-bold text-red-500 font-mono">{fmt(remainingPayment)}</span></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Rented */}
          {vForm.ownership_type==='rented' && (
            <div className="border border-slate-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-slate-600">Owner Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Owner Name</label>
                  <input value={vForm.owner_name} onChange={e=>setVForm(p=>({...p,owner_name:e.target.value}))} className="input"/></div>
                <div><label className="label">Owner Phone</label>
                  <input value={vForm.owner_phone} onChange={e=>setVForm(p=>({...p,owner_phone:e.target.value}))} className="input"/></div>
                <div className="col-span-2"><label className="label">Monthly Rent (PKR)</label>
                  <input type="number" step="100" value={vForm.monthly_rent}
                    onChange={e=>setVForm(p=>({...p,monthly_rent:e.target.value}))} className="input font-mono"/></div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':'Add Vehicle'}</button>
          </div>
        </form>
      </Modal>

      {/* Expenses Modal */}
      <Modal isOpen={modal==='expenses'} onClose={()=>setModal(null)} title={`${selVehicle?.reg_number||''} — Expenses`} size="md">
        <div className="space-y-5">
          {/* Add expense form */}
          <form onSubmit={onExpense} className="border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-600">Add Expense</p>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="label">Type</label>
                <select value={expForm.expense_type} onChange={e=>setExpForm(p=>({...p,expense_type:e.target.value}))} className="input">
                  <option value="diesel">Diesel</option>
                  <option value="service">Service</option>
                  <option value="rent">Rent</option>
                  <option value="insurance">Insurance</option>
                  <option value="other">Other</option>
                </select></div>
              <div><label className="label">Date</label>
                <input type="date" value={expForm.expense_date}
                  onChange={e=>setExpForm(p=>({...p,expense_date:e.target.value}))} className="input"/></div>
              <div><label className="label">Amount (PKR)</label>
                <input type="number" step="0.01" value={expForm.amount}
                  onChange={e=>setExpForm(p=>({...p,amount:e.target.value}))} className="input font-mono"/></div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full">{saving?'Saving…':'Add'}</button>
          </form>

          {/* Expenses list */}
          <div className="max-h-64 overflow-y-auto space-y-2">
            {expenses.length===0
              ? <p className="text-slate-400 text-sm text-center py-4">No expenses yet</p>
              : expenses.map(e=>(
                <div key={e.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-lg px-3 py-2">
                  <div>
                    <span className={`badge text-xs mr-2 ${e.expense_type==='diesel'?'badge-yellow':'badge-blue'}`}>{e.expense_type}</span>
                    <span className="text-slate-500 text-xs">{e.expense_date?.slice(0,10)}</span>
                  </div>
                  <span className="font-mono font-semibold text-red-500">{fmt(e.amount)}</span>
                </div>
              ))
            }
          </div>
        </div>
      </Modal>
    </div>
  );
}
