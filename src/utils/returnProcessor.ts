import { ReturnOrder, ReturnCategories, ReturnMetrics } from '../types/returns';

export class ReturnProcessor {
  private static instance: ReturnProcessor;
  private processingInterval: NodeJS.Timeout | null = null;
  private readonly FPS = 60;

  static getInstance(): ReturnProcessor {
    if (!ReturnProcessor.instance) {
      ReturnProcessor.instance = new ReturnProcessor();
    }
    return ReturnProcessor.instance;
  }

  setupReconciliation(): ReturnCategories {
    return {
      customer_returns: [],
      rto_returns: [],
      fraud_damage_returns: [],
      not_received_returns: [],
      claims_filed: [],
      unreimbursed_losses: []
    };
  }

  categorizeReturns(orders: ReturnOrder[]): ReturnCategories {
    const categories = this.setupReconciliation();

    orders.forEach(order => {
      // Customer Returns: Delivered orders that were returned by customer
      if (order.status === 'Delivered' && 
          order.return_type === 'customer_return' && 
          !order.seller_paid) {
        categories.customer_returns.push(order);
      }
      
      // RTO Returns: Orders not delivered and returned to origin
      else if (order.status === 'RTO' && 
               order.return_type === 'rto' && 
               !order.seller_paid) {
        categories.rto_returns.push(order);
      }
      
      // Fraud & Damage Returns: Returns flagged as fraudulent or damaged
      else if ((order.return_type === 'fraud' || order.return_type === 'damage') &&
               order.wms_received) {
        categories.fraud_damage_returns.push(order);
      }
      
      // Not Received Returns: Returns marked as delivered but not received in WMS
      else if (order.return_type === 'not_received' && 
               !order.wms_received) {
        categories.not_received_returns.push(order);
      }
      
      // Claims Filed: Returns where seller has filed claims
      else if (order.claim_status !== 'not_filed') {
        categories.claims_filed.push(order);
      }
      
      // Unreimbursed Losses: Returns with losses but no seller payment
      else if (!order.seller_paid && order.loss_amount > 0) {
        categories.unreimbursed_losses.push(order);
      }
    });

    return categories;
  }

  calculateMetrics(orders: ReturnOrder[]): ReturnMetrics {
    const totalReturns = orders.length;
    const totalLossAmount = orders.reduce((sum, order) => sum + order.loss_amount, 0);
    const totalClaimsFiled = orders.filter(order => order.claim_status !== 'not_filed').length;
    const totalClaimsApproved = orders.filter(order => order.claim_status === 'approved').length;
    const pendingReimbursements = orders.filter(order => !order.seller_paid && order.loss_amount > 0).length;
    const recoveryRate = totalClaimsFiled > 0 ? (totalClaimsApproved / totalClaimsFiled) * 100 : 0;

    return {
      total_returns: totalReturns,
      total_loss_amount: totalLossAmount,
      total_claims_filed: totalClaimsFiled,
      total_claims_approved: totalClaimsApproved,
      pending_reimbursements: pendingReimbursements,
      recovery_rate: recoveryRate
    };
  }

  async processReturnsAsync(
    orders: ReturnOrder[], 
    onUpdate: (categories: ReturnCategories, metrics: ReturnMetrics) => void
  ): Promise<void> {
    const categories = this.categorizeReturns(orders);
    const metrics = this.calculateMetrics(orders);
    
    // Simulate real-time processing
    onUpdate(categories, metrics);
    
    // Auto-generate claims for eligible returns
    await this.autoGenerateClaims(categories);
    
    // Update metrics after claim generation
    const updatedMetrics = this.calculateMetrics(orders);
    onUpdate(categories, updatedMetrics);
  }

  private async autoGenerateClaims(categories: ReturnCategories): Promise<void> {
    // Auto-file claims for fraud and damage returns
    const eligibleForClaims = [
      ...categories.fraud_damage_returns,
      ...categories.not_received_returns
    ].filter(order => order.claim_status === 'not_filed' && order.loss_amount > 0);

    for (const order of eligibleForClaims) {
      // Simulate claim filing process
      await new Promise(resolve => setTimeout(resolve, 100));
      order.claim_status = 'filed';
      order.claim_amount = order.loss_amount;
    }
  }

  startProcessing(
    orders: ReturnOrder[], 
    onUpdate: (categories: ReturnCategories, metrics: ReturnMetrics) => void
  ): void {
    if (this.processingInterval) {
      this.stopProcessing();
    }

    this.processingInterval = setInterval(() => {
      this.processReturnsAsync(orders, onUpdate);
    }, 1000 / this.FPS);
  }

  stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  // Utility methods for return management
  fileClaimForReturn(order: ReturnOrder, claimAmount: number): ReturnOrder {
    return {
      ...order,
      claim_status: 'filed',
      claim_amount: claimAmount
    };
  }

  markAsReimbursed(order: ReturnOrder, reimbursementAmount: number): ReturnOrder {
    return {
      ...order,
      seller_paid: true,
      loss_amount: Math.max(0, order.loss_amount - reimbursementAmount)
    };
  }

  updateClaimStatus(order: ReturnOrder, status: ReturnOrder['claim_status']): ReturnOrder {
    return {
      ...order,
      claim_status: status
    };
  }
}

export const returnProcessor = ReturnProcessor.getInstance();