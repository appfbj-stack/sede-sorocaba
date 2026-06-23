import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import { Building2, Plus, Edit, Trash2, Phone, Mail, MapPin } from 'lucide-react';

function FormCongregacao({ cong, onFechar }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    nome: '', endereco: '', cidade: '', estado: 'SP',
    pastor_email: '', telefone: '', whatsapp: '', email: '', status: 'ativa',
    ...cong,
  });

  const salvar = useMutation({
    mutationFn: () => cong?.id ? api.put(`/congregacoes/${cong.id}`, form) : api.post('/congregacoes', form),
    onSuccess: () => { qc.invalidateQueries(['congregacoes']); qc.invalidateQueries(['dashboard']); onFechar(); },
  });

  const campo = (name, label, type = 'text') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={form[name] || ''} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div className="bg-white w-full lg:max-w-xl lg:rounded-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">{cong ? 'Editar' : 'Nova'} Congregação</h2>
          <button onClick={onFechar} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="lg:col-span-2">{campo('nome', 'Nome da Congregação *')}</div>
          {campo('endereco', 'Endereço')}
          {campo('cidade', 'Cidade')}
          {campo('estado', 'Estado')}
          {campo('pastor_email', 'E-mail do Pastor', 'email')}
          {campo('telefone', 'Telefone', 'tel')}
          {campo('whatsapp', 'WhatsApp', 'tel')}
          {campo('email', 'E-mail da Congregação', 'email')}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button onClick={onFechar} className="flex-1 border rounded-lg py-2 text-sm">Cancelar</button>
          <button onClick={() => salvar.mutate()} disabled={salvar.isPending || !form.nome}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Congregacoes() {
  const [modal, setModal] = useState(null);
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ['congregacoes'],
    queryFn: () => api.get('/congregacoes').then(r => r.data),
  });

  const deletar = useMutation({
    mutationFn: (id) => api.delete(`/congregacoes/${id}`),
    onSuccess: () => qc.invalidateQueries(['congregacoes']),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Congregações</h1>
          <p className="text-gray-500 text-sm">{data.length} congregações cadastradas</p>
        </div>
        <button onClick={() => setModal({})} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> Nova Congregação
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Building2 size={48} className="mx-auto mb-2 opacity-30" /><p>Nenhuma congregação cadastrada</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map(c => (
            <div key={c.id} className="bg-white rounded-xl border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Building2 size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{c.nome}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'ativa' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {c.status === 'ativa' ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setModal(c)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit size={15} /></button>
                  <button onClick={() => { if (confirm('Remover congregação?')) deletar.mutate(c.id); }} className="p-1.5 text-gray-400 hover:text-red-600 rounded"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="space-y-1.5 text-sm text-gray-500">
                {c.cidade && <div className="flex items-center gap-2"><MapPin size={13} /> {c.cidade}{c.estado ? `, ${c.estado}` : ''}</div>}
                {c.telefone && <div className="flex items-center gap-2"><Phone size={13} /> {c.telefone}</div>}
                {c.pastor_email && <div className="flex items-center gap-2"><Mail size={13} /> {c.pastor_email}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && <FormCongregacao cong={modal?.id ? modal : null} onFechar={() => setModal(null)} />}
    </div>
  );
}
