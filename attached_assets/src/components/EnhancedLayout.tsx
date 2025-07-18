
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";

export default function EnhancedLayout() {
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto h-screen bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
