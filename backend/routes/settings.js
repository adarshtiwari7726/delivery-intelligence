const express = require('express');
const controller = require('../controllers/settingsController');

const router = express.Router();

router.get('/', controller.getSettings);
router.post('/', controller.updateSettings);

module.exports = router;
