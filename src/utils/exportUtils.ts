// Export utility functions for CSV and PDF generation

export const exportTableToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  try {
    // Get headers from the first object
    const headers = Object.keys(data[0]);
    
    // Create CSV content
    const csvContent = [
      headers.join(','), // Header row
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Handle values that might contain commas or quotes
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        }).join(',')
      )
    ].join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw new Error('Failed to export CSV file');
  }
};

export const exportTableToPDF = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  try {
    // For now, we'll create a simple HTML table and use the browser's print functionality
    // In a real implementation, you might want to use a library like jsPDF or Puppeteer
    
    const headers = Object.keys(data[0]);
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${filename}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <h1>${filename.replace(/_/g, ' ').toUpperCase()}</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <table>
            <thead>
              <tr>
                ${headers.map(header => `<th>${header.replace(/_/g, ' ').toUpperCase()}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  ${headers.map(header => `<td>${row[header] || ''}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    // Open in new window and trigger print
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Wait for content to load then print
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    } else {
      throw new Error('Unable to open print window');
    }
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw new Error('Failed to export PDF file');
  }
};

// Helper function to format data for export
export const formatDataForExport = (data: any[], type: 'csv' | 'pdf' = 'csv') => {
  return data.map(item => {
    const formatted: any = {};
    
    Object.keys(item).forEach(key => {
      let value = item[key];
      
      // Format specific data types
      if (key.includes('amount') && typeof value === 'number') {
        formatted[key] = `₹${value.toLocaleString()}`;
      } else if (key.includes('date') && value) {
        formatted[key] = new Date(value).toLocaleDateString();
      } else if (typeof value === 'boolean') {
        formatted[key] = value ? 'Yes' : 'No';
      } else {
        formatted[key] = value;
      }
    });
    
    return formatted;
  });
};