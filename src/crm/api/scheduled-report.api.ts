import express from 'express';
import { authenticate, authorizeRoles } from '../middlewares/auth.middleware';
import { ScheduledReportModel } from '../models/scheduled-report.model';
import { ROLES } from '../utils/rbac.util';
import logger from '../../configs/logger.config';
import { generateReport } from '../../utils/report-generator.util';
import { BotManager } from '../../bot.manager';

const router = express.Router();

/**
 * API de Reportes Programados para CEOs
 * Permite crear, editar, eliminar y gestionar reportes automáticos
 */

// Obtener todos los reportes programados
router.get('/scheduled-reports', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const { enabled, page = 1, limit = 20 } = req.query;
        
        const query: any = {};
        if (enabled !== undefined) {
            query['schedule.enabled'] = enabled === 'true';
        }
        
        const skip = (Number(page) - 1) * Number(limit);
        
        const reports = await ScheduledReportModel.find(query)
            .sort({ 'schedule.sendDate': 1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('createdBy', 'username')
            .populate('recipients.userIds', 'username')
            .lean();
        
        const total = await ScheduledReportModel.countDocuments(query);
        
        res.json({
            data: reports,
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        });
    } catch (error) {
        logger.error('Failed to get scheduled reports:', error);
        res.status(500).json({ error: 'Failed to get scheduled reports' });
    }
});

// Crear nuevo reporte programado
router.post('/scheduled-reports', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const {
            name,
            description,
            reportType,
            dateRange,
            schedule,
            recipients,
            filters,
            includeMetrics
        } = req.body;
        
        if (!name || !dateRange || !schedule || !recipients) {
            return res.status(400).json({ 
                error: 'Missing required fields: name, dateRange, schedule, recipients' 
            });
        }
        
        // Validar formato de hora
        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(schedule.time)) {
            return res.status(400).json({ error: 'Invalid time format. Use HH:mm (e.g., 09:00)' });
        }
        
        // Construir fecha de envío
        const [hours, minutes] = schedule.time.split(':').map(Number);
        const sendDate = new Date(schedule.sendDate || new Date());
        sendDate.setHours(hours, minutes, 0, 0);
        
        const report = new ScheduledReportModel({
            name,
            description,
            reportType: reportType || 'full',
            dateRange: {
                startDate: new Date(dateRange.startDate),
                endDate: new Date(dateRange.endDate)
            },
            schedule: {
                enabled: schedule.enabled !== false,
                sendDate,
                frequency: schedule.frequency || 'once',
                dayOfWeek: schedule.dayOfWeek,
                dayOfMonth: schedule.dayOfMonth,
                time: schedule.time
            },
            recipients: {
                phoneNumbers: Array.isArray(recipients.phoneNumbers) ? recipients.phoneNumbers : [],
                userIds: Array.isArray(recipients.userIds) ? recipients.userIds : []
            },
            filters: filters || {},
            includeMetrics: includeMetrics !== false,
            createdBy: req.user.userId
        });
        
        // Calcular próxima fecha de envío si es recurrente
        if (report.schedule.frequency !== 'once') {
            const nextSend = report.calculateNextSendDate();
            report.nextSendAt = nextSend || sendDate;
        } else {
            report.nextSendAt = sendDate;
        }
        
        await report.save();
        
        res.status(201).json(report);
    } catch (error) {
        logger.error('Failed to create scheduled report:', error);
        res.status(500).json({ error: 'Failed to create scheduled report' });
    }
});

// Obtener reporte por ID
router.get('/scheduled-reports/:id', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const report = await ScheduledReportModel.findById(req.params.id)
            .populate('createdBy', 'username')
            .populate('recipients.userIds', 'username')
            .lean();
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        res.json(report);
    } catch (error) {
        logger.error('Failed to get scheduled report:', error);
        res.status(500).json({ error: 'Failed to get scheduled report' });
    }
});

// Actualizar reporte programado
router.put('/scheduled-reports/:id', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const report = await ScheduledReportModel.findById(req.params.id);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        const {
            name,
            description,
            reportType,
            dateRange,
            schedule,
            recipients,
            filters,
            includeMetrics
        } = req.body;
        
        if (name) report.name = name;
        if (description !== undefined) report.description = description;
        if (reportType) report.reportType = reportType;
        if (dateRange) {
            report.dateRange.startDate = new Date(dateRange.startDate);
            report.dateRange.endDate = new Date(dateRange.endDate);
        }
        if (schedule) {
            if (schedule.enabled !== undefined) report.schedule.enabled = schedule.enabled;
            if (schedule.time) {
                report.schedule.time = schedule.time;
                // Actualizar fecha de envío
                if (schedule.sendDate) {
                    const [hours, minutes] = schedule.time.split(':').map(Number);
                    const sendDate = new Date(schedule.sendDate);
                    sendDate.setHours(hours, minutes, 0, 0);
                    report.schedule.sendDate = sendDate;
                }
            }
            if (schedule.frequency) report.schedule.frequency = schedule.frequency;
            if (schedule.dayOfWeek !== undefined) report.schedule.dayOfWeek = schedule.dayOfWeek;
            if (schedule.dayOfMonth !== undefined) report.schedule.dayOfMonth = schedule.dayOfMonth;
        }
        if (recipients) {
            if (recipients.phoneNumbers) report.recipients.phoneNumbers = recipients.phoneNumbers;
            if (recipients.userIds) report.recipients.userIds = recipients.userIds;
        }
        if (filters) report.filters = { ...report.filters, ...filters };
        if (includeMetrics !== undefined) report.includeMetrics = includeMetrics;
        
        // Recalcular próxima fecha de envío
        if (report.schedule.frequency !== 'once') {
            const nextSend = report.calculateNextSendDate();
            report.nextSendAt = nextSend || report.schedule.sendDate;
        } else {
            report.nextSendAt = report.schedule.sendDate;
        }
        
        await report.save();
        
        res.json(report);
    } catch (error) {
        logger.error('Failed to update scheduled report:', error);
        res.status(500).json({ error: 'Failed to update scheduled report' });
    }
});

// Eliminar reporte programado
router.delete('/scheduled-reports/:id', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const report = await ScheduledReportModel.findByIdAndDelete(req.params.id);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        res.json({ success: true, message: 'Scheduled report deleted' });
    } catch (error) {
        logger.error('Failed to delete scheduled report:', error);
        res.status(500).json({ error: 'Failed to delete scheduled report' });
    }
});

// Enviar reporte manualmente (para pruebas)
router.post('/scheduled-reports/:id/send', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const report = await ScheduledReportModel.findById(req.params.id);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        // Generar y enviar reporte
        const reportText = await generateReport(report);
        
        // Enviar a todos los destinatarios
        const botManager: BotManager = req.app.get('botManager');
        const sentTo: string[] = [];
        
        for (const phoneNumber of report.recipients.phoneNumbers) {
            try {
                await botManager.sendMessageToUser(phoneNumber, reportText);
                sentTo.push(phoneNumber);
            } catch (error) {
                logger.error(`Failed to send report to ${phoneNumber}:`, error);
            }
        }
        
        // Actualizar última fecha de envío
        report.lastSentAt = new Date();
        if (report.schedule.frequency !== 'once') {
            report.nextSendAt = report.calculateNextSendDate();
        }
        await report.save();
        
        res.json({
            success: true,
            message: `Report sent to ${sentTo.length} recipient(s)`,
            sentTo
        });
    } catch (error) {
        logger.error('Failed to send scheduled report:', error);
        res.status(500).json({ error: 'Failed to send scheduled report' });
    }
});

// Activar/Desactivar reporte
router.patch('/scheduled-reports/:id/toggle', authenticate, authorizeRoles(ROLES.CEO, ROLES.ADMIN), async (req, res) => {
    try {
        const report = await ScheduledReportModel.findById(req.params.id);
        
        if (!report) {
            return res.status(404).json({ error: 'Report not found' });
        }
        
        report.schedule.enabled = !report.schedule.enabled;
        await report.save();
        
        res.json({
            success: true,
            enabled: report.schedule.enabled,
            message: report.schedule.enabled ? 'Report enabled' : 'Report disabled'
        });
    } catch (error) {
        logger.error('Failed to toggle scheduled report:', error);
        res.status(500).json({ error: 'Failed to toggle scheduled report' });
    }
});

export default router;

