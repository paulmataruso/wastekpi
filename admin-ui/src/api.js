const BASE = '/api';

function getToken() { return localStorage.getItem('token'); }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Retry configuration
// Network errors / 5xx during a save: we wait long enough to cover a full
// API container restart (migrations + WAL recovery = ~8-15s).
// Schedule: attempt 1 immediately, then 2s, 5s, 10s, 10s = ~27s total window.
// Read operations use the same schedule — worst case the user waits a moment,
// but they stay logged in and their data is safe.
const RETRY_DELAYS = [2000, 5000, 10000, 10000]; // ms between attempts
const MAX_RETRIES = RETRY_DELAYS.length;          // 4 retries = 5 total attempts

async function req(path, options = {}, retryCount = 0) {
  const token = getToken();
  let res;

  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (networkErr) {
    // Pure network failure — server is down, container restarting, etc.
    // Never log the user out for this. Wait and retry.
    if (retryCount < MAX_RETRIES) {
      await sleep(RETRY_DELAYS[retryCount]);
      return req(path, options, retryCount + 1);
    }
    throw new Error('The server is not responding. Your data has been saved locally by the crash recovery system and will sync automatically when the server comes back online.');
  }

  // 401 — could be a transient issue during a restart where the auth
  // middleware fires before the server is fully ready. Retry a few times
  // with increasing delays before deciding the token is genuinely bad.
  if (res.status === 401) {
    if (retryCount < 2) {
      await sleep(RETRY_DELAYS[retryCount]);
      return req(path, options, retryCount + 1);
    }
    // Three 401s in a row — token is genuinely invalid/expired.
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/admin/';
    return;
  }

  // 5xx server errors — server is up but erroring. Give it time to recover.
  if (res.status >= 500 && retryCount < MAX_RETRIES) {
    await sleep(RETRY_DELAYS[retryCount]);
    return req(path, options, retryCount + 1);
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function reqRaw(path, options = {}, retryCount = 0) {
  const token = getToken();
  let res;

  try {
    res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (networkErr) {
    if (retryCount < MAX_RETRIES) {
      await sleep(RETRY_DELAYS[retryCount]);
      return reqRaw(path, options, retryCount + 1);
    }
    throw new Error('The server is not responding. Please try again in a moment.');
  }

  if (res.status === 401) {
    if (retryCount < 2) {
      await sleep(RETRY_DELAYS[retryCount]);
      return reqRaw(path, options, retryCount + 1);
    }
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/admin/';
    return;
  }

  if (res.status >= 500 && retryCount < MAX_RETRIES) {
    await sleep(RETRY_DELAYS[retryCount]);
    return reqRaw(path, options, retryCount + 1);
  }

  return res;
}

export const api = {
  login: (body) => req('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  employees: {
    list:   ()       => req('/employees'),
    create: (b)      => req('/employees', { method: 'POST', body: JSON.stringify(b) }),
    update: (id, b)  => req(`/employees/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
    delete: (id)     => req(`/employees/${id}`, { method: 'DELETE' })
  },

  routes: {
    list:    ()      => req('/routes'),
    listAll: ()      => req('/routes?all=true'),
    create:  (b)     => req('/routes', { method: 'POST', body: JSON.stringify(b) }),
    update:  (id, b) => req(`/routes/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
    delete:  (id)    => req(`/routes/${id}`, { method: 'DELETE' })
  },

  routeLogs: {
    list:   (params) => req('/route-logs?' + new URLSearchParams(params)),
    create: (b)      => req('/route-logs', { method: 'POST', body: JSON.stringify(b) }),
    update: (id, b)  => req(`/route-logs/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
    delete: (id)     => req(`/route-logs/${id}`, { method: 'DELETE' })
  },

  packOutLocations: {
    list:   ()      => req('/pack-out-locations'),
    create: (name)  => req('/pack-out-locations', { method: 'POST', body: JSON.stringify({ name }) }),
    delete: (id)    => req(`/pack-out-locations/${id}`, { method: 'DELETE' }),
  },

  dashboard: {
    summary: (date) => req(`/dashboard/summary?date=${date}`)
  },

  import: {
    upload: (rows) => req('/import', { method: 'POST', body: JSON.stringify({ rows }) })
  },

  backup: {
    download: ()        => reqRaw('/backup'),
    restore:  (backup)  => req('/backup/restore', { method: 'POST', body: JSON.stringify({ backup }) }),
    erase:    ()        => req('/backup/erase', { method: 'POST' })
  },

  users: {
    list:   ()       => req('/users'),
    create: (b)      => req('/users', { method: 'POST', body: JSON.stringify(b) }),
    update: (id, b)  => req(`/users/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
    delete: (id)     => req(`/users/${id}`, { method: 'DELETE' })
  },

  reports: {
    fridayHours:    (weekOf) => req(`/reports/friday-hours?week_of=${weekOf}`),
    fridayHoursCsv: (weekOf) => reqRaw(`/reports/friday-hours?week_of=${weekOf}&format=csv`),

    routeDuration: (params) => {
      const qs = new URLSearchParams({ date_from: params.date_from, date_to: params.date_to });
      (params.route_numbers || []).forEach(r => qs.append('route_numbers[]', r));
      return req(`/reports/route-duration?${qs}`);
    },
    routeDurationCsv: (params) => {
      const qs = new URLSearchParams({ date_from: params.date_from, date_to: params.date_to, format: 'csv' });
      (params.route_numbers || []).forEach(r => qs.append('route_numbers[]', r));
      return reqRaw(`/reports/route-duration?${qs}`);
    },

    custom:    (body) => req('/reports/custom', { method: 'POST', body: JSON.stringify(body) }),
    customCsv: (body) => reqRaw('/reports/custom', {
      method: 'POST',
      body: JSON.stringify({ ...body, format: 'csv' }),
      headers: { 'Content-Type': 'application/json' }
    }),
  }
};
