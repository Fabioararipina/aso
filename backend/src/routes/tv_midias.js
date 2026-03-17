const express = require('express');
const router = express.Router();
const TvMidiaController = require('../controllers/TvMidiaController');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads/tv');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) { cb(null, 'tv-' + Date.now() + path.extname(file.originalname)); }
});
const uploadTv = multer({ storage: storage });


const auth = require('../middleware/auth');

// === TOKEN TV (TV usa token próprio, usuários admin usam JWT normal) ===
router.get('/', auth, TvMidiaController.listar);

// === PROTEGIDAS ===
router.post('/', auth, uploadTv.single('arquivo'), TvMidiaController.criar);
router.put('/:id', auth, uploadTv.single('arquivo'), TvMidiaController.atualizar);
router.put('/:id/ordem', auth, TvMidiaController.atualizarOrdem);
router.delete('/:id', auth, TvMidiaController.excluir);

module.exports = router;
