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
      // Use SAME keys as api/client.js
      localStorage.setItem('accessToken', token);
      if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
      set({ user, token, refreshToken, isLoggedIn: true, isLoading: false, perms });
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
          const perms = data.data.role === 'admin' ? ['*'] : (data.data.perms || []);
          set({ user: data.data, token, isLoggedIn: true, isLoading: false, perms });
        } else {
          localStorage.removeItem('accessToken');
          set({ isLoading: false });
        }
      } catch {
        // Token invalid — clear silently, don't redirect here
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
    partialize: s => ({ token: s.token, refreshToken: s.refreshToken, user: s.user }),
  }
));

export default useAuthStore;
