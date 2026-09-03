const crypto = require('crypto');
const fetch = require('node-fetch');
const DeliveryProvider = require('./deliveryProvider');

/**
 * AmazonPAAPIProvider
 * --------------------
 * Talks to Amazon's own Product Advertising API 5.0 (GetItems operation)
 * using AWS Signature Version 4, as officially documented at
 * https://webservices.amazon.in/paapi5/documentation/
 *
 * IMPORTANT / HONEST LIMITATION:
 * PA-API's GetItems / Offers resources expose whether an item is
 * Prime-eligible, its Buy Box price, availability text ("In Stock"), and
 * merchant/fulfilment info - but Amazon does NOT expose a postal-code
 * specific delivery-promise date through this API for arbitrary ASINs.
 * That number only exists on the rendered product/checkout page for a
 * signed-in session with a delivery address set, and there is no
 * authorized API that returns it for third parties.
 *
 * Because of that, this provider ALWAYS returns deliveryDate: null and
 * deliverable: 'unknown' (unless Amazon reports the item as out of stock,
 * in which case deliverable: 'no'), and clearly documents why. It fills in
 * everything else PA-API legitimately provides. If a PIN-level delivery
 * date is required, pair this provider with an authorized third-party
 * delivery-data provider (see thirdPartyProvider.js) or run this one for
 * product/price/Prime data and let the third-party provider supply dates.
 *
 * NOTE: Amazon has been migrating PA-API 5.0 towards the "Creators API".
 * If your credentials are issued for the Creators API, update
 * PAAPI_HOST / the request path below to match its current documented
 * endpoint before use - check https://affiliate-program.amazon.com/creatorsapi/docs
 * for the current spec, since Amazon may change field names.
 */
class AmazonPAAPIProvider extends DeliveryProvider {
    constructor() {
        super();
        this.accessKey = process.env.PAAPI_ACCESS_KEY || '';
        this.secretKey = process.env.PAAPI_SECRET_KEY || '';
        this.partnerTag = process.env.PAAPI_PARTNER_TAG || '';
        this.host = process.env.PAAPI_HOST || 'webservices.amazon.in';
        this.region = process.env.PAAPI_REGION || 'eu-west-1';
        this.service = 'ProductAdvertisingAPI';
        this.path = '/paapi5/getitems';
    }

    get name() {
        return 'Amazon Product Advertising API';
    }

    get mode() {
        return 'LIVE';
    }

    isConfigured() {
        return Boolean(this.accessKey && this.secretKey && this.partnerTag);
    }

    _sign(payload) {
        const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.slice(0, 8);

        const headers = {
            'content-encoding': 'amz-1.0',
            'content-type': 'application/json; charset=utf-8',
            host: this.host,
            'x-amz-date': amzDate,
            'x-amz-target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems',
        };

        const signedHeaderKeys = Object.keys(headers).sort();
        const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join('');
        const signedHeaders = signedHeaderKeys.join(';');
        const payloadHash = crypto.createHash('sha256').update(payload).digest('hex');

        const canonicalRequest = [
            'POST',
            this.path,
            '',
            canonicalHeaders,
            signedHeaders,
            payloadHash,
        ].join('\n');

        const credentialScope = `${dateStamp}/${this.region}/${this.service}/aws4_request`;
        const stringToSign = [
            'AWS4-HMAC-SHA256',
            amzDate,
            credentialScope,
            crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
        ].join('\n');

        const kDate = crypto.createHmac('sha256', `AWS4${this.secretKey}`).update(dateStamp).digest();
        const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
        const kService = crypto.createHmac('sha256', kRegion).update(this.service).digest();
        const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
        const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

        const authorizationHeader =
            `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, ` +
            `SignedHeaders=${signedHeaders}, Signature=${signature}`;

        return { ...headers, Authorization: authorizationHeader };
    }

    async checkDelivery({ asin, postalCode, quantity }) {
        if (!this.isConfigured()) {
            return this._configError(asin, postalCode, quantity);
        }

        const payload = JSON.stringify({
            ItemIds: [asin],
            PartnerTag: this.partnerTag,
            PartnerType: 'Associates',
            Marketplace: 'www.amazon.in',
            Resources: [
                'ItemInfo.Title',
                'ItemInfo.ByLineInfo',
                'Images.Primary.Medium',
                'Offers.Listings.Price',
                'Offers.Listings.Availability.Message',
                'Offers.Listings.DeliveryInfo.IsPrimeEligible',
                'Offers.Listings.DeliveryInfo.IsFreeShippingEligible',
                'Offers.Listings.MerchantInfo',
            ],
        });

        try {
            const headers = this._sign(payload);
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const res = await fetch(`https://${this.host}${this.path}`, {
                method: 'POST',
                headers,
                body: payload,
                signal: controller.signal,
            });
            clearTimeout(timeout);

            const data = await res.json();

            if (!res.ok || data.Errors) {
                const msg = data.Errors ? data.Errors.map((e) => e.Message).join('; ') : `HTTP ${res.status}`;
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
                    source: 'Amazon Product Advertising API',
                    errorMessage: msg,
                };
            }

            const item = data.ItemsResult && data.ItemsResult.Items && data.ItemsResult.Items[0];
            if (!item) {
                return {
                    success: true,
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
                    source: 'Amazon Product Advertising API',
                    errorMessage: 'ASIN not found in catalog',
                };
            }

            const listing = item.Offers && item.Offers.Listings && item.Offers.Listings[0];
            const availabilityMsg = listing && listing.Availability && listing.Availability.Message;
            const inStock = availabilityMsg ? /in stock|available/i.test(availabilityMsg) : null;

            return {
                success: true,
                asin,
                postalCode,
                quantity,
                productName: item.ItemInfo && item.ItemInfo.Title ? item.ItemInfo.Title.DisplayValue : null,
                productImage: item.Images && item.Images.Primary ? item.Images.Primary.Medium.URL : null,
                brand:
                    item.ItemInfo && item.ItemInfo.ByLineInfo && item.ItemInfo.ByLineInfo.Brand
                        ? item.ItemInfo.ByLineInfo.Brand.DisplayValue
                        : null,
                price: listing && listing.Price ? listing.Price.DisplayAmount : null,
                availability: availabilityMsg || null,
                // PA-API tells us stock status, not a PIN-specific delivery promise.
                deliverable: inStock === null ? 'unknown' : inStock ? 'unknown' : 'no',
                deliveryDate: null,
                deliveryDateRaw: null,
                deliverySpeedDays: null,
                primeEligible: listing && listing.DeliveryInfo ? (listing.DeliveryInfo.IsPrimeEligible ? 'yes' : 'no') : 'unknown',
                seller: listing && listing.MerchantInfo ? listing.MerchantInfo.Name : null,
                fulfilment: listing && listing.DeliveryInfo && listing.DeliveryInfo.IsFreeShippingEligible ? 'Free shipping eligible' : null,
                source:
                    'Amazon Product Advertising API (availability/price/Prime only - ' +
                    'PA-API does not expose a PIN-level delivery-promise date)',
                errorMessage: null,
            };
        } catch (err) {
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
                source: 'Amazon Product Advertising API',
                errorMessage: err.name === 'AbortError' ? 'Request timed out' : err.message,
            };
        }
    }

    _configError(asin, postalCode, quantity) {
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
            source: 'Amazon Product Advertising API',
            errorMessage: 'PA-API credentials not configured (PAAPI_ACCESS_KEY / PAAPI_SECRET_KEY / PAAPI_PARTNER_TAG)',
        };
    }
}

module.exports = AmazonPAAPIProvider;
