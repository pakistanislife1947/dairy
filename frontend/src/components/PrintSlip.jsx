import { useEffect, useState } from 'react';
import api from '../api/client';

export function useLogo() {
  const [logo, setLogo] = useState('');
  const [appName, setAppName] = useState('Brimi Dairy');
  useEffect(() => {
    api.get('/settings').then(({ data }) => {
      if (data.settings?.logo_url) setLogo(data.settings.logo_url);
      if (data.settings?.app_name) setAppName(data.settings.app_name);
    }).catch(() => {});
  }, []);
  return { logo, appName };
}

const fmt = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

export function InvoicePrint({ data, onClose }) {
  const { logo, appName } = useLogo();
  if (!data) return null;

  const balance = parseFloat(data.total_amount||0) - parseFloat(data.paid_amount||0);

  return (
    <>
      {/* Screen view */}
      <div className="space-y-4">
        <div id="invoice-print-area" style={{ fontFamily:'Inter,sans-serif', background:'#fff', borderRadius:12, border:'1px solid #e2e8f0', padding:'24px', maxWidth:480, margin:'0 auto' }}>

          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, paddingBottom:16, borderBottom:'2px solid #1b6ca8' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              {logo && <img src={logo} alt="logo" style={{ height:40, width:40, objectFit:'contain', borderRadius:8 }}/>}
              <div>
                <p style={{ margin:0, fontWeight:800, fontSize:16, color:'#0a2540' }}>{appName}</p>
                <p style={{ margin:0, fontSize:10, color:'#94a3b8' }}>Dairy Management</p>
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ margin:0, fontSize:18, fontWeight:800, color:'#1b6ca8' }}>INVOICE</p>
              <p style={{ margin:0, fontSize:11, color:'#64748b', fontFamily:'monospace' }}>#{data.invoice_no}</p>
              <span style={{ display:'inline-block', marginTop:4, padding:'2px 8px', borderRadius:99, fontSize:10, fontWeight:600,
                background: data.status==='paid'?'#dcfce7':data.status==='partial'?'#fef9c3':'#fee2e2',
                color: data.status==='paid'?'#166534':data.status==='partial'?'#854d0e':'#991b1b' }}>
                {(data.status||'').toUpperCase()}
              </span>
            </div>
          </div>

          {/* Dates & Customer */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div>
              <p style={{ margin:0, fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Bill To</p>
              <p style={{ margin:0, fontWeight:700, fontSize:13, color:'#1a2636' }}>{data.cname||data.customer_name||'Walk-in Customer'}</p>
              {data.phone && <p style={{ margin:0, fontSize:11, color:'#64748b' }}>{data.phone}</p>}
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ margin:0, fontSize:9, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>Invoice Date</p>
              <p style={{ margin:0, fontSize:12, color:'#1a2636', fontWeight:600 }}>{data.invoice_date}</p>
              {data.due_date && <><p style={{ margin:'8px 0 4px', fontSize:9, color:'#94a3b8', textTransform:'uppercase' }}>Due Date</p><p style={{ margin:0, fontSize:12, color:'#dc2626', fontWeight:600 }}>{data.due_date}</p></>}
              {data.period_start && <p style={{ margin:'6px 0 0', fontSize:10, color:'#94a3b8' }}>{data.period_start} → {data.period_end}</p>}
            </div>
          </div>

          {/* Items table */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:16, fontSize:12 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                <th style={{ textAlign:'left', padding:'8px 10px', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, borderBottom:'1px solid #e2e8f0' }}>Description</th>
                <th style={{ textAlign:'right', padding:'8px 10px', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, borderBottom:'1px solid #e2e8f0' }}>Qty</th>
                <th style={{ textAlign:'right', padding:'8px 10px', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, borderBottom:'1px solid #e2e8f0' }}>Rate</th>
                <th style={{ textAlign:'right', padding:'8px 10px', color:'#64748b', fontSize:10, textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:600, borderBottom:'1px solid #e2e8f0' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.items?.map((item,i) => (
                <tr key={i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                  <td style={{ padding:'8px 10px', color:'#1a2636' }}>{item.description}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', color:'#64748b', fontFamily:'monospace' }}>{item.qty} {item.unit}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', color:'#64748b', fontFamily:'monospace' }}>{fmt(item.rate)}</td>
                  <td style={{ padding:'8px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:600, color:'#1a2636' }}>{fmt(item.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ background:'#f8fafc', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
            {parseFloat(data.discount)>0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#64748b', marginBottom:6 }}>
                <span>Subtotal</span><span style={{ fontFamily:'monospace' }}>{fmt(data.subtotal)}</span>
              </div>
            )}
            {parseFloat(data.discount)>0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#dc2626', marginBottom:6 }}>
                <span>Discount</span><span style={{ fontFamily:'monospace' }}>-{fmt(data.discount)}</span>
              </div>
            )}
            {parseFloat(data.tax_pct)>0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#64748b', marginBottom:6 }}>
                <span>Tax ({data.tax_pct}%)</span><span style={{ fontFamily:'monospace' }}>{fmt(data.tax_amount)}</span>
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:800, color:'#1b6ca8', borderTop:'1px solid #e2e8f0', paddingTop:8 }}>
              <span>Total</span><span style={{ fontFamily:'monospace' }}>{fmt(data.total_amount)}</span>
            </div>
            {parseFloat(data.paid_amount)>0 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#16a34a', marginTop:6 }}>
                <span>Paid</span><span style={{ fontFamily:'monospace' }}>{fmt(data.paid_amount)}</span>
              </div>
            )}
            {balance>0.01 && (
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700, color:'#dc2626', marginTop:4 }}>
                <span>Balance Due</span><span style={{ fontFamily:'monospace' }}>{fmt(balance)}</span>
              </div>
            )}
          </div>

          {data.notes && <p style={{ fontSize:11, color:'#94a3b8', borderTop:'1px dashed #e2e8f0', paddingTop:12 }}>{data.notes}</p>}

          <p style={{ textAlign:'center', fontSize:10, color:'#cbd5e1', marginTop:16 }}>
            Thank you for your business · Developed by Quantum Solution Group
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 max-w-sm mx-auto">
          <button onClick={() => window.print()} className="btn-primary flex-1">🖨️ Print</button>
          <button onClick={onClose} className="btn-ghost flex-1">Close</button>
        </div>
      </div>

      <style>{`
        @media print {
          body > * { visibility: hidden !important; }
          #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
          #invoice-print-area {
            position: fixed !important; left: 0 !important; top: 0 !important;
            width: 148mm !important; max-width: 148mm !important;
            padding: 12mm !important; margin: 0 !important;
            border: none !important; border-radius: 0 !important;
            font-size: 10pt !important;
          }
        }
      `}</style>
    </>
  );
}
