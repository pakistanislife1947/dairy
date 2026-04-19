import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Mail, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', data);
      setSent(true);
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} className="w-full max-w-sm">
        {sent ? (
          <div className="card text-center space-y-4">
            <Mail size={36} className="text-brand-400 mx-auto" />
            <h2 className="text-xl font-bold text-slate-100">Check Your Email</h2>
            <p className="text-sm text-muted">
              If that email exists in our system, a password reset link has been sent. Valid for 1 hour.
            </p>
            <Link to="/login" className="btn-ghost inline-flex justify-center w-full">Back to Login</Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-100 mb-1">Forgot Password?</h1>
            <p className="text-sm text-muted mb-8">Enter your email and we'll send a reset link.</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  {...register('email', {
                    required: 'Email required',
                    pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                  })}
                  type="email" placeholder="you@example.com" className="input"
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
                {loading
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <><Send size={16} /> Send Reset Link</>
                }
              </button>
            </form>
            <p className="text-center text-sm text-muted mt-6">
              <Link to="/login" className="text-brand-400 hover:text-brand-300">Back to login</Link>
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
