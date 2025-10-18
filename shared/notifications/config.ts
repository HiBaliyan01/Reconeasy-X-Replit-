export interface NotificationConfig {
  warningDays: number;
  reminderDays: number;
  emailEnabled: boolean;
  webhookUrl?: string;
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  warningDays: 30,
  reminderDays: 7,
  emailEnabled: false,
  webhookUrl: undefined,
};

export function validateNotificationConfig(partial: Partial<NotificationConfig>): string[] {
  const issues: string[] = [];

  if (partial.warningDays !== undefined) {
    if (!Number.isFinite(partial.warningDays) || partial.warningDays < 1 || partial.warningDays > 365) {
      issues.push("warningDays must be a number between 1 and 365");
    }
  }

  if (partial.reminderDays !== undefined) {
    if (!Number.isFinite(partial.reminderDays) || partial.reminderDays < 1 || partial.reminderDays > 365) {
      issues.push("reminderDays must be a number between 1 and 365");
    }
  }

  if (partial.emailEnabled !== undefined && typeof partial.emailEnabled !== "boolean") {
    issues.push("emailEnabled must be a boolean if provided");
  }

  if (partial.webhookUrl !== undefined && typeof partial.webhookUrl !== "string") {
    issues.push("webhookUrl must be a string if provided");
  }

  return issues;
}

