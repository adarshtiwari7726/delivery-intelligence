const express = require('express');
const controller = require('../controllers/historyController');

const router = express.Router();

router.get('/', controller.listHistory);
router.delete('/', controller.removeHistory);
router.get('/export', controller.exportHistory);
router.get('/dashboard', controller.dashboardStats);

module.exports = router;
