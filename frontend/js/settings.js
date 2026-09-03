(async function initSettings() {
  try {
    const data = await apiGet('/settings');
    const s = data.settings || {};

    document.getElementById('active-provider').value = s.DELIVERY_PROVIDER || 'mock';
    document.getElementById('paapi-access-key').value = s.PAAPI_ACCESS_KEY || '';
    document.getElementById('paapi-secret-key').value = s.PAAPI_SECRET_KEY || '';
    document.getElementById('paapi-partner-tag').value = s.PAAPI_PARTNER_TAG || '';
    document.getElementById('tp-base-url').value = s.THIRDPARTY_API_BASE_URL || '';
    document.getElementById('tp-api-key').value = s.THIRDPARTY_API_KEY || '';
    document.getElementById('tp-api-secret').value = s.THIRDPARTY_API_SECRET || '';
    document.getElementById('cache-duration').value = s.CACHE_DURATION_MINUTES || 30;
    document.getElementById('q-concurrency').value = s.QUEUE_CONCURRENCY || 3;
    document.getElementById('q-rpm').value = s.QUEUE_REQUESTS_PER_MINUTE || 60;
    document.getElementById('q-retries').value = s.QUEUE_RETRY_ATTEMPTS || 3;
    document.getElementById('q-timeout').value = s.QUEUE_TIMEOUT_MS || 30000;

    renderProviderCards(data.providers || []);
  } catch (err) {
    toast('Could not load settings: ' + err.message, 'error');
  }
})();

function renderProviderCards(providers) {
  const root = document.getElementById('provider-cards');
  root.innerHTML = providers
    .map((p) => {
      const pillClass = p.mode !== 'LIVE' ? 'demo' : p.configured ? 'live' : 'offline';
      const pillText = p.mode !== 'LIVE' ? 'DEMO / MOCK' : p.configured ? '● LIVE' : 'API NOT CONFIGURED';
      return `
        <div class="card" style="margin:0;">
          <div style="font-weight:700; margin-bottom:6px;">${escapeHtml(p.name)}</div>
          <div class="provider-pill ${pillClass}"><span class="dot"></span>${pillText}</div>
          <div style="color:var(--text-dim); font-size:12px; margin-top:8px;">key: <code class="inline">${p.key}</code></div>
        </div>`;
    })
    .join('');
}

document.getElementById('save-settings-btn').addEventListener('click', async () => {
  const payload = {
    DELIVERY_PROVIDER: document.getElementById('active-provider').value,
    PAAPI_ACCESS_KEY: document.getElementById('paapi-access-key').value,
    PAAPI_SECRET_KEY: document.getElementById('paapi-secret-key').value,
    PAAPI_PARTNER_TAG: document.getElementById('paapi-partner-tag').value,
    THIRDPARTY_API_BASE_URL: document.getElementById('tp-base-url').value,
    THIRDPARTY_API_KEY: document.getElementById('tp-api-key').value,
    THIRDPARTY_API_SECRET: document.getElementById('tp-api-secret').value,
    CACHE_DURATION_MINUTES: document.getElementById('cache-duration').value,
    QUEUE_CONCURRENCY: document.getElementById('q-concurrency').value,
    QUEUE_REQUESTS_PER_MINUTE: document.getElementById('q-rpm').value,
    QUEUE_RETRY_ATTEMPTS: document.getElementById('q-retries').value,
    QUEUE_TIMEOUT_MS: document.getElementById('q-timeout').value,
  };

  try {
    await apiPost('/settings', payload);
    toast('Settings saved.', 'success');
    setTimeout(() => location.reload(), 600);
  } catch (err) {
    toast('Could not save settings: ' + err.message, 'error');
  }
});
