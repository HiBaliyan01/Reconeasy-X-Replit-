
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import {
  Home,
  BarChart3,
  FileText,
  RotateCcw,
  CreditCard,
  LifeBuoy,
  Settings,
  Brain,
  Activity,
  Receipt,
  TrendingUp
} from "lucide-react";

const navItems = [
  { 
    name: "Dashboard", 
    icon: Home, 
    href: "/", 
    description: "Overview & key metrics",
    bgColor: "bg-teal-500",
    count: null
  },
  { 
    name: "AI Insights", 
    icon: Brain, 
    href: "/ai-insights", 
    description: "AI-powered insights",
    bgColor: "bg-orange-500",
    count: 4
  },
  { 
    name: "Settlements", 
    icon: Receipt, 
    href: "/reconciliation/settlements", 
    description: "Payment settlements",
    bgColor: "bg-gray-400",
    count: 15
  },
  { 
    name: "Transactions", 
    icon: CreditCard, 
    href: "/reconciliation/transactions", 
    description: "All transactions",
    bgColor: "bg-gray-400",
    count: "1.2k"
  },
  { 
    name: "Returns", 
    icon: RotateCcw, 
    href: "/reconciliation/returns", 
    description: "Return analytics",
    bgColor: "bg-gray-400",
    count: 45
  },
  { 
    name: "Rate Cards", 
    icon: FileText, 
    href: "/rate-cards", 
    description: "Marketplace fee configuration",
    bgColor: "bg-gray-400",
    count: null
  },
  { 
    name: "Support", 
    icon: LifeBuoy, 
    href: "/support", 
    description: "Live chat & management",
    bgColor: "bg-gray-400",
    count: 6
  },
  { 
    name: "Settings", 
    icon: Settings, 
    href: "/settings", 
    description: "System configuration",
    bgColor: "bg-gray-400",
    count: null
  }
];

export function Sidebar() {
  const location = useLocation();
  
  return (
    <div className="w-80 bg-gray-50 p-4 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center mr-3">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">ReconEasy</h1>
        </div>
        
        {/* Summary Card */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium text-teal-800">Today's Summary</span>
            <TrendingUp className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex justify-between text-xs text-teal-700">
            <span>₹2.4L</span>
            <span>95%</span>
          </div>
          <div className="flex justify-between text-xs text-teal-600">
            <span>Processed</span>
            <span>Auto-matched</span>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <div className="space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || (item.href !== '/' && location.pathname.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg transition-all duration-200",
                isActive 
                  ? "bg-teal-500 text-white shadow-md" 
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              )}
            >
              <div className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center mr-3",
                  isActive ? "bg-white/20" : item.bgColor
                )}>
                  <Icon className={cn("w-4 h-4", isActive ? "text-white" : "text-white")} />
                </div>
                <div>
                  <div className="font-medium text-sm">{item.name}</div>
                  <div className={cn(
                    "text-xs",
                    isActive ? "text-white/80" : "text-gray-500"
                  )}>
                    {item.description}
                  </div>
                </div>
              </div>
              {item.count && (
                <span className={cn(
                  "text-xs px-2 py-1 rounded-full",
                  isActive 
                    ? "bg-white/20 text-white" 
                    : "bg-gray-200 text-gray-600"
                )}>
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* System Health */}
      <div className="mt-6 bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">System Health</span>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
            <span className="text-xs text-green-600">Online</span>
          </div>
        </div>
        <div className="space-y-1 text-xs text-gray-600">
          <div className="flex justify-between">
            <span>API Status</span>
            <span className="text-green-600">Online</span>
          </div>
          <div className="flex justify-between">
            <span>Last Sync</span>
            <span>2 min ago</span>
          </div>
          <div className="flex justify-between">
            <span>Accuracy</span>
            <span>98.2%</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6">
        <div className="text-sm font-medium text-gray-700 mb-3">Quick Actions</div>
        <div className="flex justify-between">
          <button className="flex flex-col items-center p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <BarChart3 className="w-5 h-5 text-gray-600 mb-1" />
            <span className="text-xs text-gray-600">View Analytics</span>
          </button>
          <button className="flex flex-col items-center p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <LifeBuoy className="w-5 h-5 text-gray-600 mb-1" />
            <span className="text-xs text-gray-600">Help Center</span>
          </button>
        </div>
      </div>
    </div>
  );
}
