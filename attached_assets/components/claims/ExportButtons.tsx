import React from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import { Claim } from './ClaimsPage';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface ExportButtonsProps {
  claims: Claim[];
}

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
  }
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({ claims }) => {
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      claims.map(claim => ({
        'Order ID': claim.orderId,
        'Marketplace': claim.marketplace,
        'Issue Type': claim.issueType,
        'Status': claim.status,
        'Claim Value': claim.claimValue,
        'Days Open': claim.daysOpen,
        'Created At': claim.createdAt,
        'Priority': claim.priority || 'Normal',
        'Auto Flagged': claim.autoFlagged ? 'Yes' : 'No'
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Claims');

    const timestamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `claims-report-${timestamp}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Add header
    doc.setFontSize(18);
    doc.text('Claims Tracker Report', 20, 20);
    
    // Add summary
    doc.setFontSize(12);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 35);
    doc.text(`Total Claims: ${claims.length}`, 20, 45);
    
    const resolvedCount = claims.filter(c => c.status === 'Resolved').length;
    const pendingCount = claims.filter(c => c.status === 'Pending').length;
    const totalValue = claims.reduce((sum, c) => sum + c.claimValue, 0);
    
    doc.text(`Resolved: ${resolvedCount} | Pending: ${pendingCount}`, 20, 55);
    doc.text(`Total Claim Value: ₹${totalValue.toLocaleString()}`, 20, 65);

    // Add table
    const tableData = claims.map(claim => [
      claim.orderId,
      claim.marketplace,
      claim.issueType,
      claim.status,
      `₹${claim.claimValue}`,
      `${claim.daysOpen} days`
    ]);

    doc.autoTable({
      head: [['Order ID', 'Marketplace', 'Issue Type', 'Status', 'Value', 'Days Open']],
      body: tableData,
      startY: 75,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] }
    });

    const timestamp = new Date().toISOString().split('T')[0];
    doc.save(`claims-report-${timestamp}.pdf`);
  };

  return (
    <div className="flex space-x-2">
      <button
        onClick={exportToExcel}
        className="claim-export-button flex items-center space-x-2"
        title="Export to Excel"
      >
        <FileSpreadsheet className="w-4 h-4" />
        <span className="hidden sm:inline">Excel</span>
      </button>
      
      <button
        onClick={exportToPDF}
        className="claim-export-button flex items-center space-x-2"
        title="Export to PDF"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">PDF</span>
      </button>
    </div>
  );
};