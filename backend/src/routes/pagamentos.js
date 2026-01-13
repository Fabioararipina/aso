const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/PaymentController');

router.post('/:id/pix', PaymentController.gerarPix);
router.post('/:id/link', PaymentController.gerarLink);
router.get('/:id/status', PaymentController.consultarStatus);
router.post('/webhook', PaymentController.webhook);

module.exports = router;
