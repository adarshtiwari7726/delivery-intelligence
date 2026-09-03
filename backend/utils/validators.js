const ASIN_REGEX = /^[A-Z0-9]{10}$/;
const PIN_REGEX = /^[1-9][0-9]{5}$/; // Indian PIN codes: 6 digits, cannot start with 0

function isValidAsin(asin) {
    return typeof asin === 'string' && ASIN_REGEX.test(asin.trim().toUpperCase());
}

function isValidPin(pin) {
    return typeof pin === 'string' && PIN_REGEX.test(pin.trim());
}

function normalizeAsin(asin) {
    return String(asin || '').trim().toUpperCase();
}

function normalizePin(pin) {
    return String(pin || '').trim();
}

function isValidQuantity(qty) {
    const n = Number(qty);
    return Number.isInteger(n) && n >= 1 && n <= 999;
}

module.exports = { isValidAsin, isValidPin, isValidQuantity, normalizeAsin, normalizePin, ASIN_REGEX, PIN_REGEX };
