import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const imgLogo = "https://www.figma.com/api/mcp/asset/83e7cda2-1fde-4e09-aab6-d1905568cc90.png";
const imgPlusIcon = "https://www.figma.com/api/mcp/asset/aef0833e-f733-4e6f-87af-dec6a1e11336.svg";
const imgInvoicesIcon = "https://www.figma.com/api/mcp/asset/1028e1b6-0ae9-4d68-ae52-35119551ee2a.svg";
const imgClientsIcon = "https://www.figma.com/api/mcp/asset/932315ee-9fa5-4f1f-b82e-7aff5ecdfb3b.svg";
const imgReportsIcon = "https://www.figma.com/api/mcp/asset/8d447373-b0fa-4497-a88e-0957fe0a951c.svg";
const imgSettingsIcon = "https://www.figma.com/api/mcp/asset/d9d332a3-93e5-4d34-ae92-ee4e0500e08a.svg";
const imgChevron = "https://www.figma.com/api/mcp/asset/176d757b-ed9a-42af-afd7-576f39dbcd6d.svg";
// A tiny inline "box" icon for Products (no Figma asset exists for it yet).
const imgProductsIcon =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23818095' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M21 8l-9-5-9 5v8l9 5 9-5V8z'/><path d='M3 8l9 5 9-5'/><path d='M12 13v8'/></svg>"
  );
// A tiny inline "repeat" icon for Recurring (no Figma asset exists for it yet).
const imgRecurringIcon =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23818095' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17 2l4 4-4 4'/><path d='M3 11v-1a4 4 0 0 1 4-4h14'/><path d='M7 22l-4-4 4-4'/><path d='M21 13v1a4 4 0 0 1-4 4H3'/></svg>"
  );
// A tiny inline "users" icon for Members (no Figma asset exists for it yet).
const imgMembersIcon =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23818095' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M23 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/></svg>"
  );

const navItems = [
  { to: '/dashboard', label: 'Invoices', icon: imgInvoicesIcon },
  { to: '/products', label: 'Products', icon: imgProductsIcon },
  { to: '/clients', label: 'Clients', icon: imgClientsIcon },
  { to: '/recurring', label: 'Recurring', icon: imgRecurringIcon },
  { to: '/reports', label: 'Reports', icon: imgReportsIcon },
  { to: '/settings', label: 'Settings', icon: imgSettingsIcon },
];

// Team admin lives one level deeper (it manages the workspace itself).
const manageItems = [
  { to: '/members', label: 'Team & Members', icon: imgMembersIcon },
];

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function Sidebar() {
  const { user, workspace, canManage } = useAuth();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-[rgba(199,196,216,0.4)] flex-col justify-between z-40">
      <div>
        <div className="h-16 border-b border-[rgba(199,196,216,0.3)] flex items-center gap-2 px-4">
          <span className="font-bold text-[#131b2e] tracking-[-0.4px]">Billflow</span>
          {workspace?.name && (
            <span className="ml-auto max-w-32 min-w-0 truncate text-[11px] font-medium text-[#464555] bg-[#f2f3ff] rounded-full px-2 py-0.5">
              {workspace.name}
            </span>
          )}
        </div>

        <div className="p-4">
          <Link
            to="/invoices/new"
            className="w-full flex items-center justify-center gap-1.5 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-[0px_1px_1px_rgba(0,0,0,0.05)] transition-colors"
          >
            <img src={imgPlusIcon} alt="" className="w-2.5 h-2.5" />
            New Invoice
          </Link>
        </div>

        <nav className="flex flex-col gap-1 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors ${
                  isActive
                    ? 'bg-[#eaedff] text-[#3525cd] font-semibold'
                    : 'text-[#464555] hover:bg-gray-50'
                }`
              }
            >
              <img src={item.icon} alt="" className="w-4 h-4 opacity-80" />
              {item.label}
            </NavLink>
          ))}

          {canManage && (
            <>
              <p className="px-4 pt-4 pb-1 text-[11px] font-semibold tracking-wide uppercase text-[#777587]">
                Manage
              </p>
              {manageItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-colors ${
                      isActive
                        ? 'bg-[#eaedff] text-[#3525cd] font-semibold'
                        : 'text-[#464555] hover:bg-gray-50'
                    }`
                  }
                >
                  <img src={item.icon} alt="" className="w-4 h-4 opacity-80" />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </div>

      <div className="border-t border-[rgba(199,196,216,0.3)] px-4 py-4 flex items-center gap-2">
        <div className="w-9 h-9 rounded-full bg-[#e2e7ff] flex items-center justify-center shrink-0">
          <span className="text-xs font-semibold text-[#3525cd]">{initials(user?.name)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#131b2e] truncate">{user?.name || 'Account'}</p>
          <p className="text-xs font-mono text-[#464555] truncate">{user?.email}</p>
        </div>
        <img src={imgChevron} alt="" className="w-2 h-3.5 opacity-60" />
      </div>
    </aside>
  );
}