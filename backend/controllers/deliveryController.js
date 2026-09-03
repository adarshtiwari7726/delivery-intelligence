const { getActiveProvider, listProviders } = require('../providers');
const cacheService = require('../services/cacheService');
const historyService = require('../services/historyService');
const queueService = require('../services/queueService');
const { nowIST } = require('../utils/timezone');
const { normalizeAsin, normalizePin, isValidAsin, isValidPin } = require('../utils/validators');

/**
 * Runs a single ASIN+PIN check through the active provider, honoring the
 * cache, and persists the result to history. Shared by the single-check
 * endpoint and the bulk worker.
 */
async function performCheck({ asin, postalCode, quantity }, { forceRefresh = false } = {}) {
    const cleanAsin = normalizeAsin(asin);
    const cleanPin = normalizePin(postalCode);
    const qty = Number(quantity) || 1;

    if (!forceRefresh) {
        const cached = cacheService.getCached(cleanAsin, cleanPin, qty);
        if (cached) {
            return {
                result: cached.result,
                providerMode: cached.provider,
                fromCache: true,
                ageMinutes: cached.ageMinutes,
            };
        }
    }

    const { provider, providerKey } = getActiveProvider();
    const result = await provider.checkDelivery({ asin: cleanAsin, postalCode: cleanPin, quantity: qty });

    if (result.success) {
        cacheService.setCached(cleanAsin, cleanPin, qty, result, provider.mode);
    }

    const checkedAt = nowIST();
    historyService.saveCheck(result, {
        providerMode: provider.mode,
        providerName: providerKey,
        fromCache: false,
        checkedAt,
    });

    return { result, providerMode: provider.mode, providerName: providerKey, fromCache: false, checkedAt };
}

async function checkSingle(req, res, next) {
    try {
        const { asin, postalCode, quantity = 1 } = req.body;
        const forceRefresh = Boolean(req.body.forceRefresh);
        const { result, providerMode, fromCache, ageMinutes, checkedAt } = await performCheck(
            { asin, postalCode, quantity },
            { forceRefresh }
        );

        res.json({
            success: result.success,
            ...result,
            providerMode,
            fromCache,
            cacheAgeMinutes: fromCache ? ageMinutes : 0,
            checkedAt: checkedAt || nowIST(),
        });
    } catch (err) {
        next(err);
    }
}

/** Deduplicates ASIN+PIN+quantity combinations, keeping the first occurrence. */
function dedupeItems(items) {
    const seen = new Set();
    const unique = [];
    let duplicates = 0;

    for (const item of items) {
        const asin = normalizeAsin(item.asin);
        const pin = normalizePin(item.postalCode || item.pin);
        const qty = Number(item.quantity) || 1;
        if (!isValidAsin(asin) || !isValidPin(pin)) continue; // invalid rows are filtered separately by caller
        const key = `${asin}_${pin}_${qty}`;
        if (seen.has(key)) {
            duplicates += 1;
            continue;
        }
        seen.add(key);
        unique.push({ asin, postalCode: pin, quantity: qty });
    }
    return { unique, duplicates };
}

async function checkBulk(req, res, next) {
    try {
        const rawItems = req.body.items;
        const totalRows = rawItems.length;

        const invalidRows = rawItems.filter(
            (item) => !isValidAsin(normalizeAsin(item.asin)) || !isValidPin(normalizePin(item.postalCode || item.pin))
        );
        const { unique, duplicates } = dedupeItems(rawItems);

        const jobId = queueService.createJob(unique);

        // Fire and forget - client polls for progress
        queueService
            .runJob(jobId, unique, async (item) => {
                const { result } = await performCheck(item);
                return {
                    asin: item.asin,
                    postalCode: item.postalCode,
                    quantity: item.quantity,
                    status: historyService.statusFromResult(result),
                    result,
                };
            })
            .catch((err) => console.error('[bulk job error]', err));

        res.json({
            success: true,
            jobId,
            totalRows,
            uniqueChecks: unique.length,
            duplicatesRemoved: duplicates,
            invalidRows: invalidRows.length,
        });
    } catch (err) {
        next(err);
    }
}

function bulkStatus(req, res) {
    const progress = queueService.jobProgress(req.params.jobId);
    if (!progress) return res.status(404).json({ success: false, error: 'Job not found' });

    const job = queueService.getJob(req.params.jobId);
    res.json({ success: true, ...progress, results: job.status === 'done' ? job.results : undefined });
}

function providerStatus(req, res) {
    const { provider, providerKey } = getActiveProvider();
    res.json({
        success: true,
        activeProvider: providerKey,
        name: provider.name,
        mode: provider.mode,
        configured: provider.isConfigured(),
        allProviders: listProviders(),
        lastCheckedAt: nowIST(),
    });
}

function asinAnalysis(req, res) {
    const analysis = require('../services/historyService').getAsinAnalysis(req.params.asin);
    if (!analysis) return res.status(404).json({ success: false, error: 'No checks found for this ASIN yet.' });
    res.json({ success: true, ...analysis });
}

module.exports = { performCheck, checkSingle, checkBulk, bulkStatus, providerStatus, asinAnalysis };
