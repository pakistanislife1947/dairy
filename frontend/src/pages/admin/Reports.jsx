import { useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Download, TrendingUp, TrendingDown, DollarSign, Droplets } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../api/client';
import { PageHeader, Skeleton } from '../../components/ui';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const fmtPKR = n => `Rs ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;
const fmtN   = n => Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 1 });

export default function Reports() {
  const [month, setMonth]   = useState(format(new Date(), 'yyyy-MM'));
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/reports/pl?month=${month}`);
      setData(r.data.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!data) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const s = data.summary;
    const [yr, mn] = month.split('-');
    const MONTHS = ['','January','February','March','April','May','June','July','August','September','October','November','December'];

    // Header
    doc.setFillColor(14, 165, 233);
    doc.rect(0, 0, 210, 32, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20); doc.setFont('helvetica', 'bold');
    doc.text('DAIRY ERP', 14, 14);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(`Profit & Loss Report — ${MONTHS[parseInt(mn)]} ${yr}`, 14, 22);
    doc.setFontSize(8);
    doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, 14, 29);

    // P&L Summary
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Financial Summary', 14, 44);

    autoTable(doc, {
      startY: 48,
      head: [['Description', 'Amount (PKR)']],
      body: [
        ['Milk Purchased', s.milk_purchase],
        ['Milk Sold (Revenue)', s.sales_revenue],
        ['Amount Received', s.sales_received],
        ['Total Expenses', s.total_expenses],
        ['Gross Profit', s.gross_profit],
        ['Net Profit', s.net_profit],
        ['Net Margin', `${s.margin_pct}%`],
      ],
      headStyles: { fillColor: [14, 165, 233], textColor: [255,255,255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [241, 245, 249] },
      columnStyles: { 1: { halign: 'right', font: 'courier' } },
      didParseCell: (hookData) => {
        if (hookData.row.index === 5) { // Net Profit row
          const isProfit = parseFloat(s.net_profit) >= 0;
          hookData.cell.styles.textColor = isProfit ? [16, 185, 129] : [239, 68, 68];
          hookData.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 14, right: 14 },
    });

    // Expense breakdown
    let y = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Expense Breakdown', 14, y);

    autoTable(doc, {
      startY: y + 4,
      head: [['Category', 'Amount (PKR)']],
      body: data.expense_breakdown.map(e => [e.category, e.amount]),
      headStyles: { fillColor: [100, 116, 139], textColor: [255,255,255] },
      columnStyles: { 1: { halign: 'right', font: 'courier' } },
      margin: { left: 14, right: 14 },
    });

    // Farmer breakdown
    y = doc.lastAutoTable.finalY + 12;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text('Farmer-wise Purchase', 14, y);

    autoTable(doc, {
      startY: y + 4,
      head: [['Code', 'Farmer', 'Litres', 'Avg FAT%', 'Amount (PKR)']],
      body: data.farmer_breakdown.map(f => [
        f.farmer_code, f.name,
        parseFloat(f.liters).toFixed(1),
        parseFloat(f.avg_fat).toFixed(1),
        parseFloat(f.amount).toLocaleString(),
      ]),
      headStyles: { fillColor: [14, 165, 233], textColor: [255,255,255] },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right', font: 'courier' } },
      margin: { left: 14, right: 14 },
    });

    // Sales breakdown
    if (data.sales_breakdown?.length) {
      y = doc.lastAutoTable.finalY + 12;
      doc.setFontSize(12); doc.setFont('helvetica', 'bold');
      doc.text('Sales by Company', 14, y);
      autoTable(doc, {
        startY: y + 4,
        head: [['Company', 'Litres', 'Revenue (PKR)']],
        body: data.sales_breakdown.map(s => [
          s.company, parseFloat(s.liters).toFixed(1), parseFloat(s.revenue).toLocaleString(),
        ]),
        headStyles: { fillColor: [16, 185, 129], textColor: [255,255,255] },
        columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right', font: 'courier' } },
        margin: { left: 14, right: 14 },
      });
    }

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(148, 163, 184);
      doc.text('Dairy ERP — Confidential', 14, 287);
      doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: 'right' });
    }

    doc.save(`PL_Report_${month}.pdf`);
    toast.success('PDF downloaded');
  };

  const s = data?.summary;

  const expenseChartData = (data?.expense_breakdown || [])
    .filter(e => parseFloat(e.amount) > 0)
    .map(e => ({ name: e.category, value: parseFloat(e.amount) }));

  const COLORS = ['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="Profit & Loss and financial analytics" />

      {/* Controls */}
      <div className="card flex flex-wrap items-end gap-4">
        <div>
          <label className="label">Select Month</label>
          <input type="month" className="input w-48" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
        <button onClick={load} disabled={loading} className="btn-primary">
          {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><BarChart3 size={16} />Generate Report</>}
        </button>
        {data && (
          <button onClick={generatePDF} className="btn-ghost border border-[#d1dce8]">
            <Download size={16} /> Export PDF
          </button>
        )}
      </div>

      {data && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Milk Purchased',  val: fmtPKR(s.milk_purchase),  icon: Droplets,    color: 'text-brand-400', bg: 'bg-brand-500/10' },
              { label: 'Sales Revenue',   val: fmtPKR(s.sales_revenue),  icon: TrendingUp,  color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Total Expenses',  val: fmtPKR(s.total_expenses), icon: DollarSign,  color: 'text-amber-400', bg: 'bg-amber-500/10' },
              {
                label: 'Net Profit',
                val: fmtPKR(s.net_profit),
                icon: parseFloat(s.net_profit) >= 0 ? TrendingUp : TrendingDown,
                color: parseFloat(s.net_profit) >= 0 ? 'text-emerald-400' : 'text-red-400',
                bg:    parseFloat(s.net_profit) >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10',
              },
            ].map(({ label, val, icon: Icon, color, bg }) => (
              <div key={label} className="card">
                <div className={`inline-flex w-10 h-10 rounded-xl ${bg} items-center justify-center mb-3`}>
                  <Icon size={20} className={color} />
                </div>
                <p className="text-xs text-muted mb-1">{label}</p>
                <p className={`text-xl font-bold font-mono ${color}`}>{val}</p>
              </div>
            ))}
          </div>

          {/* Margin callout */}
          <div className={`card border ${parseFloat(s.net_profit) >= 0 ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
            <div className="flex items-center gap-4">
              {parseFloat(s.net_profit) >= 0
                ? <TrendingUp size={28} className="text-emerald-400" />
                : <TrendingDown size={28} className="text-red-400" />
              }
              <div>
                <p className="font-bold text-slate-800">
                  Net Margin: <span className={parseFloat(s.net_profit) >= 0 ? 'text-emerald-400' : 'text-red-400'}>{s.margin_pct}%</span>
                </p>
                <p className="text-sm text-muted">
                  Gross Profit: {fmtPKR(s.gross_profit)} · Sold: {fmtN(s.sales_revenue > 0 ? s.milk_liters : 0)} L purchased, {fmtN(s.sold_liters)} L sold
                </p>
              </div>
            </div>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expense breakdown bar */}
            <div className="card">
              <h3 className="font-semibold text-slate-700 mb-4">Expense Breakdown</h3>
              {expenseChartData.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={expenseChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
                      tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={v => fmtPKR(v)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 12 }} />
                    <Bar dataKey="value" radius={[0,6,6,0]}>
                      {expenseChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-muted text-sm">No expenses recorded</div>
              )}
            </div>

            {/* Farmer breakdown table */}
            <div className="card p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-[#d1dce8]">
                <h3 className="font-semibold text-slate-700 text-sm">Farmer-wise Purchase</h3>
              </div>
              <div className="overflow-y-auto max-h-60">
                <table className="table-auto w-full">
                  <thead><tr><th>Farmer</th><th>Litres</th><th>Amount</th></tr></thead>
                  <tbody>
                    {data.farmer_breakdown.map((f, i) => (
                      <tr key={i}>
                        <td>
                          <div className="font-medium text-slate-700 text-sm">{f.name}</div>
                          <div className="text-xs text-muted font-mono">{f.farmer_code}</div>
                        </td>
                        <td><span className="font-mono text-sm">{parseFloat(f.liters).toFixed(1)}</span></td>
                        <td><span className="font-mono text-emerald-400 text-sm font-semibold">{fmtPKR(f.amount)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {!data && !loading && (
        <div className="card flex items-center justify-center h-52 text-muted text-sm">
          Select a month and click "Generate Report" to view your P&L
        </div>
      )}
    </div>
  );
}
