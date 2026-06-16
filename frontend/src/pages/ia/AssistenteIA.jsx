import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth';
import { Send, Bot, User, Loader2, Settings } from 'lucide-react';

const SUGESTOES = [
  'Quantos membros ativos existem?',
  'Quem faz aniversário hoje?',
  'Quais carteirinhas estão vencidas?',
  'Quais obreiros precisam renovar a credencial?',
  'Quantos membros não são batizados?',
  'Quando será o próximo evento?',
];

export default function AssistenteIA() {
  const { isSede } = useAuthStore();
  const [mensagem, setMensagem] = useState('');
  const [historico, setHistorico] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [config, setConfig] = useState({ aberto: false, api_key: '', modelo: '', base_url: '' });
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historico]);

  const enviar = async (texto) => {
    const msg = texto || mensagem;
    if (!msg.trim() || carregando) return;
    setMensagem('');
    setCarregando(true);
    setHistorico(h => [...h, { role: 'user', content: msg }]);
    try {
      const { data } = await api.post('/ia/chat', {
        mensagem: msg,
        historico: historico.slice(-10),
      });
      setHistorico(h => [...h, { role: 'assistant', content: data.resposta, modelo: data.modelo }]);
    } catch (err) {
      setHistorico(h => [...h, {
        role: 'assistant',
        content: `❌ Erro: ${err.response?.data?.erro || 'Falha ao conectar com o assistente'}`,
        erro: true,
      }]);
    } finally {
      setCarregando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const salvarConfig = async () => {
    await api.put('/ia/config', { ai_api_key: config.api_key || undefined, ai_modelo: config.modelo || undefined, ai_base_url: config.base_url || undefined });
    setConfig(c => ({ ...c, aberto: false }));
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assistente Kairos</h1>
          <p className="text-gray-500 text-sm">Secretário virtual inteligente</p>
        </div>
        {isSede() && (
          <button onClick={() => setConfig(c => ({ ...c, aberto: !c.aberto }))}
            className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
            <Settings size={16} /> Configurar IA
          </button>
        )}
      </div>

      {config.aberto && isSede() && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 space-y-3">
          <h3 className="font-semibold text-blue-900">Configuração da IA (OpenRouter / OpenAI compatible)</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">API Key</label>
              <input type="password" placeholder="sk-or-v1-..." value={config.api_key} onChange={e => setConfig(c => ({ ...c, api_key: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Modelo</label>
              <input type="text" placeholder="google/gemini-flash-1.5" value={config.modelo} onChange={e => setConfig(c => ({ ...c, modelo: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Base URL</label>
              <input type="text" placeholder="https://openrouter.ai/api/v1" value={config.base_url} onChange={e => setConfig(c => ({ ...c, base_url: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={salvarConfig} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Salvar</button>
            <button onClick={() => setConfig(c => ({ ...c, aberto: false }))} className="border px-4 py-2 rounded-lg text-sm">Cancelar</button>
          </div>
          <p className="text-xs text-gray-500">Modelos recomendados: <code>google/gemini-flash-1.5</code>, <code>deepseek/deepseek-chat</code>, <code>qwen/qwen-2.5-72b-instruct</code></p>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl border p-4 space-y-4 min-h-0">
        {historico.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Bot size={32} className="text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-600">Olá! Sou o Assistente Kairos.</p>
              <p className="text-sm mt-1">Pergunte sobre membros, obreiros, eventos e muito mais.</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {SUGESTOES.map(s => (
                <button key={s} onClick={() => enviar(s)}
                  className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1.5 hover:bg-blue-100">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {historico.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-gray-100'}`}>
              {msg.role === 'user' ? <User size={16} className="text-white" /> : <Bot size={16} className="text-gray-600" />}
            </div>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
              msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : msg.erro ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
            }`}>
              {msg.content}
              {msg.modelo && <span className="block text-xs opacity-50 mt-1">{msg.modelo}</span>}
            </div>
          </div>
        ))}

        {carregando && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <Bot size={16} className="text-gray-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 size={16} className="animate-spin text-gray-500" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          value={mensagem}
          onChange={e => setMensagem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviar()}
          placeholder="Pergunte algo sobre sua congregação..."
          className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500"
        />
        <button
          onClick={() => enviar()}
          disabled={!mensagem.trim() || carregando}
          className="bg-blue-600 text-white rounded-xl px-4 py-3 hover:bg-blue-700 disabled:opacity-40 transition-colors"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
