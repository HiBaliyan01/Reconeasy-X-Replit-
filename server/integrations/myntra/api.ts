import { myntraAuthService } from './auth';

const MYNTRA_API_BASE = process.env.MYNTRA_BASE_URL || 'https://api.myntra.com/v1';

export class MyntraApiService {
  /**
   * Make authenticated API request to Myntra
   */
  private async makeRequest(userId: string, endpoint: string, options: RequestInit = {}): Promise<any> {
    const accessToken = await myntraAuthService.getAccessToken(userId);
    
    if (!accessToken) {
      throw new Error('No valid Myntra access token found');
    }

    const response = await fetch(`${MYNTRA_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token might be expired, disconnect user
        await myntraAuthService.disconnect(userId);
        throw new Error('Myntra token expired. Please reconnect your account.');
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Myntra API error: ${errorData.message || response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Fetch settlements from Myntra
   */
  async fetchSettlements(userId: string, startDate?: string, endDate?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const endpoint = `/settlements${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.makeRequest(userId, endpoint);
    
    return response.data || response.settlements || [];
  }

  /**
   * Fetch orders from Myntra
   */
  async fetchOrders(userId: string, startDate?: string, endDate?: string): Promise<any[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    const endpoint = `/orders${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.makeRequest(userId, endpoint);
    
    return response.data || response.orders || [];
  }

  /**
   * Sync settlements from Myntra to local database
   */
  async syncSettlements(userId: string): Promise<{ synced: number; errors: number }> {
    try {
      // Fetch last 30 days of settlements
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const settlements = await this.fetchSettlements(userId, startDate, endDate);
      
      if (!Array.isArray(settlements) || settlements.length === 0) {
        return { synced: 0, errors: 0 };
      }

      // Transform Myntra settlement data to our format
      const transformedSettlements = settlements.map(settlement => ({
        order_id: settlement.order_id || settlement.orderId,
        utr_number: settlement.utr_number || settlement.utr || settlement.payment_reference,
        payout_date: settlement.payout_date || settlement.settlement_date || settlement.date,
        actual_settlement_amount: Number(settlement.settlement_amount || settlement.amount || 0),
        commission: Number(settlement.commission || settlement.commission_amount || 0),
        shipping_fee: Number(settlement.shipping_fee || settlement.logistics_fee || 0),
        rto_fee: Number(settlement.rto_fee || settlement.return_fee || 0),
        packaging_fee: Number(settlement.packaging_fee || 0),
        fixed_fee: Number(settlement.fixed_fee || settlement.platform_fee || 0),
        gst: Number(settlement.gst || settlement.tax_amount || 0),
        order_status: settlement.order_status || settlement.status || 'Delivered',
        marketplace: 'Myntra',
        expected_amount: Number(settlement.settlement_amount || settlement.amount || 0),
        paid_amount: Number(settlement.settlement_amount || settlement.amount || 0),
        reco_status: 'matched'
      }));

      // Save to database via settlements upload API
      const response = await fetch('/api/settlements/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rows: transformedSettlements,
          marketplace: 'myntra'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save synced settlements to database');
      }

      const result = await response.json();
      
      return {
        synced: result.processed || transformedSettlements.length,
        errors: result.errors || 0
      };

    } catch (error) {
      console.error('Myntra sync error:', error);
      return { synced: 0, errors: 1 };
    }
  }

  /**
   * Test API connection
   */
  async testConnection(userId: string): Promise<boolean> {
    try {
      await this.makeRequest(userId, '/profile');
      return true;
    } catch (error) {
      console.error('Myntra connection test failed:', error);
      return false;
    }
  }
}

export const myntraApiService = new MyntraApiService();