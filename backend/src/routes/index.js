const express = require('express');
const router = express.Router();
const PacienteController = require('../controllers/PacienteController');
const AtendimentoController = require('../controllers/AtendimentoController');
const FilaController = require('../controllers/FilaController');
const AuthController = require('../controllers/AsoAuthController');
const auth = require('../middleware/auth');

// Alias for named import compatibility
const authenticateToken = auth;

// Auth
router.post('/auth/login', AuthController.login);
router.get('/auth/usuarios', auth, AuthController.listarUsuarios);
router.post('/auth/usuarios', auth, AuthController.criarUsuario);
router.put('/auth/usuarios/:id/senha', auth, AuthController.atualizarSenha);
router.delete('/auth/usuarios/:id', auth, AuthController.desativarUsuario);
router.post('/auth/tv-token', auth, AuthController.gerarCodigoTv);

// Pacientes
router.post('/pacientes', auth, PacienteController.criar);
router.get('/pacientes/buscar', auth, PacienteController.buscarPorWhatsapp);

// Atendimentos
router.post('/atendimentos', auth, AtendimentoController.criar);
router.get('/atendimentos/hoje', auth, AtendimentoController.listarHoje);
router.patch('/atendimentos/:id/cancelar', auth, AtendimentoController.cancelar);

// Fila
router.get('/fila/:sala_slug', auth, FilaController.listarPorSala);
router.post('/fila/:sala_slug/chamar', auth, FilaController.chamar);
router.post('/fila/:id/concluir', auth, FilaController.concluir);

// Salas
router.get('/salas', auth, async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query('SELECT * FROM salas WHERE ativo=true ORDER BY id');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin - update sala tempo
router.patch('/salas/:id/tempo', auth, async (req, res) => {
  const pool = require('../config/database');
  const { tempo_medio_min } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE salas SET tempo_medio_min=$1 WHERE id=$2 RETURNING *',
      [tempo_medio_min, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// TV dados (public — used by TV panel without auth)
router.get('/tv/dados', async (req, res) => {
  const pool = require('../config/database');
  try {
    const { rows } = await pool.query(`
      SELECT a.*, p.nome as paciente_nome,
        json_agg(json_build_object('sala_id',fs.sala_id,'sala_nome',s.nome,'sala_slug',s.slug,'status',fs.status,'posicao',fs.posicao) ORDER BY fs.sala_id) as salas
      FROM atendimentos a
      JOIN pacientes p ON p.id = a.paciente_id
      LEFT JOIN fila_salas fs ON fs.atendimento_id = a.id
      LEFT JOIN salas s ON s.id = fs.sala_id
      WHERE a.criado_em::date = CURRENT_DATE AND a.status IN ('PRESENTE','EM_ATENDIMENTO')
      GROUP BY a.id, p.nome
      ORDER BY a.criado_em ASC
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
