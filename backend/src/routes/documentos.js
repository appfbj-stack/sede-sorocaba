const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const { getDb } = require('../db/schema');
const { autenticar, filtrarCongregacao } = require('../middleware/auth');
const { getDriveClient } = require('../services/google');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

const upload = multer({ dest: path.join(__dirname, '../../uploads/documentos'), limits: { fileSize: 50 * 1024 * 1024 } });

async function uploadDrive(filePath, fileName, mimeType) {
  try {
    const db = getDb();
    const tokensCfg = db.prepare("SELECT valor FROM configuracoes WHERE chave = 'admin_tokens'").get();
    if (!tokensCfg) return null;
    const drive = getDriveClient(JSON.parse(tokensCfg.valor));
    const fs = require('fs');
    const { data } = await drive.files.create({
      requestBody: { name: fileName, mimeType },
      media: { mimeType, body: fs.createReadStream(filePath) },
      fields: 'id, webViewLink',
    });
    return { id: data.id, url: data.webViewLink };
  } catch (err) {
    console.error('[Drive] Erro upload:', err.message);
    return null;
  }
}

router.get('/', (req, res) => {
  const db = getDb();
  const where = req.congregacaoFiltro ? `AND congregacao_id = '${req.congregacaoFiltro}'` : '';
  const docs = db.prepare(`SELECT * FROM documentos WHERE 1=1 ${where} ORDER BY criado_em DESC`).all();
  res.json(docs);
});

router.post('/', upload.single('arquivo'), async (req, res) => {
  const db = getDb();
  const { nome, pasta } = req.body;
  const congregacao_id = req.congregacaoFiltro || req.body.congregacao_id;
  const id = uuidv4();
  const agora = new Date().toISOString();

  let drive_file_id = null, drive_url = null;
  if (req.file) {
    const result = await uploadDrive(req.file.path, req.file.originalname, req.file.mimetype);
    if (result) { drive_file_id = result.id; drive_url = result.url; }
  }

  const dados = { id, congregacao_id, nome: nome || req.file?.originalname || 'Sem nome', tipo: req.file?.mimetype || null, drive_file_id, drive_url, pasta: pasta || 'Geral', criado_em: agora };
  db.prepare(`INSERT INTO documentos (id, congregacao_id, nome, tipo, drive_file_id, drive_url, pasta, criado_em)
    VALUES (@id, @congregacao_id, @nome, @tipo, @drive_file_id, @drive_url, @pasta, @criado_em)`).run(dados);
  res.status(201).json(dados);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM documentos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
