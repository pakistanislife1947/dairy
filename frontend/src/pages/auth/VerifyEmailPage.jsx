import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import api from '../../api/client';

export default function VerifyEmailPage() {
  const [params]         = useSearchParams();
  const [status, set]    = useState('loading');
  const [msg, setMsg]    = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { set('error'); setMsg('Missing verification token.'); return; }
    api.get(`/auth/verify-email?token=${token}`)
      .then(r  => { set('success'); setMsg(r.data.message); })
      .catch(e => { set('error');   setMsg(e.response?.data?.message || 'Link invalid or expired.'); });
  }, []);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6">
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}
        className="card max-w-sm w-full text-center space-y-4">
        {status === 'loading' && <Loader  size={36} className="text-brand-400 animate-spin mx-auto" />}
        {status === 'success' && <CheckCircle size={36} className="text-emerald-400 mx-auto" />}
        {status === 'error'   && <XCircle size={36} className="text-red-400 mx-auto" />}
        <h2 className="text-xl font-bold text-slate-100">
          {status === 'loading' ? 'Verifying…' : status === 'success' ? 'Email Verified!' : 'Verification Failed'}
        </h2>
        <p className="text-sm text-muted">{msg}</p>
        {status !== 'loading' && (
          <Link to="/login" className="btn-primary inline-flex justify-center w-full">Go to Login</Link>
        )}
      </motion.div>
    </div>
  );
}
