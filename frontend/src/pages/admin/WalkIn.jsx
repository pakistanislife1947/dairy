import { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Minus, Printer, Milk, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { PageHeader } from '../../components/ui';

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

export default function WalkIn() {
  const [products, setProducts] = useState([]);
  const [milkRate, setMilkRate] = useState('');
  const [milkQty, setMilkQty]   = useState('');
  const [items, setItems]       = useState([]);
  const [saving, setSaving]     = useState(false);
  const [receipt, setReceipt]   = useState(null);

  useEffect(()=>{
    api.get('/products').then(r=>setProducts(r.data.data||[]));
  },[]);

  const addProduct = (p) => {
    setItems(prev=>{
      const ex = prev.find(i=>i.product_id===p.id);
      if(ex) return prev.map(i=>i.product_id===p.id?{...i,qty:i.qty+1}:i);
      return [...prev,{product_id:p.id,product_name:p.name,qty:1,price:parseFloat(p.price),unit:p.unit_type}];
    });
  };

  const adjustQty = (pid, delta) => {
    setItems(prev=>prev.map(i=>i.product_id===pid?{...i,qty:Math.max(0,i.qty+delta)}:i).filter(i=>i.qty>0));
  };

  const milkAmount    = parseFloat(milkQty||0)*parseFloat(milkRate||0);
  const productsAmount = items.reduce((s,i)=>s+i.qty*i.price,0);
  const total         = milkAmount+productsAmount;

  const onSale = async () => {
    if(total<=0) return toast.error('Add items to sell');
    setSaving(true);
    try {
      const r = await api.post('/customers/sale',{
        customer_type:'walkin',
        milk_qty: milkQty||0,
        milk_rate: milkRate||0,
        items,
        sale_date: new Date().toISOString().slice(0,10),
      });
      const rec = r.data.data;
      setReceipt({ no:rec.receipt_no, date:new Date().toLocaleDateString('en-PK'), milkQty, milkRate, milkAmount, items:[...items], productsAmount, total });
      setMilkQty(''); setMilkRate(''); setItems([]);
      toast.success(`Receipt: ${rec.receipt_no}`);
    } catch(err){ toast.error(err.response?.data?.message||'Failed'); }
    finally{ setSaving(false); }
  };

  const printReceipt = () => window.print();

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <PageHeader title="Walk-in Sale" subtitle="Immediate cash sale — no customer details required"/>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Left: Products */}
        <div className="space-y-4">
          {/* Milk section */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><Milk size={16} className="text-[#1d6faa]"/></div>
              <p className="font-semibold text-slate-700">Milk</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Quantity (L)</label>
                <input type="number" step="0.1" value={milkQty} onChange={e=>setMilkQty(e.target.value)}
                  className="input font-mono text-lg" placeholder="0"/>
              </div>
              <div>
                <label className="label">Rate/L (PKR)</label>
                <input type="number" step="0.01" value={milkRate} onChange={e=>setMilkRate(e.target.value)}
                  className="input font-mono text-lg" placeholder="0"/>
              </div>
            </div>
            {milkAmount>0 && <div className="mt-3 bg-blue-50 rounded-lg px-3 py-2 text-sm font-semibold text-[#1d6faa]">Milk: {fmt(milkAmount)}</div>}
          </div>

          {/* Products */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center"><Package size={16} className="text-purple-600"/></div>
              <p className="font-semibold text-slate-700">Products</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {products.map(p=>(
                <button key={p.id} onClick={()=>addProduct(p)}
                  className="flex flex-col items-start gap-1 border-2 border-slate-200 rounded-xl p-3 hover:border-[#1d6faa] hover:bg-blue-50 transition group text-left">
                  <span className="font-semibold text-slate-700 text-sm group-hover:text-[#1d6faa]">{p.name}</span>
                  <div className="flex items-center justify-between w-full">
                    <span className="font-mono font-bold text-[#1d6faa] text-sm">{fmt(p.price)}<span className="text-xs text-slate-400">/{p.unit_type}</span></span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${parseFloat(p.stock_qty)<5?'bg-red-100 text-red-600':'bg-emerald-100 text-emerald-600'}`}>{p.stock_qty}</span>
                  </div>
                </button>
              ))}
              {products.length===0 && <p className="col-span-2 text-slate-400 text-sm text-center py-4">No products. Add from Products page.</p>}
            </div>
          </div>
        </div>

        {/* Right: Bill */}
        <div className="card space-y-4 h-fit sticky top-4">
          <p className="font-semibold text-slate-700 text-base">Current Bill</p>

          {/* Selected items */}
          <div className="space-y-2 min-h-[120px]">
            {milkQty>0 && milkRate>0 && (
              <div className="flex items-center justify-between bg-blue-50 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium text-sm">Milk</p>
                  <p className="text-xs text-slate-400">{milkQty}L × {fmt(milkRate)}/L</p>
                </div>
                <span className="font-mono font-bold text-[#1d6faa]">{fmt(milkAmount)}</span>
              </div>
            )}
            {items.map(item=>(
              <div key={item.product_id} className="flex items-center justify-between border border-slate-200 rounded-xl px-4 py-3">
                <div>
                  <p className="font-medium text-sm">{item.product_name}</p>
                  <p className="text-xs text-slate-400">{fmt(item.price)}/{item.unit}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={()=>adjustQty(item.product_id,-1)} className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200"><Minus size={13}/></button>
                  <span className="font-bold w-6 text-center">{item.qty}</span>
                  <button onClick={()=>adjustQty(item.product_id,1)} className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center hover:bg-slate-200"><Plus size={13}/></button>
                  <span className="font-mono font-semibold w-20 text-right">{fmt(item.qty*item.price)}</span>
                </div>
              </div>
            ))}
            {total===0 && <div className="text-center py-8 text-slate-300"><ShoppingBag size={32} className="mx-auto mb-2"/><p className="text-sm">Add items from the left</p></div>}
          </div>

          <div className="border-t border-slate-200 pt-4 space-y-2">
            {milkAmount>0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Milk</span><span className="font-mono">{fmt(milkAmount)}</span></div>}
            {productsAmount>0 && <div className="flex justify-between text-sm"><span className="text-slate-500">Products</span><span className="font-mono">{fmt(productsAmount)}</span></div>}
            <div className="flex justify-between font-bold text-xl border-t border-slate-200 pt-3">
              <span>Total</span>
              <span className="font-mono text-[#1d6faa]">{fmt(total)}</span>
            </div>
          </div>

          <button onClick={onSale} disabled={saving||total===0}
            className="btn-primary w-full py-3 text-base">
            {saving?'Processing…':<><Printer size={16}/>Complete Sale & Print Receipt</>}
          </button>

          <p className="text-xs text-slate-400 text-center">Cash payment only · No credit</p>
        </div>
      </div>

      {/* Receipt print area */}
      {receipt && (
        <div id="receipt-print" className="hidden">
          <div style={{ fontFamily:'monospace', fontSize:12, padding:16, maxWidth:280 }}>
            <p style={{ textAlign:'center', fontWeight:'bold', fontSize:16 }}>Brimi Dairy</p>
            <p style={{ textAlign:'center', fontSize:11, color:'#888' }}>Walk-in Receipt</p>
            <p style={{ textAlign:'center', fontSize:10 }}>#{receipt.no} · {receipt.date}</p>
            <hr style={{ margin:'8px 0', border:'none', borderTop:'1px dashed #ccc' }}/>
            {parseFloat(receipt.milkQty)>0 && (
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span>Milk {receipt.milkQty}L</span><span>{fmt(receipt.milkAmount)}</span>
              </div>
            )}
            {receipt.items.map((i,idx)=>(
              <div key={idx} style={{ display:'flex', justifyContent:'space-between' }}>
                <span>{i.product_name} x{i.qty}</span><span>{fmt(i.qty*i.price)}</span>
              </div>
            ))}
            <hr style={{ margin:'8px 0', border:'none', borderTop:'1px dashed #ccc' }}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontWeight:'bold', fontSize:14 }}>
              <span>TOTAL</span><span>{fmt(receipt.total)}</span>
            </div>
            <p style={{ textAlign:'center', fontSize:10, marginTop:12, color:'#888' }}>Thank you!</p>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body > * { display: none !important; }
          #receipt-print { display: block !important; }
        }
      `}</style>
    </div>
  );
}
