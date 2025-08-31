import { db } from "../../storage";
import { rateCardsV2 } from "@shared/schema";
import { gte, lte, and, isNotNull, or } from "drizzle-orm";

export interface NotificationConfig {
  warningDays: number; // Days before expiry to send warning
  reminderDays: number; // Days before expiry to send final reminder
  emailEnabled: boolean;
  webhookUrl?: string;
}

export interface ExpiryNotification {
  id: string;
  platform_id: string;
  category_id: string;
  effective_to: string;
  daysUntilExpiry: number;
  status: 'warning' | 'urgent' | 'expired';
  message: string;
}

const DEFAULT_CONFIG: NotificationConfig = {
  warningDays: 30, // 30 days warning
  reminderDays: 7,  // 7 days final reminder
  emailEnabled: false,
  webhookUrl: undefined
};

export class NotificationService {
  private config: NotificationConfig;

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async checkExpiringRateCards(): Promise<ExpiryNotification[]> {
    try {
      const today = new Date();
      const warningDate = new Date();
      warningDate.setDate(today.getDate() + this.config.warningDays);

      // Get rate cards expiring within warning period or already expired
      const expiringCards = await db.select()
        .from(rateCardsV2)
        .where(
          and(
            lte(rateCardsV2.effective_to, warningDate.toISOString().split('T')[0]),
            // Only include cards that have an expiry date
            isNotNull(rateCardsV2.effective_to)
          )
        );

      const notifications: ExpiryNotification[] = [];

      for (const card of expiringCards) {
        if (!card.effective_to) continue;

        const expiryDate = new Date(card.effective_to);
        const timeDiff = expiryDate.getTime() - today.getTime();
        const daysUntilExpiry = Math.ceil(timeDiff / (1000 * 3600 * 24));

        let status: 'warning' | 'urgent' | 'expired';
        let message: string;

        if (daysUntilExpiry < 0) {
          status = 'expired';
          message = `Rate card for ${card.platform_id} - ${card.category_id} expired ${Math.abs(daysUntilExpiry)} days ago`;
        } else if (daysUntilExpiry <= this.config.reminderDays) {
          status = 'urgent';
          message = `URGENT: Rate card for ${card.platform_id} - ${card.category_id} expires in ${daysUntilExpiry} days`;
        } else if (daysUntilExpiry <= this.config.warningDays) {
          status = 'warning';
          message = `WARNING: Rate card for ${card.platform_id} - ${card.category_id} expires in ${daysUntilExpiry} days`;
        } else {
          continue; // Skip cards not in notification range
        }

        notifications.push({
          id: card.id,
          platform_id: card.platform_id,
          category_id: card.category_id,
          effective_to: card.effective_to,
          daysUntilExpiry,
          status,
          message
        });
      }

      return notifications.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    } catch (error) {
      console.error('Error checking expiring rate cards:', error);
      return [];
    }
  }

  async sendNotifications(notifications: ExpiryNotification[]): Promise<void> {
    if (notifications.length === 0) return;

    console.log(`\n📅 RATE CARD EXPIRY NOTIFICATIONS (${new Date().toISOString()})`);
    console.log('═'.repeat(70));

    for (const notification of notifications) {
      const emoji = notification.status === 'expired' ? '❌' : 
                   notification.status === 'urgent' ? '⚠️' : '📝';
      
      console.log(`${emoji} ${notification.message}`);
      console.log(`   Card ID: ${notification.id}`);
      console.log(`   Expiry Date: ${notification.effective_to}`);
      console.log('');
    }

    // Send webhook notification if configured
    if (this.config.webhookUrl) {
      try {
        await this.sendWebhookNotification(notifications);
      } catch (error) {
        console.error('Failed to send webhook notification:', error);
      }
    }

    // TODO: Implement email notifications when SENDGRID_API_KEY is available
    if (this.config.emailEnabled) {
      console.log('📧 Email notifications would be sent here (SENDGRID_API_KEY required)');
    }
  }

  private async sendWebhookNotification(notifications: ExpiryNotification[]): Promise<void> {
    if (!this.config.webhookUrl) return;

    const payload = {
      timestamp: new Date().toISOString(),
      source: 'ReconEasy Rate Card Expiry Monitor',
      notifications: notifications.map(n => ({
        id: n.id,
        platform: n.platform_id,
        category: n.category_id,
        expiryDate: n.effective_to,
        daysUntilExpiry: n.daysUntilExpiry,
        status: n.status,
        message: n.message
      }))
    };

    const response = await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log('✅ Webhook notification sent successfully');
  }

  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): NotificationConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const notificationService = new NotificationService();