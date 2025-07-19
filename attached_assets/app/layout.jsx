
import Sidebar from './components/Sidebar';

export default function Layout({ children }) {
  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6 bg-[#F8FAFC]">{children}</main>
    </div>
  );
}
