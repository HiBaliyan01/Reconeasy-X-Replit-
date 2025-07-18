import { NavLink } from "react-router-dom";
import { 
  Home, 
  BarChart3, 
  GitCompare, 
  CreditCard, 
  FileText, 
  ArrowLeftRight, 
  RotateCcw, 
  Brain, 
  Settings 
} from "lucide-react";
import { cn } from "../lib/utils";

const tabs = [
  { name: "Dashboard", path: "/dashboard", icon: Home },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Reconciliation", path: "/reconciliation", icon: GitCompare },
  { name: "Rate Cards", path: "/rate-cards", icon: CreditCard },
  { name: "Settlements", path: "/settlements", icon: FileText },
  { name: "Transactions", path: "/transactions", icon: ArrowLeftRight },
  { name: "Returns", path: "/returns", icon: RotateCcw },
  { name: "AI Insights", path: "/ai-insights", icon: Brain },
  { name: "Settings", path: "/settings", icon: Settings },
];

export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-gray-900 dark:bg-slate-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-6 text-green-400">ReconEasy</h1>
      <nav className="flex flex-col gap-2">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-700 dark:hover:bg-slate-700 transition-colors",
                  isActive ? "bg-green-600 font-semibold text-white" : "text-gray-300 hover:text-white"
                )
              }
            >
              <IconComponent className="w-5 h-5" />
              {tab.name}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}