const { isValidAsin, isValidPin, isValidQuantity } = require('../utils/validators');

function validateSingleCheck(req, res, next) {
    const { asin, postalCode, quantity = 1 } = req.body || {};
    const errors = [];

    if (!asin || !isValidAsin(asin)) {
        errors.push('ASIN must be a valid 10-character Amazon ASIN (e.g. B0XXXXXXXXXX).');
    }
    if (!postalCode || !isValidPin(postalCode)) {
        errors.push('PIN code must be a valid 6-digit Indian postal code.');
    }
    if (!isValidQuantity(quantity)) {
        errors.push('Quantity must be a whole number between 1 and 999.');
    }

    if (errors.length) {
        return res.status(400).json({ success: false, errors });
    }
    next();
}

function validateBulkCheck(req, res, next) {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, errors: ['No rows to process.'] });
    }
    if (items.length > 5000) {
        return res.status(400).json({ success: false, errors: ['Maximum 5000 rows per bulk job.'] });
    }
    next();
}

module.exports = { validateSingleCheck, validateBulkCheck };
