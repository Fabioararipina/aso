const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const auth = require('../middleware/auth');

// Pública
router.post('/login', AuthController.login);

// Protegidas (somente ADMIN via verificação interna no controller)
router.get('/usuarios', auth, AuthController.listarUsuarios);
router.post('/usuarios', auth, AuthController.criarUsuario);
router.put('/usuarios/:id/senha', auth, AuthController.atualizarSenha);
router.delete('/usuarios/:id', auth, AuthController.desativarUsuario);
router.post('/tv-token', auth, AuthController.gerarCodigoTv);

module.exports = router;
