import { Transaction, Return, ReturnForecast } from '../types';

// Mock transactions data
export const mockTransactions: Transaction[] = [
  {
    id: 'TXN001',
    orderId: 'ORD-2024-001',
    sku: 'SHIRT-BL-M',
    productName: 'Cotton Casual Shirt - Blue',
    marketplace: 'Amazon',
    amount: 1299,
    utr: 'UTR202401001',
    status: 'reconciled',
    date: '2024-01-15T10:30:00Z',
    customerEmail: 'customer1@email.com',
    variant: { size: 'M', color: 'Blue' }
  },
  {
    id: 'TXN002',
    orderId: 'ORD-2024-002',
    sku: 'JEANS-BK-L',
    productName: 'Slim Fit Jeans - Black',
    marketplace: 'Flipkart',
    amount: 2499,
    utr: 'UTR202401002',
    status: 'pending',
    date: '2024-01-16T14:15:00Z',
    customerEmail: 'customer2@email.com',
    variant: { size: 'L', color: 'Black' }
  },
  {
    id: 'TXN003',
    orderId: 'ORD-2024-003',
    sku: 'DRESS-RD-S',
    productName: 'Summer Dress - Red',
    marketplace: 'Myntra',
    amount: 1899,
    utr: 'UTR202401003',
    status: 'discrepancy',
    date: '2024-01-17T09:45:00Z',
    customerEmail: 'customer3@email.com',
    variant: { size: 'S', color: 'Red' }
  },
  {
    id: 'TXN004',
    orderId: 'ORD-2024-004',
    sku: 'TSHIRT-WH-XL',
    productName: 'Premium T-Shirt - White',
    marketplace: 'Amazon',
    amount: 899,
    utr: 'UTR202401004',
    status: 'reconciled',
    date: '2024-01-18T16:20:00Z',
    customerEmail: 'customer4@email.com',
    variant: { size: 'XL', color: 'White' }
  },
  {
    id: 'TXN005',
    orderId: 'ORD-2024-005',
    sku: 'SHORTS-GR-M',
    productName: 'Cargo Shorts - Green',
    marketplace: 'Flipkart',
    amount: 1599,
    utr: 'UTR202401005',
    status: 'reconciled',
    date: '2024-01-19T11:10:00Z',
    customerEmail: 'customer5@email.com',
    variant: { size: 'M', color: 'Green' }
  }
];

// Mock returns data
export const mockReturns: Return[] = [
  {
    id: 'RET001',
    orderId: 'ORD-2024-001',
    transactionId: 'TXN001',
    sku: 'SHIRT-BL-M',
    productName: 'Cotton Casual Shirt - Blue',
    marketplace: 'Amazon',
    reason: 'Size too small, need Large instead',
    reasonCategory: 'size_issue',
    refundAmount: 1299,
    status: 'processed',
    date: '2024-01-20T12:00:00Z',
    variant: { size: 'M', color: 'Blue' }
  },
  {
    id: 'RET002',
    orderId: 'ORD-2024-006',
    transactionId: 'TXN006',
    sku: 'JEANS-BK-L',
    productName: 'Slim Fit Jeans - Black',
    marketplace: 'Flipkart',
    reason: 'Poor stitching quality',
    reasonCategory: 'quality_issue',
    refundAmount: 2499,
    status: 'pending',
    date: '2024-01-21T15:30:00Z',
    variant: { size: 'L', color: 'Black' }
  },
  {
    id: 'RET003',
    orderId: 'ORD-2024-007',
    transactionId: 'TXN007',
    sku: 'DRESS-RD-S',
    productName: 'Summer Dress - Red',
    marketplace: 'Myntra',
    reason: 'Received damaged item',
    reasonCategory: 'damaged',
    refundAmount: 1899,
    status: 'processed',
    date: '2024-01-22T10:15:00Z',
    variant: { size: 'S', color: 'Red' }
  }
];

// Mock forecast data
export const mockForecastData: ReturnForecast[] = [
  { date: '2024-01-01', predicted: 5, actual: 4 },
  { date: '2024-01-02', predicted: 6, actual: 7 },
  { date: '2024-01-03', predicted: 4, actual: 3 },
  { date: '2024-01-04', predicted: 8, actual: 9 },
  { date: '2024-01-05', predicted: 7, actual: 6 },
  { date: '2024-01-06', predicted: 5, actual: 5 },
  { date: '2024-01-07', predicted: 9, actual: 8 },
  { date: '2024-01-08', predicted: 6 },
  { date: '2024-01-09', predicted: 7 },
  { date: '2024-01-10', predicted: 8 },
  { date: '2024-01-11', predicted: 5 },
  { date: '2024-01-12', predicted: 6 },
  { date: '2024-01-13', predicted: 9 },
  { date: '2024-01-14', predicted: 7 }
];

// Generate additional mock data for charts
export const generateMockSalesData = () => {
  const data = [];
  const today = new Date();
  
  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    data.push({
      date: date.toISOString().split('T')[0],
      sales: Math.floor(Math.random() * 50000) + 10000,
      returns: Math.floor(Math.random() * 5000) + 500
    });
  }
  
  return data;
};

export const mockSalesData = generateMockSalesData();