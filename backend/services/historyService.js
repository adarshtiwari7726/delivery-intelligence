const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');

const insertStmt = db.prepare(`
    INSERT INTO checks (
        id, asin, postal_code, quantity, product_name, product_image, brand, price,
        availability, deliverable, delivery_date, delivery_date_raw, delivery_speed_days,
        prime_eligible, seller, fulfilment, status, error_message, provider, provider_name,
        source, from_cache, checked_at
    ) VALUES (
        @id, @asin, @postal_code, @quantity, @product_name, @product_image, @brand, @price,
        @availability, @deliverable, @delivery_date, @delivery_date_raw, @delivery_speed_days,
        @prime_eligible, @seller, @fulfilment, @status, @error_message, @provider, @provider_name,
        @source, @from_cache, @checked_at
    )
`);

function statusFromResult(result) {
    if (!result.success) return 'error';
    if (result.deliverable === 'no') return 'not_deliverable';
    if (result.deliverable === 'unknown' || !result.deliveryDate) {
        return result.deliverable === 'unknown' ? 'unknown' : 'success';
    }
    return 'success';
}

function saveCheck(result, { providerMode, providerName, fromCache, checkedAt }) {
    const row = {
        id: uuidv4(),
        asin: result.asin,
        postal_code: result.postalCode,
        quantity: result.quantity || 1,
        product_name: result.productName || null,
        product_image: result.productImage || null,
        brand: result.brand || null,
        price: result.price || null,
        availability: result.availability || null,
        deliverable: result.deliverable || 'unknown',
        delivery_date: result.deliveryDate || null,
        delivery_date_raw: result.deliveryDateRaw || null,
        delivery_speed_days: result.deliverySpeedDays ?? null,
        prime_eligible: result.primeEligible || 'unknown',
        seller: result.seller || null,
        fulfilment: result.fulfilment || null,
        status: statusFromResult(result),
        error_message: result.errorMessage || null,
        provider: providerMode,
        provider_name: providerName,
        source: result.source || null,
        from_cache: fromCache ? 1 : 0,
        checked_at: checkedAt || new Date().toISOString(),
    };
    insertStmt.run(row);
    return row;
}

function queryHistory({ asin, postalCode, deliverable, provider, dateFrom, dateTo, search, page = 1, pageSize = 25 }) {
    const clauses = [];
    const params = {};

    if (asin) {
        clauses.push('asin LIKE @asin');
        params.asin = `%${asin.toUpperCase()}%`;
    }
    if (postalCode) {
        clauses.push('postal_code LIKE @postalCode');
        params.postalCode = `%${postalCode}%`;
    }
    if (deliverable) {
        clauses.push('deliverable = @deliverable');
        params.deliverable = deliverable;
    }
    if (provider) {
        clauses.push('provider_name = @provider');
        params.provider = provider;
    }
    if (dateFrom) {
        clauses.push('checked_at >= @dateFrom');
        params.dateFrom = dateFrom;
    }
    if (dateTo) {
        clauses.push('checked_at <= @dateTo');
        params.dateTo = dateTo;
    }
    if (search) {
        clauses.push('(asin LIKE @search OR product_name LIKE @search OR postal_code LIKE @search)');
        params.search = `%${search}%`;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const offset = (Math.max(1, page) - 1) * pageSize;

    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM checks ${where}`).get(params);
    const rows = db
        .prepare(`SELECT * FROM checks ${where} ORDER BY checked_at DESC LIMIT @limit OFFSET @offset`)
        .all({ ...params, limit: pageSize, offset });

    return { rows, total: totalRow.count, page, pageSize };
}

function deleteHistory({ ids, all }) {
    if (all) {
        db.prepare('DELETE FROM checks').run();
        return;
    }
    if (Array.isArray(ids) && ids.length) {
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`DELETE FROM checks WHERE id IN (${placeholders})`).run(...ids);
    }
}

function getAllForExport(filters) {
    return queryHistory({ ...filters, page: 1, pageSize: 100000 }).rows;
}

function getDashboardStats() {
    const totals = db
        .prepare(
            `SELECT
                COUNT(*) as total,
                SUM(CASE WHEN deliverable = 'yes' THEN 1 ELSE 0 END) as deliverable,
                SUM(CASE WHEN deliverable = 'no' THEN 1 ELSE 0 END) as not_deliverable,
                SUM(CASE WHEN deliverable = 'unknown' THEN 1 ELSE 0 END) as unknown,
                AVG(delivery_speed_days) as avg_speed
             FROM checks`
        )
        .get();

    const speedBuckets = db
        .prepare(
            `SELECT delivery_speed_days as days, COUNT(*) as count
             FROM checks WHERE delivery_speed_days IS NOT NULL
             GROUP BY delivery_speed_days ORDER BY delivery_speed_days ASC`
        )
        .all();

    const pinPerformance = db
        .prepare(
            `SELECT postal_code, AVG(delivery_speed_days) as avg_days, COUNT(*) as checks
             FROM checks WHERE delivery_speed_days IS NOT NULL
             GROUP BY postal_code ORDER BY avg_days ASC LIMIT 20`
        )
        .all();

    return { totals, speedBuckets, pinPerformance };
}

function getAsinAnalysis(asin) {
    const rows = db.prepare('SELECT * FROM checks WHERE asin = ? ORDER BY checked_at DESC').all(asin.toUpperCase());
    if (!rows.length) return null;

    const deliverableCount = rows.filter((r) => r.deliverable === 'yes').length;
    const speeds = rows.map((r) => r.delivery_speed_days).filter((d) => d != null);

    return {
        asin: asin.toUpperCase(),
        totalChecks: rows.length,
        deliverablePct: Math.round((deliverableCount / rows.length) * 100),
        notDeliverablePct: Math.round(((rows.length - deliverableCount) / rows.length) * 100),
        fastestDays: speeds.length ? Math.min(...speeds) : null,
        slowestDays: speeds.length ? Math.max(...speeds) : null,
        avgDays: speeds.length ? Math.round((speeds.reduce((a, b) => a + b, 0) / speeds.length) * 10) / 10 : null,
        rows,
    };
}

module.exports = { saveCheck, queryHistory, deleteHistory, getAllForExport, getDashboardStats, getAsinAnalysis, statusFromResult };
