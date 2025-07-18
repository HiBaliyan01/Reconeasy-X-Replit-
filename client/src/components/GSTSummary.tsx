import React, { useState } from 'react';
import { Download, FileText, Calendar, TrendingUp, DollarSign, Receipt } from 'lucide-react';

interface GSTSummaryProps {
  gstData: {
    gstin: string;
    total_taxable: number;
    total_gst: number;
  };
}

export default function GSTSummary({ gstData }: GSTSummaryProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState('current_month');

  const downloadGSTReport = async () => {
    setIsDownloading(true);
    try {
      // Simulate API call for GST report generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create mock CSV data
      const csvData = [
        ['Order ID', 'UTR', 'Marketplace', 'Taxable Amount', 'GST Rate', 'GST Amount', 'Date'],
        ['ORD-2024-001', 'UTR202401001', 'Myntra', '1237.14', '5.0', '61.86', '2024-01-15'],
        ['ORD-2024-002', 'UTR202401002', 'Amazon', '2380.95', '5.0', '119.05', '2024-01-16'],
        ['ORD-2024-003', 'UTR202401003', 'Flipkart', '1808.57', '5.0', '90.43', '2024-01-17']
      ];
      
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gst_report_${reportPeriod}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      alert('Failed to download GST report. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">GST Summary</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Tax compliance and reporting</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={reportPeriod}
            onChange={(e) => setReportPeriod(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          >
            <option value="current_month">Current Month</option>
            <option value="last_month">Last Month</option>
            <option value="current_quarter">Current Quarter</option>
            <option value="last_quarter">Last Quarter</option>
            <option value="current_year">Current Year</option>
          </select>
          
          <button
            onClick={downloadGSTReport}
            disabled={isDownloading}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download GST Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* GSTIN */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <FileText className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">GSTIN</span>
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            {gstData.gstin}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Registered GST Identification Number
          </p>
        </div>

        {/* Taxable Value */}
        <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Taxable Value</span>
          </div>
          <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
            ₹{gstData.total_taxable.toLocaleString()}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
            Total sales minus returns
          </p>
        </div>

        {/* GST Collected */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">GST Collected</span>
          </div>
          <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
            ₹{gstData.total_gst.toLocaleString()}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            5% GST on taxable sales
          </p>
        </div>
      </div>

      {/* Additional Info */}
      <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <div className="flex items-start space-x-3">
          <Calendar className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
              GST Filing Reminder
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Next GST return filing due: <strong>20th of next month</strong>. 
              Download your report and file GSTR-1 and GSTR-3B on time to avoid penalties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}