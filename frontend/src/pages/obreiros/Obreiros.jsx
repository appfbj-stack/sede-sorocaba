import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { formatarData } from '../../lib/utils';
import { UserCheck, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';

const CATEGORIAS = ['cooperador', 'diacono', 'presbitero', 'evangelista', 'pastor'];
const LABEL_CAT = { cooperador: 'Cooperador', diacono: 'Diácono', presbitero: 'Presbítero', evangelista: 'Evangelista', pastor: 'Pastor' };

function FormObreiro({ obreiro, onFechar }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    membro_id: '', categoria: 'cooperador',
    credencial_numero: '', credencial_emissao: '', credencial_validade: '',
    ...obreiro,
  });

  const { data: membros = [] } = useQuery({
    queryKey: ['membros-lista'],
    queryFn: () => api.get('/membros', { params: { limit: 200, status: 'ativo' } }).then(r => r.data.dados),
  });

  const salvar = useMutation({
    mutationFn: () => obreiro?.id ? api.put(`/obreiros/${obreiro.id}`, form) : api.post('/obreiros', form),
    onSuccess: () => { qc.invalidateQueries(['obreiros']); qc.invalidateQueries(['dashboard']); onFechar(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div className="bg-white w-full lg:max-w-lg lg:rounded-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">{obreiro ? 'Editar' : 'Novo'} Obreiro</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-4 space-y-3">
          {!obreiro && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Membro *</label>
              <select value={form.membro_id} onChange={e => setForm(f => ({ ...f, membro_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
                <option value="">Selecione o membro...</option>
                {membros.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria *</label>
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
              {CATEGORIAS.map(c => <option key={c} value={c}>{LABEL_CAT[c]}</option>)}
            </select>
          </div>
          {[
            { name: 'credencial_numero', label: 'Nº Credencial' },
            { name: 'credencial_emissao', label: 'Emissão', type: 'date' },
            { name: 'credencial_validade', label: 'Validade', type: 'date' },
          ].map(({ name, label, type = 'text' }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} value={form[name] || ''} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button onClick={onFechar} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
          <button onClick={() => salvar.mutate()} disabled={salvar.isPending || (!obreiro && !form.membro_id)}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Obreiros() {
  const [modal, setModal] = useState(null);
  const [filtroVencidos, setFiltroVencidos] = useState(false);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['obreiros', filtroVencidos],
    queryFn: () => api.get('/obreiros', { params: filtroVencidos ? { vencidos: true } : {} }).then(r => r.data),
  });

  const deletar = useMutation({
    mutationFn: (id) => api.delete(`/obreiros/${id}`),
    onSuccess: () => qc.invalidateQueries(['obreiros']),
  });

  const vencidos = data.filter(o => o.credencial_validade && new Date(o.credencial_validade) < new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Obreiros</h1>
          <p className="text-gray-500 text-sm">{data.length} obreiros • {vencidos.length} credenciais vencidas</p>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Novo Obreiro
        </button>
      </div>

      {vencidos.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-red-600" />
          <p className="text-sm text-red-700">{vencidos.length} credencial(is) vencida(s). <button onClick={() => setFiltroVencidos(!filtroVencidos)} className="underline font-medium">{filtroVencidos ? 'Ver todos' : 'Ver vencidos'}</button></p>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Categoria</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Credencial</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Validade</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map(o => {
                const vencido = o.credencial_validade && new Date(o.credencial_validade) < new Date();
                return (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {o.foto_url
                          ? <img src={o.foto_url} alt={o.nome} className="w-8 h-8 rounded-full object-cover" />
                          : <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">{o.nome?.[0]}</div>
                        }
                        <div>
                          <p className="font-medium text-gray-900">{o.nome}</p>
                          <p className="text-xs text-gray-500 lg:hidden">{LABEL_CAT[o.categoria]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full font-medium">{LABEL_CAT[o.categoria]}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{o.credencial_numero || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${vencido ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {o.credencial_validade ? formatarData(o.credencial_validade) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setModal(o)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit size={15} /></button>
                        <button onClick={() => { if (confirm('Remover obreiro?')) deletar.mutate(o.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.length === 0 && (
            <div className="text-center py-12 text-gray-400"><UserCheck size={48} className="mx-auto mb-2 opacity-30" /><p>Nenhum obreiro cadastrado</p></div>
          )}
        </div>
      )}

      {modal !== null && <FormObreiro obreiro={modal?.id ? modal : null} onFechar={() => setModal(null)} />}
    </div>
  );
}
