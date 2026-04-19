import { create } from 'zustand';
import api from '../api/client';

const useAuthStore = create((set, get) => ({
  user:        null,
  isLoading:   true,
  isLoggedIn:  false,

  // Called on app init to restore session
  init: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { set({ isLoading: false }); return; }
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.data, isLoggedIn: true, isLoading: false });
    } catch {
      localStorage.clear();
      set({ user: null, isLoggedIn: false, isLoading: false });
    }
  },

  login: (userData, accessToken, refreshToken) => {
    localStorage.setItem('accessToken',  accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user: userData, isLoggedIn: true });
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.clear();
    set({ user: null, isLoggedIn: false });
  },

  isAdmin: () => get().user?.role === 'admin',
}));

export default useAuthStore;
