import { checkScheduledCampaigns } from "./campaign.cron";
import { schedulePaymentReminders } from "./payment-reminder.cron";
import { scheduleReportJobs } from "./scheduled-report.cron";
import { BotManager } from "../bot.manager";
import { CronJob } from "cron";
import logger from "../configs/logger.config";

export function initCrons(botManager: BotManager) {
    // Check scheduled campaigns every minute
    new CronJob(
        "* * * * *",
        () => checkScheduledCampaigns(botManager),
        null,
        true,
        "Africa/Lome"
    );
    
    // Schedule payment reminders (runs every hour)
    schedulePaymentReminders(botManager);
    
    // Schedule automated reports for CEOs
    scheduleReportJobs(botManager);
    
    logger.info("Cron jobs initialized");
}