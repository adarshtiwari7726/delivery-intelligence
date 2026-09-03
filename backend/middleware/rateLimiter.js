const rateLimit = require('express-rate-limit');

// Protects our own API from abuse. This is independent from, and in
// addition to, the outbound queue rate limiting in services/queueService.js
// that protects the upstream provider.
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests. Please slow down.' },
});

module.exports = { apiLimiter };
