import { useState, useEffect } from 'react';
import { Package, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader, Modal, EmptyState } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(false);
  const [editing, setEditing]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState({ name:'', price:'', unit_type:'liter', stock_qty:'' });

  const load = () => api.get('/products').then(r=>setProducts(r.data.data||[])).finally(()=>setLoading(false));
  useEffect(()=>{ load(); },[]);

  const openEdit = (p) => { setEditing(p); setForm({ name:p.name, price:p.price, unit_type:p.unit_type, stock_qty:p.stock_qty }); setModal(true); };
  const openAdd  = () => { setEditing(null); setForm({ name:'', price:'', unit_type:'liter', stock_qty:'' }); setModal(true); };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price) return toast.error('Name and price required');
    setSaving(true);
    try {
      if (editing) await api.put(`/products/${editing.id}`, form);
      else await api.post('/products', form);
      toast.success(editing ? 'Updated' : 'Product added');
      setModal(false); load();
    } catch (err) { toast.error(err.response?.data?.message||'Failed'); }
    finally { setSaving(false); }
  };

  const del = async (id) => {
    if (!confirm('Delete this product?')) return;
    await api.delete(`/products/${id}`); toast.success('Deleted'); load();
  };

  const addStock = async (p) => {
    const qty = parseFloat(prompt(`Add stock for ${p.name} (current: ${p.stock_qty})`) || 0);
    if (qty) { await api.patch(`/products/${p.id}/stock`, { delta: qty }); load(); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Products" subtitle="Dahi, Ghee, Lassi and other dairy products"
        action={<button onClick={openAdd} className="btn-primary"><Plus size={16}/>Add Product</button>}/>

      <div className="card p-0 overflow-hidden">
        <table className="table-auto w-full">
          <thead><tr><th>Product</th><th>Price</th><th>Unit</th><th>Stock</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="py-8 text-center text-slate-400">Loading…</td></tr>
            : products.length===0 ? <tr><td colSpan={5}><EmptyState icon={Package} title="No products" description="Add dairy products"/></td></tr>
            : products.map(p=>(
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td className="font-mono font-semibold text-[#1d6faa]">{fmt(p.price)}</td>
                <td><span className="badge badge-gray">{p.unit_type}</span></td>
                <td>
                  <span className={`font-mono font-semibold ${parseFloat(p.stock_qty)<5?'text-red-500':'text-emerald-600'}`}>
                    {p.stock_qty} {p.unit_type}
                  </span>
                </td>
                <td>
                  <div className="flex gap-2">
                    <button onClick={()=>addStock(p)} className="btn-ghost text-xs py-1 px-2">+ Stock</button>
                    <button onClick={()=>openEdit(p)} className="btn-ghost p-1.5"><Pencil size={13}/></button>
                    <button onClick={()=>del(p.id)} className="btn-danger p-1.5"><Trash2 size={13}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={modal} onClose={()=>setModal(false)} title={editing?'Edit Product':'Add Product'} size="sm">
        <form onSubmit={onSubmit} className="space-y-4">
          <div><label className="label">Product Name *</label>
            <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="input" placeholder="Dahi, Ghee…"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Price (PKR) *</label>
              <input type="number" step="0.01" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))} className="input font-mono"/></div>
            <div><label className="label">Unit</label>
              <select value={form.unit_type} onChange={e=>setForm(p=>({...p,unit_type:e.target.value}))} className="input">
                <option value="liter">Liter</option><option value="kg">KG</option><option value="piece">Piece</option>
              </select></div>
          </div>
          <div><label className="label">Initial Stock</label>
            <input type="number" step="0.1" value={form.stock_qty} onChange={e=>setForm(p=>({...p,stock_qty:e.target.value}))} className="input font-mono" placeholder="0"/></div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>setModal(false)} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving?'Saving…':'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
