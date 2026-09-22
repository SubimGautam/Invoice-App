import { useEffect, useState } from 'react';
import DashboardLayout from '../layouts/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

const imgChevronRight = "https://www.figma.com/api/mcp/asset/d1746a44-fd1d-4316-8e4c-0f8692bb0500.svg";

const CURRENCIES = [
  { code: 'USD', label: 'US Dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British Pound (£)' },
  { code: 'NPR', label: 'Nepali Rupee (Rs.)' },
];

const EMPTY_PROFILE = {
  businessName: '', email: '', phone: '',
  street: '', city: '', state: '', zipCode: '', country: '',
  taxNumber: '', logoUrl: '',
  bankName: '', routingNumber: '', accountNumber: '',
};

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer select-none">
      <div>
        <p className="text-sm font-medium text-[#131b2e]">{label}</p>
        {description && <p className="text-xs text-[#464555] mt-0.5">{description}</p>}
      </div>
      <span
        className={`relative w-10 h-6 rounded-full shrink-0 transition-colors ${checked ? 'bg-[#4f46e5]' : 'bg-[#e2e7ff]'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`}
        />
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
    </label>
  );
}

function Field({ label, disabled, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">{label}</label>
      <input
        {...props}
        disabled={disabled}
        className={`w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] placeholder:text-[#9694a8] focus:outline-none focus:ring-2 focus:ring-[#4f46e5] ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
    </div>
  );
}

export default function Settings() {
  const { workspace, canWrite, canManage, updateWorkspace } = useAuth();
  const readOnly = !canWrite;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  const [settings, setSettings] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [emailStatus, setEmailStatus] = useState(null);

  const [workspaceName, setWorkspaceName] = useState(workspace?.name || '');
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceSaved, setWorkspaceSaved] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const [prof, sett, emailStatusRes] = await Promise.all([
        api.getProfile(),
        api.getSettings(),
        api.getEmailStatus(),
      ]);
      if (prof) setProfile({ ...EMPTY_PROFILE, ...prof });
      setSettings(sett);
      setEmailStatus(emailStatusRes);
      setWorkspaceName(workspace?.name || '');
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRenameWorkspace(e) {
    e.preventDefault();
    setWorkspaceSaving(true);
    setWorkspaceError('');
    setWorkspaceSaved(false);
    try {
      const res = await api.renameWorkspace(workspaceName);
      updateWorkspace({ name: res.name });
      setWorkspaceSaved(true);
      setTimeout(() => setWorkspaceSaved(false), 3000);
    } catch (err) {
      setWorkspaceError(err.message);
    } finally {
      setWorkspaceSaving(false);
    }
  }

  function updateProfileField(field, value) {
    setProfile((p) => ({ ...p, [field]: value }));
  }

  function updateSettingsField(field, value) {
    setSettings((s) => ({ ...s, [field]: value }));
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError('');
    setProfileSaved(false);
    try {
      const saved = await api.updateProfile(profile);
      setProfile({ ...EMPTY_PROFILE, ...saved });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setSettingsSaving(true);
    setSettingsError('');
    setSettingsSaved(false);
    try {
      const saved = await api.updateSettings({
        currency: settings.currency,
        invoicePrefix: settings.invoicePrefix,
        defaultPaymentTerms: Number(settings.defaultPaymentTerms),
        defaultTaxRate: Number(settings.defaultTaxRate),
        emailNotifications: settings.emailNotifications,
        paymentNotifications: settings.paymentNotifications,
        reminderNotifications: settings.reminderNotifications,
      });
      setSettings(saved);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSettingsSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="py-4 max-w-3xl">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium font-mono tracking-[0.6px] uppercase text-[#464555]">Workspace</span>
          <img src={imgChevronRight} alt="" className="w-1.5 h-2 opacity-50" />
          <span className="text-xs font-semibold font-mono tracking-[0.6px] uppercase text-[#3525cd]">Settings</span>
        </div>
        <h1 className="text-[28px] font-bold tracking-[-0.7px] text-[#131b2e] mt-1 mb-6">Settings</h1>

        {readOnly && (
          <div className="mb-6 bg-[#fdf0d8] text-[#9a6b00] text-sm px-4 py-3 rounded-xl">
            You're viewing settings in <span className="font-semibold">read-only</span> mode. Ask an admin or owner
            to make changes to this workspace.
          </div>
        )}

        {loadError && (
          <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl flex items-center justify-between">
            {loadError}
            <button onClick={load} className="font-semibold underline">Retry</button>
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-10 text-center text-sm text-[#464555]">
            Loading settings...
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Workspace */}
            {canManage && (
              <form onSubmit={handleRenameWorkspace} className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-6">
                <h2 className="font-bold text-[#131b2e] mb-1">Workspace</h2>
                <p className="text-xs text-[#464555] mb-5">
                  The name shown across the app, in the sidebar, and on invites. Renaming doesn't affect your data.
                </p>

                {workspaceError && (
                  <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{workspaceError}</div>
                )}

                <div className="flex items-end gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <Field
                      label="Workspace Name"
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2 pb-0.5">
                    {workspaceSaved && <span className="text-xs font-semibold text-[#006c49]">Saved ✓</span>}
                    <button
                      type="submit"
                      disabled={workspaceSaving}
                      className="bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {workspaceSaving ? 'Saving...' : 'Save Name'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Business Profile */}
            <form onSubmit={handleSaveProfile} className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-6">
              <h2 className="font-bold text-[#131b2e] mb-1">Business Profile</h2>
              <p className="text-xs text-[#464555] mb-5">
                Shown on every invoice you send, including the PDF export.
              </p>

              {profileError && (
                <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{profileError}</div>
              )}

              <fieldset disabled={readOnly} className="border-0 p-0 m-0 min-w-0">
              <div className="grid sm:grid-cols-2 gap-4 mb-5">
                <Field
                  label="Business Name"
                  required
                  value={profile.businessName}
                  onChange={(e) => updateProfileField('businessName', e.target.value)}
                />
                <Field
                  label="Business Email"
                  type="email"
                  value={profile.email || ''}
                  onChange={(e) => updateProfileField('email', e.target.value)}
                />
                <Field
                  label="Business Phone"
                  value={profile.phone || ''}
                  onChange={(e) => updateProfileField('phone', e.target.value)}
                />
                <Field
                  label="Tax Number"
                  value={profile.taxNumber || ''}
                  onChange={(e) => updateProfileField('taxNumber', e.target.value)}
                />
              </div>

              <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-3">Address</p>
              <div className="flex flex-col gap-4 mb-5">
                <Field
                  label="Street Address"
                  value={profile.street || ''}
                  onChange={(e) => updateProfileField('street', e.target.value)}
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="City" value={profile.city || ''} onChange={(e) => updateProfileField('city', e.target.value)} />
                  <Field label="State" value={profile.state || ''} onChange={(e) => updateProfileField('state', e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Zip Code" value={profile.zipCode || ''} onChange={(e) => updateProfileField('zipCode', e.target.value)} />
                  <Field label="Country" value={profile.country || ''} onChange={(e) => updateProfileField('country', e.target.value)} />
                </div>
              </div>

              <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-3">
                Bank / Payout Details <span className="text-[#9694a8]">(shown on invoices when filled in)</span>
              </p>
              <div className="grid sm:grid-cols-3 gap-4 mb-5">
                <Field label="Bank Name" value={profile.bankName || ''} onChange={(e) => updateProfileField('bankName', e.target.value)} />
                <Field label="Routing Number" value={profile.routingNumber || ''} onChange={(e) => updateProfileField('routingNumber', e.target.value)} />
                <Field label="Account Number" value={profile.accountNumber || ''} onChange={(e) => updateProfileField('accountNumber', e.target.value)} />
              </div>

              <Field
                label="Logo URL"
                placeholder="https://..."
                value={profile.logoUrl || ''}
                onChange={(e) => updateProfileField('logoUrl', e.target.value)}
              />
              </fieldset>

              <div className="pt-5">
                {canWrite ? (
                  <div className="flex items-center gap-3 justify-end">
                    {profileSaved && <span className="text-xs font-semibold text-[#006c49]">Saved ✓</span>}
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {profileSaving ? 'Saving...' : 'Save Business Profile'}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[#9694a8]">Read-only for your role.</p>
                )}
              </div>
            </form>

            {/* Invoicing & Notifications */}
            <form onSubmit={handleSaveSettings} className="bg-white rounded-xl shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] p-6">
              <h2 className="font-bold text-[#131b2e] mb-1">Invoicing Defaults</h2>
              <p className="text-xs text-[#464555] mb-5">
                Applied to new invoices and used throughout Reports.
              </p>

              {settingsError && (
                <div className="mb-4 bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">{settingsError}</div>
              )}

              <fieldset disabled={readOnly} className="border-0 p-0 m-0 min-w-0">
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium tracking-wide uppercase text-[#464555]">Currency</label>
                  <select
                    value={settings.currency}
                    onChange={(e) => updateSettingsField('currency', e.target.value)}
                    className="w-full h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm text-[#131b2e] focus:outline-none focus:ring-2 focus:ring-[#4f46e5]"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <Field
                  label="Invoice Number Prefix"
                  value={settings.invoicePrefix}
                  onChange={(e) => updateSettingsField('invoicePrefix', e.target.value)}
                />
                <Field
                  label="Default Payment Terms (days)"
                  type="number"
                  min="0"
                  value={settings.defaultPaymentTerms}
                  onChange={(e) => updateSettingsField('defaultPaymentTerms', e.target.value)}
                />
                <Field
                  label="Default Tax Rate (%)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.defaultTaxRate}
                  onChange={(e) => updateSettingsField('defaultTaxRate', e.target.value)}
                />
              </div>

              <p className="text-xs font-semibold tracking-wide uppercase text-[#464555] mb-1">Notifications</p>
              <div className="divide-y divide-gray-100">
                <Toggle
                  label="Email notifications"
                  description="General account and activity emails."
                  checked={settings.emailNotifications}
                  onChange={(v) => updateSettingsField('emailNotifications', v)}
                />
                <Toggle
                  label="Payment notifications"
                  description="Get notified when an invoice is marked as paid."
                  checked={settings.paymentNotifications}
                  onChange={(v) => updateSettingsField('paymentNotifications', v)}
                />
                <Toggle
                  label="Reminder notifications"
                  description="Heads-up when invoices are approaching or past due."
                  checked={settings.reminderNotifications}
                  onChange={(v) => updateSettingsField('reminderNotifications', v)}
                />
              </div>
              </fieldset>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${emailStatus?.configured ? 'bg-[#e5f7ee] text-[#0e7a41]' : 'bg-[#fdf0d8] text-[#9a6b00]'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${emailStatus?.configured ? 'bg-[#0e7a41]' : 'bg-[#9a6b00]'}`} />
                  SMTP {emailStatus?.configured ? 'configured' : 'not configured'}
                </span>
                <span className="text-xs text-[#9694a8]">
                  Send invoices &amp; reminders from the invoice page and Dashboard. Without SMTP credentials emails are
                  simulated and logged instead of dispatched.
                </span>
              </div>

              <div className="pt-5">
                {canWrite ? (
                  <div className="flex items-center gap-3 justify-end">
                    {settingsSaved && <span className="text-xs font-semibold text-[#006c49]">Saved ✓</span>}
                    <button
                      type="submit"
                      disabled={settingsSaving}
                      className="bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {settingsSaving ? 'Saving...' : 'Save Invoicing Defaults'}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[#9694a8]">Read-only for your role.</p>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}