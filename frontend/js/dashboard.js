(async function initDashboard() {
  try {
    const data = await apiGet('/delivery/history/dashboard');
    const t = data.totals || {};

    document.getElementById('stat-total').textContent = t.total || 0;
    document.getElementById('stat-deliverable').textContent = t.deliverable || 0;
    document.getElementById('stat-not-deliverable').textContent = t.not_deliverable || 0;
    document.getElementById('stat-unknown').textContent = t.unknown || 0;
    document.getElementById('stat-avg-days').textContent = t.avg_speed ? Number(t.avg_speed).toFixed(1) : '—';

    renderDeliverabilityChart(t);
    renderSpeedChart(data.speedBuckets || []);
    renderPinTable(data.pinPerformance || []);
  } catch (e) {
    toast('Could not load dashboard: ' + e.message, 'error');
  }
})();

function renderDeliverabilityChart(t) {
  const ctx = document.getElementById('chart-deliverability');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Deliverable', 'Not Deliverable', 'Unknown'],
      datasets: [
        {
          data: [t.deliverable || 0, t.not_deliverable || 0, t.unknown || 0],
          backgroundColor: ['#2ecc71', '#ff5c5c', '#ffb84d'],
          borderRadius: 6,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9aa0ac' }, grid: { color: '#2a2f3a' } },
        y: { ticks: { color: '#e7e9ee' }, grid: { display: false } },
      },
    },
  });
}

function renderSpeedChart(buckets) {
  const labels = [];
  const values = [];
  const grouped = { '1 Day': 0, '2 Days': 0, '3 Days': 0, '4 Days': 0, '5+ Days': 0 };
  buckets.forEach((b) => {
    if (b.days === 1) grouped['1 Day'] += b.count;
    else if (b.days === 2) grouped['2 Days'] += b.count;
    else if (b.days === 3) grouped['3 Days'] += b.count;
    else if (b.days === 4) grouped['4 Days'] += b.count;
    else grouped['5+ Days'] += b.count;
  });
  Object.entries(grouped).forEach(([k, v]) => {
    labels.push(k);
    values.push(v);
  });

  new Chart(document.getElementById('chart-speed'), {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: '#37b6ff', borderRadius: 6 }] },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9aa0ac' }, grid: { display: false } },
        y: { ticks: { color: '#9aa0ac' }, grid: { color: '#2a2f3a' }, beginAtZero: true },
      },
    },
  });
}

function renderPinTable(rows) {
  const el = document.getElementById('pin-performance-table');
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state"><div class="icon">&#128230;</div>No delivery-speed data yet. Run some checks first.</div>`;
    return;
  }
  el.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>PIN</th><th>Avg. Days</th><th>Checks</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr><td>${escapeHtml(r.postal_code)}</td><td>${Number(r.avg_days).toFixed(1)}</td><td>${r.checks}</td></tr>`
            )
            .join('')}
        </tbody>
      </table>
    </div>`;
}
