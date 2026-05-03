import { useState, useEffect, useRef } from 'react';
import { FileText, Plus, Printer, CreditCard, Search, CheckCircle, Clock, AlertCircle, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, EmptyState } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;
const statusBadge = { unpaid:'badge-red', partial:'badge-yellow', paid:'badge-green', cancelled:'badge-gray' };
const statusIcon  = { unpaid:<AlertCircle size={11}/>, partial:<Clock size={11}/>, paid:<CheckCircle size={11}/>, cancelled:<X size={11}/> };

function PrintView({ inv, onClose }) {
  const ref = useRef();
  const print = () => { window.print(); };
  if (!inv) return null;
  return (
    <div className="space-y-4">
      <div ref={ref} id="inv-print" className="bg-white p-6 rounded-xl border border-slate-200 text-sm">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-2xl font-bold text-slate-800">INVOICE</p>
            <p className="text-slate-500 text-xs mt-1">#{inv.invoice_no}</p>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Date: {inv.invoice_date}</p>
            {inv.due_date && <p>Due: {inv.due_date}</p>}
            <span className={`badge mt-1 ${statusBadge[inv.status]||'badge-gray'}`}>{inv.status}</span>
          </div>
        </div>
        {(inv.cname||inv.customer_name) && (
          <div className="mb-5 p-3 bg-slate-50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Bill To</p>
            <p className="font-semibold">{inv.cname||inv.customer_name}</p>
            {inv.phone && <p className="text-xs text-slate-500">{inv.phone}</p>}
            {inv.address && <p className="text-xs text-slate-500">{inv.address}</p>}
          </div>
        )}
        {inv.period_start && (
          <p className="text-xs text-slate-500 mb-4">Period: {inv.period_start} to {inv.period_end}</p>
        )}
        <table className="w-full mb-4">
          <thead><tr className="border-b border-slate-200">
            <th className="text-left text-xs text-slate-500 pb-2">Description</th>
            <th className="text-right text-xs text-slate-500 pb-2">Qty</th>
            <th className="text-right text-xs text-slate-500 pb-2">Rate</th>
            <th className="text-right text-xs text-slate-500 pb-2">Amount</th>
          </tr></thead>
          <tbody>
            {inv.items?.map((item,i)=>(
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 text-sm">{item.description}</td>
                <td className="py-2 text-right text-sm">{item.qty} {item.unit}</td>
                <td className="py-2 text-right text-sm font-mono">{fmt(item.rate)}</td>
                <td className="py-2 text-right text-sm font-mono font-semibold">{fmt(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-mono">{fmt(inv.subtotal)}</span></div>
          {parseFloat(inv.discount)>0 && <div className="flex justify-between text-red-500"><span>Discount</span><span className="font-mono">-{fmt(inv.discount)}</span></div>}
          {parseFloat(inv.tax_pct)>0 && <div className="flex justify-between"><span className="text-slate-500">Tax ({inv.tax_pct}%)</span><span className="font-mono">{fmt(inv.tax_amount)}</span></div>}
          <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-base"><span>Total</span><span className="font-mono text-[#1d6faa]">{fmt(inv.total_amount)}</span></div>
          {parseFloat(inv.paid_amount)>0 && <div className="flex justify-between text-emerald-600"><span>Paid</span><span className="font-mono">{fmt(inv.paid_amount)}</span></div>}
          {parseFloat(inv.total_amount)-parseFloat(inv.paid_amount)>0 && (
            <div className="flex justify-between text-red-600 font-semibold"><span>Balance Due</span><span className="font-mono">{fmt(parseFloat(inv.total_amount)-parseFloat(inv.paid_amount))}</span></div>
          )}
        </div>
        {inv.notes && <p className="text-xs text-slate-400 mt-4 border-t pt-3">{inv.notes}</p>}
        <p className="text-center text-xs text-slate-300 mt-6">Brimi Dairy · Developed by Quantum Solution Group</p>
      </div>
      <div className="flex gap-3">
        <button onClick={print} className="btn-primary flex-1"><Printer size={15}/>Print</button>
        <button onClick={onClose} className="btn-ghost flex-1">Close</button>
      </div>
      <style>{`@media print { body * { visibility:hidden; } #inv-print, #inv-print * { visibility:visible; } #inv-print { position:absolute;left:0;top:0;width:100%;padding:20px; } }`}</style>
    </div>
  );
}

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null);
  const [selInv, setSelInv]     = useState(null);
  const [detailData, setDetail] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [filters, setFilters]   = useState({ status:'', customer_id:'' });

  const [form, setForm] = useState({
    customer_id:'', customer_type:'bulk', customer_name:'', invoice_date: new Date().toISOString().slice(0,10),
    due_date:'', period_start:'', period_end:'', discount:0, tax_pct:0, notes:'',
    items:[{ description:'', qty:'', unit:'L', rate:'' }]
  });
  const [payForm, setPayForm] = useState({ amount:'', payment_date: new Date().toISOString().slice(0,10), method:'cash', reference:'' });
  const [editForm, setEditForm] = useState({ discount:0, tax_pct:0, notes:'' });

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([,v])=>v)));
    Promise.all([
      api.get(`/invoices?${q}`),
      api.get('/customers?limit=500'),
    ]).then(([inv,c])=>{ setInvoices(inv.data.data||[]); setCustomers(c.data.data||[]); }).finally(()=>setLoading(false));
  };
  useEffect(()=>{ load(); },[]);

  const openDetail = async (inv) => {
    setSelInv(inv); setModal('detail');
    const { data } = await api.get(`/invoices/${inv.id}`);
    setDetail(data.data);
    setEditForm({ discount: data.data.discount, tax_pct: data.data.tax_pct, notes: data.data.notes||'' });
    setPayForm(p=>({...p, amount: (parseFloat(data.data.total_amount)-parseFloat(data.data.paid_amount)).toFixed(0) }));
  };

  const addItem = () => setForm(p=>({...p, items:[...p.items,{ description:'', qty:'', unit:'L', rate:'' }]}));
  const removeItem = (i) => setForm(p=>({...p, items:p.items.filter((_,idx)=>idx!==i)}));
  const updateItem = (i, field, val) => setForm(p=>({...p, items:p.items.map((item,idx)=>idx===i?{...item,[field]:val}:item)}));

  const calcTotal = () => {
    const sub = form.items.reduce((s,i)=>s+parseFloat(i.qty||0)*parseFloat(i.rate||0),0);
    const disc = parseFloat(form.discount||0);
    const tax  = (sub-disc)*(parseFloat(form.tax_pct||0)/100);
    return { sub, disc, tax, total: sub-disc+tax };
  };

  const onCustomerSelect = (id) => {
    const c = customers.find(x=>String(x.id)===id);
    setForm(p=>({...p, customer_id:id, customer_name:c?.name||'', customer_type:c?.customer_type||'bulk' }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.post('/invoices', form);
      toast.success(`Invoice created: ${r.data.data.invoice_no}`);
      setModal(null); load();
    } catch(err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const onPayment = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/invoices/${selInv.id}/payment`, payForm);
      toast.success('Payment recorded');
      openDetail(selInv); load();
    } catch(err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const onEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/invoices/${selInv.id}`, editForm);
      toast.success('Invoice updated');
      openDetail(selInv); load();
    } catch(err) { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const { sub, disc, tax, total } = calcTotal();
  const totalOut = invoices.filter(i=>i.status!=='paid').reduce((s,i)=>s+parseFloat(i.total_amount)-parseFloat(i.paid_amount),0);

  return (
    <div className="space-y-5">
      <PageHeader title="Invoices" subtitle="Billing, payments and receivables"
        action={<button onClick={()=>setModal('create')} className="btn-primary"><Plus size={16}/>New Invoice</button>}/>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label:'Total Invoices', value: invoices.length, color:'text-slate-700' },
          { label:'Pending Amount', value: fmt(totalOut), color:'text-red-500' },
          { label:'Paid This Month', value: invoices.filter(i=>i.status==='paid').length + ' invoices', color:'text-emerald-600' },
        ].map(({label,value,color})=>(
          <div key={label} className="card">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card flex gap-3 items-end flex-wrap">
        <div><label className="label">Status</label>
          <select className="input" value={filters.status} onChange={e=>setFilters(p=>({...p,status:e.target.value}))}>
            <option value="">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
          </select></div>
        <div><label className="label">Customer</label>
          <select className="input" value={filters.customer_id} onChange={e=>setFilters(p=>({...p,customer_id:e.target.value}))}>
            <option value="">All customers</option>
            {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <button onClick={load} className="btn-primary">Apply</button>
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        <table className="table-auto w-full">
          <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Amount</th><th>Paid</th><th>Balance</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading…</td></tr>
            : invoices.length===0 ? <tr><td colSpan={8}><EmptyState icon={FileText} title="No invoices" description="Create your first invoice"/></td></tr>
            : invoices.map(inv=>(
              <tr key={inv.id} className="cursor-pointer" onClick={()=>openDetail(inv)}>
                <td><span className="font-mono text-xs text-[#1d6faa] font-semibold">{inv.invoice_no}</span></td>
                <td><div className="font-medium text-sm">{inv.cname||inv.customer_name||'Walk-in'}</div><div className="text-xs text-slate-400">{inv.customer_type}</div></td>
                <td className="text-xs text-slate-500">{inv.invoice_date}</td>
                <td className="font-mono font-semibold">{fmt(inv.total_amount)}</td>
                <td className="font-mono text-emerald-600">{fmt(inv.paid_amount)}</td>
                <td className="font-mono text-red-500">{fmt(parseFloat(inv.total_amount)-parseFloat(inv.paid_amount))}</td>
                <td><span className={`badge text-xs flex items-center gap-1 w-fit ${statusBadge[inv.status]||'badge-gray'}`}>{statusIcon[inv.status]}{inv.status}</span></td>
                <td><button className="btn-ghost p-1.5"><Printer size={13}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Invoice Modal */}
      <Modal isOpen={modal==='create'} onClose={()=>setModal(null)} title="New Invoice" size="md">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="label">Customer</label>
              <select className="input" value={form.customer_id} onChange={e=>onCustomerSelect(e.target.value)}>
                <option value="">Select customer…</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name} ({c.customer_type})</option>)}
              </select></div>
            <div><label className="label">Invoice Date</label>
              <input type="date" value={form.invoice_date} onChange={e=>setForm(p=>({...p,invoice_date:e.target.value}))} className="input"/></div>
            <div><label className="label">Due Date</label>
              <input type="date" value={form.due_date} onChange={e=>setForm(p=>({...p,due_date:e.target.value}))} className="input"/></div>
            <div><label className="label">Period From</label>
              <input type="date" value={form.period_start} onChange={e=>setForm(p=>({...p,period_start:e.target.value}))} className="input"/></div>
            <div><label className="label">Period To</label>
              <input type="date" value={form.period_end} onChange={e=>setForm(p=>({...p,period_end:e.target.value}))} className="input"/></div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Line Items</label>
              <button type="button" onClick={addItem} className="btn-ghost text-xs py-1 px-2"><Plus size={12}/>Add Row</button>
            </div>
            <div className="space-y-2">
              {form.items.map((item,i)=>(
                <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                  <input placeholder="Description" value={item.description} onChange={e=>updateItem(i,'description',e.target.value)} className="input col-span-5 text-xs py-1.5"/>
                  <input type="number" placeholder="Qty" step="0.01" value={item.qty} onChange={e=>updateItem(i,'qty',e.target.value)} className="input col-span-2 font-mono text-xs py-1.5"/>
                  <select value={item.unit} onChange={e=>updateItem(i,'unit',e.target.value)} className="input col-span-2 text-xs py-1.5">
                    <option>L</option><option>kg</option><option>pcs</option>
                  </select>
                  <input type="number" placeholder="Rate" step="0.01" value={item.rate} onChange={e=>updateItem(i,'rate',e.target.value)} className="input col-span-2 font-mono text-xs py-1.5"/>
                  <button type="button" onClick={()=>removeItem(i)} className="text-red-400 hover:text-red-600 col-span-1 flex justify-center"><X size={14}/></button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Discount (PKR)</label>
              <input type="number" step="0.01" value={form.discount} onChange={e=>setForm(p=>({...p,discount:e.target.value}))} className="input font-mono"/></div>
            <div><label className="label">Tax %</label>
              <input type="number" step="0.1" value={form.tax_pct} onChange={e=>setForm(p=>({...p,tax_pct:e.target.value}))} className="input font-mono"/></div>
          </div>

          {sub>0 && (
            <div className="bg-blue-50 rounded-xl p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span className="font-mono">{fmt(sub)}</span></div>
              {disc>0&&<div className="flex justify-between text-red-500"><span>Discount</span><span className="font-mono">-{fmt(disc)}</span></div>}
              {tax>0&&<div className="flex justify-between"><span className="text-slate-500">Tax</span><span className="font-mono">{fmt(tax)}</span></div>}
              <div className="flex justify-between font-bold text-base border-t border-blue-200 pt-2"><span>Total</span><span className="font-mono text-[#1d6faa]">{fmt(total)}</span></div>
            </div>
          )}

          <div><label className="label">Notes</label>
            <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="input"/></div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(null)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Creating…':'Create Invoice'}</button>
          </div>
        </form>
      </Modal>

      {/* Invoice Detail Modal */}
      <Modal isOpen={modal==='detail'} onClose={()=>setModal(null)} title={`Invoice ${selInv?.invoice_no||''}`} size="md">
        {detailData ? (
          <div className="space-y-5">
            {/* Print view */}
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setModal('print')} className="btn-ghost text-sm"><Printer size={14}/>Print</button>
            </div>

            <PrintView inv={detailData} onClose={()=>setModal('detail')}/>

            {/* Edit discount/tax */}
            {detailData.status !== 'paid' && (
              <div className="border border-slate-200 rounded-xl p-4 space-y-3">
                <p className="font-semibold text-sm text-slate-600 flex items-center gap-2"><Pencil size={13}/>Edit Invoice</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="label">Discount (PKR)</label>
                    <input type="number" step="0.01" value={editForm.discount} onChange={e=>setEditForm(p=>({...p,discount:e.target.value}))} className="input font-mono"/></div>
                  <div><label className="label">Tax %</label>
                    <input type="number" step="0.1" value={editForm.tax_pct} onChange={e=>setEditForm(p=>({...p,tax_pct:e.target.value}))} className="input font-mono"/></div>
                </div>
                <input value={editForm.notes} onChange={e=>setEditForm(p=>({...p,notes:e.target.value}))} className="input" placeholder="Notes…"/>
                <button onClick={onEdit} disabled={saving} className="btn-primary w-full">{saving?'…':'Save Changes'}</button>
              </div>
            )}

            {/* Record Payment */}
            {detailData.status !== 'paid' && (
              <form onSubmit={onPayment} className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 space-y-3">
                <p className="font-semibold text-sm text-emerald-700 flex items-center gap-2"><CreditCard size={13}/>Record Payment</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="label">Amount</label>
                    <input type="number" step="0.01" value={payForm.amount} onChange={e=>setPayForm(p=>({...p,amount:e.target.value}))} className="input font-mono"/></div>
                  <div><label className="label">Date</label>
                    <input type="date" value={payForm.payment_date} onChange={e=>setPayForm(p=>({...p,payment_date:e.target.value}))} className="input"/></div>
                  <div><label className="label">Method</label>
                    <select value={payForm.method} onChange={e=>setPayForm(p=>({...p,method:e.target.value}))} className="input">
                      <option value="cash">Cash</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="upi">UPI/Easypaisa</option>
                    </select></div>
                  <div><label className="label">Reference</label>
                    <input value={payForm.reference} onChange={e=>setPayForm(p=>({...p,reference:e.target.value}))} className="input" placeholder="Txn #"/></div>
                </div>
                <button type="submit" disabled={saving} className="btn-primary w-full">{saving?'…':'Record Payment'}</button>
              </form>
            )}

            {/* Payment history */}
            {detailData.payments?.length > 0 && (
              <div>
                <p className="font-semibold text-sm text-slate-600 mb-2">Payments</p>
                {detailData.payments.map(p=>(
                  <div key={p.id} className="flex justify-between text-sm border border-slate-100 rounded-lg px-3 py-2 mb-1">
                    <span className="text-slate-500">{p.payment_date} · {p.method}</span>
                    <span className="font-mono font-semibold text-emerald-600">{fmt(p.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : <div className="py-8 text-center text-slate-400">Loading…</div>}
      </Modal>
    </div>
  );
}
