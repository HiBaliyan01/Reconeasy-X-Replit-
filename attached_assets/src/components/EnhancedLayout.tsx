
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function EnhancedLayout() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
