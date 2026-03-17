const express = require('express');
const router = express.Router();
const MedicoController = require('../controllers/MedicoController');
const uploadMedicos = require('../config/multerMedicos');
const auth = require('../middleware/auth');

// === ROTAS PÚBLICAS (sem login) ===
router.get('/', MedicoController.listar);                                             // wizard público
router.get('/:id/disponiveis', MedicoController.disponiveis);                         // wizard público

// === ROTAS PROTEGIDAS (requerem login) ===
router.post('/', auth, uploadMedicos.single('foto'), MedicoController.criar);
router.put('/:id', auth, uploadMedicos.single('foto'), MedicoController.atualizar);
router.delete('/:id', auth, MedicoController.excluir);
router.get('/:id/horarios', auth, MedicoController.listarHorarios);
router.post('/:id/horarios', auth, MedicoController.adicionarHorario);
router.delete('/horarios/:id', auth, MedicoController.removerHorario);
router.post('/:id/atraso', auth, MedicoController.notificarAtraso);

module.exports = router;
