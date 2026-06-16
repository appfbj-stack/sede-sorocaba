const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db/schema');
const { autenticar, filtrarCongregacao } = require('../middleware/auth');
const { enfileirar, registrarAuditoria } = require('../services/sync');
const multer = require('multer');
const path = require('path');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/membros'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

function buildFiltro(req) {
  const filtros = ['1=1'];
  const params = [];
  if (req.congregacaoFiltro) { filtros.push('congregacao_id = ?'); params.push(req.congregacaoFiltro); }
  else if (req.query.congregacao_id) { filtros.push('congregacao_id = ?'); params.push(req.query.congregacao_id); }
  if (req.query.status) { filtros.push('status = ?'); params.push(req.query.status); }
  if (req.query.busca) { filtros.push('(nome LIKE ? OR cpf LIKE ?)'); params.push(`%${req.query.busca}%`, `%${req.query.busca}%`); }
  return { where: filtros.join(' AND '), params };
}

router.get('/', (req, res) => {
  const db = getDb();
  const { where, params } = buildFiltro(req);
  const total = db.prepare(`SELECT COUNT(*) as c FROM membros WHERE ${where}`).get(...params).c;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const offset = (page - 1) * limit;
  const membros = db.prepare(`SELECT * FROM membros WHERE ${where} ORDER BY nome LIMIT ? OFFSET ?`).all(...params, limit, offset);
  res.json({ total, page, limit, dados: membros });
});

router.get('/aniversariantes', (req, res) => {
  const db = getDb();
  const hoje = new Date();
  const filtro = req.congregacaoFiltro ? 'AND congregacao_id = ?' : '';
  const params = req.congregacaoFiltro ? [req.congregacaoFiltro] : [];
  const periodo = req.query.periodo || 'hoje';
  let condicao = '';
  if (periodo === 'hoje') {
    const mmdd = `${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
    condicao = `AND substr(data_nascimento, 6, 5) = '${mmdd}'`;
  } else if (periodo === 'semana') {
    condicao = `AND strftime('%j', date(substr(data_nascimento, 1, 4) || substr(data_nascimento, 5), '+${hoje.getFullYear() - 1} years')) BETWEEN strftime('%j', 'now') AND strftime('%j', 'now', '+7 days')`;
  } else if (periodo === 'mes') {
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    condicao = `AND substr(data_nascimento, 6, 2) = '${mm}'`;
  }
  const membros = db.prepare(`SELECT id, nome, data_nascimento, congregacao_id, foto_url, telefone, whatsapp FROM membros WHERE status = 'ativo' ${filtro} ${condicao} ORDER BY substr(data_nascimento, 6, 5)`).all(...params);
  res.json(membros);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const m = db.prepare('SELECT * FROM membros WHERE id = ?').get(req.params.id);
  if (!m) return res.status(404).json({ erro: 'Não encontrado' });
  if (req.congregacaoFiltro && m.congregacao_id !== req.congregacaoFiltro) return res.status(403).json({ erro: 'Acesso negado' });
  res.json(m);
});

router.post('/', upload.single('foto'), (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const agora = new Date().toISOString();
  const foto_url = req.file ? `/uploads/membros/${req.file.filename}` : null;
  const congregacao_id = req.congregacaoFiltro || req.body.congregacao_id;
  const dados = { id, congregacao_id, foto_url, ...req.body, criado_em: agora, atualizado_em: agora };
  db.prepare(`INSERT INTO membros (id, congregacao_id, foto_url, nome, cpf, rg, data_nascimento, telefone, whatsapp, endereco, estado_civil, data_conversao, data_batismo, cargo, status, observacoes, criado_em, atualizado_em)
    VALUES (@id, @congregacao_id, @foto_url, @nome, @cpf, @rg, @data_nascimento, @telefone, @whatsapp, @endereco, @estado_civil, @data_conversao, @data_batismo, @cargo, @status, @observacoes, @criado_em, @atualizado_em)`).run(dados);
  enfileirar('membros', 'upsert', dados);
  registrarAuditoria(req.usuario.id, 'create', 'membros', id, null, dados, req.ip);
  res.status(201).json(dados);
});

router.put('/:id', upload.single('foto'), (req, res) => {
  const db = getDb();
  const antes = db.prepare('SELECT * FROM membros WHERE id = ?').get(req.params.id);
  if (!antes) return res.status(404).json({ erro: 'Não encontrado' });
  if (req.congregacaoFiltro && antes.congregacao_id !== req.congregacaoFiltro) return res.status(403).json({ erro: 'Acesso negado' });
  const agora = new Date().toISOString();
  const foto_url = req.file ? `/uploads/membros/${req.file.filename}` : antes.foto_url;
  const { nome, cpf, rg, data_nascimento, telefone, whatsapp, endereco, estado_civil, data_conversao, data_batismo, cargo, status, observacoes } = req.body;
  db.prepare(`UPDATE membros SET nome=@nome, cpf=@cpf, rg=@rg, data_nascimento=@data_nascimento, telefone=@telefone, whatsapp=@whatsapp, endereco=@endereco,
    estado_civil=@estado_civil, data_conversao=@data_conversao, data_batismo=@data_batismo, cargo=@cargo, status=@status, observacoes=@observacoes,
    foto_url=@foto_url, atualizado_em=@atualizado_em WHERE id=@id`)
    .run({ nome, cpf, rg, data_nascimento, telefone, whatsapp, endereco, estado_civil, data_conversao, data_batismo, cargo, status, observacoes, foto_url, atualizado_em: agora, id: req.params.id });
  const depois = db.prepare('SELECT * FROM membros WHERE id = ?').get(req.params.id);
  enfileirar('membros', 'upsert', depois);
  registrarAuditoria(req.usuario.id, 'update', 'membros', req.params.id, antes, depois, req.ip);
  res.json(depois);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const antes = db.prepare('SELECT * FROM membros WHERE id = ?').get(req.params.id);
  if (!antes) return res.status(404).json({ erro: 'Não encontrado' });
  if (req.congregacaoFiltro && antes.congregacao_id !== req.congregacaoFiltro) return res.status(403).json({ erro: 'Acesso negado' });
  db.prepare('DELETE FROM membros WHERE id = ?').run(req.params.id);
  enfileirar('membros', 'delete', { id: req.params.id });
  registrarAuditoria(req.usuario.id, 'delete', 'membros', req.params.id, antes, null, req.ip);
  res.json({ ok: true });
});

module.exports = router;
