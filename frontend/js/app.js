// ---------------------------------------------------------------
// Shared app shell: API base URL, fetch helper, sidebar, toasts.
// Loaded on every page before the page-specific script.
// ---------------------------------------------------------------

const API_BASE = (window.DELIVERY_API_BASE || 'http://localhost:4000') + '/api';

const NAV_ITEMS = [
  { href: 'index.html', label: 'Dashboard', icon: '&#9635;' },
  { href: 'single-check.html', label: 'Single Check', icon: '&#128269;' },
  { href: 'bulk-check.html', label: 'Bulk Checker', icon: '&#128203;' },
  { href: 'history.html', label: 'History', icon: '&#128337;' },
  { href: 'analytics.html', label: 'Analytics', icon: '&#128202;' },
  { href: 'settings.html', label: 'Settings', icon: '&#9881;' },
];

function renderSidebar(activeHref) {
  const root = document.getElementById('sidebar-root');
  if (!root) return;

  const links = NAV_ITEMS.map(
    (item) => `
      <a class="nav-link ${item.href === activeHref ? 'active' : ''}" href="${item.href}">
        <span>${item.icon}</span><span>${item.label}</span>
      </a>`
  ).join('');

  root.innerHTML = `
    <div class="brand">
      <div class="brand-title">Delivery <span>Intelligence</span></div>
      <div class="brand-subtitle">ASIN + PIN Delivery Promise Checker</div>
    </div>
    ${links}
    <div class="sidebar-footer">
      <div id="provider-pill" class="provider-pill offline"><span class="dot"></span>Checking provider...</div>
      <div style="margin-top:8px;">Marketplace: amazon.in</div>
    </div>
  `;

  refreshProviderPill();
}

async function refreshProviderPill() {
  const el = document.getElementById('provider-pill');
  if (!el) return;
  try {
    const status = await apiGet('/delivery/status');
    if (status.mode === 'LIVE' && status.configured) {
      el.className = 'provider-pill live';
      el.innerHTML = `<span class="dot"></span>LIVE &middot; ${escapeHtml(status.name)}`;
    } else if (status.mode === 'LIVE' && !status.configured) {
      el.className = 'provider-pill offline';
      el.innerHTML = `<span class="dot"></span>API NOT CONFIGURED`;
    } else {
      el.className = 'provider-pill demo';
      el.innerHTML = `<span class="dot"></span>DEMO / MOCK`;
    }
  } catch (e) {
    el.className = 'provider-pill offline';
    el.innerHTML = `<span class="dot"></span>Backend offline`;
  }
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || data.errors?.join(', ') || 'Request failed', data);
  return data;
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || (data.errors && data.errors.join(', ')) || 'Request failed', data);
  return data;
}

async function apiDelete(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Request failed', data);
  return data;
}

class ApiError extends Error {
  constructor(message, data) {
    super(message);
    this.data = data;
  }
}

function toast(message, type = 'info') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return null;
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function formatDateShort(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit', timeZone: 'UTC' });
}

function formatTimestampDisplay(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
