const fetch = require('node-fetch');
const DeliveryProvider = require('./deliveryProvider');

/**
 * ThirdPartyProvider
 * -------------------
 * Amazon does not publish any first-party API that returns a postal-code
 * specific delivery-promise date for an arbitrary ASIN (see README.md for
 * the full explanation). The only way to obtain that number legitimately
 * is through a paid, permitted third-party data provider that has already
 * built and operates that data pipeline under its own terms of service -
 * you are not asked to scrape, bypass CAPTCHAs, or automate a browser
 * yourself; you are calling a REST API you have a commercial agreement
 * with, the same way you'd call any other paid data API.
 *
 * This class is a generic, ready-to-use REST adapter. It expects a simple
 * "POST {baseUrl}/check" endpoint that accepts { asin, postalCode,
 * quantity, marketplace } and returns JSON. Swap in your actual provider's
 * request/response shape in _buildRequest() / _parseResponse() below -
 * every field is mapped in ONE place so this is a small, obvious edit.
 *
 * Where to configure credentials:
 *   backend/.env -> THIRDPARTY_API_BASE_URL, THIRDPARTY_API_KEY,
 *                   THIRDPARTY_API_SECRET
 *   or via the Settings page in the UI (stored server-side only).
 */
class ThirdPartyProvider extends DeliveryProvider {
    constructor() {
        super();
        this.baseUrl = process.env.THIRDPARTY_API_BASE_URL || '';
        this.apiKey = process.env.THIRDPARTY_API_KEY || '';
        this.apiSecret = process.env.THIRDPARTY_API_SECRET || '';
        this.timeoutMs = Number(process.env.QUEUE_TIMEOUT_MS || 30000);
    }

    get name() {
        return 'Authorized Third-Party Delivery Data Provider';
    }

    get mode() {
        return 'LIVE';
    }

    isConfigured() {
        return Boolean(this.baseUrl && this.apiKey);
    }

    /** Builds the outgoing request. Edit this to match your provider's API. */
    _buildRequest({ asin, postalCode, quantity }) {
        return {
            url: `${this.baseUrl.replace(/\/$/, '')}/check`,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
                ...(this.apiSecret ? { 'X-Api-Secret': this.apiSecret } : {}),
            },
            body: JSON.stringify({
                asin,
                postalCode,
                quantity,
                marketplace: process.env.AMAZON_MARKETPLACE || 'amazon.in',
            }),
        };
    }

    /** Maps the provider's raw JSON response into our DeliveryResult shape. */
    _parseResponse(raw, { asin, postalCode, quantity }) {
        // NOTE: field names below (raw.deliverable, raw.deliveryDate, ...) are
        // placeholders illustrating the mapping - replace with your actual
        // provider's field names.
        const deliverable = raw.deliverable === true ? 'yes' : raw.deliverable === false ? 'no' : 'unknown';

        return {
            success: true,
            asin,
            postalCode,
            quantity,
            productName: raw.productName || raw.title || null,
            productImage: raw.image || raw.productImage || null,
            brand: raw.brand || null,
            price: raw.price || raw.displayPrice || null,
            availability: raw.availability || raw.stockStatus || null,
            deliverable,
            deliveryDate: raw.deliveryDateISO || raw.deliveryDate || null,
            deliveryDateRaw: raw.deliveryDateText || raw.deliveryPromise || null,
            deliverySpeedDays:
                typeof raw.deliverySpeedDays === 'number'
                    ? raw.deliverySpeedDays
                    : typeof raw.days === 'number'
                    ? raw.days
                    : null,
            primeEligible: raw.primeEligible === true ? 'yes' : raw.primeEligible === false ? 'no' : 'unknown',
            seller: raw.seller || null,
            fulfilment: raw.fulfilment || raw.fulfilledBy || null,
            source: raw.source || this.name,
            errorMessage: null,
        };
    }

    async checkDelivery(params) {
        const { asin, postalCode, quantity } = params;

        if (!this.isConfigured()) {
            return {
                success: false,
                asin,
                postalCode,
                quantity,
                productName: null,
                productImage: null,
                brand: null,
                price: null,
                availability: null,
                deliverable: 'unknown',
                deliveryDate: null,
                deliveryDateRaw: null,
                deliverySpeedDays: null,
                primeEligible: 'unknown',
                seller: null,
                fulfilment: null,
                source: this.name,
                errorMessage:
                    'Third-party provider not configured. Set THIRDPARTY_API_BASE_URL and THIRDPARTY_API_KEY.',
            };
        }

        const { url, headers, body } = this._buildRequest(params);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal });
            clearTimeout(timeout);

            if (!res.ok) {
                const text = await res.text().catch(() => '');
                return {
                    success: false,
                    asin,
                    postalCode,
                    quantity,
                    productName: null,
                    productImage: null,
                    brand: null,
                    price: null,
                    availability: null,
                    deliverable: 'unknown',
                    deliveryDate: null,
                    deliveryDateRaw: null,
                    deliverySpeedDays: null,
                    primeEligible: 'unknown',
                    seller: null,
                    fulfilment: null,
                    source: this.name,
                    errorMessage: `Provider returned HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
                };
            }

            const raw = await res.json();
            return this._parseResponse(raw, params);
        } catch (err) {
            clearTimeout(timeout);
            return {
                success: false,
                asin,
                postalCode,
                quantity,
                productName: null,
                productImage: null,
                brand: null,
                price: null,
                availability: null,
                deliverable: 'unknown',
                deliveryDate: null,
                deliveryDateRaw: null,
                deliverySpeedDays: null,
                primeEligible: 'unknown',
                seller: null,
                fulfilment: null,
                source: this.name,
                errorMessage: err.name === 'AbortError' ? 'Request timed out' : err.message,
            };
        }
    }
}

module.exports = ThirdPartyProvider;
