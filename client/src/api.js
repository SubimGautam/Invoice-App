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

  // --- Clients ---
  getClients: () => request('/api/clients'),
  getClient: (id) => request(`/api/clients/${id}`),
  createClient: (client) =>
    request('/api/clients', { method: 'POST', body: JSON.stringify(client) }),
  updateClient: (id, client) =>
    request(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(client) }),
  deleteClient: (id) =>
    request(`/api/clients/${id}`, { method: 'DELETE' }),

  // --- Invoices ---
  getInvoiceStats: () => request('/api/invoices/stats'),
  getTimeline: () => request('/api/invoices/timeline'),
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

  // --- Payments ---
  recordPayment: (payload) =>
    request('/api/payments', { method: 'POST', body: JSON.stringify(payload) }),

  // --- Products ---
  getProducts: () => request('/api/products'),
  createProduct: (product) =>
    request('/api/products', { method: 'POST', body: JSON.stringify(product) }),
  updateProduct: (id, product) =>
    request(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  deleteProduct: (id) =>
    request(`/api/products/${id}`, { method: 'DELETE' }),

  // --- Account ---
  getProfile: () => request('/api/account/profile'),
  updateProfile: (profile) =>
    request('/api/account/profile', { method: 'PUT', body: JSON.stringify(profile) }),
  getSettings: () => request('/api/account/settings'),
  updateSettings: (settings) =>
    request('/api/account/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  getEmailStatus: () => request('/api/account/email-status'),

  // --- Reports ---
  getReports: (months = 12) => request(`/api/reports?months=${months}`),

  // --- Workspaces & Members ---
  getWorkspaces: () => request('/api/workspaces'),
  createWorkspace: (name) =>
    request('/api/workspaces', { method: 'POST', body: JSON.stringify({ name }) }),
  activateWorkspace: (workspaceId) =>
    request('/api/workspaces/activate', { method: 'POST', body: JSON.stringify({ workspaceId }) }),
  getMembers: () => request('/api/workspaces/members'),
  inviteMember: () =>
    request('/api/workspaces/invite', { method: 'POST' }),
  joinWorkspace: (code) =>
    request('/api/workspaces/join', { method: 'POST', body: JSON.stringify({ code }) }),
  updateMemberRole: (id, role) =>
    request(`/api/workspaces/members/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  removeMember: (id) =>
    request(`/api/workspaces/members/${id}`, { method: 'DELETE' }),
  leaveWorkspace: (workspaceId) =>
    request('/api/workspaces/leave', { method: 'POST', body: JSON.stringify({ workspaceId }) }),
  renameWorkspace: (name) =>
    request('/api/workspaces', { method: 'PATCH', body: JSON.stringify({ name }) }),

  // --- Notifications ---
  getNotifications: (limit = 50) =>
    request(`/api/notifications?limit=${limit}`),
  getNotificationCount: () => request('/api/notifications/unread-count'),
  readNotification: (id) =>
    request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  readAllNotifications: () =>
    request('/api/notifications/read-all', { method: 'PATCH' }),

  // --- Emails (send) ---
  sendInvoiceEmail: (id) =>
    request(`/api/emails/invoice/${id}/send`, { method: 'POST' }),
  sendReminderEmail: (id) =>
    request(`/api/emails/invoice/${id}/reminder`, { method: 'POST' }),
  batchReminders: () =>
    request('/api/emails/reminders/batch', { method: 'POST' }),
  getEmailLog: (invoiceId) => {
    const params = invoiceId ? `?invoiceId=${invoiceId}` : '';
    return request(`/api/emails/log${params}`);
  },

  // --- Recurring schedules ---
  getRecurring: () => request('/api/recurring'),
  createRecurring: (payload) =>
    request('/api/recurring', { method: 'POST', body: JSON.stringify(payload) }),
  updateRecurring: (id, payload) =>
    request(`/api/recurring/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  setRecurringActive: (id, active) =>
    request(`/api/recurring/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  deleteRecurring: (id) =>
    request(`/api/recurring/${id}`, { method: 'DELETE' }),
  generateDueRecurring: () =>
    request('/api/recurring/generate-due', { method: 'POST' })
};
