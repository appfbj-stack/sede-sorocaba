import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { formatarDataHora, TIPOS_EVENTO } from '../../lib/utils';
import { Calendar, Plus, Trash2, MapPin, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

const CORES_TIPO = {
  culto: 'bg-blue-100 text-blue-700',
  batismo: 'bg-cyan-100 text-cyan-700',
  santa_ceia: 'bg-purple-100 text-purple-700',
  congresso: 'bg-orange-100 text-orange-700',
  reuniao: 'bg-gray-100 text-gray-700',
};

function FormEvento({ onFechar }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ titulo: '', tipo: 'culto', descricao: '', data_inicio: '', data_fim: '', local: '', responsavel_email: '' });

  const salvar = useMutation({
    mutationFn: () => api.post('/agenda', form),
    onSuccess: () => { qc.invalidateQueries(['agenda']); qc.invalidateQueries(['dashboard']); onFechar(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div className="bg-white w-full lg:max-w-lg lg:rounded-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Novo Evento</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-4 space-y-3">
          {[{ name: 'titulo', label: 'Título *' }, { name: 'local', label: 'Local' }, { name: 'responsavel_email', label: 'Responsável (e-mail)', type: 'email' }].map(({ name, label, type = 'text' }) => (
            <div key={name}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input type={type} value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
              {TIPOS_EVENTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
              <input type="datetime-local" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
              <input type="datetime-local" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button onClick={onFechar} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
          <button onClick={() => salvar.mutate()} disabled={salvar.isPending || !form.titulo || !form.data_inicio}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvar.isPending ? 'Salvando...' : 'Criar Evento'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Agenda() {
  const [modal, setModal] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');
  const qc = useQueryClient();

  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth());
  const [ano, setAno] = useState(hoje.getFullYear());

  const de = new Date(ano, mes, 1).toISOString().split('T')[0];
  const ate = new Date(ano, mes + 1, 0).toISOString().split('T')[0];

  const { data = [], isLoading } = useQuery({
    queryKey: ['agenda', de, ate, filtroTipo],
    queryFn: () => api.get('/agenda', { params: { de, ate, tipo: filtroTipo || undefined } }).then(r => r.data),
  });

  const deletar = useMutation({
    mutationFn: (id) => api.delete(`/agenda/${id}`),
    onSuccess: () => qc.invalidateQueries(['agenda']),
  });

  const proximoMes = () => { if (mes === 11) { setMes(0); setAno(a => a + 1); } else setMes(m => m + 1); };
  const mesAnterior = () => { if (mes === 0) { setMes(11); setAno(a => a - 1); } else setMes(m => m - 1); };

  const nomeMes = new Date(ano, mes).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-gray-500 text-sm">{data.length} eventos em {nomeMes}</p>
        </div>
        <button onClick={() => setModal(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Novo Evento
        </button>
      </div>

      <div className="flex items-center justify-between bg-white rounded-xl border px-4 py-3">
        <button onClick={mesAnterior} className="p-1 hover:bg-gray-100 rounded"><ChevronLeft size={20} /></button>
        <span className="font-semibold text-gray-800 capitalize">{nomeMes}</span>
        <button onClick={proximoMes} className="p-1 hover:bg-gray-100 rounded"><ChevronRight size={20} /></button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setFiltroTipo('')} className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${!filtroTipo ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Todos</button>
        {TIPOS_EVENTO.map(t => (
          <button key={t.value} onClick={() => setFiltroTipo(t.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${filtroTipo === t.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Calendar size={48} className="mx-auto mb-2 opacity-30" /><p>Nenhum evento neste período</p></div>
      ) : (
        <div className="space-y-3">
          {data.map(ev => (
            <div key={ev.id} className="bg-white rounded-xl border p-4 flex gap-3 hover:shadow-sm transition-shadow">
              <div className="text-center min-w-[3rem]">
                <p className="text-2xl font-bold text-blue-700">{new Date(ev.data_inicio).getDate()}</p>
                <p className="text-xs text-gray-400">{new Date(ev.data_inicio).toLocaleDateString('pt-BR', { month: 'short' })}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CORES_TIPO[ev.tipo] || 'bg-gray-100 text-gray-600'}`}>
                        {TIPOS_EVENTO.find(t => t.value === ev.tipo)?.label || ev.tipo}
                      </span>
                      {ev.google_event_id && <span className="text-xs text-blue-500">📅 Google Calendar</span>}
                    </div>
                    <h3 className="font-semibold text-gray-900">{ev.titulo}</h3>
                    {ev.descricao && <p className="text-sm text-gray-500 mt-0.5">{ev.descricao}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(ev.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {ev.local && <span className="flex items-center gap-1"><MapPin size={12} /> {ev.local}</span>}
                    </div>
                  </div>
                  <button onClick={() => { if (confirm('Remover evento?')) deletar.mutate(ev.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded flex-shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <FormEvento onFechar={() => setModal(false)} />}
    </div>
  );
}
