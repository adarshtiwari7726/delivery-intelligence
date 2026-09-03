-- Delivery Intelligence database schema

CREATE TABLE IF NOT EXISTS checks (
    id                 TEXT PRIMARY KEY,
    asin               TEXT NOT NULL,
    postal_code        TEXT NOT NULL,
    quantity           INTEGER NOT NULL DEFAULT 1,
    product_name       TEXT,
    product_image      TEXT,
    brand              TEXT,
    price              TEXT,
    availability       TEXT,
    deliverable        TEXT NOT NULL,      -- 'yes' | 'no' | 'unknown'
    delivery_date      TEXT,               -- ISO date, may be null
    delivery_date_raw  TEXT,               -- raw string from provider (range / "by Friday" / etc)
    delivery_speed_days INTEGER,           -- integer day count if determinable
    prime_eligible     TEXT,               -- 'yes' | 'no' | 'unknown'
    seller             TEXT,
    fulfilment         TEXT,
    status             TEXT NOT NULL,      -- 'success' | 'not_deliverable' | 'unknown' | 'error'
    error_message      TEXT,
    provider           TEXT NOT NULL,      -- 'LIVE' | 'DEMO'
    provider_name      TEXT,               -- 'mock' | 'paapi' | 'thirdparty'
    source             TEXT,               -- human readable data source label
    from_cache         INTEGER NOT NULL DEFAULT 0,
    checked_at         TEXT NOT NULL       -- ISO timestamp, Asia/Kolkata
);

CREATE INDEX IF NOT EXISTS idx_checks_asin ON checks(asin);
CREATE INDEX IF NOT EXISTS idx_checks_pin ON checks(postal_code);
CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at);

CREATE TABLE IF NOT EXISTS cache (
    cache_key   TEXT PRIMARY KEY,          -- ASIN_PIN_QTY
    result_json TEXT NOT NULL,
    provider    TEXT NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);
