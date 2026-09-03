const MockProvider = require('./mockProvider');
const AmazonPAAPIProvider = require('./amazonPAAPIProvider');
const ThirdPartyProvider = require('./thirdPartyProvider');
const { getSetting } = require('../services/settingsService');

const REGISTRY = {
    mock: MockProvider,
    paapi: AmazonPAAPIProvider,
    thirdparty: ThirdPartyProvider,
};

/**
 * Returns a fresh provider instance for the currently configured provider
 * name (Settings UI value takes precedence over .env, so credential
 * changes in Settings apply without restarting the server).
 */
function getActiveProvider() {
    const name = getSetting('DELIVERY_PROVIDER') || process.env.DELIVERY_PROVIDER || 'mock';
    const ProviderClass = REGISTRY[name] || MockProvider;
    return { provider: new ProviderClass(), providerKey: REGISTRY[name] ? name : 'mock' };
}

function listProviders() {
    return Object.keys(REGISTRY).map((key) => {
        const instance = new REGISTRY[key]();
        return {
            key,
            name: instance.name,
            mode: instance.mode,
            configured: instance.isConfigured(),
        };
    });
}

module.exports = { getActiveProvider, listProviders, REGISTRY };
