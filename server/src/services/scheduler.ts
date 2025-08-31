import { NotificationService } from "./notificationService";

export class TaskScheduler {
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  startNotificationScheduler(intervalMinutes: number = 60): void {
    // Clear existing interval if running
    this.stopTask('notifications');

    // Run initial check
    this.runNotificationCheck();

    // Schedule recurring checks
    const intervalMs = intervalMinutes * 60 * 1000;
    const interval = setInterval(() => {
      this.runNotificationCheck();
    }, intervalMs);

    this.intervals.set('notifications', interval);
    console.log(`📅 Started notification scheduler - checking every ${intervalMinutes} minutes`);
  }

  stopTask(taskName: string): void {
    const interval = this.intervals.get(taskName);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(taskName);
      console.log(`⏹️ Stopped task: ${taskName}`);
    }
  }

  stopAllTasks(): void {
    const taskNames = Array.from(this.intervals.keys());
    for (const taskName of taskNames) {
      this.stopTask(taskName);
    }
    console.log('⏹️ All scheduled tasks stopped');
  }

  private async runNotificationCheck(): Promise<void> {
    try {
      console.log('🔍 Running scheduled rate card expiry check...');
      const notifications = await this.notificationService.checkExpiringRateCards();
      
      if (notifications.length > 0) {
        await this.notificationService.sendNotifications(notifications);
        console.log(`✅ Found and processed ${notifications.length} expiring rate card(s)`);
      } else {
        console.log('✅ No expiring rate cards found');
      }
    } catch (error) {
      console.error('❌ Error in scheduled notification check:', error);
    }
  }

  getActiveTasksCount(): number {
    return this.intervals.size;
  }

  getActiveTasks(): string[] {
    return Array.from(this.intervals.keys());
  }
}

// Export singleton instance
export const taskScheduler = new TaskScheduler();

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping all scheduled tasks...');
  taskScheduler.stopAllTasks();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping all scheduled tasks...');
  taskScheduler.stopAllTasks();
  process.exit(0);
});