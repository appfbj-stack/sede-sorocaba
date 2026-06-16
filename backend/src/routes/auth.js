const express = require('express');
const jwt = require('jsonwebtoken');
const { getAuthUrl, getTokensFromCode, getUserInfo } = require('../services/google');
const { getDb } = require('../db/schema');
const { autenticar } = require('../middleware/auth');

const router = express.Router();

// Redireciona para login Google
router.get('/google', (req, res) => {
  res.redirect(getAuthUrl());
});

// Callback do Google OAuth
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ erro: 'Código ausente' });

    const tokens = await getTokensFromCode(code);
    const userInfo = await getUserInfo(tokens.access_token);

    const db = getDb();
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ? AND ativo = 1').get(userInfo.email);

    if (!usuario) {
      return res.redirect(`${process.env.FRONTEND_URL}/acesso-negado?email=${encodeURIComponent(userInfo.email)}`);
    }

    // Salva tokens do admin para uso nos serviços Google
    if (usuario.perfil === 'sede') {
      db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('admin_tokens', ?)").run(JSON.stringify(tokens));
    }

    // Atualiza foto e nome
    db.prepare('UPDATE usuarios SET nome = ?, foto_url = ?, atualizado_em = datetime("now") WHERE id = ?')
      .run(userInfo.name, userInfo.picture, usuario.id);

    const jwtToken = jwt.sign(
      { id: usuario.id, email: usuario.email, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${jwtToken}`);
  } catch (err) {
    console.error('[Auth] Erro no callback:', err.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?erro=1`);
  }
});

// Retorna dados do usuário logado
router.get('/me', autenticar, (req, res) => {
  const { id, email, nome, perfil, congregacao_id, foto_url } = req.usuario;
  res.json({ id, email, nome, perfil, congregacao_id, foto_url });
});

router.post('/logout', autenticar, (req, res) => {
  res.json({ ok: true });
});

module.exports = router;
