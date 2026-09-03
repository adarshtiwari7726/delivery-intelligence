const TZ = process.env.DEFAULT_TIMEZONE || 'Asia/Kolkata';

function nowIST() {
    // Returns an ISO-like string with the IST offset, e.g. 2026-09-02T14:20:00+05:30
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(now);

    const get = (type) => parts.find((p) => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}+05:30`;
}

function formatISTDisplay(isoString) {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-IN', {
        timeZone: TZ,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    }).format(date);
}

module.exports = { nowIST, formatISTDisplay, TZ };
