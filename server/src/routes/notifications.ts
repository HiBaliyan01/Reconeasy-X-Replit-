import { Router } from "express";
import { NotificationService } from "../services/notificationService";
import type { NotificationConfig } from "@shared/notifications/config";
import { validateNotificationConfig } from "@shared/notifications/config";

const router = Router();

// Create a notification service instance
const notificationService = new NotificationService();

// Get current notification configuration
router.get("/notifications/config", async (req, res) => {
  try {
    const config = notificationService.getConfig();
    res.json(config);
  } catch (error) {
    console.error("Error getting notification config:", error);
    res.status(500).json({ message: "Failed to get notification configuration" });
  }
});

// Update notification configuration
router.put("/notifications/config", async (req, res) => {
  try {
    const config: Partial<NotificationConfig> = req.body;
    
    const validationIssues = validateNotificationConfig(config);
    if (validationIssues.length) {
      return res.status(400).json({ message: validationIssues.join("; ") });
    }

    notificationService.updateConfig(config);
    res.json({ message: "Configuration updated successfully", config: notificationService.getConfig() });
  } catch (error) {
    console.error("Error updating notification config:", error);
    res.status(500).json({ message: "Failed to update notification configuration" });
  }
});

// Get current expiring rate cards
router.get("/notifications/expiring", async (req, res) => {
  try {
    const notifications = await notificationService.checkExpiringRateCards();
    res.json(notifications);
  } catch (error) {
    console.error("Error getting expiring rate cards:", error);
    res.status(500).json({ message: "Failed to get expiring rate cards" });
  }
});

// Trigger manual notification check
router.post("/notifications/check", async (req, res) => {
  try {
    const notifications = await notificationService.checkExpiringRateCards();
    await notificationService.sendNotifications(notifications);
    
    res.json({ 
      message: "Notification check completed", 
      count: notifications.length,
      notifications 
    });
  } catch (error) {
    console.error("Error running notification check:", error);
    res.status(500).json({ message: "Failed to run notification check" });
  }
});

export default router;
