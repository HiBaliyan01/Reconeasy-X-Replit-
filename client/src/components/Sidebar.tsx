import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";

const menu = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Analytics", path: "/analytics" },
  { header: "Reconciliation" },
  { name: "Payments", path: "/reconciliation/payments" },
  { name: "Returns", path: "/reconciliation/returns" },
  { name: "Rate Cards", path: "/rate-cards" },
  { name: "Settlements", path: "/settlements" },
  { header: "Tickets" },
  { name: "All Tickets", path: "/tickets/all" },
  { name: "Transactions", path: "/transactions" },
  { name: "AI Insights", path: "/ai-insights" },
  { name: "Settings", path: "/settings" },
  { name: "Support", path: "/support" }
];

export default function Sidebar() {
  return (
    <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4">
      <div className="font-bold text-green-600 dark:text-green-400 mb-4 text-lg">ReconEasy</div>
      <ul className="space-y-2">
        {menu.map((item, idx) =>
          item.header ? (
            <li key={idx} className="text-gray-400 dark:text-slate-500 uppercase text-xs mt-4 font-semibold">
              {item.header}
            </li>
          ) : (
            <li key={idx}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn(
                    "block px-4 py-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 text-slate-700 dark:text-slate-300 transition-colors",
                    isActive && "bg-green-200 dark:bg-green-900/40 text-green-800 dark:text-green-200 font-medium"
                  )
                }
              >
                {item.name}
              </NavLink>
            </li>
          )
        )}
      </ul>
    </div>
  );
}