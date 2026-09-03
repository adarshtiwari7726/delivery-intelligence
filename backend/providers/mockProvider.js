const crypto = require('crypto');
const DeliveryProvider = require('./deliveryProvider');

/**
 * MockProvider
 * ------------
 * FOR DEVELOPMENT / UI TESTING ONLY.
 *
 * Produces deterministic, clearly-fake data derived from a hash of the
 * ASIN + PIN so the interface can be exercised end-to-end (queue, cache,
 * bulk upload, dashboard, exports) without any internet call or real
 * Amazon credentials.
 *
 * Every result is stamped mode = 'DEMO' and source = 'Mock Provider (no
 * internet call made)'. The frontend must never present this as real data.
 */
class MockProvider extends DeliveryProvider {
    get name() {
        return 'Mock Provider (Development)';
    }

    get mode() {
        return 'DEMO';
    }

    isConfigured() {
        return true; // always available, by design
    }

    async checkDelivery({ asin, postalCode, quantity }) {
        // Small artificial delay so the queue/progress UI has something to show
        await new Promise((r) => setTimeout(r, 120 + Math.random() * 200));

        const hash = crypto
            .createHash('md5')
            .update(`${asin}_${postalCode}_${quantity}`)
            .digest('hex');
        const hashInt = parseInt(hash.slice(0, 8), 16);

        // ~90% deliverable, ~7% not deliverable, ~3% unknown - purely for UI testing
        const bucket = hashInt % 100;
        let deliverable = 'yes';
        if (bucket >= 90 && bucket < 97) deliverable = 'no';
        else if (bucket >= 97) deliverable = 'unknown';

        if (deliverable !== 'yes') {
            return {
                success: true,
                asin,
                postalCode,
                quantity,
                productName: `Demo Product ${asin.slice(-4)}`,
                productImage: null,
                brand: 'Demo Brand',
                price: '₹' + (499 + (hashInt % 4000)),
                availability: deliverable === 'no' ? 'Currently unavailable' : null,
                deliverable,
                deliveryDate: null,
                deliveryDateRaw: null,
                deliverySpeedDays: null,
                primeEligible: 'unknown',
                seller: null,
                fulfilment: null,
                source: 'Mock Provider (no internet call made)',
                errorMessage: null,
            };
        }

        const speedDays = 1 + (hashInt % 7); // 1-7 days
        const date = new Date();
        date.setDate(date.getDate() + speedDays);
        const isoDate = date.toISOString().slice(0, 10);

        return {
            success: true,
            asin,
            postalCode,
            quantity,
            productName: `Demo Product ${asin.slice(-4)}`,
            productImage: null,
            brand: 'Demo Brand',
            price: '₹' + (499 + (hashInt % 4000)),
            availability: 'In stock',
            deliverable: 'yes',
            deliveryDate: isoDate,
            deliveryDateRaw: null,
            deliverySpeedDays: speedDays,
            primeEligible: hashInt % 2 === 0 ? 'yes' : 'no',
            seller: hashInt % 3 === 0 ? 'Appario Retail' : 'Cloudtail India',
            fulfilment: hashInt % 2 === 0 ? 'Fulfilled by Amazon' : 'Fulfilled by Seller',
            source: 'Mock Provider (no internet call made)',
            errorMessage: null,
        };
    }
}

module.exports = MockProvider;
