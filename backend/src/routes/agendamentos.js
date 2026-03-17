const express = require('express');
const router = express.Router();
const AgendamentoController = require('../controllers/AgendamentoController');
const upload = require('../config/multer');
const auth = require('../middleware/auth');

// === ROTAS PÚBLICAS (sem login) ===
router.post('/', AgendamentoController.criar);                          // wizard público
router.get('/detalhes/:id', AgendamentoController.buscarPorId);         // acompanhamento do paciente
router.get('/:id/posicao', AgendamentoController.verFila);              // rastreador de fila
router.post('/:id/feedback', AgendamentoController.receberFeedback);    // NPS

// === ROTAS COM TOKEN (TV usa token próprio, usuários admin usam JWT normal) ===
router.get('/tv/dados', auth, AgendamentoController.dadosTv);

// === ROTAS PROTEGIDAS (requerem login) ===
router.post('/encaixe', auth, AgendamentoController.encaixar);
router.post('/trocar', auth, AgendamentoController.trocar);
router.get('/pendentes', auth, AgendamentoController.listarPendentes);
router.get('/recepcao/dia', auth, AgendamentoController.listarPorDia);
router.get('/medico/:medico_id', auth, AgendamentoController.listarPorMedico);
router.get('/paciente/:paciente_id/historico', auth, AgendamentoController.listarHistorico);
router.put('/:id/confirmar', auth, AgendamentoController.confirmar);
router.put('/:id/cancelar', auth, AgendamentoController.cancelar);
router.put('/:id/status', auth, AgendamentoController.alterarStatus);
router.put('/:id/mover', auth, AgendamentoController.mover);
router.post('/:id/prontuario', auth, upload.single('file'), AgendamentoController.enviarProntuario);

module.exports = router;
