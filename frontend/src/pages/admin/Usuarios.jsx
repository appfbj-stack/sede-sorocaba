import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { PERFIS } from '../../lib/utils';
import { Plus, Trash2 } from 'lucide-react';

const PERFIL_OPCOES = ['admin', 'cliente'];

export default function Usuarios() {
  const qc = useQueryClient();
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then((r) => r.data),
  });

  const [form, setForm] = useState({ nome: '', email: '', senha: '', perfil: 'cliente' });
  const [erro, setErro] = useState('');

  const criar = useMutation({
    mutationFn: (payload) => api.post('/usuarios', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] });
      setForm({ nome: '', email: '', senha: '', perfil: 'cliente' });
      setErro('');
    },
    onError: (err) => setErro(err.response?.data?.detail || 'Erro ao criar usuário'),
  });

  const remover = useMutation({
    mutationFn: (id) => api.delete(`/usuarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>

      <form
        onSubmit={(e) => { e.preventDefault(); criar.mutate(form); }}
        className="bg-white rounded-xl border p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
      >
        <input required placeholder="Nome" value={form.nome}
               onChange={(e) => setForm({ ...form, nome: e.target.value })}
               className="border rounded-lg px-3 py-2 md:col-span-1" />
        <input required type="email" placeholder="E-mail" value={form.email}
               onChange={(e) => setForm({ ...form, email: e.target.value })}
               className="border rounded-lg px-3 py-2 md:col-span-1" />
        <input type="password" placeholder="Senha (opcional p/ login Google)" value={form.senha}
               onChange={(e) => setForm({ ...form, senha: e.target.value })}
               className="border rounded-lg px-3 py-2 md:col-span-1" />
        <select value={form.perfil} onChange={(e) => setForm({ ...form, perfil: e.target.value })}
                className="border rounded-lg px-3 py-2 md:col-span-1">
          {PERFIL_OPCOES.map((p) => <option key={p} value={p}>{PERFIS[p].label}</option>)}
        </select>
        <button type="submit" className="bg-blue-900 text-white rounded-lg px-4 py-2 flex items-center justify-center gap-2 md:col-span-1">
          <Plus size={16} /> Adicionar
        </button>
        {erro && <p className="text-sm text-red-600 md:col-span-5">{erro}</p>}
      </form>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Nome</th>
              <th className="text-left px-4 py-2">E-mail</th>
              <th className="text-left px-4 py-2">Perfil</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="px-4 py-3" colSpan={5}>Carregando...</td></tr>}
            {usuarios?.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-2">{u.nome}</td>
                <td className="px-4 py-2">{u.email}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${PERFIS[u.perfil]?.color}`}>
                    {PERFIS[u.perfil]?.label ?? u.perfil}
                  </span>
                </td>
                <td className="px-4 py-2">{u.ativo ? 'Ativo' : 'Inativo'}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => remover.mutate(u.id)} className="text-red-600 hover:text-red-800">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
