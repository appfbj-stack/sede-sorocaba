import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../services/api';
import { Settings, Save, Building2, Bell, Link2 } from 'lucide-react';

const CAMPOS = [
  {
    secao: 'Igreja', icon: Building2,
    campos: [
      { chave: 'igreja_nome', label: 'Nome da Igreja' },
      { chave: 'igreja_endereco', label: 'Endereço' },
      { chave: 'igreja_cidade', label: 'Cidade' },
      { chave: 'igreja_telefone', label: 'Telefone' },
      { chave: 'igreja_email', label: 'E-mail', type: 'email' },
      { chave: 'igreja_site', label: 'Site', type: 'url' },
    ],
  },
  {
    secao: 'Notificações', icon: Bell,
    campos: [
      { chave: 'notif_email_remetente', label: 'E-mail Remetente', type: 'email' },
      { chave: 'notif_dias_vencimento_credencial', label: 'Avisar vencimento de credencial (dias antes)', type: 'number' },
      { chave: 'notif_dias_aniversario', label: 'Avisar aniversário (dias antes)', type: 'number' },
    ],
  },
  {
    secao: 'Integrações', icon: Link2,
    campos: [
      { chave: 'google_sheets_id', label: 'Google Sheets ID (Sincronização)' },
      { chave: 'google_drive_folder_id', label: 'Google Drive Folder ID (Documentos)' },
    ],
  },
];

export default function Configuracoes() {
  const [form, setForm] = useState({});
  const [salvo, setSalvo] = useState(false);

  const { data = {}, isLoading } = useQuery({
    queryKey: ['configuracoes'],
    queryFn: () => api.get('/configuracoes').then(r => r.data),
  });

  useEffect(() => {
    if (data && Object.keys(data).length) setForm(data);
  }, [data]);

  const salvar = useMutation({
    mutationFn: () => api.put('/configuracoes', form),
    onSuccess: () => {
      setSalvo(true);
      setTimeout(() => setSalvo(false), 3000);
    },
  });

  const campo = (chave, label, type = 'text') => (
    <div key={chave}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={form[chave] || ''}
        onChange={e => setForm(f => ({ ...f, [chave]: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
      />
    </div>
  );

  if (isLoading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-500 text-sm">Parâmetros gerais do sistema</p>
        </div>
        <button
          onClick={() => salvar.mutate()}
          disabled={salvar.isPending}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={16} />
          {salvar.isPending ? 'Salvando...' : salvo ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {salvo && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
          Configurações salvas com sucesso.
        </div>
      )}

      {CAMPOS.map(({ secao, icon: Icon, campos }) => (
        <div key={secao} className="bg-white rounded-xl border p-5">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b">
            <Icon size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">{secao}</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {campos.map(c => campo(c.chave, c.label, c.type))}
          </div>
        </div>
      ))}
    </div>
  );
}
