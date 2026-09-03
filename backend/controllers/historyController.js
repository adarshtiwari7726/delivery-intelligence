const historyService = require('../services/historyService');

function listHistory(req, res) {
    const { asin, postalCode, deliverable, provider, dateFrom, dateTo, search, page, pageSize } = req.query;
    const data = historyService.queryHistory({
        asin,
        postalCode,
        deliverable,
        provider,
        dateFrom,
        dateTo,
        search,
        page: Number(page) || 1,
        pageSize: Math.min(Number(pageSize) || 25, 500),
    });
    res.json({ success: true, ...data });
}

function removeHistory(req, res) {
    const { ids, all } = req.body || {};
    historyService.deleteHistory({ ids, all: Boolean(all) });
    res.json({ success: true });
}

function exportHistory(req, res) {
    const rows = historyService.getAllForExport(req.query);
    res.json({ success: true, rows });
}

function dashboardStats(req, res) {
    res.json({ success: true, ...historyService.getDashboardStats() });
}

module.exports = { listHistory, removeHistory, exportHistory, dashboardStats };
