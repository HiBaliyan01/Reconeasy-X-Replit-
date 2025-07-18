
import { NavLink } from "react-router-dom";
import { cn } from "../utils/cn";

const tabs = [
  { name: "Dashboard", path: "/" },
  { name: "Reconciliation", path: "/reconciliation" },
  { name: "Rate Cards", path: "/rate-cards" },
  { name: "Settlements", path: "/settlements" },
  { name: "Transactions", path: "/transactions" },
  { name: "Returns", path: "/returns" },
  { name: "Analytics", path: "/analytics" },
  { name: "AI", path: "/ai" },
  { name: "Settings", path: "/settings" },
];

export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-6">ReconEasy</h1>
      <nav className="flex flex-col gap-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              cn(
                "block px-4 py-2 rounded hover:bg-gray-700 transition",
                isActive ? "bg-gray-700 font-semibold" : "text-gray-300"
              )
            }
          >
            {tab.name}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
