const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { autenticar, filtrarCongregacao } = require('../middleware/auth');
const { enfileirar, registrarAuditoria } = require('../services/sync');
const { getCalendarClient } = require('../services/google');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

async function criarEventoCalendar(evento) {
  try {
    const db = getDb();
    const tokensCfg = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'admin_tokens'").get();
    if (!tokensCfg) return null;
    const calendar = getCalendarClient(JSON.parse(tokensCfg.valor));
    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: evento.titulo,
        description: evento.descricao || '',
        location: evento.local || '',
        start: { dateTime: evento.data_inicio, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: evento.data_fim || evento.data_inicio, timeZone: 'America/Sao_Paulo' },
        reminders: { useDefault: false, overrides: [{ method: 'email', minutes: 1440 }, { method: 'popup', minutes: 60 }] },
      },
    });
    return result.data.id;
  } catch (err) {
    console.error('[Calendar] Erro ao criar evento:', err.message);
    return null;
  }
}

router.get('/', (req, res) => {
  const db = getDb();
  const filtros = ['1=1'];
  const params = [];
  if (req.congregacaoFiltro) { filtros.push('congregacao_id = ?'); params.push(req.congregacaoFiltro); }
  if (req.query.tipo) { filtros.push('tipo = ?'); params.push(req.query.tipo); }
  if (req.query.de) { filtros.push('date(data_inicio) >= ?'); params.push(req.query.de); }
  if (req.query.ate) { filtros.push('date(data_inicio) <= ?'); params.push(req.query.ate); }
  const eventos = db.prepare(`SELECT * FROM eventos WHERE ${filtros.join(' AND ')} ORDER BY data_inicio`).all(...params);
  res.json(eventos);
});

router.post('/', async (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const agora = new Date().toISOString();
  const { titulo, tipo, descricao, data_inicio, data_fim, local, responsavel_email } = req.body;
  const congregacao_id = req.congregacaoFiltro || req.body.congregacao_id;
  const google_event_id = await criarEventoCalendar({ titulo, tipo, descricao, data_inicio, data_fim, local });
  const dados = { id, congregacao_id, titulo, tipo, descricao, data_inicio, data_fim, local, responsavel_email, google_event_id, criado_em: agora };
  db.prepare(`INSERT INTO eventos (id, congregacao_id, titulo, tipo, descricao, data_inicio, data_fim, local, responsavel_email, google_event_id, criado_em)
    VALUES (@id, @congregacao_id, @titulo, @tipo, @descricao, @data_inicio, @data_fim, @local, @responsavel_email, @google_event_id, @criado_em)`).run(dados);
  enfileirar('eventos', 'upsert', dados);
  registrarAuditoria(req.usuario.id, 'create', 'eventos', id, null, dados, req.ip);
  res.status(201).json(dados);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const antes = db.prepare('SELECT * FROM eventos WHERE id = ?').get(req.params.id);
  if (!antes) return res.status(404).json({ erro: 'Não encontrado' });
  db.prepare('DELETE FROM eventos WHERE id = ?').run(req.params.id);
  enfileirar('eventos', 'delete', { id: req.params.id });
  registrarAuditoria(req.usuario.id, 'delete', 'eventos', req.params.id, antes, null, req.ip);
  res.json({ ok: true });
});

module.exports = router;
