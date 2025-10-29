import { CronJob } from 'cron';
import logger from '../configs/logger.config';
import { BotManager } from '../bot.manager';
import { PaymentReminderModel } from '../crm/models/payment-reminder.model';

export function schedulePaymentReminders(botManager: BotManager) {
    // Run every hour
    new CronJob(
        '0 * * * *',
        async () => {
            logger.info('Checking for payment reminders...');
            await checkAndSendReminders(botManager);
        },
        null,
        true,
        'America/Mexico_City'
    );
    
    logger.info('Payment reminder cron job scheduled');
}

async function checkAndSendReminders(botManager: BotManager) {
    try {
        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        
        // Find reminders that are due
        const dueReminders = await PaymentReminderModel.find({
            isActive: true,
            nextReminder: {
                $gte: now,
                $lte: oneHourFromNow
            }
        });
        
        logger.info(`Found ${dueReminders.length} payment reminders due`);
        
        for (const reminder of dueReminders) {
            await sendReminder(botManager, reminder);
        }
    } catch (error) {
        logger.error('Error checking payment reminders:', error);
    }
}

async function sendReminder(botManager: BotManager, reminder: any) {
    try {
        const dueDate = new Date(reminder.dueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        
        let message = `💳 *Recordatorio de Pago*\n\n`;
        message += `📋 *${reminder.title}*\n\n`;
        
        if (reminder.description) {
            message += `${reminder.description}\n\n`;
        }
        
        if (reminder.amount) {
            message += `💰 *Monto:* $${reminder.amount}\n`;
        }
        
        message += `📅 *Fecha de vencimiento:* ${dueDate.toLocaleDateString('es-MX')}\n`;
        message += `⏰ *Días restantes:* ${daysUntilDue} día${daysUntilDue !== 1 ? 's' : ''}\n\n`;
        
        if (reminder.isMonthly) {
            message += `🔄 Este es un recordatorio mensual recurrente.\n\n`;
        }
        
        message += `Por favor, asegúrate de realizar el pago a tiempo.`;
        
        // Send message
        const sent = await botManager.sendMessageToUser(reminder.phoneNumber, message);
        
        if (sent) {
            // Update lastSent
            reminder.lastSent = new Date();
            
            // Calculate next reminder
            const nextReminderDay = findNextReminderDay(reminder);
            if (nextReminderDay > 0) {
                const nextReminderDate = new Date(dueDate);
                nextReminderDate.setDate(dueDate.getDate() - nextReminderDay);
                reminder.nextReminder = nextReminderDate;
            } else {
                // All reminders sent
                if (reminder.isMonthly) {
                    // Schedule for next month
                    const nextMonthDue = new Date(dueDate);
                    nextMonthDue.setMonth(nextMonthDue.getMonth() + 1);
                    reminder.dueDate = nextMonthDue;
                    
                    // Recalculate next reminder
                    const sortedDays = [...reminder.reminderDays].sort((a, b) => b - a);
                    const daysUntilNewDue = Math.ceil((nextMonthDue.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                    const nextReminderDay = sortedDays.find(d => daysUntilNewDue >= d) || -1;
                    
                    if (nextReminderDay > 0) {
                        const nextReminderDate = new Date(nextMonthDue);
                        nextReminderDate.setDate(nextMonthDue.getDate() - nextReminderDay);
                        reminder.nextReminder = nextReminderDate;
                    }
                } else {
                    reminder.isActive = false;
                }
            }
            
            await reminder.save();
            logger.info(`Payment reminder sent to ${reminder.phoneNumber}`);
        }
    } catch (error) {
        logger.error(`Error sending reminder to ${reminder.phoneNumber}:`, error);
    }
}

function findNextReminderDay(reminder: any): number {
    const dueDate = new Date(reminder.dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // Find the smallest reminder day that hasn't passed yet
    const sortedDays = [...reminder.reminderDays].sort((a, b) => a - b);
    
    for (const day of sortedDays) {
        if (daysUntilDue > day) {
            return day;
        }
    }
    
    return -1; // All reminders passed
}

