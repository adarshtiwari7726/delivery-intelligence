let historyPage = 1;
const PAGE_SIZE = 25;
let debounceTimer = null;

['search', 'filter-asin', 'filter-pin', 'filter-deliverable', 'filter-provider'].forEach((id) => {
  document.getElementById(id).addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      historyPage = 1;
      loadHistory();
    }, 300);
  });
});

function currentFilters() {
  return {
    search: document.getElementById('search').value.trim(),
    asin: document.getElementById('filter-asin').value.trim(),
    postalCode: document.getElementById('filter-pin').value.trim(),
    deliverable: document.getElementById('filter-deliverable').value,
    provider: document.getElementById('filter-provider').value,
  };
}

async function loadHistory() {
  const filters = currentFilters();
  const params = new URLSearchParams({ ...filters, page: historyPage, pageSize: PAGE_SIZE });
  try {
    const data = await apiGet(`/delivery/history?${params.toString()}`);
    renderTable(data.rows);
    renderPagination(data.total);
  } catch (err) {
    toast('Could not load history: ' + err.message, 'error');
  }
}

function renderTable(rows) {
  const table = document.getElementById('history-table');
  if (!rows.length) {
    table.innerHTML = `<tbody><tr><td><div class="empty-state"><div class="icon">&#128337;</div>No checks match your filters yet.</div></td></tr></tbody>`;
    return;
  }
  table.innerHTML = `
    <thead><tr>
      <th>Checked</th><th>ASIN</th><th>Product</th><th>PIN</th><th>Delivery Date</th><th>Deliverable</th><th>Provider</th><th>Status</th>
    </tr></thead>
    <tbody>
      ${rows.map(rowHtml).join('')}
    </tbody>`;
}

function rowHtml(r) {
  const pillClass = r.deliverable === 'yes' ? 'ok' : r.deliverable === 'no' ? 'no' : 'unknown';
  const dateDisplay = r.delivery_date ? formatDateShort(r.delivery_date) : r.delivery_date_raw || '—';
  return `<tr>
    <td>${formatTimestampDisplay(r.checked_at)}</td>
    <td>${escapeHtml(r.asin)}</td>
    <td>${escapeHtml(r.product_name) || '—'}</td>
    <td>${escapeHtml(r.postal_code)}</td>
    <td>${dateDisplay}</td>
    <td><span class="pill ${pillClass}">${r.deliverable}</span></td>
    <td>${escapeHtml(r.provider_name)} (${r.provider})</td>
    <td>${escapeHtml(r.status)}</td>
  </tr>`;
}

function renderPagination(total) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  document.getElementById('history-pagination').innerHTML = `
    Page ${historyPage} of ${totalPages} (${total} total)
    <button class="btn btn-sm" ${historyPage <= 1 ? 'disabled' : ''} onclick="changeHistoryPage(-1)">Prev</button>
    <button class="btn btn-sm" ${historyPage >= totalPages ? 'disabled' : ''} onclick="changeHistoryPage(1)">Next</button>`;
}

function changeHistoryPage(delta) {
  historyPage += delta;
  loadHistory();
}

document.getElementById('clear-btn').addEventListener('click', async () => {
  if (!confirm('Delete ALL check history? This cannot be undone.')) return;
  try {
    await apiDelete('/delivery/history', { all: true });
    toast('History cleared.', 'success');
    historyPage = 1;
    loadHistory();
  } catch (err) {
    toast('Could not delete history: ' + err.message, 'error');
  }
});

document.getElementById('export-btn').addEventListener('click', async () => {
  try {
    const filters = currentFilters();
    const params = new URLSearchParams(filters);
    const data = await apiGet(`/delivery/history/export?${params.toString()}`);
    if (!data.rows.length) {
      toast('No history to export.', 'error');
      return;
    }
    const rows = data.rows.map((r) => ({
      ASIN: r.asin,
      PIN: r.postal_code,
      Quantity: r.quantity,
      'Product Name': r.product_name || '',
      'Product ID': r.asin,
      Deliverable: r.deliverable,
      'Delivery Date': r.delivery_date || r.delivery_date_raw || '',
      'Delivery Speed': r.delivery_speed_days ? `${r.delivery_speed_days} Days` : '',
      'Prime Eligible': r.prime_eligible,
      Seller: r.seller || '',
      Fulfilment: r.fulfilment || '',
      Price: r.price || '',
      'Checked At': r.checked_at,
      Provider: r.provider_name,
      Status: r.status,
      Error: r.error_message || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'History');
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Amazon_Delivery_Check_${dateStr}.xlsx`);
  } catch (err) {
    toast('Export failed: ' + err.message, 'error');
  }
});

loadHistory();
