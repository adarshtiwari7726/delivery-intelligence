const db = require('../database/db');

const SECRET_KEYS = new Set([
    'PAAPI_SECRET_KEY',
    'PAAPI_ACCESS_KEY',
    'THIRDPARTY_API_KEY',
    'THIRDPARTY_API_SECRET',
]);

const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setStmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
);
const allStmt = db.prepare('SELECT key, value FROM settings');

function getSetting(key) {
    const row = getStmt.get(key);
    return row ? row.value : undefined;
}

function setSetting(key, value) {
    setStmt.run(key, value == null ? null : String(value));
}

/** Returns all settings, with secret values masked for the frontend. */
function getAllSettingsMasked() {
    const rows = allStmt.all();
    const out = {};
    for (const row of rows) {
        if (SECRET_KEYS.has(row.key) && row.value) {
            out[row.key] = maskSecret(row.value);
        } else {
            out[row.key] = row.value;
        }
    }
    return out;
}

function maskSecret(value) {
    if (!value) return value;
    if (value.length <= 4) return '****';
    return `${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

module.exports = { getSetting, setSetting, getAllSettingsMasked, SECRET_KEYS };
