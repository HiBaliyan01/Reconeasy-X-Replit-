import type { NotificationConfig } from "@shared/notifications/config";
import { DEFAULT_NOTIFICATION_CONFIG } from "@shared/notifications/config";

export interface ExpiryNotification {
  id: string;
  platform_id: string;
  category_id: string;
  effective_to: string;
  daysUntilExpiry: number;
  status: 'warning' | 'urgent' | 'expired';
  message: string;
}

export class NotificationService {
  private config: NotificationConfig;

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...config };
  }

  async checkExpiringRateCards(): Promise<ExpiryNotification[]> {
    try {
      const today = new Date();
      const warningThreshold = new Date(today.getTime() + (this.config.warningDays * 24 * 60 * 60 * 1000));
      const reminderThreshold = new Date(today.getTime() + (this.config.reminderDays * 24 * 60 * 60 * 1000));

      // Use in-memory storage to avoid database connection issues
      const { storage } = await import("../../storage");
      const expiringCards = await storage.getRateCards();

      const notifications: ExpiryNotification[] = [];

      for (const card of expiringCards) {
        if (!card.effective_to) continue;

        const expiryDate = new Date(card.effective_to);
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

        let status: 'warning' | 'urgent' | 'expired' | null = null;
        let message = '';

        if (expiryDate < today) {
          status = 'expired';
          message = `Rate card expired ${Math.abs(daysUntilExpiry)} days ago`;
        } else if (expiryDate <= reminderThreshold) {
          status = 'urgent';
          message = `Rate card expires in ${daysUntilExpiry} days - Action required!`;
        } else if (expiryDate <= warningThreshold) {
          status = 'warning';
          message = `Rate card expires in ${daysUntilExpiry} days`;
        }

        if (status) {
          notifications.push({
            id: card.id,
            platform_id: card.platform || 'Unknown',
            category_id: card.category || 'Unknown',
            effective_to: card.effective_to,
            daysUntilExpiry,
            status,
            message
          });
        }
      }

      // Sort by urgency (expired first, then urgent, then warning)
      notifications.sort((a, b) => {
        const priority = { expired: 3, urgent: 2, warning: 1 };
        return priority[b.status] - priority[a.status] || a.daysUntilExpiry - b.daysUntilExpiry;
      });

      console.log(`🔍 Found ${notifications.length} expiring rate cards:`, 
        notifications.map(n => `${n.platform_id}-${n.category_id}: ${n.message}`));

      return notifications;
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

    const message = {
      text: `🚨 Rate Card Expiry Alert - ${notifications.length} cards require attention`,
      attachments: [{
        color: notifications.some(n => n.status === 'expired') ? 'danger' : 'warning',
        fields: notifications.map(n => ({
          title: `${n.platform_id} - ${n.category_id}`,
          value: n.message,
          short: false
        }))
      }]
    };

    await fetch(this.config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message)
    });
  }

  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): NotificationConfig {
    return { ...this.config };
  }
}
