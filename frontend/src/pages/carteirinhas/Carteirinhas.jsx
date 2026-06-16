import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { formatarData } from '../../lib/utils';
import { CreditCard, Plus, Trash2, AlertTriangle, CheckCircle, QrCode } from 'lucide-react';

function ModalEmitir({ onFechar }) {
  const qc = useQueryClient();
  const [membroId, setMembroId] = useState('');
  const [validade, setValidade] = useState('12');

  const { data: pendentes = [] } = useQuery({
    queryKey: ['carteirinhas-pendentes'],
    queryFn: () => api.get('/carteirinhas/pendentes').then(r => r.data),
  });

  const emitir = useMutation({
    mutationFn: () => api.post('/carteirinhas/emitir', { membro_id: membroId, validade_meses: validade }),
    onSuccess: () => { qc.invalidateQueries(['carteirinhas']); qc.invalidateQueries(['dashboard']); onFechar(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div className="bg-white w-full lg:max-w-md lg:rounded-2xl">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Emitir Carteirinha</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Membro *</label>
            <select value={membroId} onChange={e => setMembroId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="">Selecione o membro...</option>
              {pendentes.map(m => <option key={m.id} value={m.id}>{m.nome}{m.cargo ? ` — ${m.cargo}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Validade</label>
            <select value={validade} onChange={e => setValidade(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="6">6 meses</option>
              <option value="12">1 ano</option>
              <option value="24">2 anos</option>
              <option value="36">3 anos</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t">
          <button onClick={onFechar} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
          <button onClick={() => emitir.mutate()} disabled={emitir.isPending || !membroId}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {emitir.isPending ? 'Emitindo...' : 'Emitir'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CarteirinhaCard({ c, onDeletar }) {
  const vencida = c.status === 'vencida' || (c.validade && new Date(c.validade) < new Date());

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${vencida ? 'border-red-200' : 'border-gray-200'}`}>
      {/* Carteirinha visual */}
      <div className={`p-4 ${vencida ? 'bg-red-600' : 'bg-blue-800'} text-white`}>
        <p className="text-xs opacity-70 font-medium uppercase tracking-wider">OBPC Sorocaba</p>
        <div className="flex items-center gap-3 mt-2">
          {c.foto_url
            ? <img src={c.foto_url} alt={c.nome} className="w-12 h-12 rounded-full object-cover border-2 border-white/30" />
            : <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold">{c.nome?.[0]}</div>
          }
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">{c.nome}</p>
            <p className="text-xs opacity-80">{c.cargo || 'Membro'}</p>
            <p className="text-xs opacity-70 truncate">{c.congregacao_nome}</p>
          </div>
          <QrCode size={36} className="opacity-50 flex-shrink-0" />
        </div>
      </div>
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="text-xs text-gray-500">
          <p>Emissão: {formatarData(c.emissao)}</p>
          <p>Validade: {formatarData(c.validade)}</p>
        </div>
        <div className="flex items-center gap-2">
          {vencida
            ? <span className="flex items-center gap-1 text-xs text-red-600 font-medium"><AlertTriangle size={12} /> Vencida</span>
            : <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle size={12} /> Ativa</span>
          }
          <button onClick={() => { if (confirm('Remover carteirinha?')) onDeletar(c.id); }} className="p-1 text-gray-400 hover:text-red-600 rounded">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Carteirinhas() {
  const [modal, setModal] = useState(false);
  const [filtro, setFiltro] = useState('');
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['carteirinhas', filtro],
    queryFn: () => api.get('/carteirinhas', { params: filtro ? { status: filtro } : {} }).then(r => r.data),
  });

  const deletar = useMutation({
    mutationFn: (id) => api.delete(`/carteirinhas/${id}`),
    onSuccess: () => qc.invalidateQueries(['carteirinhas']),
  });

  const ativas = data.filter(c => c.status === 'ativa').length;
  const vencidas = data.filter(c => c.status === 'vencida').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carteirinhas</h1>
          <p className="text-gray-500 text-sm">{ativas} ativas • {vencidas} vencidas</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Emitir
        </button>
      </div>

      <div className="flex gap-2">
        {[{ value: '', label: 'Todas' }, { value: 'ativa', label: 'Ativas' }, { value: 'vencida', label: 'Vencidas' }, { value: 'nao_emitida', label: 'Não emitidas' }].map(({ value, label }) => (
          <button key={value} onClick={() => setFiltro(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${filtro === value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><CreditCard size={48} className="mx-auto mb-2 opacity-30" /><p>Nenhuma carteirinha</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map(c => <CarteirinhaCard key={c.id} c={c} onDeletar={(id) => deletar.mutate(id)} />)}
        </div>
      )}

      {modal && <ModalEmitir onFechar={() => setModal(false)} />}
    </div>
  );
}
