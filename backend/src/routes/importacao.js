const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const xlsx = require('xlsx');
const { parse } = require('csv-parse/sync');
const { getDb } = require('../db/schema');
const { autenticar, filtrarCongregacao } = require('../middleware/auth');
const { enfileirar } = require('../services/sync');

const router = express.Router();
router.use(autenticar, filtrarCongregacao);

const upload = multer({
  dest: path.join(__dirname, '../../uploads/importacao'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Mapeamento inteligente de colunas comuns
const MAPA_COLUNAS = {
  nome: ['nome', 'name', 'membro', 'pessoa', 'completo', 'nome completo'],
  cpf: ['cpf', 'documento', 'doc', 'cadastro'],
  data_nascimento: ['nascimento', 'data de nascimento', 'nasc', 'birthday', 'data_nasc'],
  telefone: ['telefone', 'tel', 'phone', 'celular', 'fone'],
  whatsapp: ['whatsapp', 'wpp', 'zap'],
  email: ['email', 'e-mail', 'correio'],
  data_batismo: ['batismo', 'data batismo', 'batizado em'],
  data_conversao: ['conversao', 'conversão', 'convertido em'],
  cargo: ['cargo', 'função', 'funcao', 'role'],
  estado_civil: ['estado civil', 'estadocivil', 'civil'],
  endereco: ['endereco', 'endereço', 'address', 'rua'],
  rg: ['rg', 'identidade', 'registro geral'],
  observacoes: ['obs', 'observacoes', 'observações', 'notas', 'nota'],
};

function detectarColuna(headerOriginal) {
  const h = headerOriginal.toLowerCase().trim();
  for (const [campo, aliases] of Object.entries(MAPA_COLUNAS)) {
    if (aliases.some(a => h.includes(a))) return campo;
  }
  return null;
}

function validarCPF(cpf) {
  if (!cpf) return true;
  const nums = cpf.replace(/\D/g, '');
  if (nums.length !== 11) return false;
  if (/^(\d)\1+$/.test(nums)) return false;
  return true;
}

function detectarDuplicidade(db, membro, congregacao_id) {
  if (membro.cpf) {
    const cpfLimpo = membro.cpf.replace(/\D/g, '');
    const existe = db.prepare('SELECT id, nome FROM membros WHERE REPLACE(cpf, "-", "") = ? OR REPLACE(cpf, ".", "") = ?').get(cpfLimpo, cpfLimpo);
    if (existe) return { tipo: 'cpf', existente: existe };
  }
  if (membro.nome) {
    const existe = db.prepare('SELECT id, nome FROM membros WHERE nome = ? AND congregacao_id = ?').get(membro.nome, congregacao_id);
    if (existe) return { tipo: 'nome', existente: existe };
  }
  return null;
}

router.post('/analisar', upload.single('arquivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ erro: 'Arquivo obrigatório' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  let linhas = [];
  let headers = [];

  try {
    if (['.xlsx', '.xls'].includes(ext)) {
      const wb = xlsx.readFile(req.file.path);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const dados = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
      headers = dados[0].map(String);
      linhas = dados.slice(1).filter(r => r.some(c => c !== ''));
    } else if (ext === '.csv') {
      const fs = require('fs');
      const conteudo = fs.readFileSync(req.file.path, 'utf-8');
      const dados = parse(conteudo, { columns: true, skip_empty_lines: true });
      headers = Object.keys(dados[0] || {});
      linhas = dados.map(r => headers.map(h => r[h]));
    } else {
      return res.status(400).json({ erro: `Formato não suportado: ${ext}. Use XLSX, XLS ou CSV` });
    }

    const mapeamento = {};
    headers.forEach(h => {
      const campo = detectarColuna(h);
      if (campo) mapeamento[h] = campo;
    });

    res.json({
      total_linhas: linhas.length,
      headers,
      mapeamento_sugerido: mapeamento,
      previa: linhas.slice(0, 5).map(r => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = r[i]; });
        return obj;
      }),
      arquivo_temp: req.file.filename,
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao analisar arquivo', detalhe: err.message });
  }
});

router.post('/confirmar', upload.single('dummy'), async (req, res) => {
  const { arquivo_temp, mapeamento, congregacao_id, modo_duplicado = 'ignorar' } = req.body;
  const mapeamentoObj = typeof mapeamento === 'string' ? JSON.parse(mapeamento) : mapeamento;
  const congId = req.congregacaoFiltro || congregacao_id;

  if (!arquivo_temp || !congId) return res.status(400).json({ erro: 'Parâmetros obrigatórios ausentes' });

  const arquivoPath = path.join(__dirname, '../../uploads/importacao', arquivo_temp);
  const ext = path.extname(arquivo_temp).split('_').pop() || '.xlsx';

  let linhas = [];
  let headers = [];

  try {
    const fs = require('fs');
    const wb = xlsx.readFile(arquivoPath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const dados = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
    headers = dados[0].map(String);
    linhas = dados.slice(1).filter(r => r.some(c => c !== ''));
  } catch {
    try {
      const fs = require('fs');
      const conteudo = fs.readFileSync(arquivoPath, 'utf-8');
      const dados = parse(conteudo, { columns: true, skip_empty_lines: true });
      headers = Object.keys(dados[0] || {});
      linhas = dados.map(r => headers.map(h => r[h]));
    } catch (err2) {
      return res.status(500).json({ erro: 'Não foi possível ler o arquivo temporário' });
    }
  }

  const db = getDb();
  const resultado = { importados: 0, atualizados: 0, duplicados: 0, rejeitados: 0, erros: [] };

  const inserir = db.prepare(`INSERT INTO membros (id, congregacao_id, nome, cpf, rg, data_nascimento, telefone, whatsapp, endereco, estado_civil, data_conversao, data_batismo, cargo, status, observacoes, criado_em, atualizado_em)
    VALUES (@id, @congregacao_id, @nome, @cpf, @rg, @data_nascimento, @telefone, @whatsapp, @endereco, @estado_civil, @data_conversao, @data_batismo, @cargo, @status, @observacoes, @criado_em, @atualizado_em)`);

  const atualizar = db.prepare(`UPDATE membros SET nome=@nome, cpf=@cpf, telefone=@telefone, whatsapp=@whatsapp, data_nascimento=@data_nascimento, atualizado_em=@atualizado_em WHERE id=@id`);

  const importar = db.transaction(() => {
    for (let i = 0; i < linhas.length; i++) {
      try {
        const linha = linhas[i];
        const membro = { status: 'ativo' };
        headers.forEach((h, idx) => {
          const campo = mapeamentoObj[h];
          if (campo) membro[campo] = String(linha[idx] || '').trim() || null;
        });

        if (!membro.nome) { resultado.rejeitados++; resultado.erros.push({ linha: i + 2, erro: 'Nome obrigatório' }); continue; }
        if (membro.cpf && !validarCPF(membro.cpf)) { resultado.rejeitados++; resultado.erros.push({ linha: i + 2, erro: `CPF inválido: ${membro.cpf}` }); continue; }

        const dup = detectarDuplicidade(db, membro, congId);
        if (dup) {
          if (modo_duplicado === 'ignorar') { resultado.duplicados++; continue; }
          if (modo_duplicado === 'atualizar') {
            atualizar.run({ ...membro, id: dup.existente.id, atualizado_em: new Date().toISOString() });
            enfileirar('membros', 'upsert', { id: dup.existente.id, ...membro });
            resultado.atualizados++;
            continue;
          }
        }

        const id = uuidv4();
        const agora = new Date().toISOString();
        inserir.run({ id, congregacao_id: congId, ...membro, criado_em: agora, atualizado_em: agora });
        enfileirar('membros', 'upsert', { id, congregacao_id: congId, ...membro });
        resultado.importados++;
      } catch (err) {
        resultado.rejeitados++;
        resultado.erros.push({ linha: i + 2, erro: err.message });
      }
    }
  });

  importar();
  res.json(resultado);
});

module.exports = router;
