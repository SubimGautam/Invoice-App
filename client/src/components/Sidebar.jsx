import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

// Sidebar icons — uploaded into src/assets.
import imgDashboardIcon from '../assets/Dashboard.png';
import imgProductsIcon from '../assets/Product.png';
import imgClientsIcon from '../assets/Client.png';
import imgPaymentsIcon from '../assets/Payments.svg';
import imgRecurringIcon from '../assets/Recurring.png';
import imgReportsIcon from '../assets/Reports.png';
import imgSettingsIcon from '../assets/Setting.png';
import imgMembersIcon from '../assets/Team and member.png';
import { PlusIcon, ChevronDownIcon, DocumentIcon } from './Icons';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: imgDashboardIcon },
  // Estimates has no PNG export in assets/, so it uses the inline DocumentIcon
  // (currentColor, so it matches the active/inactive text color exactly).
  { to: '/estimates', label: 'Estimates', icon: DocumentIcon },
  { to: '/products', label: 'Products', icon: imgProductsIcon },
  { to: '/clients', label: 'Clients', icon: imgClientsIcon },
  { to: '/payments', label: 'Payments', icon: imgPaymentsIcon },
  { to: '/recurring', label: 'Recurring', icon: imgRecurringIcon },
  { to: '/reports', label: 'Reports', icon: imgReportsIcon },
  { to: '/settings', label: 'Settings', icon: imgSettingsIcon },
];

// Team admin lives one level deeper (it manages the workspace itself).
const manageItems = [
  { to: '/members', label: 'Team & Members', icon: imgMembersIcon },
];

// A nav icon is either an imported image file (most of the legacy set) or an
// inline SVG component (newer additions). Both get the same box and the same
// opacity so an SVG entry doesn't read heavier than its PNG neighbours.
function NavIcon({ icon: Icon }) {
  if (typeof Icon === 'function') return <Icon className="w-5 h-5 shrink-0 opacity-80" />;
  return <img src={Icon} alt="" className="w-5 h-5 opacity-80" />;
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
            <PlusIcon className="w-2.5 h-2.5" />
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
              <NavIcon icon={item.icon} />
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
                  <NavIcon icon={item.icon} />
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </div>

      <div className="border-t border-[rgba(199,196,216,0.3)] px-4 py-4 flex items-center gap-2">
        <Avatar url={user?.avatarUrl} name={user?.name} sizeClass="w-9 h-9" textClass="text-xs" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#131b2e] truncate">{user?.name || 'Account'}</p>
          <p className="text-xs font-mono text-[#464555] truncate">{user?.email}</p>
        </div>
        <ChevronDownIcon className="w-2 h-3.5 opacity-60" />
      </div>
    </aside>
  );
}