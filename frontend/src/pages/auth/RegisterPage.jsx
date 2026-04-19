import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Droplets, UserPlus, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function RegisterPage() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const password = watch('password');

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.post('/auth/register', {
        name:     data.name,
        email:    data.email,
        password: data.password,
      });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="card max-w-sm w-full text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Check Your Email</h2>
          <p className="text-sm text-muted">
            We sent a verification link to your email address. Click the link to activate your account.
          </p>
          <Link to="/login" className="btn-primary inline-flex justify-center w-full">
            Back to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-slate-100">Dairy ERP</span>
        </div>

        <h1 className="text-2xl font-bold text-slate-100 mb-1">Create account</h1>
        <p className="text-sm text-muted mb-8">You'll need admin approval to access full features</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              {...register('name', { required: 'Name required', minLength: { value: 2, message: 'Min 2 chars' } })}
              placeholder="Muhammad Ali" className="input"
            />
            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Email</label>
            <input
              {...register('email', { required: 'Email required', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Invalid email' } })}
              type="email" placeholder="you@example.com" className="input"
            />
            {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <div className="relative">
              <input
                {...register('password', {
                  required: 'Password required',
                  minLength: { value: 8, message: 'Minimum 8 characters' },
                  pattern: { value: /(?=.*[A-Z])(?=.*[0-9])/, message: 'Needs uppercase + number' },
                })}
                type={showPass ? 'text' : 'password'}
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                className="input pr-10"
              />
              <button type="button" onClick={() => setShowPass(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-slate-300">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <label className="label">Confirm Password</label>
            <input
              {...register('confirm', {
                required: 'Please confirm password',
                validate: v => v === password || 'Passwords do not match',
              })}
              type="password" placeholder="••••••••" className="input"
            />
            {errors.confirm && <p className="text-red-400 text-xs mt-1">{errors.confirm.message}</p>}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><UserPlus size={16} /> Create Account</>
            }
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
