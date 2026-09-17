import { useAuth } from '../context/AuthContext';

const imgSearchIcon = "https://www.figma.com/api/mcp/asset/43fbf5d1-f4ec-4e81-ad71-b7cdabc39b32.svg";
const imgBellIcon = "https://www.figma.com/api/mcp/asset/a5ba9df9-fe7a-42b3-bc1e-30920939bc2a.svg";
const imgHelpIcon = "https://www.figma.com/api/mcp/asset/00cf93c1-f1c2-4326-bdd2-b96f39af8db3.svg";
const imgChevron = "https://www.figma.com/api/mcp/asset/af9cfe37-009e-4c4c-9a8c-17f1d885ea5b.svg";

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function TopBar() {
  const { user } = useAuth();

  return (
    <header className="fixed top-0 left-0 md:left-64 right-0 h-16 backdrop-blur-md bg-[rgba(250,248,255,0.9)] border-b border-[rgba(199,196,216,0.3)] shadow-[0px_1px_8px_0px_rgba(15,23,42,0.04)] flex items-center justify-between px-4 md:px-6 z-30">
      <div className="relative flex-1 max-w-md hidden sm:block">
        <img src={imgSearchIcon} alt="" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-60" />
        <input
          type="text"
          placeholder="Search invoices, clients, or amounts..."
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-[rgba(199,196,216,0.4)] bg-white text-sm text-[#131b2e] placeholder:text-[rgba(70,69,85,0.7)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
          <img src={imgBellIcon} alt="" className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ba1a1a]" />
        </button>
        <button className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
          <img src={imgHelpIcon} alt="" className="w-4 h-4" />
        </button>
        <div className="w-px h-6 bg-[rgba(199,196,216,0.4)] mx-1" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#e2e7ff] flex items-center justify-center">
            <span className="text-xs font-semibold text-[#3525cd]">{initials(user?.name)}</span>
          </div>
          <img src={imgChevron} alt="" className="w-2 h-1.5 opacity-60 hidden sm:block" />
        </div>
      </div>
    </header>
  );
}