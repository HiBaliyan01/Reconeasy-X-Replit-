
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import {
  LayoutDashboard,
  BarChart,
  RefreshCw,
  FileBarChart,
  BadgePercent,
  LifeBuoy,
  Settings,
  Brain,
  Ticket
} from "lucide-react";

const navItems = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/" },
  { name: "AI Insights", icon: Brain, href: "/ai-insights" },
  {
    name: "Reconciliation",
    icon: RefreshCw,
    href: "/reconciliation",
    subRoutes: [
      { name: "Payments", href: "/reconciliation/payments" },
      { name: "Returns", href: "/reconciliation/returns" },
      { name: "Transactions", href: "/reconciliation/transactions" }
    ]
  },
  { name: "Rate Cards", icon: BadgePercent, href: "/rate-cards" },
  { name: "Tickets", icon: Ticket, href: "/tickets" },
  { name: "Settings", icon: Settings, href: "/settings" },
  { name: "Support", icon: LifeBuoy, href: "/support" }
];

export function Sidebar() {
  const location = useLocation();
  return (
    <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 shadow-sm p-4 space-y-3">
      <div className="font-bold text-lg px-2 mb-4 text-slate-900 dark:text-slate-100">ReconEasy</div>
      {navItems.map((item) => {
        const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
        return (
          <div key={item.name}>
            <Link
              to={item.href}
              className={cn("flex items-center px-3 py-2 rounded-md transition-colors duration-200", {
                "bg-blue-600 text-white hover:bg-blue-700": isActive,
                "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700": !isActive
              })}
            >
              <item.icon className="h-4 w-4 mr-2" />
              {item.name}
            </Link>
            {isActive && item.subRoutes?.length && (
              <div className="pl-6 mt-2 space-y-1">
                {item.subRoutes.map((sub) => (
                  <Link
                    key={sub.name}
                    to={sub.href}
                    className={cn("block py-2 px-2 text-sm rounded-md transition-colors duration-200", {
                      "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-medium": location.pathname === sub.href,
                      "text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700": location.pathname !== sub.href
                    })}
                  >
                    {sub.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
