const express = require('express');
const router = express.Router();
const AgendamentoController = require('../controllers/AgendamentoController');
const upload = require('../config/multer');

router.post('/', AgendamentoController.criar);
router.get('/pendentes', AgendamentoController.listarPendentes);
router.get('/recepcao/dia', AgendamentoController.listarPorDia); 
router.get('/tv/dados', AgendamentoController.dadosTv); // Nova rota TV
router.put('/:id/confirmar', AgendamentoController.confirmar);
router.put('/:id/cancelar', AgendamentoController.cancelar);
router.get('/medico/:medico_id', AgendamentoController.listarPorMedico);
router.put('/:id/status', AgendamentoController.alterarStatus);
router.post('/:id/prontuario', upload.single('file'), AgendamentoController.enviarProntuario);
router.post('/:id/feedback', AgendamentoController.receberFeedback);
router.get('/detalhes/:id', AgendamentoController.buscarPorId); // Rota para o ticket de sucesso

module.exports = router;
