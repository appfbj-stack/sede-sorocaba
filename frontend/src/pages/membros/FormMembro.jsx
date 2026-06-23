import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import { X, Upload, Shield } from 'lucide-react';

const CAMPOS = [
  { name: 'nome', label: 'Nome completo *', type: 'text', required: true },
  { name: 'cpf', label: 'CPF', type: 'text', mask: 'cpf' },
  { name: 'rg', label: 'RG', type: 'text' },
  { name: 'data_nascimento', label: 'Data de nascimento', type: 'date' },
  { name: 'telefone', label: 'Telefone', type: 'tel' },
  { name: 'whatsapp', label: 'WhatsApp', type: 'tel' },
  { name: 'endereco', label: 'Endereço', type: 'text' },
  { name: 'estado_civil', label: 'Estado civil', type: 'select', opcoes: ['solteiro', 'casado', 'divorciado', 'viuvo'] },
  { name: 'data_conversao', label: 'Data de conversão', type: 'date' },
  { name: 'data_batismo', label: 'Data de batismo', type: 'date' },
  { name: 'cargo', label: 'Cargo', type: 'text' },
  { name: 'status', label: 'Status', type: 'select', opcoes: ['ativo', 'inativo', 'transferido', 'falecido'], required: true },
  { name: 'observacoes', label: 'Observações', type: 'textarea' },
];

export default function FormMembro({ membro, onFechar }) {
  const qc = useQueryClient();
  const { isAdmin } = useAuthStore();
  const [form, setForm] = useState({
    nome: '', cpf: '', rg: '', data_nascimento: '', telefone: '', whatsapp: '',
    endereco: '', estado_civil: '', data_conversao: '', data_batismo: '',
    cargo: '', status: 'ativo', observacoes: '', congregacao_id: '',
    consentimento_lgpd: false,
    ...membro,
  });
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(membro?.foto_url || null);

  const { data: congregacoes } = useQuery({
    queryKey: ['congregacoes'],
    queryFn: () => api.get('/congregacoes').then(r => r.data),
    enabled: isAdmin(),
  });

  const salvar = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v !== '' && v !== null) fd.append(k, v); });
      fd.set('consentimento_lgpd', form.consentimento_lgpd ? 'true' : 'false');
      if (foto) fd.append('foto', foto);
      if (membro?.id) return api.put(`/membros/${membro.id}`, fd);
      return api.post('/membros', fd);
    },
    onSuccess: () => { qc.invalidateQueries(['membros']); qc.invalidateQueries(['dashboard']); onFechar(); },
  });

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4">
      <div className="bg-white w-full lg:max-w-2xl lg:rounded-2xl max-h-[95vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">{membro ? 'Editar' : 'Novo'} Membro</h2>
          <button onClick={onFechar} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
              {fotoPreview
                ? <img src={fotoPreview} alt="Foto" className="w-full h-full object-cover" />
                : <span className="text-3xl text-gray-300">👤</span>
              }
            </div>
            <label className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg cursor-pointer text-sm">
              <Upload size={16} /> Foto
              <input type="file" accept="image/*" onChange={handleFoto} className="hidden" />
            </label>
          </div>

          {isAdmin() && congregacoes && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Congregação *</label>
              <select value={form.congregacao_id} onChange={e => setForm(f => ({ ...f, congregacao_id: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
                <option value="">Selecione...</option>
                {congregacoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {CAMPOS.map(({ name, label, type, required, opcoes }) => (
              <div key={name} className={type === 'textarea' || name === 'nome' ? 'lg:col-span-2' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                {type === 'select' ? (
                  <select value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500">
                    <option value="">Selecione...</option>
                    {opcoes.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1).replace('_', ' ')}</option>)}
                  </select>
                ) : type === 'textarea' ? (
                  <textarea value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
                    rows={3} className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none" />
                ) : (
                  <input type={type} value={form[name]} required={required}
                    onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
                )}
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <Shield size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={form.consentimento_lgpd}
                  onChange={e => setForm(f => ({ ...f, consentimento_lgpd: e.target.checked }))}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <div>
                  <span className="text-sm font-medium text-gray-900">Consentimento LGPD</span>
                  <p className="text-xs text-gray-500 mt-0.5">Autorizo o armazenamento e tratamento dos meus dados pessoais conforme a Lei Geral de Proteção de Dados (Lei 13.709/2018) para fins de gestão eclesiástica.</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t sticky bottom-0 bg-white">
          <button onClick={onFechar} className="flex-1 border rounded-lg py-2 text-sm font-medium hover:bg-gray-50">Cancelar</button>
          <button
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending || !form.nome}
            className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
