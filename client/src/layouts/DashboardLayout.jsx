import Sidebar from '../components/Sidebar';
import TopBar from '../components/Topbar';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <Sidebar />
      <TopBar />
      <main className="md:pl-64 pt-16">
        <div className="px-4 md:px-6 py-4 max-w-[1400px] mx-auto">{children}</div>
      </main>
    </div>
  );
}