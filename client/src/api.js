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
  signup: (name, email, password) =>
  request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) }),

  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  getClients: () => request('/api/clients'),

  createClient: (client) =>
    request('/api/clients', { method: 'POST', body: JSON.stringify(client) }),

  updateClient: (id, client) =>
    request(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(client) }),

  deleteClient: (id) =>
    request(`/api/clients/${id}`, { method: 'DELETE' }),

  getInvoices: (status) =>
    request(`/api/invoices${status ? `?status=${status}` : ''}`),

  getInvoice: (id) => request(`/api/invoices/${id}`),

  createInvoice: (invoice) =>
    request('/api/invoices', { method: 'POST', body: JSON.stringify(invoice) }),

  updateInvoice: (id, invoice) =>
    request(`/api/invoices/${id}`, { method: 'PUT', body: JSON.stringify(invoice) }),

  updateInvoiceStatus: (id, status) =>
    request(`/api/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  deleteInvoice: (id) =>
    request(`/api/invoices/${id}`, { method: 'DELETE' })
};