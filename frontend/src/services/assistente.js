import api from './api';

export async function enviarMensagem({ mensagem, telaAtual, historico }) {
  const { data } = await api.post('/assistente/chat', {
    mensagem,
    tela_atual: telaAtual,
    historico: historico.slice(-20),
  });
  return data;
}

export async function confirmarAcao({ acao, telaAtual }) {
  const { data } = await api.post('/assistente/executar', {
    acao,
    tela_atual: telaAtual,
  });
  return data;
}

export async function obterContexto() {
  const { data } = await api.get('/assistente/contexto');
  return data;
}
