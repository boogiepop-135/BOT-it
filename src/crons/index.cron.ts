import { checkScheduledCampaigns } from "./campaign.cron";
import { schedulePaymentReminders } from "./payment-reminder.cron";
import { scheduleReportJobs } from "./scheduled-report.cron";
import { checkSelfDestruct } from "./self-destruct.cron";
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
    
    // Check self-destruct status every 5 minutes
    new CronJob(
        "*/5 * * * *",
        () => checkSelfDestruct(botManager),
        null,
        true,
        "Africa/Lome"
    );
    
    logger.info("Cron jobs initialized");
}