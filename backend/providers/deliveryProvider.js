/**
 * DeliveryProvider
 * -----------------
 * Abstract base class. Every real or mock data source implements this
 * interface. The rest of the application (routes, queue, cache, UI) only
 * ever talks to this interface, so a new provider can be dropped in by:
 *
 *   1. Creating a new class in /providers that extends DeliveryProvider
 *   2. Registering it in /providers/index.js
 *   3. Setting DELIVERY_PROVIDER=<name> in .env (or via Settings UI)
 *
 * No other file needs to change.
 *
 * checkDelivery() MUST resolve to a DeliveryResult object (see shape below)
 * and must NEVER invent a delivery date. If the underlying data source does
 * not provide one, deliveryDate must be null and deliverable should be
 * 'unknown' unless the source explicitly says the item can't ship there.
 */

class DeliveryProvider {
    /**
     * Human readable name shown in the UI, e.g. "Amazon Product Advertising API".
     */
    get name() {
        return 'Unnamed Provider';
    }

    /**
     * 'LIVE' or 'DEMO'. Anything other than 'LIVE' is rendered by the UI
     * with a prominent "DEMO / MOCK DATA" badge and must never be styled
     * to look like a real result.
     */
    get mode() {
        return 'DEMO';
    }

    /**
     * Whether this provider is currently usable (credentials present, etc).
     * @returns {boolean}
     */
    isConfigured() {
        return false;
    }

    /**
     * @param {{asin: string, postalCode: string, quantity: number}} params
     * @returns {Promise<DeliveryResult>}
     */
    // eslint-disable-next-line no-unused-vars
    async checkDelivery(params) {
        throw new Error('checkDelivery() not implemented');
    }
}

/**
 * @typedef {Object} DeliveryResult
 * @property {boolean} success              - whether the provider call itself succeeded
 * @property {string}  asin
 * @property {string}  postalCode
 * @property {number}  quantity
 * @property {string|null} productName
 * @property {string|null} productImage
 * @property {string|null} brand
 * @property {string|null} price
 * @property {string|null} availability      - free-text availability info from source, or null
 * @property {'yes'|'no'|'unknown'} deliverable
 * @property {string|null} deliveryDate      - ISO date (YYYY-MM-DD) ONLY if the source gave an exact date
 * @property {string|null} deliveryDateRaw   - exact text from the source when no clean ISO date exists
 *                                              (e.g. "5-7 September", "Delivery by Friday")
 * @property {number|null} deliverySpeedDays - integer day count if it can be derived, else null
 * @property {'yes'|'no'|'unknown'} primeEligible
 * @property {string|null} seller
 * @property {string|null} fulfilment
 * @property {string} source                 - human readable description of where this came from
 * @property {string|null} errorMessage
 */

module.exports = DeliveryProvider;
