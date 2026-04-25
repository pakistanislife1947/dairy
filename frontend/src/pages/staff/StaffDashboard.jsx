import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Droplets, Sun, Moon, TrendingUp, Users } from 'lucide-react';
import { format } from 'date-fns';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';

const fmtPKR = n => `Rs ${Number(n||0).toLocaleString('en-PK',{maximumFractionDigits:0})}`;

export default function StaffDashboard() {
  const { user } = useAuthStore();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    api.get(`/milk/summary?date_from=${today}&date_to=${today}`)
      .then(r => setSummary(r.data.data))
      .finally(() => setLoading(false));
  }, []);

  const morning = summary?.find(s => s.shift === 'morning');
  const evening = summary?.find(s => s.shift === 'evening');

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-2">
        <h1 className="text-xl font-bold text-slate-800">{greeting}, {user?.name?.split(' ')[0]}! 👋</h1>
        <p className="text-sm text-muted mt-1">{format(new Date(), 'EEEE, dd MMM yyyy')}</p>
      </motion.div>

      {/* Today's shifts */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { shift: 'Morning', icon: Sun, data: morning, color: 'amber' },
          { shift: 'Evening', icon: Moon, data: evening, color: 'brand' },
        ].map(({ shift, icon: Icon, data, color }) => (
          <motion.div
            key={shift}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="card"
          >
            <div className={`w-9 h-9 rounded-xl mb-3 flex items-center justify-center
              ${color === 'amber' ? 'bg-amber-500/10' : 'bg-brand-500/10'}`}>
              <Icon size={18} className={color === 'amber' ? 'text-amber-400' : 'text-brand-400'} />
            </div>
            <p className="text-xs text-muted mb-1">{shift} Shift</p>
            {loading ? (
              <div className="space-y-1">
                <div className="skeleton h-5 w-3/4 rounded" />
                <div className="skeleton h-3 w-1/2 rounded" />
              </div>
            ) : data ? (
              <>
                <p className="font-bold text-lg text-slate-800">{parseFloat(data.total_liters).toFixed(1)} L</p>
                <p className="text-xs text-muted">{data.farmer_count} farmers</p>
                <p className="text-xs font-mono text-emerald-400 mt-1">{fmtPKR(data.total_amount)}</p>
              </>
            ) : (
              <p className="text-sm text-muted">No records yet</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Summary card */}
      {(morning || evening) && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card bg-brand-900/30 border-brand-500/20"
        >
          <div className="flex items-center gap-3 mb-3">
            <Droplets size={20} className="text-brand-400" />
            <h3 className="font-semibold text-slate-700">Today's Total</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-muted mb-0.5">Litres</p>
              <p className="font-bold text-slate-800 text-lg">
                {((parseFloat(morning?.total_liters||0) + parseFloat(evening?.total_liters||0))).toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted mb-0.5">Farmers</p>
              <p className="font-bold text-slate-800 text-lg">
                {(parseInt(morning?.farmer_count||0) + parseInt(evening?.farmer_count||0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted mb-0.5">Amount</p>
              <p className="font-bold text-emerald-400 text-lg">
                {fmtPKR((parseFloat(morning?.total_amount||0) + parseFloat(evening?.total_amount||0)))}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Quick tip */}
      <div className="text-center py-4">
        <p className="text-xs text-muted">Tap <strong className="text-slate-400">Milk Entry</strong> below to record collection</p>
      </div>
    </div>
  );
}
