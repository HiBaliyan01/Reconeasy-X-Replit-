import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { ThemeProvider } from "./ThemeProvider";

export default function EnhancedLayout() {
  return (
    <ThemeProvider>
      <div className="flex h-screen bg-gray-50 dark:bg-slate-900">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </ThemeProvider>
  );
}