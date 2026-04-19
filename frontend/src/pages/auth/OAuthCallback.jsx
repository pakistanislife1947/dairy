import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import api from '../../api/client';
import useAuthStore from '../../store/authStore';

export default function OAuthCallback() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const { login } = useAuthStore();

  useEffect(() => {
    const at = params.get('accessToken');
    const rt = params.get('refreshToken');
    if (!at || !rt) { navigate('/login?error=oauth_failed'); return; }

    api.get('/auth/me', { headers: { Authorization: `Bearer ${at}` } })
      .then(r => {
        login(r.data.data, at, rt);
        navigate(r.data.data.role === 'admin' ? '/admin/dashboard' : '/staff', { replace: true });
      })
      .catch(() => navigate('/login?error=oauth_failed'));
  }, []);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader size={32} className="text-brand-400 animate-spin mx-auto" />
        <p className="text-sm text-muted">Completing sign in…</p>
      </div>
    </div>
  );
}
