
import { Sidebar } from "../components/Sidebar";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6">
        <Outlet />
      </div>
    </div>
  );
}
