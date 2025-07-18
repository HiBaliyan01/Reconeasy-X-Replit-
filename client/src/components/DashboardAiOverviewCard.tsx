import { useEffect, useState } from "react";
import { AlertTriangle, PieChart } from "lucide-react";
import { ResponsiveContainer, PieChart as Chart, Pie, Cell, Tooltip } from "recharts";

const COLORS = ["#10B981", "#6366F1", "#F59E0B", "#EF4444"];

const mockCategoryRevenue = [
  { name: "Apparel", value: 410000 },
  { name: "Electronics", value: 270000 },
  { name: "Footwear", value: 150000 },
  { name: "Accessories", value: 90000 },
];

const mockAlerts = [
  { id: 1, text: "Discrepancy spike detected in Myntra – Jul 9-12", level: "high" },
  { id: 2, text: "RTO fraud trend in Tier-2 cities", level: "medium" },
  { id: 3, text: "3 SKUs flagged for low payout vs rate card" },
];

export function DashboardAiOverviewCard() {
  const [alerts, setAlerts] = useState(mockAlerts);
  const [categories, setCategories] = useState(mockCategoryRevenue);

  return (
    <div className="bg-white dark:bg-slate-800 shadow rounded-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-bold mb-3 flex items-center text-slate-900 dark:text-slate-100">
          <AlertTriangle className="w-5 h-5 text-red-500 mr-2" />
          AI Flagged Insights
        </h3>
        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
          {alerts.map((a) => (
            <li key={a.id} className="flex gap-2 items-start">
              <span className="mt-0.5 w-2 h-2 rounded-full bg-red-500"></span>
              <span>{a.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-3 flex items-center text-slate-900 dark:text-slate-100">
          <PieChart className="w-5 h-5 text-indigo-500 mr-2" />
          Revenue by Category
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <Chart>
              <Pie
                data={categories}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={60}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {categories.map((_, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} />
            </Chart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}