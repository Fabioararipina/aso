const express = require('express');
const router = express.Router();
const MedicoController = require('../controllers/MedicoController');
const uploadMedicos = require('../config/multerMedicos');

router.get('/', MedicoController.listar);
router.post('/', uploadMedicos.single('foto'), MedicoController.criar);
router.put('/:id', uploadMedicos.single('foto'), MedicoController.atualizar);
router.delete('/:id', MedicoController.excluir);

router.get('/:id/horarios', MedicoController.listarHorarios);
router.post('/:id/horarios', MedicoController.adicionarHorario);
router.delete('/horarios/:id', MedicoController.removerHorario);
router.get('/:id/disponiveis', MedicoController.disponiveis);
router.post('/:id/atraso', MedicoController.notificarAtraso);

module.exports = router;
