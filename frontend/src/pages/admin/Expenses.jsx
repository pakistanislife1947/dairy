import { useState, useEffect } from 'react';
import { Receipt, Plus, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, SkeletonRow, EmptyState, ConfirmDialog } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

export default function Expenses() {
  const [expenses, setExpenses]     = useState([]);
  const [categories, setCategories] = useState([]);
  const [rentRefs, setRentRefs]     = useState([]);   // shops + rented vehicles
  const [vehicles, setVehicles]     = useState([]);   // for diesel
  const [loading, setLoading]       = useState(true);
  const [modal, setModal]           = useState(false);
  const [saving, setSaving]         = useState(false);
  const [delTarget, setDel]         = useState(null);
  const [filters, setFilters]       = useState({ category_id:'', date_from:'', date_to:'' });

  // Form state
  const [form, setForm] = useState({
    category_id: '', expense_date: new Date().toISOString().slice(0,10),
    amount: '', description: '', reference_type: '', reference_id: ''
  });

  const selectedCat = categories.find(c => String(c.id) === String(form.category_id));
  const catName = selectedCat?.name?.toLowerCase() || '';
  const isRent    = catName.includes('rent');
  const isDiesel  = catName.includes('diesel');
  const isVehRent = catName.includes('vehicle rent');
  const isShopRent = catName.includes('shop rent');

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v))).toString();
    Promise.all([
      api.get(`/expenses?${q}&limit=100`),
      api.get('/expenses/categories'),
      api.get('/expenses/rent-refs'),
      api.get('/vehicles'),
    ]).then(([e, c, r, v]) => {
      setExpenses(e.data.data || []);
      setCategories(c.data.data || []);
      setRentRefs(r.data.data || []);
      setVehicles(v.data.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // When category changes, reset reference and auto-select if only 1 option
  const handleCatChange = (catId) => {
    const cat = categories.find(c => String(c.id) === String(catId));
    const name = cat?.name?.toLowerCase() || '';
    let ref_type = '', ref_id = '', amount = form.amount;

    setForm(p => ({ ...p, category_id: catId, reference_type: ref_type, reference_id: ref_id, amount }));
  };

  // When reference (shop/vehicle) selected, auto-fill amount
  const handleRefChange = (refId) => {
    const ref = rentRefs.find(r => String(r.id) === String(refId) &&
      (isShopRent ? r.type === 'shop' : r.type === 'vehicle'));
    setForm(p => ({
      ...p,
      reference_id: refId,
      reference_type: isShopRent ? 'shop' : 'vehicle',
      amount: ref?.amount || p.amount,
      description: ref ? `${isShopRent ? 'Shop' : 'Vehicle'} rent: ${ref.name}` : p.description,
    }));
  };

  const handleVehicleChange = (vId) => {
    const v = vehicles.find(v => String(v.id) === String(vId));
    setForm(p => ({
      ...p,
      reference_id: vId,
      reference_type: 'vehicle',
      description: v ? `Diesel: ${v.reg_number}` : p.description,
    }));
  };

  const onExpense = async (e) => {
    e.preventDefault();
    if (!form.category_id || !form.expense_date || !form.amount) return toast.error('Fill required fields');
    setSaving(true);
    try {
      await api.post('/expenses', form);
      toast.success('Expense recorded');
      setModal(false);
      setForm({ category_id:'', expense_date: new Date().toISOString().slice(0,10), amount:'', description:'', reference_type:'', reference_id:'' });
      load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const deleteExpense = async () => {
    try { await api.delete(`/expenses/${delTarget.id}`); toast.success('Deleted'); load(); }
    catch { toast.error('Failed'); }
  };

  const shopRefs    = rentRefs.filter(r => r.type === 'shop');
  const vehicleRentRefs = rentRefs.filter(r => r.type === 'vehicle');
  const totalShown  = expenses.reduce((s, e) => s + parseFloat(e.amount||0), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Expenses" subtitle="Centralized expense ledger"
        action={<button onClick={() => setModal(true)} className="btn-primary"><Plus size={16}/>Add Expense</button>} />

      {/* Category summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {categories.slice(0,4).map((c,i) => (
          <div key={i} className="card">
            <p className="text-xs text-slate-500 truncate">{c.name}</p>
            <p className="font-bold text-lg font-mono text-slate-800 mt-1">{fmt(c.total_spent)}</p>
            <p className="text-xs text-slate-400">{c.entry_count} entries</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div><label className="label">Category</label>
          <select className="input" value={filters.category_id}
            onChange={e=>setFilters(f=>({...f,category_id:e.target.value}))}>
            <option value="">All Categories</option>
            {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div><label className="label">From</label>
          <input type="date" className="input" value={filters.date_from}
            onChange={e=>setFilters(f=>({...f,date_from:e.target.value}))}/></div>
        <div><label className="label">To</label>
          <input type="date" className="input" value={filters.date_to}
            onChange={e=>setFilters(f=>({...f,date_to:e.target.value}))}/></div>
        <button onClick={load} className="btn-primary">Apply</button>
        <div className="ml-auto text-right">
          <p className="text-xs text-slate-400">Total shown</p>
          <p className="font-bold text-red-500 font-mono text-lg">{fmt(totalShown)}</p>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="table-auto w-full">
          <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th><th>By</th><th></th></tr></thead>
          <tbody>
            {loading ? [...Array(6)].map((_,i)=><SkeletonRow key={i} cols={6}/>) :
             expenses.length===0 ? <tr><td colSpan={6}><EmptyState icon={Receipt} title="No expenses" description="Add your first expense"/></td></tr> :
             expenses.map(e => (
              <tr key={e.id}>
                <td className="font-mono text-xs">{e.expense_date?.slice(0,10)}</td>
                <td><span className="badge badge-blue">{e.category_name}</span></td>
                <td className="text-sm text-slate-500 max-w-xs truncate">{e.description||'—'}</td>
                <td><span className="font-mono text-red-500 font-semibold">{fmt(e.amount)}</span></td>
                <td className="text-xs text-slate-400">{e.created_by_name}</td>
                <td><button onClick={()=>setDel(e)} className="btn-danger p-1.5"><Trash2 size={13}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Expense Modal */}
      <Modal isOpen={modal} onClose={()=>setModal(false)} title="Add Expense" size="sm">
        <form onSubmit={onExpense} className="space-y-4">

          <div><label className="label">Category *</label>
            <select value={form.category_id} onChange={e=>handleCatChange(e.target.value)} className="input">
              <option value="">Select category…</option>
              {categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>

          {/* Diesel — pick vehicle */}
          {isDiesel && (
            <div><label className="label">Vehicle (optional)</label>
              <select value={form.reference_id} onChange={e=>handleVehicleChange(e.target.value)} className="input">
                <option value="">Select vehicle…</option>
                {vehicles.map(v=><option key={v.id} value={v.id}>{v.reg_number} — {v.make_model||''}</option>)}
              </select></div>
          )}

          {/* Shop Rent — pick shop */}
          {isShopRent && (
            <div><label className="label">Shop *</label>
              <select value={form.reference_id} onChange={e=>handleRefChange(e.target.value)} className="input">
                <option value="">Select shop…</option>
                {shopRefs.map(s=><option key={s.id} value={s.id}>{s.name} — {fmt(s.amount)}/month</option>)}
              </select></div>
          )}

          {/* Vehicle Rent — pick vehicle */}
          {isVehRent && (
            <div><label className="label">Rented Vehicle *</label>
              <select value={form.reference_id} onChange={e=>handleRefChange(e.target.value)} className="input">
                <option value="">Select vehicle…</option>
                {vehicleRentRefs.map(v=><option key={v.id} value={v.id}>{v.name} — {fmt(v.amount)}/month</option>)}
              </select></div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Date *</label>
              <input type="date" value={form.expense_date}
                onChange={e=>setForm(p=>({...p,expense_date:e.target.value}))} className="input"/></div>
            <div><label className="label">Amount (PKR) *</label>
              <input type="number" step="0.01" value={form.amount}
                onChange={e=>setForm(p=>({...p,amount:e.target.value}))} className="input font-mono"/></div>
          </div>

          <div><label className="label">Description</label>
            <input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
              className="input" placeholder="Optional details…"/></div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':'Save Expense'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!delTarget} onClose={()=>setDel(null)} onConfirm={deleteExpense}
        title="Delete Expense" message={`Delete ${delTarget?.category_name} of ${fmt(delTarget?.amount)}?`}/>
    </div>
  );
}
