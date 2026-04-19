import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function ResetPasswordPage() {
  const [params]               = useSearchParams();
  const navigate               = useNavigate();
  const [loading, setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const password = watch('password');

  const onSubmit = async (data) => {
    const token = params.get('token');
    if (!token) { toast.error('Invalid reset link.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password: data.password });
      toast.success('Password reset! Please log in.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed. Link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">Reset Password</h1>
        <p className="text-sm text-muted mb-8">Enter your new password below.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">New Password</label>
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
              type="password" className="input"
            />
            {errors.confirm && <p className="text-red-400 text-xs mt-1">{errors.confirm.message}</p>}
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><KeyRound size={16} /> Set New Password</>
            }
          </button>
        </form>
        <p className="text-center text-sm text-muted mt-6">
          <Link to="/login" className="text-brand-400 hover:text-brand-300">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
