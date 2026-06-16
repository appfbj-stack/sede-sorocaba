import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { Droplets, Plus, Trash2, User } from 'lucide-react';

function FormBatismo({ onFechar }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ membro_id: '', data: '', local: '', pastor_id: '' });

  const { data: pendentes = [] } = useQuery({
    queryKey: ['batismos-pendentes'],
    queryFn: () => api.get('/batismos/pendentes').then(r => r.data),
  });

  const { data: membros = [] } = useQuery({
    queryKey: ['membros-select'],
    queryFn: () => api.get('/membros').then(r => r.data),
  });

  const salvar = useMutation({
    mutationFn: () => api.post('/batismos', form),
    onSuccess: () => {
      qc.invalidateQueries(['batismos']);
      qc.invalidateQueries(['batismos-pendentes']);
      qc.invalidateQueries(['membros']);
      onFechar();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div className="bg-white w-full lg:max-w-lg lg:rounded-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Registrar Batismo</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Membro *</label>
            <select
              value={form.membro_id}
              onChange={e => setForm(f => ({ ...f, membro_id: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Selecione o membro...</option>
              {pendentes.map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
            {pendentes.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">Nenhum membro pendente de batismo.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
            <input
              type="date"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Local</label>
            <input
              type="text"
              value={form.local}
              onChange={e => setForm(f => ({ ...f, local: e.target.value }))}
              placeholder="Ex: Rio Sorocaba, Igreja Sede..."
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pastor Celebrante</label>
            <select
              value={form.pastor_id}
              onChange={e => setForm(f => ({ ...f, pastor_id: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="">Selecione (opcional)...</option>
              {membros.filter(m => ['pastor', 'sede'].includes(m.cargo || m.perfil)).map(m => (
                <option key={m.id} value={m.id}>{m.nome}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button onClick={onFechar} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
          <button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !form.membro_id || !form.data}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {salvar.isPending ? 'Salvando...' : 'Registrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Batismos() {
  const [modal, setModal] = useState(false);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['batismos'],
    queryFn: () => api.get('/batismos').then(r => r.data),
  });

  const deletar = useMutation({
    mutationFn: (id) => api.delete(`/batismos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['batismos']);
      qc.invalidateQueries(['membros']);
    },
  });

  const fmt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Batismos</h1>
          <p className="text-gray-500 text-sm">{data.length} batismo{data.length !== 1 ? 's' : ''} registrado{data.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setModal(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <Plus size={16} /> Registrar Batismo
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Droplets size={48} className="mx-auto mb-2 opacity-30" />
          <p>Nenhum batismo registrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Membro</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Data</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Local</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Pastor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {b.foto_url
                        ? <img src={b.foto_url} alt={b.membro_nome} className="w-8 h-8 rounded-full object-cover" />
                        : <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><User size={14} className="text-blue-600" /></div>
                      }
                      <div>
                        <p className="font-medium text-gray-900">{b.membro_nome}</p>
                        <p className="text-xs text-gray-400 sm:hidden">{fmt(b.data)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">{fmt(b.data)}</td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{b.local || '—'}</td>
                  <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">{b.pastor_nome || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { if (confirm('Remover registro de batismo?')) deletar.mutate(b.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <FormBatismo onFechar={() => setModal(false)} />}
    </div>
  );
}
