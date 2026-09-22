import Sidebar from '../components/Sidebar';
import TopBar from '../components/Topbar';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-[#faf8ff]">
      <Sidebar />
      <TopBar />
      <main className="md:pl-64 pt-16">
        <div className="px-5 md:px-8 py-5 max-w-[1600px] mx-auto">{children}</div>
      </main>
    </div>
  );
}