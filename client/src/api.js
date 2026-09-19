const API_URL = import.meta.env.VITE_API_URL;

function getToken() {
  return localStorage.getItem('token');
}

async function request(endpoint, options = {}) {
  const token = getToken();

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

export const api = {
  signup: (payload) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),

  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  getClients: () => request('/api/clients'),
  getInvoiceStats: () => request('/api/invoices/stats'),

  createClient: (client) =>
    request('/api/clients', { method: 'POST', body: JSON.stringify(client) }),

  updateClient: (id, client) =>
    request(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(client) }),

  deleteClient: (id) =>
    request(`/api/clients/${id}`, { method: 'DELETE' }),

  getInvoices: (page = 1, limit = 20, status) => {
    const params = new URLSearchParams({ page, limit });
    if (status) params.set('status', status);
    return request(`/api/invoices?${params}`);
  },

  getInvoice: (id) => request(`/api/invoices/${id}`),

  createInvoice: (invoice) =>
    request('/api/invoices', { method: 'POST', body: JSON.stringify(invoice) }),

  updateInvoice: (id, invoice) =>
    request(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(invoice) }),

  updateInvoiceStatus: (id, status) =>
    request(`/api/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  deleteInvoice: (id) =>
    request(`/api/invoices/${id}`, { method: 'DELETE' }),

  getProfile: () => request('/api/account/profile'),
  updateProfile: (profile) =>
    request('/api/account/profile', { method: 'PUT', body: JSON.stringify(profile) }),

  getSettings: () => request('/api/account/settings'),
  updateSettings: (settings) =>
    request('/api/account/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  getReports: (months = 12) => request(`/api/reports?months=${months}`)
};