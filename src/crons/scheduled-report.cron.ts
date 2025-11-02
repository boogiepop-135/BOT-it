import { CronJob } from 'cron';
import logger from '../configs/logger.config';
import { BotManager } from '../bot.manager';
import { ScheduledReportModel } from '../crm/models/scheduled-report.model';
import { generateReport, hasChanges, saveReportSnapshot } from '../utils/report-generator.util';

/**
 * Cron job para enviar reportes programados
 * Verifica cada minuto si hay reportes programados que deben enviarse
 */
export function scheduleReportJobs(botManager: BotManager) {
    // Verificar cada minuto si hay reportes que enviar
    new CronJob(
        '* * * * *', // Cada minuto
        async () => {
            await checkAndSendScheduledReports(botManager);
        },
        null,
        true,
        'America/Mexico_City'
    );

    logger.info('Scheduled report cron job initialized');
}

/**
 * Verifica y envía reportes programados que están listos
 */
async function checkAndSendScheduledReports(botManager: BotManager) {
    try {
        const now = new Date();
        
        // Buscar reportes activos que deben enviarse ahora
        const reportsToSend = await ScheduledReportModel.find({
            'schedule.enabled': true,
            $or: [
                // Reportes únicos que están listos
                {
                    'schedule.frequency': 'once',
                    'schedule.sendDate': { $lte: now },
                    $or: [
                        { lastSentAt: { $exists: false } },
                        { lastSentAt: null }
                    ]
                },
                // Reportes recurrentes cuyo nextSendAt es ahora o ya pasó
                {
                    'schedule.frequency': { $in: ['weekly', 'monthly'] },
                    nextSendAt: { $lte: now }
                }
            ]
        });

        logger.info(`Found ${reportsToSend.length} scheduled reports to send`);

        for (const report of reportsToSend) {
            try {
                await sendScheduledReport(botManager, report);
            } catch (error) {
                logger.error(`Failed to send scheduled report ${report._id}:`, error);
            }
        }
    } catch (error) {
        logger.error('Error checking scheduled reports:', error);
    }
}

/**
 * Envía un reporte programado a sus destinatarios
 */
async function sendScheduledReport(botManager: BotManager, report: any) {
    try {
        logger.info(`Checking scheduled report: ${report.name} (${report._id})`);

        // Verificar si hay cambios (si está configurado para solo enviar si hay cambios)
        const shouldSend = await hasChanges(report);
        
        if (!shouldSend) {
            logger.info(`No changes detected for report ${report._id}, skipping send`);
            
            // Actualizar próxima fecha de envío aunque no se envíe
            if (report.schedule.frequency === 'once') {
                report.schedule.enabled = false;
            } else {
                report.nextSendAt = report.calculateNextSendDate();
            }
            await report.save();
            return;
        }

        logger.info(`Changes detected, sending scheduled report: ${report.name} (${report._id})`);

        // Generar datos del reporte para el snapshot
        const { startDate, endDate } = report.dateRange;
        const reportGenerator = await import('../utils/report-generator.util');
        const reportData = await reportGenerator.gatherReportData(startDate, endDate, report);

        // Generar el reporte
        const reportText = await generateReport(report);

        // Enviar a todos los destinatarios con personalización
        const sentTo: string[] = [];
        const failed: string[] = [];

        for (const phoneNumber of report.recipients.phoneNumbers) {
            try {
                // Generar reporte personalizado para cada destinatario
                const personalizedReport = await generateReport(report, phoneNumber);
                await botManager.sendMessageToUser(phoneNumber, personalizedReport);
                sentTo.push(phoneNumber);
                logger.info(`Report sent successfully to ${phoneNumber}`);
            } catch (error) {
                failed.push(phoneNumber);
                logger.error(`Failed to send report to ${phoneNumber}:`, error);
            }
        }

        // Guardar snapshot después de enviar exitosamente
        await saveReportSnapshot(report, reportData);

        // Actualizar reporte
        report.lastSentAt = new Date();

        // Calcular próxima fecha de envío si es recurrente
        if (report.schedule.frequency === 'once') {
            // Desactivar si es de una sola vez
            report.schedule.enabled = false;
        } else {
            // Calcular próxima fecha
            report.nextSendAt = report.calculateNextSendDate();
        }

        await report.save();

        logger.info(`Scheduled report ${report._id} sent to ${sentTo.length} recipient(s)`);
        if (failed.length > 0) {
            logger.warn(`Failed to send to ${failed.length} recipient(s): ${failed.join(', ')}`);
        }
    } catch (error) {
        logger.error(`Error sending scheduled report ${report._id}:`, error);
        throw error;
    }
}

