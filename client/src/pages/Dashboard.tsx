import { TrendingUp, IndianRupee, CheckCircle, AlertTriangle, Users, BarChart3 } from "lucide-react";

const stats = [
  {
    title: "Total Revenue",
    value: "₹2,45,678",
    change: "+12.5%",
    trend: "up",
    icon: IndianRupee,
    color: "bg-green-500"
  },
  {
    title: "Settlements",
    value: "1,234",
    change: "+5.2%", 
    trend: "up",
    icon: CheckCircle,
    color: "bg-blue-500"
  },
  {
    title: "Pending",
    value: "45",
    change: "-8.1%",
    trend: "down", 
    icon: AlertTriangle,
    color: "bg-orange-500"
  },
  {
    title: "Auto-match Rate",
    value: "87.2%",
    change: "+2.3%",
    trend: "up",
    icon: BarChart3,
    color: "bg-purple-500"
  }
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome back! Here's what's happening with your reconciliation.</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Export Report
          </button>
          <button className="px-4 py-2 bg-[#F6AD55] text-white rounded-lg hover:bg-[#E09F4A] transition-colors">
            New Settlement
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const IconComponent = stat.icon;
          return (
            <div key={stat.title} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <div className="flex items-center mt-2">
                    <TrendingUp className={`w-4 h-4 mr-1 ${stat.trend === 'up' ? 'text-green-500' : 'text-red-500'}`} />
                    <span className={`text-sm font-medium ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {stat.change}
                    </span>
                    <span className="text-gray-500 text-sm ml-1">vs last month</span>
                  </div>
                </div>
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <IconComponent className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts and Tables Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
            <select className="text-sm border border-gray-300 rounded-lg px-3 py-1">
              <option>Last 7 days</option>
              <option>Last 30 days</option>
              <option>Last 90 days</option>
            </select>
          </div>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-400" />
              <p>Chart visualization coming soon</p>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Recent Activity</h3>
          <div className="space-y-4">
            {[
              { action: "Settlement processed", amount: "₹12,500", time: "2 minutes ago", status: "success" },
              { action: "Discrepancy detected", amount: "₹3,200", time: "15 minutes ago", status: "warning" },
              { action: "Auto-match completed", amount: "₹8,900", time: "1 hour ago", status: "success" },
              { action: "Manual review required", amount: "₹5,600", time: "2 hours ago", status: "pending" }
            ].map((activity, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.status === 'success' ? 'bg-green-500' : 
                    activity.status === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-900">{activity.amount}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}