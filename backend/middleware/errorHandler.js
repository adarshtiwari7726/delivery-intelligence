// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    console.error('[error]', err);
    const status = err.status || 500;
    res.status(status).json({
        success: false,
        error: 'Unable to complete the request.',
        reason: status === 500 ? 'An internal error occurred.' : err.message,
    });
}

function notFoundHandler(req, res) {
    res.status(404).json({ success: false, error: 'Not found.' });
}

module.exports = { errorHandler, notFoundHandler };
