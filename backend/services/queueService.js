const { v4: uuidv4 } = require('uuid');
const { getSetting } = require('./settingsService');

/**
 * In-memory bulk job manager.
 *
 * Runs an array of {asin, postalCode, quantity} items through a worker
 * function with a bounded concurrency, retrying failed items with
 * exponential backoff, and tracking progress so the frontend can poll
 * GET /api/delivery/bulk/:jobId for a live percentage.
 *
 * Jobs live in memory only (they are meant to complete within a session -
 * for durability across server restarts, back this with a DB table and a
 * persistent queue library instead).
 */

const jobs = new Map();

function getQueueSettings() {
    const concurrency = Number(getSetting('QUEUE_CONCURRENCY') || process.env.QUEUE_CONCURRENCY || 3);
    const retryAttempts = Number(getSetting('QUEUE_RETRY_ATTEMPTS') || process.env.QUEUE_RETRY_ATTEMPTS || 3);
    const requestsPerMinute = Number(
        getSetting('QUEUE_REQUESTS_PER_MINUTE') || process.env.QUEUE_REQUESTS_PER_MINUTE || 60
    );
    return {
        concurrency: Math.max(1, Math.min(concurrency, 10)),
        retryAttempts: Math.max(0, Math.min(retryAttempts, 5)),
        minSpacingMs: requestsPerMinute > 0 ? Math.ceil(60000 / requestsPerMinute) : 0,
    };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function createJob(items) {
    const jobId = uuidv4();
    jobs.set(jobId, {
        id: jobId,
        total: items.length,
        completed: 0,
        successful: 0,
        unavailable: 0,
        errors: 0,
        status: 'pending', // pending | running | done
        results: [],
        createdAt: new Date().toISOString(),
    });
    return jobId;
}

function getJob(jobId) {
    return jobs.get(jobId) || null;
}

/**
 * @param {string} jobId
 * @param {Array<{asin:string, postalCode:string, quantity:number}>} items
 * @param {(item, attempt:number) => Promise<any>} workerFn - resolves to a
 *   result object with { status: 'success'|'not_deliverable'|'unknown'|'error', ... }
 *   or throws to trigger a retry.
 */
async function runJob(jobId, items, workerFn) {
    const job = jobs.get(jobId);
    if (!job) throw new Error('Unknown job id');

    const { concurrency, retryAttempts, minSpacingMs } = getQueueSettings();
    job.status = 'running';

    let cursor = 0;
    let lastRequestTime = 0;

    async function processOne(item) {
        // simple global rate limiter (requests-per-minute spacing)
        if (minSpacingMs > 0) {
            const wait = lastRequestTime + minSpacingMs - Date.now();
            if (wait > 0) await sleep(wait);
            lastRequestTime = Date.now();
        }

        let attempt = 0;
        let lastError = null;

        while (attempt <= retryAttempts) {
            try {
                const result = await workerFn(item, attempt);
                job.results.push(result);
                job.completed += 1;
                if (result.status === 'success') job.successful += 1;
                else if (result.status === 'not_deliverable') job.unavailable += 1;
                else if (result.status === 'error') job.errors += 1;
                return;
            } catch (err) {
                lastError = err;
                attempt += 1;
                if (attempt <= retryAttempts) {
                    const backoffMs = Math.min(1000 * 2 ** attempt, 15000);
                    await sleep(backoffMs);
                }
            }
        }

        job.results.push({
            asin: item.asin,
            postalCode: item.postalCode,
            quantity: item.quantity,
            status: 'error',
            errorMessage: lastError ? lastError.message : 'Unknown error',
        });
        job.completed += 1;
        job.errors += 1;
    }

    async function worker() {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            await processOne(items[index]);
        }
    }

    const workers = Array.from({ length: Math.min(concurrency, items.length) || 1 }, () => worker());
    await Promise.all(workers);

    job.status = 'done';
    job.completedAt = new Date().toISOString();
}

function jobProgress(jobId) {
    const job = jobs.get(jobId);
    if (!job) return null;
    return {
        jobId: job.id,
        status: job.status,
        total: job.total,
        completed: job.completed,
        successful: job.successful,
        unavailable: job.unavailable,
        errors: job.errors,
        percent: job.total ? Math.round((job.completed / job.total) * 100) : 100,
    };
}

module.exports = { createJob, getJob, runJob, jobProgress, getQueueSettings };
