import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Home, BarChart2, ListChecks, RotateCcw, RefreshCcw, Tag, Zap, Settings } from "lucide-react";
import { cn } from "../lib/utils";

const navItems = [
  { label: "Dashboard", icon: Home, path: "/dashboard" },
  { label: "Analytics", icon: BarChart2, path: "/analytics" },
  { label: "Reconciliation", icon: ListChecks, path: "/reconciliation" },
  { label: "Rate Cards", icon: Tag, path: "/rate-cards" },
  { label: "Settlements", icon: RefreshCcw, path: "/settlements" },
  { label: "Transactions", icon: RotateCcw, path: "/transactions" },
  { label: "Returns", icon: RotateCcw, path: "/returns" },
  { label: "AI Insights", icon: Zap, path: "/ai-insights" },
  { label: "Settings", icon: Settings, path: "/settings" },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen w-screen text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-[#0C1A2D] text-white p-4 flex flex-col">
        <div className="flex items-center gap-2 text-2xl font-bold mb-8">
          <div className="w-7 h-7 bg-[#F6AD55] rounded-lg flex items-center justify-center text-[#0C1A2D] font-bold text-sm">
            R
          </div>
          ReconEasy
        </div>
        <nav className="flex-1">
          {navItems.map(({ label, icon: Icon, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={cn(
                "flex items-center w-full gap-3 px-4 py-2 mb-2 rounded-lg hover:bg-[#1B2B44] transition-colors",
                isActive(path) && "bg-[#1B2B44] text-[#F6AD55]"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-[#F7FAFC] p-8">
        <Outlet />
      </main>
    </div>
  );
}