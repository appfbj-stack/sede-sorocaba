import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { formatarData, calcularIdade, STATUS_MEMBRO } from '../../lib/utils';
import { Plus, Search, ChevronLeft, ChevronRight, Edit, Trash2, User, Download, ShieldOff } from 'lucide-react';
import FormMembro from './FormMembro';

export default function Membros() {
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [membroEditando, setMembroEditando] = useState(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['membros', busca, status, page],
    queryFn: () => api.get('/membros', { params: { busca, status, page, limit: 20 } }).then(r => r.data),
    keepPreviousData: true,
  });

  const deletar = useMutation({
    mutationFn: (id) => api.delete(`/membros/${id}`),
    onSuccess: () => qc.invalidateQueries(['membros']),
  });

  const exportar = useMutation({
    mutationFn: (id) => api.get(`/membros/${id}/exportar-dados`).then(r => r.data),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `dados-lgpd-${data.dados_pessoais?.nome || 'anonimizado'}.json`;
      a.click(); URL.revokeObjectURL(url);
    },
  });

  const anonimizar = useMutation({
    mutationFn: (id) => api.post(`/membros/${id}/anonimizar`),
    onSuccess: () => { qc.invalidateQueries(['membros']); qc.invalidateQueries(['dashboard']); },
  });

  const abrirEdicao = (membro) => { setMembroEditando(membro); setModalAberto(true); };
  const abrirCriacao = () => { setMembroEditando(null); setModalAberto(true); };
  const fecharModal = () => { setModalAberto(false); setMembroEditando(null); };

  const totalPaginas = Math.ceil((data?.total || 0) / 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membros</h1>
          <p className="text-gray-500 text-sm">{data?.total ?? '...'} registros</p>
        </div>
        <button onClick={abrirCriacao} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> Novo Membro
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 flex-1 min-w-48">
          <Search size={16} className="text-gray-400" />
          <input
            value={busca}
            onChange={e => { setBusca(e.target.value); setPage(1); }}
            placeholder="Buscar por nome ou CPF..."
            className="flex-1 outline-none text-sm"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
          className="bg-white border rounded-lg px-3 py-2 text-sm outline-none"
        >
          <option value="">Todos os status</option>
          {Object.entries(STATUS_MEMBRO).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data?.dados?.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <User size={48} className="mx-auto mb-2 opacity-30" />
            <p>Nenhum membro encontrado</p>
          </div>
        ) : (
          <>
            <div className="lg:hidden divide-y">
              {data?.dados?.map(m => (
                <div key={m.id} className="p-4 flex items-center gap-3">
                  {m.foto_url
                    ? <img src={m.foto_url} alt={m.nome} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 flex-shrink-0">{m.nome[0]}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{m.nome}</p>
                    <p className="text-xs text-gray-500">{m.telefone || 'Sem telefone'} • {calcularIdade(m.data_nascimento)} anos</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_MEMBRO[m.status]?.color}`}>
                      {STATUS_MEMBRO[m.status]?.label}
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => abrirEdicao(m)} className="p-1 text-gray-400 hover:text-blue-600"><Edit size={14} /></button>
                      <button onClick={() => exportar.mutate(m.id)} className="p-1 text-gray-400 hover:text-green-600" title="Exportar dados"><Download size={14} /></button>
                      {!m.anonimizado_em && <button onClick={() => { if (confirm('Anonimizar dados pessoais deste membro? Esta ação não pode ser desfeita.')) anonimizar.mutate(m.id); }} className="p-1 text-gray-400 hover:text-orange-600" title="Anonimizar"><ShieldOff size={14} /></button>}
                      <button onClick={() => deletar.mutate(m.id)} className="p-1 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <table className="hidden lg:table w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">CPF</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nascimento</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Telefone</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Cargo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data?.dados?.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {m.foto_url
                          ? <img src={m.foto_url} alt={m.nome} className="w-7 h-7 rounded-full object-cover" />
                          : <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">{m.nome[0]}</div>
                        }
                        <span className="font-medium">{m.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{m.cpf || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatarData(m.data_nascimento)}</td>
                    <td className="px-4 py-3 text-gray-500">{m.telefone || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{m.cargo || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_MEMBRO[m.status]?.color}`}>
                        {STATUS_MEMBRO[m.status]?.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => abrirEdicao(m)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Editar"><Edit size={15} /></button>
                        <button onClick={() => exportar.mutate(m.id)} className="p-1.5 text-gray-400 hover:text-green-600 rounded" title="Exportar dados"><Download size={15} /></button>
                        {!m.anonimizado_em && <button onClick={() => { if (confirm('Anonimizar dados pessoais deste membro? Esta ação não pode ser desfeita.')) anonimizar.mutate(m.id); }} className="p-1.5 text-gray-400 hover:text-orange-600 rounded" title="Anonimizar"><ShieldOff size={15} /></button>}
                        <button onClick={() => { if (confirm('Remover membro?')) deletar.mutate(m.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPaginas > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                <p className="text-sm text-gray-500">Página {page} de {totalPaginas}</p>
                <div className="flex gap-1">
                  <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-1 rounded disabled:opacity-40 hover:bg-gray-200"><ChevronLeft size={18} /></button>
                  <button disabled={page === totalPaginas} onClick={() => setPage(p => p + 1)} className="p-1 rounded disabled:opacity-40 hover:bg-gray-200"><ChevronRight size={18} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {modalAberto && <FormMembro membro={membroEditando} onFechar={fecharModal} />}
    </div>
  );
}
