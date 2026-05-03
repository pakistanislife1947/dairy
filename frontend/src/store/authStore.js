import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../api/client';

const useAuthStore = create(persist(
  (set, get) => ({
    user: null,
    token: null,
    refreshToken: null,
    isLoggedIn: false,
    isLoading: true,
    perms: [],

    login: (user, token, refreshToken) => {
      const perms = user.role === 'admin' ? ['*'] : (user.perms || []);
      localStorage.setItem('access_token', token);
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
      set({ user, token, refreshToken, isLoggedIn: true, isLoading: false, perms });
    },

    logout: async () => {
      try { await api.post('/auth/logout'); } catch {}
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      set({ user:null, token:null, refreshToken:null, isLoggedIn:false, isLoading:false, perms:[] });
    },

    init: async () => {
      const token = localStorage.getItem('access_token');
      if (!token) { set({ isLoading:false }); return; }
      try {
        const { data } = await api.get('/auth/me');
        if (data.success) {
          const perms = data.data.role==='admin' ? ['*'] : (data.data.perms || []);
          set({ user:data.data, token, isLoggedIn:true, isLoading:false, perms });
        } else { set({ isLoading:false }); }
      } catch { set({ isLoading:false }); }
    },

    hasPerm: (perm) => {
      const { perms } = get();
      return perms.includes('*') || perms.includes(perm);
    },
  }),
  { name:'dairy-auth', partialize: s => ({ token:s.token, refreshToken:s.refreshToken, user:s.user }) }
));

export default useAuthStore;
