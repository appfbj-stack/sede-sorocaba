import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, X, Send, Mic, MicOff, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAssistenteStore } from '../../stores/assistente';
import { useAuthStore } from '../../stores/auth';
import { enviarMensagem, confirmarAcao } from '../../services/assistente';
import CardAjuda from './CardAjuda';
import api from '../../services/api';

const LABELS_TELA = {
  '/dashboard': 'Dashboard',
  '/membros': 'Cadastro de Membros',
  '/obreiros': 'Obreiros',
  '/congregacoes': 'Congregacoes',
  '/agenda': 'Agenda',
  '/batismos': 'Batismos',
  '/carteirinhas': 'Carteirinhas',
  '/patrimonio': 'Patrimonio',
  '/perfil': 'Meu Perfil',
  '/admin/usuarios': 'Gestao de Usuarios',
  '/admin/configuracoes': 'Configuracoes',
  '/admin/logs': 'Logs de Atividade',
};

const SUGESTOES_TELA = {
  '/membros': ['Como cadastro um membro?', 'Mostre os aniversariantes', 'Cadastre um novo membro'],
  '/agenda': ['Quais eventos temos esta semana?', 'Criar um culto para domingo'],
  '/obreiros': ['Listar obreiros ativos', 'Como emito uma credencial?'],
  '/dashboard': ['Mostre um resumo', 'Quem faz aniversario hoje?', 'Quantos membros temos?'],
  '/congregacoes': ['Listar congregacoes', 'Como adicionar uma congregacao?'],
};

export default function AssistenteIA() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    aberto, alternar, fechar, historico, carregando, acaoPendente,
    adicionarMensagem, setCarregando, setAcaoPendente, limparAcaoPendente, limparHistorico,
  } = useAssistenteStore();
  const { usuario } = useAuthStore();

  const [texto, setTexto] = useState('');
  const [escutando, setEscutando] = useState(false);
  const [respostaAtual, setRespostaAtual] = useState(null);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const recognitionRef = useRef(null);

  const telaAtual = LABELS_TELA[location.pathname] || location.pathname;
  const sugestoes = SUGESTOES_TELA[location.pathname] || [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [historico, carregando, respostaAtual]);
  useEffect(() => { if (aberto) setTimeout(() => inputRef.current?.focus(), 100); }, [aberto]);

  const enviar = async (mensagemTexto) => {
    const msg = (mensagemTexto || texto).trim();
    if (!msg || carregando) return;
    setTexto('');
    setRespostaAtual(null);
    adicionarMensagem('user', msg);
    setCarregando(true);
    try {
      const resposta = await enviarMensagem({ mensagem: msg, telaAtual, historico: historico.slice(-20) });
      setRespostaAtual(resposta);
      adicionarMensagem('assistant', resposta.resposta);
      if (resposta.aguardando_confirmacao && resposta.acao) {
        setAcaoPendente(resposta.acao);
      } else {
        limparAcaoPendente();
      }
    } catch {
      adicionarMensagem('assistant', 'Desculpe, tive um problema. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const confirmar = async () => {
    if (!acaoPendente) return;
    setCarregando(true);
    try {
      const resultado = await confirmarAcao({ acao: acaoPendente, telaAtual });
      if (resultado.executar_no_frontend) {
        await executarNoFrontend(resultado.tipo, resultado.dados);
      } else {
        adicionarMensagem('assistant', resultado.mensagem || 'Feito!');
      }
      limparAcaoPendente();
      setRespostaAtual(null);
    } catch {
      adicionarMensagem('assistant', 'Nao consegui executar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const executarNoFrontend = async (tipo, dados) => {
    try {
      if (tipo === 'cadastrar_membro') {
        await api.post('/membros', dados);
        adicionarMensagem('assistant', 'Membro "' + dados.nome + '" cadastrado com sucesso!');
      } else if (tipo === 'cadastrar_evento') {
        await api.post('/agenda', dados);
        adicionarMensagem('assistant', 'Evento "' + dados.titulo + '" criado com sucesso!');
      } else if (tipo === 'cadastrar_congregacao') {
        await api.post('/congregacoes', dados);
        adicionarMensagem('assistant', 'Congregacao "' + dados.nome + '" cadastrada!');
      }
    } catch (err) {
      const detalhe = err.response?.data?.detail || 'Verifique os dados e tente novamente.';
      adicionarMensagem('assistant', 'Erro: ' + detalhe);
    }
  };

  const alternarVoz = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { adicionarMensagem('assistant', 'Seu navegador nao suporta voz. Use o Chrome.'); return; }
    if (escutando) { recognitionRef.current?.stop(); setEscutando(false); return; }
    const recognition = new SR();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => setEscutando(true);
    recognition.onend = () => setEscutando(false);
    recognition.onerror = () => setEscutando(false);
    recognition.onresult = (e) => enviar(e.results[0][0].transcript);
    recognition.start();
  };

  return (
    <>
      <button
        onClick={alternar}
        className={"fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 " + (aberto ? "bg-gray-700 hover:bg-gray-800" : "bg-blue-600 hover:bg-blue-700 hover:scale-110")}
        title="Assistente Kairos"
      >
        {aberto ? <X size={22} className="text-white" /> : <Bot size={24} className="text-white" />}
      </button>

      {aberto && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden" style={{ height: '520px' }}>

          <div className="bg-blue-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                <Bot size={18} className="text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Kairos IA</p>
                <p className="text-blue-200 text-xs truncate max-w-[180px]">{telaAtual}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={limparHistorico} title="Limpar conversa" className="text-blue-300 hover:text-white transition-colors">
                <Trash2 size={16} />
              </button>
              <button onClick={fechar} className="text-blue-300 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {historico.length === 0 && (
              <div className="text-center py-4">
                <div className="text-3xl mb-2">👋</div>
                <p className="text-sm text-gray-600 font-medium">Ola, {usuario?.nome?.split(' ')[0]}!</p>
                <p className="text-xs text-gray-500 mt-1">Sou a Kairos, sua secretaria digital. Como posso ajudar?</p>
                {sugestoes.length > 0 && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {sugestoes.map((s, i) => (
                      <button key={i} onClick={() => enviar(s)} className="text-xs bg-white border border-blue-200 text-blue-700 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors text-left">{s}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {historico.map((msg, i) => (
              <div key={i} className={"flex " + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={"max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed " + (msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm')}>
                  {msg.content}
                </div>
              </div>
            ))}

            {respostaAtual?.card_ajuda && (
              <CardAjuda card={respostaAtual.card_ajuda} onVoltar={() => setRespostaAtual(null)} />
            )}

            {acaoPendente && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <p className="text-xs text-yellow-800 font-medium mb-2">Confirma esta acao?</p>
                <p className="text-xs text-gray-600 mb-3">
                  <strong>Acao:</strong> {acaoPendente.tipo?.replace(/_/g, ' ')}
                  {acaoPendente.dados?.nome && <> - <strong>{acaoPendente.dados.nome}</strong></>}
                </p>
                <div className="flex gap-2">
                  <button onClick={confirmar} disabled={carregando} className="flex items-center gap-1 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
                    <CheckCircle size={13} /> Confirmar
                  </button>
                  <button onClick={() => { limparAcaoPendente(); setRespostaAtual(null); adicionarMensagem('assistant', 'Ok, cancelei. Posso ajudar com mais alguma coisa?'); }} className="flex items-center gap-1 bg-white border border-gray-300 text-gray-600 text-xs px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                    <XCircle size={13} /> Cancelar
                  </button>
                </div>
              </div>
            )}

            {carregando && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {historico.length > 0 && sugestoes.length > 0 && !carregando && !acaoPendente && (
            <div className="px-3 py-2 border-t border-gray-100 bg-white flex gap-1.5 overflow-x-auto">
              {sugestoes.slice(0, 2).map((s, i) => (
                <button key={i} onClick={() => enviar(s)} className="text-xs bg-gray-100 text-gray-600 rounded-full px-3 py-1 hover:bg-blue-100 hover:text-blue-700 transition-colors whitespace-nowrap flex-shrink-0">{s}</button>
              ))}
            </div>
          )}

          <div className="p-3 border-t border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <button onClick={alternarVoz} title={escutando ? 'Parar' : 'Falar'} className={"w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors " + (escutando ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600')}>
                {escutando ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && enviar()}
                placeholder={escutando ? 'Ouvindo...' : 'Digite ou fale sua mensagem...'}
                disabled={carregando || escutando}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button onClick={() => enviar()} disabled={!texto.trim() || carregando} className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {carregando ? <Loader2 size={16} className="text-white animate-spin" /> : <Send size={16} className="text-white" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
