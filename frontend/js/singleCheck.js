const ASIN_RE = /^[A-Z0-9]{10}$/;
const PIN_RE = /^[1-9][0-9]{5}$/;

let lastQuery = null;

document.getElementById('check-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  await runCheck(false);
});

function readForm() {
  const asin = document.getElementById('asin').value.trim().toUpperCase();
  const pin = document.getElementById('pin').value.trim();
  const qty = Number(document.getElementById('qty').value) || 1;
  return { asin, postalCode: pin, quantity: qty };
}

function validateForm({ asin, postalCode }) {
  let ok = true;
  const errAsin = document.getElementById('err-asin');
  const errPin = document.getElementById('err-pin');
  errAsin.classList.add('hidden');
  errPin.classList.add('hidden');

  if (!ASIN_RE.test(asin)) {
    errAsin.textContent = 'Enter a valid 10-character ASIN, e.g. B0XXXXXXXXXX.';
    errAsin.classList.remove('hidden');
    ok = false;
  }
  if (!PIN_RE.test(postalCode)) {
    errPin.textContent = 'Enter a valid 6-digit Indian PIN code.';
    errPin.classList.remove('hidden');
    ok = false;
  }
  return ok;
}

async function runCheck(forceRefresh) {
  const form = readForm();
  if (!validateForm(form)) return;
  lastQuery = form;

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  document.getElementById('result-container').innerHTML = `<div class="card">Checking delivery promise…</div>`;

  try {
    const result = await apiPost('/delivery/check', { ...form, forceRefresh });
    renderResult(result);
  } catch (err) {
    document.getElementById('result-container').innerHTML = `
      <div class="card">
        <div class="notice warn">
          Unable to retrieve delivery information.<br/>
          Reason: ${escapeHtml(err.message)}
        </div>
        <button class="btn" style="margin-top:12px;" onclick="runCheck(false)">Try Again</button>
      </div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Check Delivery';
  }
}

function renderResult(r) {
  const container = document.getElementById('result-container');

  if (!r.success) {
    container.innerHTML = `
      <div class="card">
        <div class="notice warn">
          &#9888; DELIVERY DATE UNAVAILABLE<br/>
          The delivery promise could not be determined.<br/>
          <span style="color:var(--text-dim)">${escapeHtml(r.errorMessage || '')}</span>
        </div>
        <button class="btn" style="margin-top:12px;" onclick="runCheck(true)">Try Again</button>
      </div>`;
    return;
  }

  const providerBadge =
    r.providerMode === 'LIVE'
      ? ''
      : `<span class="badge demo">DEMO DATA</span>`;

  let statusBadge, statusBlock;
  if (r.deliverable === 'yes') {
    statusBadge = `<span class="badge ok">&#10003; DELIVERABLE</span>`;
  } else if (r.deliverable === 'no') {
    statusBadge = `<span class="badge no">&#10007; NOT DELIVERABLE</span>`;
  } else {
    statusBadge = `<span class="badge unknown">&#9888; DELIVERY DATE UNAVAILABLE</span>`;
  }

  if (r.deliverable === 'no') {
    statusBlock = `<div class="notice">This product is currently unavailable for delivery to PIN ${escapeHtml(r.postalCode)}.</div>`;
  } else if (r.deliverable === 'unknown' || (!r.deliveryDate && !r.deliveryDateRaw)) {
    statusBlock = `<div class="notice warn">The delivery promise could not be determined by the active data source.</div>`;
  } else {
    const dateDisplay = r.deliveryDate ? formatDateDisplay(r.deliveryDate) : r.deliveryDateRaw;
    statusBlock = `
      <div class="result-grid">
        <div class="result-kv"><div class="k">Expected Delivery</div><div class="v">${escapeHtml(dateDisplay)}</div></div>
        <div class="result-kv"><div class="k">Delivery Speed</div><div class="v">${r.deliverySpeedDays ? r.deliverySpeedDays + ' Day(s)' : '—'}</div></div>
        <div class="result-kv"><div class="k">Prime</div><div class="v">${primeLabel(r.primeEligible)}</div></div>
        <div class="result-kv"><div class="k">PIN</div><div class="v">${escapeHtml(r.postalCode)}</div></div>
        <div class="result-kv"><div class="k">Fulfilment</div><div class="v">${escapeHtml(r.fulfilment) || '—'}</div></div>
        <div class="result-kv"><div class="k">Seller</div><div class="v">${escapeHtml(r.seller) || '—'}</div></div>
      </div>`;
  }

  const cacheNote = r.fromCache
    ? `<div class="notice">Cached Result &middot; Checked ${r.cacheAgeMinutes} minute(s) ago
        <button class="btn btn-sm" style="margin-left:10px;" onclick="runCheck(true)">Refresh Now</button>
       </div>`
    : '';

  container.innerHTML = `
    <div class="card result-card">
      <div class="result-image">${r.productImage ? `<img src="${escapeHtml(r.productImage)}" />` : '&#128230;'}</div>
      <div class="result-body">
        <div class="result-title">${escapeHtml(r.productName) || 'Product name not available from provider'}</div>
        <div class="result-asin">ASIN: ${escapeHtml(r.asin)} ${r.price ? '&middot; ' + escapeHtml(r.price) : ''}</div>
        ${statusBadge} ${providerBadge}
        ${statusBlock}
        ${cacheNote}
        <div class="notice" style="margin-top:10px;">
          Checked: ${formatTimestampDisplay(r.checkedAt)} &middot; Source: ${escapeHtml(r.source) || 'Unknown'}
        </div>
      </div>
    </div>`;
}

function primeLabel(v) {
  if (v === 'yes') return 'Eligible';
  if (v === 'no') return 'Not Eligible';
  return 'Unknown';
}
