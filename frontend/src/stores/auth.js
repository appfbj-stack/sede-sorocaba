import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      usuario: null,
      token: null,
      carregando: false,

      login: (token) => {
        localStorage.setItem('kairos_token', token);
        set({ token, carregando: true });
        api.get('/auth/me')
          .then(({ data }) => set({ usuario: data, carregando: false }))
          .catch((err) => {
            console.error('[Auth] Falha ao carregar usuário:', err.response?.status, err.message);
            get().logout();
          });
      },

      carregarUsuario: async () => {
        const token = localStorage.getItem('kairos_token');
        if (!token) return;
        set({ carregando: true });
        try {
          const { data } = await api.get('/auth/me');
          set({ usuario: data, token, carregando: false });
        } catch {
          set({ usuario: null, token: null, carregando: false });
          localStorage.removeItem('kairos_token');
        }
      },

      logout: () => {
        localStorage.removeItem('kairos_token');
        set({ usuario: null, token: null });
      },

      isSede: () => get().usuario?.perfil === 'sede',
    }),
    { name: 'kairos-auth', partialize: (s) => ({ token: s.token }) }
  )
);
