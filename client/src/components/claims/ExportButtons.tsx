// Excel and PDF download buttons

import React from 'react';
import { Download, FileText } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Claim, formatCurrency } from './claimsHelpers';

interface ExportButtonsProps {
  claims: Claim[];
  selectedClaims: string[];
  activeTab: 'Returns' | 'Payments';
  disabled?: boolean;
}

const ExportButtons: React.FC<ExportButtonsProps> = ({ 
  claims, 
  selectedClaims, 
  activeTab, 
  disabled = false 
}) => {
  const getExportData = () => {
    return selectedClaims.length > 0 
      ? claims.filter(claim => selectedClaims.includes(claim.claimId))
      : claims;
  };

  const exportToPDF = () => {
    const dataToExport = getExportData();
    if (dataToExport.length === 0) return;

    const doc = new jsPDF();
    
    // Header with brand styling
    doc.setFontSize(18);
    const headerColor: [number, number, number] = activeTab === 'Returns' ? [20, 184, 166] : [239, 68, 68]; // Teal or Red
    doc.setTextColor(headerColor[0], headerColor[1], headerColor[2]);
    doc.text(`${activeTab} Claims Report`, 20, 20);
    
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(`Generated on ${new Date().toLocaleDateString()}`, 20, 30);
    
    const totalValue = dataToExport.reduce((sum, claim) => sum + claim.claimValue, 0);
    const criticalClaims = dataToExport.filter(claim => claim.age > 15).length;
    const activeCount = dataToExport.filter(claim => 
      claim.status !== 'Resolved' && claim.status !== 'Rejected'
    ).length;
    
    // Summary stats
    doc.text(`Total Claims: ${dataToExport.length}`, 20, 40);
    doc.text(`Active Claims: ${activeCount}`, 120, 40);
    doc.text(`Total Value: ${formatCurrency(totalValue)}`, 20, 50);
    doc.text(`Critical Claims (>15 days): ${criticalClaims}`, 120, 50);
    
    // Table data
    const tableData = dataToExport.map(claim => [
      claim.orderId,
      claim.marketplace,
      claim.issue,
      claim.status,
      formatCurrency(claim.claimValue),
      `${claim.age} days`,
      claim.lastUpdated
    ]);
    
    // Generate table with professional styling
    autoTable(doc, {
      head: [['Order ID', 'Marketplace', 'Issue', 'Status', 'Value', 'Age', 'Updated']],
      body: tableData,
      startY: 65,
      headStyles: { 
        fillColor: headerColor,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      styles: { 
        fontSize: 9,
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      columnStyles: {
        0: { cellWidth: 25, fontStyle: 'bold' },
        1: { cellWidth: 25 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20, halign: 'right' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 25, halign: 'center' }
      }
    });
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Page ${i} of ${pageCount} | ${selectedClaims.length > 0 ? 'Selected' : 'All'} ${activeTab} Claims`, 
        doc.internal.pageSize.width - 80, 
        doc.internal.pageSize.height - 10
      );
    }
    
    const filename = `${activeTab.toLowerCase()}-claims-${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  const exportToExcel = () => {
    const dataToExport = getExportData();
    if (dataToExport.length === 0) return;
    
    // Create CSV content
    const headers = [
      'Claim ID',
      'Order ID', 
      'Marketplace', 
      'Issue', 
      'Claim Value', 
      'Status', 
      'Age (Days)', 
      'Last Updated',
      'Priority'
    ];
    
    const csvContent = [
      headers.join(','),
      ...dataToExport.map(claim => [
        claim.claimId,
        claim.orderId,
        claim.marketplace,
        `"${claim.issue}"`, // Quote to handle commas in issue description
        claim.claimValue,
        claim.status,
        claim.age,
        claim.lastUpdated,
        claim.priority
      ].join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    
    const filename = `${activeTab.toLowerCase()}-claims-${new Date().toISOString().split('T')[0]}.csv`;
    link.download = filename;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const buttonClass = `flex items-center space-x-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`;
  
  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={exportToExcel}
        disabled={disabled}
        className={`${buttonClass} bg-green-600 hover:bg-green-700 focus:ring-green-500`}
        title={`Export ${selectedClaims.length > 0 ? 'selected' : 'all'} ${activeTab.toLowerCase()} claims to Excel`}
      >
        <FileText className="w-4 h-4" />
        <span>Excel</span>
      </button>
      
      <button
        onClick={exportToPDF}
        disabled={disabled}
        className={`${buttonClass} bg-blue-600 hover:bg-blue-700 focus:ring-blue-500`}
        title={`Export ${selectedClaims.length > 0 ? 'selected' : 'all'} ${activeTab.toLowerCase()} claims to PDF`}
      >
        <Download className="w-4 h-4" />
        <span>PDF</span>
      </button>
    </div>
  );
};

export default ExportButtons;