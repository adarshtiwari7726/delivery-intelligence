const ASIN_RE = /^[A-Z0-9]{10}$/;
const PIN_RE = /^[1-9][0-9]{5}$/;

// ---------- Tabs ----------
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-csv').classList.toggle('hidden', btn.dataset.tab !== 'csv');
    document.getElementById('tab-asinpins').classList.toggle('hidden', btn.dataset.tab !== 'asinpins');
  });
});

// =========================================================
// TAB 1: CSV / Excel bulk
// =========================================================
let csvRows = []; // parsed {asin, postalCode, quantity}
let csvResults = [];
let csvPage = 1;
const CSV_PAGE_SIZE = 25;

document.getElementById('download-template').addEventListener('click', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['ASIN', 'PIN', 'Quantity'],
    ['B0XXXXXXXX', '380001', 1],
    ['B0XXXXXXXX', '110001', 1],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, 'Delivery_Check_Template.xlsx');
});

document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const rows = rowsFromAoa(json);
  document.getElementById('paste-area').value = rows.map((r) => `${r.asin}, ${r.pin}, ${r.quantity}`).join('\n');
  parseRows();
});

document.getElementById('parse-btn').addEventListener('click', parseRows);

function rowsFromAoa(aoa) {
  const out = [];
  let start = 0;
  // skip header row if it looks like one
  if (aoa.length && /asin/i.test(String(aoa[0][0] || ''))) start = 1;
  for (let i = start; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || !row.length) continue;
    const asin = String(row[0] || '').trim();
    const pin = String(row[1] || '').trim();
    const qty = row[2] ? Number(row[2]) : 1;
    if (!asin && !pin) continue;
    out.push({ asin, pin, quantity: qty || 1 });
  }
  return out;
}

function parseRows() {
  const text = document.getElementById('paste-area').value.trim();
  if (!text) {
    toast('Nothing to parse yet.', 'error');
    return;
  }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const parsed = lines.map((line) => {
    const parts = line.split(/[,\t]/).map((p) => p.trim());
    return { asin: (parts[0] || '').toUpperCase(), postalCode: parts[1] || '', quantity: Number(parts[2]) || 1 };
  });

  const valid = parsed.filter((r) => ASIN_RE.test(r.asin) && PIN_RE.test(r.postalCode));
  const invalidCount = parsed.length - valid.length;

  csvRows = valid;
  document.getElementById('parse-summary').textContent =
    `${parsed.length} row(s) parsed. ${valid.length} valid, ${invalidCount} invalid (skipped).`;

  document.getElementById('csv-run-card').classList.toggle('hidden', valid.length === 0);
  if (valid.length) {
    const uniqueKeys = new Set(valid.map((r) => `${r.asin}_${r.postalCode}_${r.quantity}`));
    document.getElementById('csv-dedupe-summary').textContent =
      `Total Rows: ${valid.length} · Unique Checks: ${uniqueKeys.size} · Duplicates Removed: ${valid.length - uniqueKeys.size}`;
  }
}

document.getElementById('check-all-btn').addEventListener('click', async () => {
  if (!csvRows.length) return;
  const btn = document.getElementById('check-all-btn');
  btn.disabled = true;

  try {
    const { jobId, totalRows, uniqueChecks, duplicatesRemoved, invalidRows } = await apiPost('/delivery/bulk', {
      items: csvRows,
    });
    document.getElementById('csv-dedupe-summary').textContent =
      `Total Rows: ${totalRows} · Unique Checks: ${uniqueChecks} · Duplicates Removed: ${duplicatesRemoved}` +
      (invalidRows ? ` · Invalid Rows Skipped: ${invalidRows}` : '');

    document.getElementById('csv-progress').classList.remove('hidden');
    await pollJob(jobId, (progress) => updateProgressUI('csv', progress));
    const final = await apiGet(`/delivery/bulk/${jobId}`);
    csvResults = final.results || [];
    csvPage = 1;
    renderCsvResults();
    document.getElementById('csv-results-card').classList.remove('hidden');
  } catch (err) {
    toast('Bulk check failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

['csv-search', 'csv-filter-status', 'csv-filter-pin'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    csvPage = 1;
    renderCsvResults();
  });
});

function filteredCsvResults() {
  const search = document.getElementById('csv-search').value.trim().toLowerCase();
  const status = document.getElementById('csv-filter-status').value;
  const pin = document.getElementById('csv-filter-pin').value.trim();

  return csvResults.filter((r) => {
    const res = r.result || {};
    if (status && r.status !== status) return false;
    if (pin && r.postalCode !== pin) return false;
    if (search) {
      const hay = `${r.asin} ${r.postalCode} ${res.productName || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function renderCsvResults() {
  const rows = filteredCsvResults();
  const totalPages = Math.max(1, Math.ceil(rows.length / CSV_PAGE_SIZE));
  csvPage = Math.min(csvPage, totalPages);
  const pageRows = rows.slice((csvPage - 1) * CSV_PAGE_SIZE, csvPage * CSV_PAGE_SIZE);

  const table = document.getElementById('csv-results-table');
  table.innerHTML = `
    <thead><tr>
      <th>ASIN</th><th>PIN</th><th>Product</th><th>Deliverable</th><th>Delivery Date</th><th>Speed</th><th>Prime</th><th>Status</th>
    </tr></thead>
    <tbody>
      ${pageRows.map(rowToHtml).join('') || `<tr><td colspan="8"><div class="empty-state">No results match your filters.</div></td></tr>`}
    </tbody>`;

  document.getElementById('csv-pagination').innerHTML =
    `Page ${csvPage} of ${totalPages} (${rows.length} results)
     <button class="btn btn-sm" ${csvPage <= 1 ? 'disabled' : ''} onclick="changeCsvPage(-1)">Prev</button>
     <button class="btn btn-sm" ${csvPage >= totalPages ? 'disabled' : ''} onclick="changeCsvPage(1)">Next</button>`;
}

function changeCsvPage(delta) {
  csvPage += delta;
  renderCsvResults();
}

function rowToHtml(r) {
  const res = r.result || {};
  const deliverable = res.deliverable === 'yes' ? 'Yes' : res.deliverable === 'no' ? 'No' : 'Unknown';
  const pillClass = res.deliverable === 'yes' ? 'ok' : res.deliverable === 'no' ? 'no' : 'unknown';
  const dateDisplay = res.deliveryDate ? formatDateShort(res.deliveryDate) : res.deliveryDateRaw ? escapeHtml(res.deliveryDateRaw) : '—';
  const statusPill = r.status === 'error' ? `<span class="pill error">Error</span>` : `<span class="pill ${pillClass}">${statusLabel(r.status)}</span>`;

  return `<tr>
    <td>${escapeHtml(r.asin)}</td>
    <td>${escapeHtml(r.postalCode)}</td>
    <td>${escapeHtml(res.productName) || '—'}</td>
    <td>${deliverable}</td>
    <td>${dateDisplay}</td>
    <td>${res.deliverySpeedDays ? res.deliverySpeedDays + ' Days' : '—'}</td>
    <td>${res.primeEligible === 'yes' ? 'Yes' : res.primeEligible === 'no' ? 'No' : '—'}</td>
    <td>${statusPill}</td>
  </tr>`;
}

function statusLabel(status) {
  return { success: 'Success', not_deliverable: 'Not Deliverable', unknown: 'Unknown', error: 'Error' }[status] || status;
}

document.getElementById('csv-export-btn').addEventListener('click', () => {
  exportResultsToExcel(csvResults, 'Amazon_Delivery_Check');
});

// =========================================================
// TAB 2: One ASIN -> Many PINs
// =========================================================
let apResults = [];

document.getElementById('ap-check-btn').addEventListener('click', async () => {
  const asin = document.getElementById('ap-asin').value.trim().toUpperCase();
  const qty = Number(document.getElementById('ap-qty').value) || 1;
  const pins = document
    .getElementById('ap-pins')
    .value.split('\n')
    .map((p) => p.trim())
    .filter(Boolean);

  if (!ASIN_RE.test(asin)) {
    toast('Enter a valid ASIN first.', 'error');
    return;
  }
  const validPins = pins.filter((p) => PIN_RE.test(p));
  if (!validPins.length) {
    toast('Enter at least one valid 6-digit PIN.', 'error');
    return;
  }

  const btn = document.getElementById('ap-check-btn');
  btn.disabled = true;
  document.getElementById('ap-progress-card').classList.remove('hidden');
  document.getElementById('ap-summary-card').classList.add('hidden');
  document.getElementById('ap-results-card').classList.add('hidden');

  try {
    const items = validPins.map((pin) => ({ asin, postalCode: pin, quantity: qty }));
    const { jobId } = await apiPost('/delivery/bulk', { items });
    await pollJob(jobId, (progress) => updateProgressUI('ap', progress));
    const final = await apiGet(`/delivery/bulk/${jobId}`);
    apResults = final.results || [];
    renderApSummary();
    renderApResults();
  } catch (err) {
    toast('Check failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

function renderApSummary() {
  const total = apResults.length;
  const deliverable = apResults.filter((r) => r.result && r.result.deliverable === 'yes').length;
  const notDeliverable = apResults.filter((r) => r.result && r.result.deliverable === 'no').length;
  const dates = apResults.map((r) => r.result && r.result.deliveryDate).filter(Boolean).sort();

  document.getElementById('ap-summary-grid').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total PINs</div><div class="stat-value">${total}</div></div>
    <div class="stat-card"><div class="stat-label">Deliverable</div><div class="stat-value green">${deliverable}</div></div>
    <div class="stat-card"><div class="stat-label">Not Deliverable</div><div class="stat-value red">${notDeliverable}</div></div>
    <div class="stat-card"><div class="stat-label">Earliest &rarr; Latest</div><div class="stat-value" style="font-size:16px;">
      ${dates.length ? formatDateShort(dates[0]) + ' &rarr; ' + formatDateShort(dates[dates.length - 1]) : '—'}
    </div></div>`;
  document.getElementById('ap-summary-card').classList.remove('hidden');
}

function renderApResults() {
  const table = document.getElementById('ap-results-table');
  table.innerHTML = `
    <thead><tr><th>PIN</th><th>Deliverable</th><th>Delivery Date</th><th>Days</th></tr></thead>
    <tbody>
      ${apResults
        .map((r) => {
          const res = r.result || {};
          const mark = res.deliverable === 'yes' ? '&#10003;' : res.deliverable === 'no' ? '&#10007;' : '&#9888;';
          const dateDisplay = res.deliveryDate ? formatDateShort(res.deliveryDate) : res.deliveryDateRaw || '—';
          return `<tr><td>${escapeHtml(r.postalCode)}</td><td>${mark}</td><td>${dateDisplay}</td><td>${res.deliverySpeedDays || '—'}</td></tr>`;
        })
        .join('')}
    </tbody>`;
  document.getElementById('ap-results-card').classList.remove('hidden');
}

document.getElementById('ap-export-btn').addEventListener('click', () => {
  const asin = document.getElementById('ap-asin').value.trim().toUpperCase();
  exportResultsToExcel(apResults, `Amazon_Delivery_${asin}`);
});

// =========================================================
// Shared helpers
// =========================================================
async function pollJob(jobId, onProgress) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const progress = await apiGet(`/delivery/bulk/${jobId}`);
        onProgress(progress);
        if (progress.status === 'done') {
          clearInterval(interval);
          resolve(progress);
        }
      } catch (err) {
        clearInterval(interval);
        reject(err);
      }
    }, 900);
  });
}

function updateProgressUI(prefix, progress) {
  const fill = document.getElementById(`${prefix}-progress-fill`);
  const pct = document.getElementById(`${prefix}-progress-pct`);
  const count = document.getElementById(`${prefix}-progress-count`);
  fill.style.width = `${progress.percent}%`;
  pct.textContent = `${progress.percent}%`;
  count.textContent = `${progress.completed} / ${progress.total}`;

  if (prefix === 'csv') {
    document.getElementById('csv-progress-ok').textContent = progress.successful;
    document.getElementById('csv-progress-no').textContent = progress.unavailable;
    document.getElementById('csv-progress-err').textContent = progress.errors;
  }
}

function exportResultsToExcel(results, filenamePrefix) {
  if (!results.length) {
    toast('No results to export yet.', 'error');
    return;
  }
  const rows = results.map((r) => {
    const res = r.result || {};
    return {
      ASIN: r.asin,
      PIN: r.postalCode,
      Quantity: r.quantity,
      'Product Name': res.productName || '',
      Deliverable: res.deliverable || '',
      'Delivery Date': res.deliveryDate || res.deliveryDateRaw || '',
      'Delivery Speed': res.deliverySpeedDays ? `${res.deliverySpeedDays} Days` : '',
      'Prime Eligible': res.primeEligible || '',
      Seller: res.seller || '',
      Fulfilment: res.fulfilment || '',
      Price: res.price || '',
      Provider: res.source || '',
      Status: r.status,
      Error: res.errorMessage || '',
    };
  });
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Results');
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${filenamePrefix}_${dateStr}.xlsx`);
}
