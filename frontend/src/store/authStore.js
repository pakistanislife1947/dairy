import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/client';

// Derive department from perms array as fallback
const deriveDept = (user) => {
  if (user.department) return user.department;
  const p = user.perms || user.permissions || [];
  if (p.includes('milk')) return 'purchase';
  if (p.includes('sales')) return 'sales';
  return null;
};

const useAuthStore = create(persist(
  (set, get) => ({
    user: null,
    token: null,
    refreshToken: null,
    isLoggedIn: false,
    isLoading: true,
    perms: [],

    login: (user, token, refreshToken) => {
      const dept = deriveDept(user);
      const enriched = { ...user, department: dept };
      const perms = user.role === 'admin' ? ['*'] : (user.perms || []);
      localStorage.setItem('accessToken', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      set({ user: enriched, token, refreshToken, isLoggedIn: true, isLoading: false, perms });
    },

    logout: async () => {
      try { await api.post('/auth/logout'); } catch {}
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      set({ user:null, token:null, refreshToken:null, isLoggedIn:false, isLoading:false, perms:[] });
    },

    init: async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) { set({ isLoading: false }); return; }
      try {
        const { data } = await api.get('/auth/me');
        if (data.success) {
          const u = data.data;
          const dept = deriveDept(u);
          const enriched = { ...u, department: dept };
          const perms = u.role === 'admin' ? ['*'] : (u.perms || []);
          // Always update from server — never trust stale localStorage cache for routing
          set({ user: enriched, token, isLoggedIn: true, isLoading: false, perms });
        } else {
          localStorage.removeItem('accessToken');
          set({ isLoading: false });
        }
      } catch {
        localStorage.removeItem('accessToken');
        set({ isLoading: false });
      }
    },

    hasPerm: (perm) => {
      const { perms } = get();
      return perms.includes('*') || perms.includes(perm);
    },
  }),
  {
    name: 'dairy-auth',
    // Only persist token — never persist user object (stale dept/shop causes wrong routing)
    partialize: s => ({ token: s.token, refreshToken: s.refreshToken }),
  }
));

export default useAuthStore;
