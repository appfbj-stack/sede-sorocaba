import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      usuario: null,
      token: null,
      carregando: false,

      loginComSenha: async (email, senha) => {
        const { data } = await api.post('/auth/login', { email, senha });
        localStorage.setItem('kairos_token', data.access_token);
        set({ token: data.access_token, usuario: data.usuario });
        return data.usuario;
      },

      login: (token) => {
        localStorage.setItem('kairos_token', token);
        set({ token, carregando: true });
        api.get('/auth/me')
          .then(({ data }) => set({ usuario: data, carregando: false }))
          .catch(() => get().logout());
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

      logout: async () => {
        try { await api.post('/auth/logout'); } catch { /* sessão já pode estar inválida */ }
        localStorage.removeItem('kairos_token');
        set({ usuario: null, token: null });
      },

      isMaster: () => get().usuario?.perfil === 'master',
      isAdmin: () => ['master', 'admin'].includes(get().usuario?.perfil),
    }),
    { name: 'kairos-auth', partialize: (s) => ({ token: s.token }) }
  )
);
