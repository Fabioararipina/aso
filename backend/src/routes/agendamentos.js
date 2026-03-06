const express = require('express');
const router = express.Router();
const AgendamentoController = require('../controllers/AgendamentoController');
const upload = require('../config/multer');

// Rotas estáticas (sem parâmetros dinâmicos) - sempre antes das dinâmicas
router.post('/', AgendamentoController.criar);
router.post('/encaixe', AgendamentoController.encaixar);
router.post('/trocar', AgendamentoController.trocar);
router.get('/pendentes', AgendamentoController.listarPendentes);
router.get('/recepcao/dia', AgendamentoController.listarPorDia);
router.get('/tv/dados', AgendamentoController.dadosTv);
router.get('/medico/:medico_id', AgendamentoController.listarPorMedico);
router.get('/paciente/:paciente_id/historico', AgendamentoController.listarHistorico);
router.get('/detalhes/:id', AgendamentoController.buscarPorId);

// Rotas dinâmicas (com :id) - sempre depois das estáticas
router.get('/:id/posicao', AgendamentoController.verFila);
router.put('/:id/confirmar', AgendamentoController.confirmar);
router.put('/:id/cancelar', AgendamentoController.cancelar);
router.put('/:id/status', AgendamentoController.alterarStatus);
router.put('/:id/mover', AgendamentoController.mover);
router.post('/:id/prontuario', upload.single('file'), AgendamentoController.enviarProntuario);
router.post('/:id/feedback', AgendamentoController.receberFeedback);

module.exports = router;
