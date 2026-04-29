import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Droplets, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';

export default function LoginPage() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const { login } = useAuthStore();
  const navigate  = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.post('/auth/login', data);
      const { accessToken, refreshToken, user } = res.data.data;
      login(user, accessToken, refreshToken);
      toast.success(`Welcome back, ${user.name}!`);
      navigate(user.role === 'admin' ? '/admin/dashboard' : '/staff');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-brand-900/30 border-r border-[#d1dce8] p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center">
            <Droplets className="w-6 h-6 text-white" />
          </div>
          <span className="font-bold text-xl text-slate-800">Brimi Dairy</span>
        </div>

        <div>
          <h2 className="text-4xl font-extrabold text-slate-800 leading-tight mb-4">
            Manage your dairy<br />
            <span className="text-[#1d6faa]">smarter, faster.</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-sm">
            Complete farm-to-sale dairy management — milk collection, billing, payroll, and real-time analytics.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Dynamic Pricing', desc: 'FAT/SNF formula rates' },
            { label: 'Auto Payroll',   desc: 'Advance deduction logic' },
            { label: 'P&L Reports',   desc: 'PDF exports monthly' },
            { label: 'Audit Trail',   desc: 'Every change tracked' },
          ].map(({ label, desc }) => (
            <div key={label} className="bg-white/50 rounded-xl p-4 border border-[#d1dce8]">
              <p className="font-semibold text-slate-200 text-sm">{label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <Droplets className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-800">Brimi Dairy</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-800 mb-1">Sign in</h1>
          <p className="text-sm text-slate-500 mb-8">Enter your credentials to continue</p>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl
                       bg-white border border-[#d1dce8] hover:border-slate-600
                       text-sm font-medium text-slate-200 transition-all mb-6"
          >
            <svg viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.8 29.3 5 24 5 12.4 5 3 14.4 3 26s9.4 21 21 21 21-9.4 21-21c0-1.3-.1-2.7-.4-3.9z"/>
              <path fill="#FF3D00" d="m6.3 15.4 6.6 4.8C14.5 16.6 18.9 14 24 14c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 8.2 29.3 6 24 6 16.3 6 9.7 9.8 6.3 15.4z"/>
              <path fill="#4CAF50" d="M24 47c5.2 0 9.9-1.8 13.5-4.7l-6.2-5.3C29.4 38.6 26.8 39.5 24 39.5c-5.3 0-9.7-3.1-11.3-7.5l-6.5 5C9.6 43.3 16.3 47 24 47z"/>
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.4 4.3-4.5 5.7l6.2 5.3c-.3.3 4.9-3.6 4.9-12 0-1.4-.1-2.7-.4-3.9z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 border-t border-[#d1dce8]" />
            <span className="text-xs text-slate-500">or email</span>
            <div className="flex-1 border-t border-[#d1dce8]" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                {...register('email', { required: 'Email required' })}
                type="email" placeholder="admin@dairy.local" className="input"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password', { required: 'Password required' })}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••" className="input pr-10"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input type="checkbox" {...register('rememberMe')}
                  className="w-4 h-4 rounded border-[#d1dce8] bg-white text-brand-500" />
                Remember me (30 days)
              </label>
              <Link to="/forgot-password" className="text-xs text-[#1d6faa] hover:text-[#165d8f]">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
              {loading
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><LogIn size={16} /> Sign In</>
              }
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            No account?{' '}
            <Link to="/register" className="text-[#1d6faa] hover:text-[#165d8f] font-medium">
              Register
            </Link>
          </p>
        </motion.div>
      </div>
    
      {/* Footer */}
      <div className="fixed bottom-0 left-0 right-0 py-3 text-center">
        <p className="text-xs text-slate-400">
          Developed by <span className="font-semibold text-[#1d6faa]">Quantum Solution Group</span> &nbsp;|&nbsp; © 2025 All rights reserved
        </p>
      </div>
    </div>
