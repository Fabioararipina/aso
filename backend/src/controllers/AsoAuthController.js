const pool = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'TROQUE_ESSA_CHAVE_NO_ENV';

const AuthController = {
  async login(req, res) {
    const { usuario, email, senha } = req.body;
    const identificador = usuario || email;
    if (!identificador || !senha) {
      return res.status(400).json({ error: 'Usuário/email e senha obrigatórios.' });
    }
    try {
      // Try by usuario field first, then email
      let result = await pool.query(
        'SELECT * FROM usuarios WHERE usuario = $1 AND ativo = true',
        [identificador]
      );
      if (result.rows.length === 0) {
        result = await pool.query(
          'SELECT * FROM usuarios WHERE email = $1 AND ativo = true',
          [identificador]
        );
      }
      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      }
      const user = result.rows[0];
      const senhaCorreta = await bcrypt.compare(senha, user.senha_hash);
      if (!senhaCorreta) {
        return res.status(401).json({ error: 'Usuário ou senha inválidos.' });
      }
      const expiresIn = user.perfil === 'TV' ? '365d' : '8h';
      const token = jwt.sign(
        {
          id: user.id,
          usuario: user.usuario,
          perfil: user.perfil,
          nome: user.nome,
          sala_id: user.sala_id || null,
        },
        JWT_SECRET,
        { expiresIn }
      );
      res.json({ token, perfil: user.perfil, nome: user.nome, sala_id: user.sala_id });
    } catch (err) {
      console.error('[AUTH] Erro no login:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },

  async criarUsuario(req, res) {
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    const { nome, usuario, email, senha, perfil, sala_id } = req.body;
    if (!nome || !usuario || !senha || !perfil) {
      return res.status(400).json({ error: 'Nome, usuário, senha e perfil são obrigatórios.' });
    }
    if (!['ADMIN', 'RECEPCAO', 'OPERADOR'].includes(perfil)) {
      return res.status(400).json({ error: 'Perfil inválido. Use: ADMIN, RECEPCAO ou OPERADOR.' });
    }
    try {
      const senhaHash = await bcrypt.hash(senha, 10);
      const result = await pool.query(
        `INSERT INTO usuarios (nome, usuario, email, senha_hash, perfil, sala_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, nome, usuario, email, perfil, sala_id`,
        [nome, usuario, email || null, senhaHash, perfil, sala_id || null]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Esse nome de usuário já existe.' });
      }
      console.error('[AUTH] Erro ao criar usuário:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },

  async listarUsuarios(req, res) {
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    try {
      const result = await pool.query(
        'SELECT id, nome, usuario, email, perfil, sala_id, ativo, criado_em FROM usuarios ORDER BY nome'
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },

  async atualizarSenha(req, res) {
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    const { id } = req.params;
    const { senha } = req.body;
    if (!senha || senha.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
    }
    try {
      const senhaHash = await bcrypt.hash(senha, 10);
      await pool.query('UPDATE usuarios SET senha_hash = $1 WHERE id = $2', [senhaHash, id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },

  async desativarUsuario(req, res) {
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    const { id } = req.params;
    if (parseInt(id) === req.usuario.id) {
      return res.status(400).json({ error: 'Você não pode desativar seu próprio usuário.' });
    }
    try {
      await pool.query('UPDATE usuarios SET ativo = false WHERE id = $1', [id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },

  async gerarCodigoTv(req, res) {
    if (req.usuario.perfil !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    try {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const codigo = `${seg()}-${seg()}-${seg()}`;
      const senhaHash = await bcrypt.hash(codigo, 10);
      await pool.query(`
        INSERT INTO usuarios (nome, usuario, senha_hash, perfil)
        VALUES ('TV ASO', 'tv', $1, 'TV')
        ON CONFLICT (usuario) DO UPDATE SET senha_hash = $1, ativo = true
      `, [senhaHash]);
      res.json({ codigo });
    } catch (err) {
      console.error('[AUTH] Erro ao gerar código TV:', err.message);
      res.status(500).json({ error: 'Erro interno no servidor.' });
    }
  },
};

module.exports = AuthController;
