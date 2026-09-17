import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const imgLogo = "https://www.figma.com/api/mcp/asset/83e7cda2-1fde-4e09-aab6-d1905568cc90.png";
const imgPlusIcon = "https://www.figma.com/api/mcp/asset/aef0833e-f733-4e6f-87af-dec6a1e11336.svg";
const imgInvoicesIcon = "https://www.figma.com/api/mcp/asset/1028e1b6-0ae9-4d68-ae52-35119551ee2a.svg";
const imgClientsIcon = "https://www.figma.com/api/mcp/asset/932315ee-9fa5-4f1f-b82e-7aff5ecdfb3b.svg";
const imgReportsIcon = "https://www.figma.com/api/mcp/asset/8d447373-b0fa-4497-a88e-0957fe0a951c.svg";
const imgSettingsIcon = "https://www.figma.com/api/mcp/asset/d9d332a3-93e5-4d34-ae92-ee4e0500e08a.svg";
const imgChevron = "https://www.figma.com/api/mcp/asset/176d757b-ed9a-42af-afd7-576f39dbcd6d.svg";

const navItems = [
  { to: '/dashboard', label: 'Invoices', icon: imgInvoicesIcon },
  { to: '/clients', label: 'Clients', icon: imgClientsIcon },
  { to: '/reports', label: 'Reports', icon: imgReportsIcon },
  { to: '/settings', label: 'Settings', icon: imgSettingsIcon },
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
  const { user } = useAuth();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-[rgba(199,196,216,0.4)] flex-col justify-between z-40">
      <div>
        <div className="h-16 border-b border-[rgba(199,196,216,0.3)] flex items-center gap-2 px-4">
          <span className="font-bold text-[#131b2e] tracking-[-0.4px]">Billflow</span>
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