const express = require('express');
const controller = require('../controllers/deliveryController');
const { validateSingleCheck, validateBulkCheck } = require('../middleware/validate');

const router = express.Router();

router.post('/check', validateSingleCheck, controller.checkSingle);
router.post('/bulk', validateBulkCheck, controller.checkBulk);
router.get('/bulk/:jobId', controller.bulkStatus);
router.get('/status', controller.providerStatus);
router.get('/asin/:asin/analysis', controller.asinAnalysis);

module.exports = router;
