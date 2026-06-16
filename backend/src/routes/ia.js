const express = require('express');
const axios = require('axios');
const { getDb } = require('../db/schema');
const { autenticar, filtrarCongregacao } = require('../middleware/auth');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

function buildContexto(usuario, congId) {
  const db = getDb();
  const isSede = usuario.perfil === 'sede';
  const whereC = congId ? `AND congregacao_id = '${congId}'` : '';

  const hoje = new Date();
  const mm = String(hoje.getMonth() + 1).padStart(2, '0');
  const dd = String(hoje.getDate()).padStart(2, '0');

  const stats = {
    total_membros: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE 1=1 ${whereC}`).get().c,
    membros_ativos: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE status='ativo' ${whereC}`).get().c,
    membros_inativos: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE status='inativo' ${whereC}`).get().c,
    batizados: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE data_batismo IS NOT NULL AND data_batismo != '' ${whereC}`).get().c,
    nao_batizados: db.prepare(`SELECT COUNT(*) as c FROM membros WHERE (data_batismo IS NULL OR data_batismo = '') AND status='ativo' ${whereC}`).get().c,
    total_obreiros: db.prepare(`SELECT COUNT(*) as c FROM obreiros WHERE ativo=1 ${whereC}`).get().c,
    credenciais_vencidas: db.prepare(`SELECT COUNT(*) as c FROM obreiros WHERE ativo=1 AND credencial_validade < date('now') ${whereC}`).get().c,
    carteirinhas_vencidas: db.prepare(`SELECT COUNT(*) as c FROM carteirinhas c JOIN membros m ON c.membro_id=m.id WHERE c.status='vencida' ${whereC.replace('congregacao_id', 'm.congregacao_id')}`).get().c,
  };

  const aniversariantes = db.prepare(
    `SELECT nome, data_nascimento FROM membros WHERE status='ativo' AND substr(data_nascimento,6,5)='${mm}-${dd}' ${whereC} LIMIT 10`
  ).all();

  const proximos_eventos = db.prepare(
    `SELECT titulo, tipo, data_inicio, local FROM eventos WHERE date(data_inicio) >= date('now') ${whereC} ORDER BY data_inicio LIMIT 5`
  ).all();

  return `
Você é o Assistente Kairos, secretário virtual da ${isSede ? 'OBPC Sorocaba Sede' : 'congregação'}.
Responda sempre em português brasileiro, de forma clara e objetiva.
${!isSede ? 'Você só tem acesso aos dados da congregação do pastor usuário.' : 'Você tem acesso a todos os dados da sede.'}

DADOS ATUAIS (${new Date().toLocaleDateString('pt-BR')}):
- Total de membros: ${stats.total_membros}
- Membros ativos: ${stats.membros_ativos}
- Membros inativos: ${stats.membros_inativos}
- Batizados: ${stats.batizados}
- Não batizados (ativos): ${stats.nao_batizados}
- Total de obreiros ativos: ${stats.total_obreiros}
- Credenciais vencidas: ${stats.credenciais_vencidas}
- Carteirinhas vencidas: ${stats.carteirinhas_vencidas}
- Aniversariantes hoje: ${aniversariantes.length > 0 ? aniversariantes.map(a => a.nome).join(', ') : 'Nenhum'}
- Próximos eventos: ${proximos_eventos.length > 0 ? proximos_eventos.map(e => `${e.titulo} em ${new Date(e.data_inicio).toLocaleDateString('pt-BR')}`).join('; ') : 'Nenhum agendado'}
  `.trim();
}

router.post('/chat', async (req, res) => {
  const { mensagem, historico = [] } = req.body;
  if (!mensagem) return res.status(400).json({ erro: 'Mensagem obrigatória' });

  const db = getDb();
  const apiKeyCfg = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'ai_api_key'").get();
  const modeloCfg = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'ai_modelo'").get();
  const baseurlCfg = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'ai_base_url'").get();

  const apiKey = apiKeyCfg?.valor || process.env.OPENROUTER_API_KEY;
  const modelo = modeloCfg?.valor || 'google/gemini-flash-1.5';
  const baseURL = baseurlCfg?.valor || 'https://openrouter.ai/api/v1';

  if (!apiKey) return res.status(500).json({ erro: 'Chave de API de IA não configurada' });

  const sistemPrompt = buildContexto(req.usuario, req.congregacaoFiltro);

  const messages = [
    { role: 'system', content: sistemPrompt },
    ...historico.slice(-10),
    { role: 'user', content: mensagem },
  ];

  try {
    const response = await axios.post(
      `${baseURL}/chat/completions`,
      { model: modelo, messages, max_tokens: 1000, temperature: 0.7 },
      { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );
    const resposta = response.data.choices[0].message.content;
    res.json({ resposta, modelo });
  } catch (err) {
    console.error('[IA] Erro:', err.response?.data || err.message);
    res.status(500).json({ erro: 'Erro ao contatar o assistente IA', detalhe: err.response?.data?.error?.message });
  }
});

router.get('/config', (req, res) => {
  const db = getDb();
  const cfg = {};
  ['ai_modelo', 'ai_base_url'].forEach(chave => {
    const r = db.prepare('SELECT valor FROM configuracoes WHERE chave = ?').get(chave);
    if (r) cfg[chave] = r.valor;
  });
  cfg.ai_api_key = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'ai_api_key'").get() ? '***configurado***' : null;
  res.json(cfg);
});

router.put('/config', (req, res) => {
  if (req.usuario.perfil !== 'sede') return res.status(403).json({ erro: 'Apenas sede pode configurar IA' });
  const db = getDb();
  const { ai_api_key, ai_modelo, ai_base_url } = req.body;
  const agora = new Date().toISOString();
  if (ai_api_key) db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor, atualizado_em) VALUES ('ai_api_key', ?, ?)").run(ai_api_key, agora);
  if (ai_modelo) db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor, atualizado_em) VALUES ('ai_modelo', ?, ?)").run(ai_modelo, agora);
  if (ai_base_url) db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor, atualizado_em) VALUES ('ai_base_url', ?, ?)").run(ai_base_url, agora);
  res.json({ ok: true });
});

module.exports = router;
