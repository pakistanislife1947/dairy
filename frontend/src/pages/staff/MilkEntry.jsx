import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm } from 'react-hook-form';
import {
  Milk, Sun, Moon, Calculator, CheckCircle,
  ChevronDown, RefreshCw, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../api/client';

const fmtPKR = n => `Rs ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 0 })}`;

export default function MilkEntry() {
  const [farmers, setFarmers]   = useState([]);
  const [preview, setPreview]   = useState(null);
  const [previewing, setPrev]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [lastSaved, setLast]    = useState(null);
  const [todayRecords, setToday] = useState([]);

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm({
    defaultValues: {
      farmer_id:       '',
      collection_date: format(new Date(), 'yyyy-MM-dd'),
      shift:           format(new Date(), 'HH') < '12' ? 'morning' : 'evening',
      quantity_liters: '',
      fat_percentage:  '',
      snf_percentage:  '',
      notes:           '',
    },
  });

  const [wFarmer, wFat, wSnf, wQty, wDate, wShift] =
    watch(['farmer_id','fat_percentage','snf_percentage','quantity_liters','collection_date','shift']);

  // Load farmers once
  useEffect(() => {
    api.get('/farmers?limit=200&active=1')
      .then(r => setFarmers(r.data.data))
      .catch(() => toast.error('Could not load farmers'));
  }, []);

  // Load today's records
  const loadToday = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    api.get(`/milk?date_from=${today}&date_to=${today}&limit=50`)
      .then(r => setToday(r.data.data))
      .catch(() => {});
  };
  useEffect(() => { loadToday(); }, []);

  // Debounced live rate preview
  useEffect(() => {
    if (!wFarmer || !wFat || !wQty || parseFloat(wQty) <= 0) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      setPrev(true);
      api.post('/milk/preview-rate', {
        farmer_id:      wFarmer,
        fat_percentage: parseFloat(wFat),
        snf_percentage: wSnf ? parseFloat(wSnf) : null,
        quantity_liters: parseFloat(wQty),
      })
        .then(r => setPreview(r.data.data))
        .catch(() => setPreview(null))
        .finally(() => setPrev(false));
    }, 500);
    return () => clearTimeout(t);
  }, [wFarmer, wFat, wSnf, wQty]);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      const r = await api.post('/milk', data);
      const { computed_rate, total_amount } = r.data.data;

      const farmer = farmers.find(f => String(f.id) === String(data.farmer_id));
      setLast({
        farmer:  farmer?.name || '',
        shift:   data.shift,
        liters:  data.quantity_liters,
        rate:    computed_rate,
        amount:  total_amount,
      });

      toast.success(`✓ Saved! Rs ${computed_rate}/L`);

      // Reset quantity/fat/snf but keep farmer, date, shift for quick consecutive entry
      setValue('quantity_liters', '');
      setValue('fat_percentage',  '');
      setValue('snf_percentage',  '');
      setValue('notes', '');
      setPreview(null);
      loadToday();
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const selectedFarmer = farmers.find(f => String(f.id) === String(wFarmer));

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Milk Entry</h1>
        <p className="text-sm text-muted mt-0.5">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
      </div>

      {/* Last saved banner */}
      <AnimatePresence>
        {lastSaved && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20"
          >
            <CheckCircle size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-emerald-400">Last Saved</p>
              <p className="text-emerald-300/80 text-xs mt-0.5">
                {lastSaved.farmer} · {lastSaved.liters}L · Rs {lastSaved.rate}/L ={' '}
                <strong>{fmtPKR(lastSaved.amount)}</strong>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shift selector — big tap targets */}
      <div>
        <label className="label">Shift *</label>
        <div className="grid grid-cols-2 gap-3">
          {['morning', 'evening'].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setValue('shift', s)}
              className={`flex items-center justify-center gap-2 py-4 rounded-2xl border-2 font-semibold text-sm transition-all
                ${wShift === s
                  ? s === 'morning'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-brand-500/20 border-brand-500 text-brand-300'
                  : 'bg-white border-[#d1dce8] text-muted'
                }`}
            >
              {s === 'morning' ? <Sun size={18} /> : <Moon size={18} />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Date */}
        <div>
          <label className="label">Date *</label>
          <input
            type="date"
            {...register('collection_date', { required: 'Date required' })}
            className="input text-base py-3.5"
          />
        </div>

        {/* Farmer selector */}
        <div>
          <label className="label">Farmer *</label>
          <div className="relative">
            <select
              {...register('farmer_id', { required: 'Select a farmer' })}
              className="input text-base py-3.5 pr-10 appearance-none"
            >
              <option value="">Select farmer…</option>
              {farmers.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.farmer_code})
                </option>
              ))}
            </select>
            <ChevronDown size={18} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          </div>
          {errors.farmer_id && (
            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
              <AlertCircle size={12} />{errors.farmer_id.message}
            </p>
          )}
          {/* Farmer pricing info */}
          {selectedFarmer && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 px-3 py-2 rounded-xl bg-white border border-[#d1dce8] text-xs text-muted flex gap-4"
            >
              <span>Base: <strong className="text-slate-600">Rs {selectedFarmer.base_rate}/L</strong></span>
              <span>FAT ideal: <strong className="text-slate-600">{selectedFarmer.ideal_fat}%</strong></span>
              <span>SNF ideal: <strong className="text-slate-600">{selectedFarmer.ideal_snf}%</strong></span>
            </motion.div>
          )}
        </div>

        {/* Quantity */}
        <div>
          <label className="label">Quantity (Litres) *</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="0.00"
            {...register('quantity_liters', {
              required: 'Quantity required',
              min: { value: 0.01, message: 'Must be > 0' },
            })}
            className="input text-xl font-mono font-bold py-4 text-center tracking-wide"
          />
          {errors.quantity_liters && (
            <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
              <AlertCircle size={12} />{errors.quantity_liters.message}
            </p>
          )}
        </div>

        {/* FAT / SNF — side by side */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">FAT % *</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              {...register('fat_percentage', {
                required: 'FAT % required',
                min: { value: 0, message: 'Min 0' },
                max: { value: 20, message: 'Max 20' },
              })}
              className="input text-lg font-mono font-semibold py-3.5 text-center text-blue-400"
            />
            {errors.fat_percentage && (
              <p className="text-red-400 text-xs mt-1">{errors.fat_percentage.message}</p>
            )}
          </div>
          <div>
            <label className="label">SNF % <span className="text-muted normal-case font-normal">(optional)</span></label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              placeholder="0.00"
              {...register('snf_percentage')}
              className="input text-lg font-mono font-semibold py-3.5 text-center text-purple-400"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes <span className="text-muted normal-case font-normal">(optional)</span></label>
          <input
            {...register('notes')}
            placeholder="Any remarks…"
            className="input py-3"
          />
        </div>

        {/* Live rate preview */}
        <AnimatePresence>
          {(preview || previewing) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              className="rounded-2xl border border-emerald-500/30 bg-emerald-500/8 p-4"
            >
              {previewing ? (
                <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm">
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Calculating rate…</span>
                </div>
              ) : preview && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Calculator size={20} />
                    <div>
                      <p className="text-xs text-emerald-500">Computed Rate</p>
                      <p className="font-bold text-lg font-mono">Rs {preview.computed_rate}/L</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-emerald-500">Total Amount</p>
                    <p className="font-bold text-2xl font-mono text-emerald-300">
                      {fmtPKR(preview.total_amount)}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Submit button — full width, large */}
        <button
          type="submit"
          disabled={saving}
          className="w-full py-5 rounded-2xl bg-brand-600 hover:bg-brand-500 active:scale-[0.98]
                     text-white font-bold text-lg flex items-center justify-center gap-3
                     transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-xl shadow-brand-900/30"
        >
          {saving ? (
            <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Milk size={22} />
              Save Collection
            </>
          )}
        </button>
      </form>

      {/* Today's entries */}
      {todayRecords.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Today's Entries ({todayRecords.length})</h3>
          <div className="space-y-2">
            {todayRecords.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-[#d1dce8]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                    ${r.shift === 'morning' ? 'bg-amber-500/10' : 'bg-slate-600/40'}`}>
                    {r.shift === 'morning' ? <Sun size={14} className="text-amber-400" /> : <Moon size={14} className="text-slate-400" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{r.farmer_name}</p>
                    <p className="text-xs text-muted font-mono">
                      {parseFloat(r.quantity_liters).toFixed(1)}L · {parseFloat(r.fat_percentage).toFixed(1)}% FAT
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold font-mono text-emerald-400">{fmtPKR(r.total_amount)}</p>
                  <p className="text-xs text-muted font-mono">Rs {parseFloat(r.computed_rate).toFixed(2)}/L</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
