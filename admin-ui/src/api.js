const BASE = '/api';

function getToken() { return localStorage.getItem('token'); }

async function req(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/admin/';
    return;
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function reqRaw(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    window.location.href = '/admin/';
    return;
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
