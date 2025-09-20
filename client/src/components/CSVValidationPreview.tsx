import React, { useState, useCallback } from 'react';
import { Upload, Download, CheckCircle, AlertTriangle, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Note: Alert component will be created if needed, using simple div for now

interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationSummary {
  totalRows: number;
  validRows: number;
  errors: ValidationError[];
  warnings: ValidationError[];
}

interface ParsedRow {
  rowNumber: number;
  data: Record<string, string>;
  isValid: boolean;
  errors: ValidationError[];
}

interface CSVValidationPreviewProps {
  onValidDataConfirmed: (validRows: any[]) => void;
  onCancel: () => void;
  initialFile?: File;
}

const CSVValidationPreview: React.FC<CSVValidationPreviewProps> = ({
  onValidDataConfirmed,
  onCancel,
  initialFile
}) => {
  const [csvData, setCsvData] = useState<string>('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [validationSummary, setValidationSummary] = useState<ValidationSummary | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const openFileDialog = () => inputRef.current?.click();

  const requiredFields = [
    'platform_id', 'category_id', 'commission_type', 'effective_from'
  ];

  const validateField = (field: string, value: string, rowNum: number, rowData: Record<string, string>): ValidationError[] => {
    const errors: ValidationError[] = [];

    switch (field) {
      case 'platform_id':
      case 'category_id':
        if (!value || value.trim() === '') {
          errors.push({
            row: rowNum,
            field,
            message: `${field} is required`,
            severity: 'error'
          });
        }
        break;

      case 'commission_type':
        if (!['flat', 'tiered'].includes(value)) {
          errors.push({
            row: rowNum,
            field,
            message: 'commission_type must be "flat" or "tiered"',
            severity: 'error'
          });
        }
        break;

      case 'commission_percent':
        if (rowData.commission_type === 'flat') {
          if (!value || isNaN(parseFloat(value))) {
            errors.push({
              row: rowNum,
              field,
              message: 'commission_percent is required for flat commission type',
              severity: 'error'
            });
          }
        } else if (rowData.commission_type === 'tiered' && value && value.trim()) {
          errors.push({
            row: rowNum,
            field,
            message: 'commission_percent should be blank for tiered commission type',
            severity: 'warning'
          });
        }
        break;

      case 'effective_from':
        if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          errors.push({
            row: rowNum,
            field,
            message: 'effective_from must be in YYYY-MM-DD format',
            severity: 'error'
          });
        }
        break;

      case 'slabs_json':
        if (rowData.commission_type === 'tiered') {
          if (!value || value.trim() === '' || value === '[]') {
            errors.push({
              row: rowNum,
              field,
              message: 'slabs_json is required for tiered commission type',
              severity: 'error'
            });
          } else {
            try {
              const parsed = JSON.parse(value);
              if (!Array.isArray(parsed) || parsed.length === 0) {
                errors.push({
                  row: rowNum,
                  field,
                  message: 'slabs_json must contain at least one slab for tiered commission',
                  severity: 'error'
                });
              } else {
                // Validate slab structure
                parsed.forEach((slab, index) => {
                  if (!slab.hasOwnProperty('min_price') || !slab.hasOwnProperty('commission_percent')) {
                    errors.push({
                      row: rowNum,
                      field,
                      message: `Slab ${index + 1} missing required fields (min_price, commission_percent)`,
                      severity: 'error'
                    });
                  }
                });
              }
            } catch {
              errors.push({
                row: rowNum,
                field,
                message: 'slabs_json contains invalid JSON',
                severity: 'error'
              });
            }
          }
        }
        break;

      case 'fees_json':
        if (value && value.trim() && value !== '[]') {
          try {
            const parsed = JSON.parse(value);
            if (!Array.isArray(parsed)) {
              errors.push({
                row: rowNum,
                field,
                message: 'fees_json must be a valid JSON array',
                severity: 'error'
              });
            } else {
              // Validate fee structure
              parsed.forEach((fee, index) => {
                if (!fee.fee_code || !fee.fee_type || fee.fee_value === undefined) {
                  errors.push({
                    row: rowNum,
                    field,
                    message: `Fee ${index + 1} missing required fields (fee_code, fee_type, fee_value)`,
                    severity: 'error'
                  });
                }
                if (fee.fee_type && !['percent', 'amount'].includes(fee.fee_type)) {
                  errors.push({
                    row: rowNum,
                    field,
                    message: `Fee ${index + 1} fee_type must be "percent" or "amount"`,
                    severity: 'error'
                  });
                }
              });
            }
          } catch {
            errors.push({
              row: rowNum,
              field,
              message: 'fees_json contains invalid JSON',
              severity: 'error'
            });
          }
        }
        break;

      case 'settlement_basis':
        if (value && !['t_plus', 'weekly', 'bi_weekly', 'monthly'].includes(value)) {
          errors.push({
            row: rowNum,
            field,
            message: 'settlement_basis must be one of: t_plus, weekly, bi_weekly, monthly',
            severity: 'error'
          });
        }
        break;

      case 'monthly_day':
        if (value && value !== 'eom' && (isNaN(parseInt(value)) || parseInt(value) < 1 || parseInt(value) > 31)) {
          errors.push({
            row: rowNum,
            field,
            message: 'monthly_day must be 1-31 or "eom"',
            severity: 'error'
          });
        }
        break;

      case 'bi_weekly_which':
        if (value && !['first', 'second'].includes(value)) {
          errors.push({
            row: rowNum,
            field,
            message: 'bi_weekly_which must be "first" or "second"',
            severity: 'error'
          });
        }
        break;
    }

    return errors;
  };

  const parseCSV = (text: string): ParsedRow[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const rowData: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        rowData[header] = values[index] || '';
      });

      const rowErrors: ValidationError[] = [];
      
      // Validate all fields with row context
      Object.keys(rowData).forEach(field => {
        const fieldErrors = validateField(field, rowData[field], i + 1, rowData);
        rowErrors.push(...fieldErrors);
      });

      rows.push({
        rowNumber: i + 1,
        data: rowData,
        isValid: rowErrors.filter(e => e.severity === 'error').length === 0,
        errors: rowErrors
      });
    }

    return rows;
  };

  const processCSV = useCallback((text: string) => {
    setIsProcessing(true);
    
    try {
      const parsed = parseCSV(text);
      setParsedRows(parsed);

      const allErrors = parsed.flatMap(row => row.errors);
      const errors = allErrors.filter(e => e.severity === 'error');
      const warnings = allErrors.filter(e => e.severity === 'warning');

      setValidationSummary({
        totalRows: parsed.length,
        validRows: parsed.filter(row => row.isValid).length,
        errors,
        warnings
      });
    } catch (error) {
      console.error('CSV processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvData(text);
      processCSV(text);
    };
    reader.readAsText(file);
  };

  // Auto-load selected file from parent if provided
  React.useEffect(() => {
    if (initialFile) {
      handleFileSelect(initialFile);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    
    if (csvFile) {
      handleFileSelect(csvFile);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragActive(false);
  }, []);

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/templates/rate-cards-template.csv');
      if (!response.ok) throw new Error('Failed to download template');
      
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'rate-card-template.csv';
      link.click();
    } catch (error) {
      console.error('Error downloading template:', error);
    }
  };

  const confirmValidData = () => {
    const validRows = parsedRows
      .filter(row => row.isValid)
      .map(row => row.data);
    
    onValidDataConfirmed(validRows);
  };

  if (!csvData) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Validation Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Upload a CSV file to preview and validate your rate card data before importing.
            </p>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive 
                ? 'border-teal-500 bg-teal-50 dark:bg-teal-950' 
                : 'border-slate-300 dark:border-slate-600'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={openFileDialog}
            data-testid="csv-drop-zone"
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <p className="text-lg font-medium mb-2">Drop your CSV file here</p>
            <p className="text-sm text-slate-500 mb-4">or <button onClick={(e)=>{ e.stopPropagation(); openFileDialog(); }} className="underline text-teal-600">click to browse</button></p>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => e.target?.files?.[0] && handleFileSelect(e.target.files[0])}
              className="hidden"
              id="csv-file-input"
              ref={inputRef}
              data-testid="csv-file-input"
            />
            {/* Removed duplicate Browse Files button to avoid repetition; use the link above or click the drop zone */}
          </div>

          <div className="flex justify-end gap-2">
            <Button onClick={onCancel} variant="outline" data-testid="cancel-button">
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            CSV Validation Results
          </CardTitle>
          <Button 
            onClick={() => {
              setCsvData('');
              setParsedRows([]);
              setValidationSummary(null);
            }} 
            variant="ghost" 
            size="sm"
            data-testid="reset-button"
          >
            <X className="h-4 w-4 mr-2" />
            Upload Different File
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {validationSummary && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Rows</p>
                      <p className="text-2xl font-bold" data-testid="total-rows">{validationSummary.totalRows}</p>
                    </div>
                    <FileText className="h-8 w-8 text-slate-400" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-600 dark:text-green-400">Valid Rows</p>
                      <p className="text-2xl font-bold text-green-600" data-testid="valid-rows">{validationSummary.validRows}</p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Errors</p>
                      <p className="text-2xl font-bold text-red-600" data-testid="error-count">{validationSummary.errors.length}</p>
                    </div>
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Error Summary */}
            {validationSummary.errors.length > 0 && (
              <div className="border border-red-200 bg-red-50 dark:bg-red-950 rounded-lg p-4 flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
                <div>
                  <strong>{validationSummary.errors.length} errors found</strong> that must be fixed before import.
                  Please review and correct the highlighted issues.
                </div>
              </div>
            )}

            {/* Validation Results Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 border-b">
                <h3 className="font-medium">Row-by-Row Validation</h3>
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium">Row</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Status</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Platform</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Category</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Type</th>
                      <th className="px-4 py-2 text-left text-sm font-medium">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row) => (
                      <tr 
                        key={row.rowNumber} 
                        className={`border-b ${!row.isValid ? 'bg-red-50 dark:bg-red-950/20' : ''}`}
                        data-testid={`row-${row.rowNumber}`}
                      >
                        <td className="px-4 py-2 text-sm">{row.rowNumber}</td>
                        <td className="px-4 py-2">
                          {row.isValid ? (
                            <Badge variant="default" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Valid
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Error
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm">{row.data.platform_id || '-'}</td>
                        <td className="px-4 py-2 text-sm">{row.data.category_id || '-'}</td>
                        <td className="px-4 py-2 text-sm">{row.data.commission_type || '-'}</td>
                        <td className="px-4 py-2 text-sm">
                          {row.errors.length > 0 ? (
                            <div className="space-y-1">
                              {row.errors.slice(0, 2).map((error, index) => (
                                <div key={index} className="text-xs text-red-600 dark:text-red-400">
                                  {error.field}: {error.message}
                                </div>
                              ))}
                              {row.errors.length > 2 && (
                                <div className="text-xs text-slate-500">
                                  +{row.errors.length - 2} more...
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-green-600 text-xs">All valid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between">
              <Button onClick={onCancel} variant="outline" data-testid="cancel-validation">
                Cancel
              </Button>
              <div className="space-x-2">
                {validationSummary.validRows > 0 && (
                  <Button 
                    onClick={confirmValidData} 
                    disabled={validationSummary.errors.length > 0}
                    data-testid="import-valid-data"
                  >
                    Import {validationSummary.validRows} Valid Row{validationSummary.validRows !== 1 ? 's' : ''}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {isProcessing && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            <span className="ml-2">Processing CSV data...</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CSVValidationPreview;
