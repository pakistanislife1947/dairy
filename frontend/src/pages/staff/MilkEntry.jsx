import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Milk, Sun, Moon, Calculator, CheckCircle, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';

export default function MilkEntry() {
  const { user } = useAuthStore();
  const [farmers, setFarmers]     = useState([]);
  const [preview, setPreview]     = useState(null);
  const [previewing, setPrev]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [lastSaved, setLast]      = useState(null);
  const [todayRecords, setToday]  = useState([]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const defaultShift = parseInt(format(new Date(), 'HH')) < 12 ? 'morning' : 'evening';

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      farmer_id:          '',
      collection_date:    todayStr,
      shift:              defaultShift,
      quantity_liters:    '',
      fat_percentage:     '',
      lactometer_reading: '',
      snf_percentage:     '',
      notes:              '',
    },
  });

  const [wFarmer, wFat, wLR, wQty, wShift] =
    watch(['farmer_id', 'fat_percentage', 'lactometer_reading', 'quantity_liters', 'shift']);

  useEffect(() => {
    api.get('/farmers?limit=200&active=1')
      .then(r => setFarmers(r.data.data || []))
      .catch(() => toast.error('Could not load farmers'));
  }, []);

  const loadToday = () => {
    api.get(`/milk?date_from=${todayStr}&date_to=${todayStr}&limit=50`)
      .then(r => setToday(r.data.data || []))
      .catch(() => {});
  };
  useEffect(() => { loadToday(); }, []);

  // Live TS preview
  useEffect(() => {
    if (!wFat || !wLR || !wQty || parseFloat(wQty) <= 0) { setPreview(null); return; }
    const t = setTimeout(() => {
      setPrev(true);
      api.post('/milk/preview-rate', {
        fat_percentage: parseFloat(wFat),
        lactometer_reading: parseFloat(wLR),
        quantity_liters: parseFloat(wQty),
      })
        .then(r => setPreview(r.data.data))
        .catch(() => setPreview(null))
        .finally(() => setPrev(false));
    }, 600);
    return () => clearTimeout(t);
  }, [wFat, wLR, wQty]);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const r = await api.post('/milk', data);
      const result = r.data.data;
      const farmer = farmers.find(f => String(f.id) === String(data.farmer_id));

      setLast({ farmer: farmer?.name || '', shift: data.shift, liters: data.quantity_liters, ts: result.ts });
      toast.success('✓ Milk record saved');

      setValue('quantity_liters', '');
      setValue('fat_percentage',  '');
      setValue('lactometer_reading', '');
      setValue('snf_percentage',  '');
      setValue('notes', '');
      setPreview(null);
      loadToday();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const selectedFarmer = farmers.find(f => String(f.id) === String(wFarmer));

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Milk Collection Entry</h1>
        <p className="text-sm text-muted mt-0.5">{format(new Date(), 'EEEE, dd MMM yyyy')} · {format(new Date(), 'hh:mm a')}</p>
      </div>

      {lastSaved && (
        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
          <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-0.5"/>
          <div className="text-sm">
            <p className="font-semibold text-emerald-400">Last Saved</p>
            <p className="text-emerald-300/80 text-xs mt-0.5">
              {lastSaved.farmer} · {lastSaved.liters}L · TS: {lastSaved.ts}
            </p>
          </div>
        </div>
      )}

      {/* Shift */}
      <div>
        <label className="label">Shift *</label>
        <div className="grid grid-cols-2 gap-3">
          {['morning','evening'].map(s => (
            <button key={s} type="button" onClick={() => setValue('shift', s)}
              className={`flex items-center justify-center gap-2 py-4 rounded-2xl border-2 font-semibold text-sm transition-all
                ${wShift === s
                  ? s === 'morning' ? 'bg-amber-500/20 border-amber-500 text-amber-600' : 'bg-blue-500/20 border-blue-500 text-blue-600'
                  : 'bg-white border-slate-200 text-slate-400'}`}>
              {s === 'morning' ? <Sun size={18}/> : <Moon size={18}/>}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* Date — prefilled, shown read-only style */}
        <div>
          <label className="label">Date</label>
          <input type="date" {...register('collection_date')}
            className="input text-base py-3 bg-slate-50 font-mono"/>
        </div>

        {/* Farmer */}
        <div>
          <label className="label">Farmer / Centre *</label>
          <div className="relative">
            <select {...register('farmer_id', { required: 'Select a farmer' })}
              className="input text-base py-3.5 pr-10 appearance-none">
              <option value="">Select farmer…</option>
              {farmers.map(f => (
                <option key={f.id} value={f.id}>{f.name} ({f.farmer_code})</option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none"/>
          </div>
          {errors.farmer_id && <p className="text-red-400 text-xs mt-1 flex items-center gap-1"><AlertCircle size={12}/>{errors.farmer_id.message}</p>}
          {selectedFarmer && (
            <div className="mt-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-100 text-xs text-slate-500 flex gap-4">
              <span>Code: <strong className="text-slate-700">{selectedFarmer.farmer_code}</strong></span>
              <span>Village: <strong className="text-slate-700">{selectedFarmer.village || '—'}</strong></span>
            </div>
          )}
        </div>

        {/* Quantity */}
        <div>
          <label className="label">Milk Weight (KG / Litres) *</label>
          <input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
            {...register('quantity_liters', { required: 'Required', min: { value: 0.01, message: 'Must be > 0' } })}
            className="input text-xl font-mono font-bold py-4 text-center tracking-wide"/>
          {errors.quantity_liters && <p className="text-red-400 text-xs mt-1">{errors.quantity_liters.message}</p>}
        </div>

        {/* FAT + LR side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">FAT % *</label>
            <input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
              {...register('fat_percentage', { required: 'Required', min:0, max:20 })}
              className="input text-lg font-mono font-semibold py-3.5 text-center text-blue-600"/>
            {errors.fat_percentage && <p className="text-red-400 text-xs mt-1">{errors.fat_percentage.message}</p>}
          </div>
          <div>
            <label className="label">LR (Lactometer) *</label>
            <input type="number" inputMode="decimal" step="0.1" placeholder="0.0"
              {...register('lactometer_reading', { required: 'Required', min: { value: 0, message: 'Min 0' } })}
              className="input text-lg font-mono font-semibold py-3.5 text-center text-violet-600"/>
            {errors.lactometer_reading && <p className="text-red-400 text-xs mt-1">{errors.lactometer_reading.message}</p>}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes <span className="text-muted normal-case font-normal">(optional)</span></label>
          <input {...register('notes')} placeholder="Any remarks…" className="input py-3"/>
        </div>

        {/* TS Preview — NO price shown for purchase role */}
        {(preview || previewing) && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            {previewing ? (
              <div className="flex items-center justify-center gap-2 text-blue-500 text-sm">
                <RefreshCw size={15} className="animate-spin"/>Calculating TS…
              </div>
            ) : preview && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calculator size={16} className="text-blue-500"/>
                  <p className="text-sm font-semibold text-blue-700">TS Calculation Preview</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-slate-400 mb-1">Total Solids (TS)</p>
                    <p className="font-bold text-xl font-mono text-blue-700">{preview.ts}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-blue-100">
                    <p className="text-xs text-slate-400 mb-1">Standardised TS</p>
                    <p className="font-bold text-xl font-mono text-violet-700">{preview.standardised_ts}</p>
                  </div>
                </div>
                {/* Show price ONLY if admin/non-purchase-staff */}
                {preview.rate_per_unit !== undefined && (
                  <div className="grid grid-cols-2 gap-3 text-center mt-3">
                    <div className="bg-white rounded-xl p-3 border border-emerald-100">
                      <p className="text-xs text-slate-400 mb-1">Rate / Unit</p>
                      <p className="font-bold text-lg font-mono text-emerald-700">Rs {Number(preview.rate_per_unit).toFixed(2)}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-emerald-100">
                      <p className="text-xs text-slate-400 mb-1">Total Payout</p>
                      <p className="font-bold text-xl font-mono text-emerald-700">Rs {Number(preview.total_payout).toLocaleString('en-PK', {maximumFractionDigits:0})}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={saving}
          className="w-full py-5 rounded-2xl bg-[#1d6faa] hover:bg-[#1557a0] active:scale-[0.98]
                     text-white font-bold text-lg flex items-center justify-center gap-3
                     transition-all disabled:opacity-60 shadow-lg">
          {saving
            ? <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            : <><Milk size={22}/>Save Collection</>}
        </button>
      </form>

      {/* Today's entries */}
      {todayRecords.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Today's Entries ({todayRecords.length})</h3>
          <div className="space-y-2">
            {todayRecords.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${r.shift==='morning'?'bg-amber-50':'bg-slate-100'}`}>
                    {r.shift==='morning'?<Sun size={14} className="text-amber-500"/>:<Moon size={14} className="text-slate-400"/>}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{r.farmer_name}</p>
                    <p className="text-xs text-slate-400 font-mono">
                      {parseFloat(r.quantity_liters).toFixed(1)}L · FAT {parseFloat(r.fat_percentage).toFixed(1)}%
                      {r.lactometer_reading ? ` · LR ${r.lactometer_reading}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {r.ts_value ? <p className="text-xs font-mono text-blue-600">TS: {parseFloat(r.ts_value).toFixed(2)}</p> : null}
                  {/* Price hidden from purchase employees by backend */}
                  {r.total_amount !== undefined && r.total_amount !== null && (
                    <p className="text-sm font-bold font-mono text-emerald-600">
                      Rs {Number(r.total_amount).toLocaleString('en-PK',{maximumFractionDigits:0})}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
