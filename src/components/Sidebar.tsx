
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
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
    <div className="w-64 bg-white border-r shadow-sm p-4 space-y-3">
      <div className="font-bold text-lg px-2 mb-4">ReconEasy</div>
      {navItems.map((item) => {
        const isActive = location.pathname.startsWith(item.href);
        return (
          <div key={item.name}>
            <Link
              to={item.href}
              className={cn("flex items-center px-3 py-2 rounded-md transition hover:bg-gray-100", {
                "bg-primary text-white": isActive
              })}
            >
              <item.icon className="h-4 w-4 mr-2" />
              {item.name}
            </Link>
            {isActive && item.subRoutes?.length && (
              <div className="pl-6">
                {item.subRoutes.map((sub) => (
                  <Link
                    key={sub.name}
                    to={sub.href}
                    className={cn("block py-1 text-sm hover:text-primary", {
                      "text-primary font-medium": location.pathname === sub.href
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
