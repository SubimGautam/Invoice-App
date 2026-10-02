const API_URL = import.meta.env.VITE_API_URL || '';

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

// Multipart upload helper. Unlike `request` it deliberately does NOT set a
// Content-Type header — the browser fills the multipart boundary itself.
async function upload(endpoint, file) {
  const token = getToken();
  const form = new FormData();
  form.append('file', file);

  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Upload failed');
  }
  return data;
}

// Resolve an uploaded file path (/uploads/...) to a full URL served by the
// API server. External URLs pass through untouched (e.g. a logo hosted on
// your own CDN, or a Figma asset).
export function assetUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return `${API_URL}${path}`;
  return path;
}

export const api = {
  signup: (payload) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),

  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  forgotPassword: (email) =>
    request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) =>
    request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // --- Global search (topbar) ---
  globalSearch: (q) => request(`/api/search?q=${encodeURIComponent(q)}`),

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
  getInvoices: (page = 1, limit = 20, status, q) => {
    const params = new URLSearchParams({ page, limit });
    if (status) params.set('status', status);
    if (q) params.set('q', q);
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
  // Cancel an invoice while KEEPING it: the row, its line items, its payments
  // and its audit trail all survive, but it drops out of every total. This is
  // what "delete" becomes once an invoice has been sent or paid.
  voidInvoice: (id, reason) =>
    request(`/api/invoices/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),

  // --- Estimates (quotes) ---
  getEstimates: (page = 1, limit = 20, status, q) => {
    const params = new URLSearchParams({ page, limit });
    if (status) params.set('status', status);
    if (q) params.set('q', q);
    return request(`/api/estimates?${params}`);
  },
  getEstimate: (id) => request(`/api/estimates/${id}`),
  createEstimate: (estimate) =>
    request('/api/estimates', { method: 'POST', body: JSON.stringify(estimate) }),
  updateEstimate: (id, estimate) =>
    request(`/api/estimates/${id}`, { method: 'PUT', body: JSON.stringify(estimate) }),
  updateEstimateStatus: (id, status, reason) =>
    request(`/api/estimates/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, reason }) }),
  convertEstimate: (id) =>
    request(`/api/estimates/${id}/convert`, { method: 'POST' }),
  deleteEstimate: (id) => request(`/api/estimates/${id}`, { method: 'DELETE' }),
  sendEstimateEmail: (id) =>
    request(`/api/emails/estimate/${id}/send`, { method: 'POST' }),
  getEstimateLink: (id) => request(`/api/estimates/${id}/link`),

  // --- Public quote link (no auth) — how the client reviews and responds ---
  getPublicEstimate: (token) => request(`/api/estimate/${token}`),
  respondToEstimate: (token, payload) =>
    request(`/api/estimate/${token}/respond`, { method: 'POST', body: JSON.stringify(payload) }),

  // --- Payments ---
  recordPayment: (payload) =>
    request('/api/payments', { method: 'POST', body: JSON.stringify(payload) }),
  getPayments: (months = 0) => request(`/api/payments?months=${months}`),
  recordUnallocatedPayment: (payload) =>
    request('/api/payments/unallocated', { method: 'POST', body: JSON.stringify(payload) }),
  allocatePayment: (id, invoiceId) =>
    request(`/api/payments/${id}/allocate`, { method: 'POST', body: JSON.stringify({ invoiceId }) }),
  refundPayment: (id, payload) =>
    request(`/api/payments/${id}/refund`, { method: 'POST', body: JSON.stringify(payload) }),

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
  getNotifications: (limit = 50, page = 1) =>
    request(`/api/notifications?limit=${limit}&page=${page}`),
  getNotificationCount: () => request('/api/notifications/unread-count'),
  readNotification: (id) =>
    request(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  readAllNotifications: () =>
    request('/api/notifications/read-all', { method: 'PATCH' }),

  // --- Profile picture (avatar) + business logo uploads ---
  uploadAvatar: (file) => upload('/api/account/avatar', file),
  removeAvatar: () => request('/api/account/avatar', { method: 'DELETE' }),
  uploadLogo: (file) => upload('/api/account/logo', file),
  removeLogo: () => request('/api/account/logo', { method: 'DELETE' }),

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
    request('/api/recurring/generate-due', { method: 'POST' }),

  // --- Public payment links (no auth needed to fetch or pay) ---
  getPaymentLink: (token) => request(`/api/pay/${token}`),
  payInvoice: (token, payload) =>
    request(`/api/pay/${token}`, { method: 'POST', body: JSON.stringify(payload) }),
  initiatePayLink: (token, payload) =>
    request(`/api/pay/${token}/initiate`, { method: 'POST', body: JSON.stringify(payload) }),
  resolvePayLink: (token, attemptId) =>
    request(`/api/pay/${token}/resolve`, { method: 'POST', body: JSON.stringify({ attemptId }) }),
  // Auth'd helper: the workspace share link for an invoice (copies to clipboard).
  getInvoicePayLink: (id) => request(`/api/invoices/${id}/link`)
};
