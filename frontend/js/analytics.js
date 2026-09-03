document.getElementById('analyze-btn').addEventListener('click', async () => {
  const asin = document.getElementById('analysis-asin').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{10}$/.test(asin)) {
    toast('Enter a valid ASIN.', 'error');
    return;
  }
  const container = document.getElementById('analysis-result');
  container.innerHTML = `<div class="card">Loading…</div>`;

  try {
    const data = await apiGet(`/delivery/asin/${asin}/analysis`);
    renderAnalysis(data);
  } catch (err) {
    container.innerHTML = `<div class="card"><div class="empty-state"><div class="icon">&#128202;</div>No checks found for this ASIN yet. Run some checks first.</div></div>`;
  }
});

function renderAnalysis(data) {
  const container = document.getElementById('analysis-result');
  container.innerHTML = `
    <div class="card">
      <div class="grid grid-4">
        <div class="stat-card"><div class="stat-label">Total PINs Checked</div><div class="stat-value">${data.totalChecks}</div></div>
        <div class="stat-card"><div class="stat-label">Deliverable</div><div class="stat-value green">${data.deliverablePct}%</div></div>
        <div class="stat-card"><div class="stat-label">Not Deliverable</div><div class="stat-value red">${data.notDeliverablePct}%</div></div>
        <div class="stat-card"><div class="stat-label">Avg. Delivery Days</div><div class="stat-value">${data.avgDays ?? '—'}</div></div>
      </div>
      <div class="grid grid-3" style="margin-top:14px;">
        <div class="stat-card"><div class="stat-label">Fastest Delivery</div><div class="stat-value" style="font-size:18px;">${data.fastestDays ? data.fastestDays + ' Day(s)' : '—'}</div></div>
        <div class="stat-card"><div class="stat-label">Slowest Delivery</div><div class="stat-value" style="font-size:18px;">${data.slowestDays ? data.slowestDays + ' Day(s)' : '—'}</div></div>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead><tr><th>PIN</th><th>Deliverable</th><th>Delivery Date</th><th>Speed</th><th>Checked</th></tr></thead>
          <tbody>
            ${data.rows
              .map(
                (r) => `<tr>
                  <td>${escapeHtml(r.postal_code)}</td>
                  <td><span class="pill ${r.deliverable === 'yes' ? 'ok' : r.deliverable === 'no' ? 'no' : 'unknown'}">${r.deliverable}</span></td>
                  <td>${r.delivery_date ? formatDateShort(r.delivery_date) : (r.delivery_date_raw || '—')}</td>
                  <td>${r.delivery_speed_days ? r.delivery_speed_days + ' Days' : '—'}</td>
                  <td>${formatTimestampDisplay(r.checked_at)}</td>
                </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </div>`;
}
