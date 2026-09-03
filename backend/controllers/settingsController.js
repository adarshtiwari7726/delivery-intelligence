const { getAllSettingsMasked, setSetting, SECRET_KEYS } = require('../services/settingsService');
const { listProviders } = require('../providers');

const EDITABLE_KEYS = new Set([
    'DELIVERY_PROVIDER',
    'AMAZON_MARKETPLACE',
    'CACHE_DURATION_MINUTES',
    'QUEUE_CONCURRENCY',
    'QUEUE_REQUESTS_PER_MINUTE',
    'QUEUE_RETRY_ATTEMPTS',
    'QUEUE_TIMEOUT_MS',
    'PAAPI_ACCESS_KEY',
    'PAAPI_SECRET_KEY',
    'PAAPI_PARTNER_TAG',
    'PAAPI_HOST',
    'PAAPI_REGION',
    'THIRDPARTY_API_BASE_URL',
    'THIRDPARTY_API_KEY',
    'THIRDPARTY_API_SECRET',
]);

function getSettings(req, res) {
    res.json({ success: true, settings: getAllSettingsMasked(), providers: listProviders() });
}

function updateSettings(req, res) {
    const body = req.body || {};
    const updated = [];

    for (const [key, value] of Object.entries(body)) {
        if (!EDITABLE_KEYS.has(key)) continue;
        // Skip masked placeholders sent back unmodified from the UI (e.g. "****ab12")
        if (SECRET_KEYS.has(key) && typeof value === 'string' && value.startsWith('****')) continue;
        setSetting(key, value);
        updated.push(key);
    }

    res.json({ success: true, updated });
}

module.exports = { getSettings, updateSettings };
