import { TicketModel } from '../crm/models/ticket.model';
import { ContactModel } from '../crm/models/contact.model';
import { FeedbackModel } from '../crm/models/feedback.model';
import { IScheduledReport } from '../crm/models/scheduled-report.model';
import logger from '../configs/logger.config';

/**
 * Generador de reportes para CEOs
 * 
 * Sistema de automatización desarrollado por Levi Eduardo
 * para San Cosme Orgánico - Automatización Integral
 */

export interface ReportData {
    period: {
        startDate: Date;
        endDate: Date;
    };
    tickets: {
        total: number;
        byStatus: Record<string, number>;
        byPriority: Record<string, number>;
        byCategory: Record<string, number>;
        bySucursal: Record<string, number>;
        resolved: number;
        resolutionTime: {
            average: number;
            total: number;
        };
        list: any[];
    };
    metrics?: {
        totalContacts: number;
        newContacts: number;
        totalInteractions: number;
        feedbackCount: number;
    };
}

/**
 * Genera un reporte basado en la configuración programada
 */
export async function generateReport(reportConfig: IScheduledReport): Promise<string> {
    try {
        const { startDate, endDate } = reportConfig.dateRange;
        const reportData = await gatherReportData(startDate, endDate, reportConfig);

        return formatReport(reportData, reportConfig);
    } catch (error) {
        logger.error('Error generating report:', error);
        throw error;
    }
}

/**
 * Recopila todos los datos para el reporte
 */
async function gatherReportData(
    startDate: Date,
    endDate: Date,
    config: IScheduledReport
): Promise<ReportData> {
    // Construir query para tickets
    const ticketQuery: any = {
        createdAt: {
            $gte: startDate,
            $lte: endDate
        }
    };

    // Aplicar filtros si existen
    if (config.filters) {
        if (config.filters.ticketCategories?.length) {
            ticketQuery.category = { $in: config.filters.ticketCategories };
        }
        if (config.filters.ticketStatuses?.length) {
            ticketQuery.status = { $in: config.filters.ticketStatuses };
        }
        if (config.filters.ticketPriorities?.length) {
            ticketQuery.priority = { $in: config.filters.ticketPriorities };
        }
        if (config.filters.sucursales?.length) {
            ticketQuery.sucursal = { $in: config.filters.sucursales };
        }
    }

    const tickets = await TicketModel.find(ticketQuery).sort({ createdAt: -1 }).lean();

    // Estadísticas de tickets
    const ticketsByStatus: Record<string, number> = {};
    const ticketsByPriority: Record<string, number> = {};
    const ticketsByCategory: Record<string, number> = {};
    const ticketsBySucursal: Record<string, number> = {};

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    tickets.forEach((ticket: any) => {
        // Por estado
        ticketsByStatus[ticket.status] = (ticketsByStatus[ticket.status] || 0) + 1;
        
        // Por prioridad
        ticketsByPriority[ticket.priority] = (ticketsByPriority[ticket.priority] || 0) + 1;
        
        // Por categoría
        ticketsByCategory[ticket.category] = (ticketsByCategory[ticket.category] || 0) + 1;
        
        // Por sucursal
        ticketsBySucursal[ticket.sucursal] = (ticketsBySucursal[ticket.sucursal] || 0) + 1;

        // Tiempo de resolución
        if (ticket.resolutionTime) {
            totalResolutionTime += ticket.resolutionTime;
            resolvedCount++;
        }
    });

    const reportData: ReportData = {
        period: { startDate, endDate },
        tickets: {
            total: tickets.length,
            byStatus: ticketsByStatus,
            byPriority: ticketsByPriority,
            byCategory: ticketsByCategory,
            bySucursal: ticketsBySucursal,
            resolved: tickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length,
            resolutionTime: {
                average: resolvedCount > 0 ? Math.round(totalResolutionTime / resolvedCount) : 0,
                total: totalResolutionTime
            },
            list: config.reportType === 'full' ? tickets.slice(0, 50) : [] // Limitar a 50 tickets para no saturar
        }
    };

    // Métricas adicionales si se solicitan
    if (config.includeMetrics) {
        const totalContacts = await ContactModel.countDocuments({
            lastInteraction: { $gte: startDate, $lte: endDate }
        });

        const newContacts = await ContactModel.countDocuments({
            firstInteraction: { $gte: startDate, $lte: endDate }
        });

        const contacts = await ContactModel.find({
            lastInteraction: { $gte: startDate, $lte: endDate }
        });

        const totalInteractions = contacts.reduce((sum, contact) => sum + (contact.interactionsCount || 0), 0);

        const feedbackCount = await FeedbackModel.countDocuments({
            periodDate: { $gte: startDate, $lte: endDate }
        });

        reportData.metrics = {
            totalContacts,
            newContacts,
            totalInteractions,
            feedbackCount
        };
    }

    return reportData;
}

/**
 * Formatea el reporte en texto legible
 */
function formatReport(data: ReportData, config: IScheduledReport): string {
    const startDateStr = data.period.startDate.toLocaleDateString('es-MX');
    const endDateStr = data.period.endDate.toLocaleDateString('es-MX');

    let report = `
📊 *REPORTE AUTOMÁTICO - SAN COSME ORGÁNICO*

*Período:* ${startDateStr} - ${endDateStr}
*Tipo:* ${config.reportType === 'tickets' ? 'Solo Tickets' : config.reportType === 'full' ? 'Completo' : 'Personalizado'}

${config.name ? `*Nombre del Reporte:* ${config.name}\n` : ''}

📋 *TICKETS* 🎫

📈 *Resumen General*
• Total de tickets: *${data.tickets.total}*
• Tickets resueltos: *${data.tickets.resolved}*
• Tiempo promedio de resolución: *${data.tickets.resolutionTime.average} minutos*

📊 *Por Estado*
${Object.entries(data.tickets.byStatus).map(([status, count]) => {
    const emoji = {
        'open': '🟢',
        'assigned': '🟡',
        'in_progress': '🟠',
        'resolved': '✅',
        'closed': '✔️'
    }[status] || '📝';
    return `${emoji} ${status}: *${count}*`;
}).join('\n')}

🔥 *Por Prioridad*
${Object.entries(data.tickets.byPriority).map(([priority, count]) => {
    const emoji = {
        'low': '🟢',
        'medium': '🟡',
        'high': '🟠',
        'urgent': '🔴'
    }[priority] || '📝';
    return `${emoji} ${priority}: *${count}*`;
}).join('\n')}

📦 *Por Categoría*
${Object.entries(data.tickets.byCategory).map(([category, count]) => `• ${category}: *${count}*`).join('\n')}

🏢 *Por Sucursal*
${Object.entries(data.tickets.bySucursal).map(([sucursal, count]) => `• ${sucursal}: *${count}*`).join('\n')}
`;

    // Agregar métricas adicionales si están disponibles
    if (data.metrics) {
        report += `

📈 *MÉTRICAS GENERALES*

👥 *Contactos*
• Total de contactos activos: *${data.metrics.totalContacts}*
• Nuevos contactos: *${data.metrics.newContacts}*
• Total de interacciones: *${data.metrics.totalInteractions}*

📝 *Retroalimentación*
• Retroalimentaciones creadas: *${data.metrics.feedbackCount}*
`;
    }

    // Lista de tickets si es reporte completo
    if (config.reportType === 'full' && data.tickets.list.length > 0) {
        report += `\n📋 *Últimos Tickets*\n`;
        data.tickets.list.slice(0, 10).forEach((ticket: any) => {
            const statusEmoji = {
                'open': '🟢',
                'assigned': '🟡',
                'in_progress': '🟠',
                'resolved': '✅',
                'closed': '✔️'
            }[ticket.status] || '📝';

            report += `${statusEmoji} *${ticket.ticketNumber}* - ${ticket.title}\n`;
            report += `   ${ticket.category} | ${ticket.priority} | ${ticket.sucursal}\n\n`;
        });
    }

    report += `\n---
🤖 *Reporte generado automáticamente*
💻 Programado por: Levi Eduardo
🏢 San Cosme Orgánico - Automatización Integral
`;

    return report;
}

