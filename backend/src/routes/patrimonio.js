const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const { getDb } = require('../db/schema');
const { autenticar, filtrarCongregacao } = require('../middleware/auth');
const { enfileirar, registrarAuditoria } = require('../services/sync');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/patrimonio'),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', (req, res) => {
  const db = getDb();
  const filtros = ['ativo = 1'];
  const params = [];
  if (req.congregacaoFiltro) { filtros.push('congregacao_id = ?'); params.push(req.congregacaoFiltro); }
  if (req.query.categoria) { filtros.push('categoria = ?'); params.push(req.query.categoria); }
  res.json(db.prepare(`SELECT * FROM patrimonio WHERE ${filtros.join(' AND ')} ORDER BY descricao`).all(...params));
});

router.post('/', upload.single('foto'), (req, res) => {
  const db = getDb();
  const id = uuidv4();
  const agora = new Date().toISOString();
  const foto_url = req.file ? `/uploads/patrimonio/${req.file.filename}` : null;
  const { codigo, categoria, descricao, valor, localizacao } = req.body;
  const congregacao_id = req.congregacaoFiltro || req.body.congregacao_id;
  const dados = { id, congregacao_id, codigo, categoria, descricao, valor: parseFloat(valor) || 0, foto_url, localizacao, ativo: 1, criado_em: agora, atualizado_em: agora };
  db.prepare(`INSERT INTO patrimonio (id, congregacao_id, codigo, categoria, descricao, valor, foto_url, localizacao, ativo, criado_em, atualizado_em)
    VALUES (@id, @congregacao_id, @codigo, @categoria, @descricao, @valor, @foto_url, @localizacao, @ativo, @criado_em, @atualizado_em)`).run(dados);
  enfileirar('patrimonio', 'upsert', dados);
  registrarAuditoria(req.usuario.id, 'create', 'patrimonio', id, null, dados, req.ip);
  res.status(201).json(dados);
});

router.put('/:id', upload.single('foto'), (req, res) => {
  const db = getDb();
  const antes = db.prepare('SELECT * FROM patrimonio WHERE id = ?').get(req.params.id);
  if (!antes) return res.status(404).json({ erro: 'Não encontrado' });
  const agora = new Date().toISOString();
  const foto_url = req.file ? `/uploads/patrimonio/${req.file.filename}` : antes.foto_url;
  const { codigo, categoria, descricao, valor, localizacao, ativo } = req.body;
  db.prepare(`UPDATE patrimonio SET codigo=@codigo, categoria=@categoria, descricao=@descricao, valor=@valor, foto_url=@foto_url, localizacao=@localizacao, ativo=@ativo, atualizado_em=@atualizado_em WHERE id=@id`)
    .run({ codigo, categoria, descricao, valor: parseFloat(valor) || 0, foto_url, localizacao, ativo: ativo !== '0' ? 1 : 0, atualizado_em: agora, id: req.params.id });
  const depois = db.prepare('SELECT * FROM patrimonio WHERE id = ?').get(req.params.id);
  enfileirar('patrimonio', 'upsert', depois);
  registrarAuditoria(req.usuario.id, 'update', 'patrimonio', req.params.id, antes, depois, req.ip);
  res.json(depois);
});

module.exports = router;
