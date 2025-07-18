
import { NavLink } from "react-router-dom";
import { cn } from "../lib/utils";

const menu = [
  { name: "Dashboard", path: "/dashboard" },
  { name: "Analytics", path: "/analytics" },
  { header: "Reconciliation" },
  { name: "Payments", path: "/reconciliation/payments" },
  { name: "Returns", path: "/reconciliation/returns" },
  { name: "Rate Cards", path: "/rate-cards" },
  { header: "Tickets" },
  { name: "All Tickets", path: "/tickets/all" },
  { name: "Transactions", path: "/transactions" },
  { name: "AI Insights", path: "/ai-insights" },
  { name: "Settings", path: "/settings" },
  { name: "Support", path: "/support" }
];

export default function Sidebar() {
  return (
    <div className="w-64 bg-white border-r p-4">
      <div className="font-bold text-green-600 mb-4">ReconEasy</div>
      <ul className="space-y-2">
        {menu.map((item, idx) =>
          item.header ? (
            <li key={idx} className="text-gray-400 uppercase text-xs mt-4">{item.header}</li>
          ) : (
            <li key={idx}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  cn("block px-4 py-2 rounded hover:bg-green-100", isActive && "bg-green-200")
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
