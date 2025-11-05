import { TicketModel } from '../crm/models/ticket.model';
import { ContactModel } from '../crm/models/contact.model';
import { FeedbackModel } from '../crm/models/feedback.model';
import { ProjectModel } from '../crm/models/project.model';
import { TaskModel } from '../crm/models/task.model';
import { IScheduledReport } from '../crm/models/scheduled-report.model';
import EnvConfig from '../configs/env.config';
import logger from '../configs/logger.config';

/**
 * Generador de reportes para CEOs
 * 
 * Sistema de automatización desarrollado por Levi Eduardo
 * para Levi Villarreal - Asistente Personal
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
    projects?: {
        total: number;
        byStatus: Record<string, number>;
        active: any[];
        progressAverage: number;
    };
    tasks?: {
        total: number;
        byStatus: Record<string, number>;
        byProject: Record<string, number>;
        completed: number;
        inProgress: any[];
        progressAverage: number;
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
/**
 * Verificar si hay cambios desde el último reporte
 */
export async function hasChanges(reportConfig: IScheduledReport): Promise<boolean> {
    // Si no está configurado para solo enviar si hay cambios, siempre retornar true
    if (!reportConfig.onlySendIfChanges) {
        return true;
    }

    // Si no hay snapshot previo, hay cambios (primer envío)
    if (!reportConfig.lastReportSnapshot || !reportConfig.lastReportSnapshot.snapshotDate) {
        return true;
    }

    const startDate = reportConfig.dateRange.startDate;
    const endDate = reportConfig.dateRange.endDate;

    // Obtener datos actuales
    const currentData = await gatherReportData(startDate, endDate, reportConfig);
    const snapshot = reportConfig.lastReportSnapshot;

    // Comparar métricas clave
    const hasProjectChanges = 
        (currentData.projects?.total || 0) !== (snapshot.projectsCount || 0) ||
        (currentData.projects?.progressAverage || 0) !== (snapshot.projectsProgress || 0);

    const hasTaskChanges = 
        (currentData.tasks?.total || 0) !== (snapshot.tasksCount || 0) ||
        (currentData.tasks?.completed || 0) !== (snapshot.completedTasks || 0) ||
        (currentData.tasks?.progressAverage || 0) !== (snapshot.tasksProgress || 0);

    const hasTicketChanges = 
        (currentData.tickets?.total || 0) !== (snapshot.ticketsCount || 0) ||
        (currentData.tickets?.resolved || 0) !== (snapshot.ticketsResolved || 0);

    return hasProjectChanges || hasTaskChanges || hasTicketChanges;
}

/**
 * Guardar snapshot del reporte actual
 */
export async function saveReportSnapshot(reportConfig: IScheduledReport, reportData: ReportData): Promise<void> {
    const snapshot = {
        projectsCount: reportData.projects?.total || 0,
        tasksCount: reportData.tasks?.total || 0,
        completedTasks: reportData.tasks?.completed || 0,
        projectsProgress: reportData.projects?.progressAverage || 0,
        tasksProgress: reportData.tasks?.progressAverage || 0,
        ticketsCount: reportData.tickets?.total || 0,
        ticketsResolved: reportData.tickets?.resolved || 0,
        snapshotDate: new Date()
    };

    reportConfig.lastReportSnapshot = snapshot;
    await reportConfig.save();
}

export async function generateReport(reportConfig: IScheduledReport, recipientPhone?: string): Promise<string> {
    try {
        const { startDate, endDate } = reportConfig.dateRange;
        const reportData = await gatherReportData(startDate, endDate, reportConfig);

        return formatReport(reportData, reportConfig, recipientPhone);
    } catch (error) {
        logger.error('Error generating report:', error);
        throw error;
    }
}

/**
 * Recopila todos los datos para el reporte
 */
export async function gatherReportData(
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

    // Incluir proyectos y tareas - Mejorado para mostrar progreso
    const projects = await ProjectModel.find({
        $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { updatedAt: { $gte: startDate, $lte: endDate } }
        ]
    }).lean();

    const projectsByStatus: Record<string, number> = {};
    let totalProgress = 0;
    let projectsWithProgress = 0;

    projects.forEach((project: any) => {
        projectsByStatus[project.status] = (projectsByStatus[project.status] || 0) + 1;
        
        // Calcular progreso promedio
        if (project.progress !== undefined && project.progress !== null) {
            totalProgress += project.progress;
            projectsWithProgress++;
        }
    });

    const activeProjects = projects.filter((p: any) => 
        p.status === 'in_progress' || p.status === 'planned'
    );

    reportData.projects = {
        total: projects.length,
        byStatus: projectsByStatus,
        active: activeProjects,
        progressAverage: projectsWithProgress > 0 ? Math.round(totalProgress / projectsWithProgress) : 0
    };

    // Incluir tareas
    const tasks = await TaskModel.find({
        $or: [
            { createdAt: { $gte: startDate, $lte: endDate } },
            { updatedAt: { $gte: startDate, $lte: endDate } }
        ]
    }).populate('projectId', 'name').lean();

    const tasksByStatus: Record<string, number> = {};
    const tasksByProject: Record<string, number> = {};
    let totalTaskProgress = 0;
    let tasksWithProgress = 0;

    tasks.forEach((task: any) => {
        tasksByStatus[task.status] = (tasksByStatus[task.status] || 0) + 1;
        
        if (task.projectId && task.projectId.name) {
            const projectName = task.projectId.name;
            tasksByProject[projectName] = (tasksByProject[projectName] || 0) + 1;
        }

        if (task.progress !== undefined && task.progress !== null) {
            totalTaskProgress += task.progress;
            tasksWithProgress++;
        }
    });

    const completedTasks = tasks.filter((t: any) => t.status === 'done').length;
    const inProgressTasks = tasks.filter((t: any) => 
        t.status === 'doing' || (t.status === 'todo' && t.progress && t.progress > 0)
    );

    reportData.tasks = {
        total: tasks.length,
        byStatus: tasksByStatus,
        byProject: tasksByProject,
        completed: completedTasks,
        inProgress: inProgressTasks.slice(0, 10), // Limitar a 10
        progressAverage: tasksWithProgress > 0 ? Math.round(totalTaskProgress / tasksWithProgress) : 0
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
 * Obtener información del destinatario desde número de teléfono
 * Configuración desde variables de entorno
 */
export interface BossInfo {
    name: string;
    role: 'boss' | 'ceo' | 'admin';
}

export function getBossInfo(phoneNumber: string): BossInfo | null {
        // Normalizar número (remover caracteres especiales)
        const phoneNormalized = phoneNumber.replace(/[^0-9]/g, '');
        
        // Verificar si es Levi Villarreal (Super Admin)
        if (EnvConfig.LEVI_PHONE && phoneNormalized === EnvConfig.LEVI_PHONE.replace(/[^0-9]/g, '')) {
            return {
                name: 'Levi Villarreal',
                role: 'admin' // Super admin tiene rol admin para permisos
            };
        }
        
        // Buscar en variables de entorno primero
        if (EnvConfig.SALMA_PHONE && phoneNormalized === EnvConfig.SALMA_PHONE.replace(/[^0-9]/g, '')) {
            return {
                name: 'Salma',
                role: (EnvConfig.SALMA_ROLE as 'boss' | 'ceo' | 'admin') || 'boss'
            };
        }
        
        if (EnvConfig.FRANCISCO_PHONE && phoneNormalized === EnvConfig.FRANCISCO_PHONE.replace(/[^0-9]/g, '')) {
            return {
                name: 'Francisco',
                role: (EnvConfig.FRANCISCO_ROLE as 'boss' | 'ceo' | 'admin') || 'boss'
            };
        }
        
        // Búsqueda por palabras clave como fallback
        const phoneLower = phoneNumber.toLowerCase().replace(/[^0-9a-z]/g, '');
        const keywords: Record<string, { name: string; defaultRole: 'boss' | 'ceo' }> = {
            'salma': { name: 'Salma', defaultRole: 'boss' },
            'francisco': { name: 'Francisco', defaultRole: 'boss' },
            'franco': { name: 'Francisco', defaultRole: 'boss' },
            'frank': { name: 'Francisco', defaultRole: 'boss' }
        };
        
        for (const [key, info] of Object.entries(keywords)) {
            if (phoneLower.includes(key)) {
                return {
                    name: info.name,
                    role: info.defaultRole
                };
            }
        }
        
        return null;
    }

/**
 * Obtener nombre del destinatario desde número de teléfono (compatibilidad)
 */
export function getRecipientName(phoneNumber: string): string | null {
    const bossInfo = getBossInfo(phoneNumber);
    return bossInfo ? bossInfo.name : null;
}

/**
 * Generar mensaje personalizado según el destinatario
 */
function getPersonalizedGreeting(phoneNumber: string, startDateStr: string, endDateStr: string): string {
    const recipientName = getRecipientName(phoneNumber);
    
    if (recipientName === 'Salma') {
        return `👋 *Hola Salma!*\n\n📊 *Reporte Semanal de IT*\n\n*Período:* ${startDateStr} - ${endDateStr}\n\nAquí tienes un resumen del trabajo realizado esta semana en el área de IT:`;
    } else if (recipientName === 'Francisco') {
        return `👋 *Hola Francisco!*\n\n📊 *Reporte Semanal de IT*\n\n*Período:* ${startDateStr} - ${endDateStr}\n\nTe comparto el resumen semanal de actividades del área de IT:`;
    }
    
    return `📊 *REPORTE AUTOMÁTICO - LEVI VILLARREAL*\n\n*Período:* ${startDateStr} - ${endDateStr}`;
}

/**
 * Formatea el reporte en texto legible con personalización
 */
function formatReport(data: ReportData, config: IScheduledReport, recipientPhone?: string): string {
    const startDateStr = data.period.startDate.toLocaleDateString('es-MX');
    const endDateStr = data.period.endDate.toLocaleDateString('es-MX');

    // Usar el primer número de teléfono si hay múltiples
    const phoneNumber = recipientPhone || (config.recipients?.phoneNumbers?.[0] || '');
    
    let report = getPersonalizedGreeting(phoneNumber, startDateStr, endDateStr);
    
    report += `\n*Tipo:* ${config.reportType === 'tickets' ? 'Solo Tickets' : config.reportType === 'full' ? 'Completo' : 'Personalizado'}\n`;
    report += `${config.name ? `*Nombre del Reporte:* ${config.name}\n` : ''}`;

    report += `\n📋 *TICKETS* 🎫\n\n`;
    report += `📈 *Resumen General*\n`;
    report += `• Total de tickets: *${data.tickets.total}*\n`;
    report += `• Tickets resueltos: *${data.tickets.resolved}*\n`;
    report += `• Tiempo promedio de resolución: *${data.tickets.resolutionTime.average} minutos*\n\n`;
    
    report += `📊 *Por Estado*\n`;
    report += Object.entries(data.tickets.byStatus).map(([status, count]) => {
        const emoji = {
            'open': '🟢',
            'assigned': '🟡',
            'in_progress': '🟠',
            'resolved': '✅',
            'closed': '✔️'
        }[status] || '📝';
        return `${emoji} ${status}: *${count}*`;
    }).join('\n');
    
    report += `\n\n🔥 *Por Prioridad*\n`;
    report += Object.entries(data.tickets.byPriority).map(([priority, count]) => {
        const emoji = {
            'low': '🟢',
            'medium': '🟡',
            'high': '🟠',
            'urgent': '🔴'
        }[priority] || '📝';
        return `${emoji} ${priority}: *${count}*`;
    }).join('\n');
    
    report += `\n\n📦 *Por Categoría*\n`;
    report += Object.entries(data.tickets.byCategory).map(([category, count]) => `• ${category}: *${count}*`).join('\n');
    
    report += `\n\n🏢 *Por Sucursal*\n`;
    report += Object.entries(data.tickets.bySucursal).map(([sucursal, count]) => `• ${sucursal}: *${count}*`).join('\n');

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

    // Sección de PROYECTOS mejorada
    if (data.projects && data.projects.total > 0) {
        report += `\n\n🚀 *PROYECTOS EN CURSO*\n\n`;
        report += `📊 *Resumen General*\n`;
        report += `• Total de proyectos: *${data.projects.total}*\n`;
        report += `• Proyectos activos: *${data.projects.active.length}*\n\n`;
        
        report += `📈 *Por Estado*\n`;
        Object.entries(data.projects.byStatus).forEach(([status, count]) => {
            const statusEmoji = {
                'planned': '📋',
                'in_progress': '🚀',
                'paused': '⏸️',
                'done': '✅'
            }[status] || '📝';
            const statusName = {
                'planned': 'Planificados',
                'in_progress': 'En Progreso',
                'paused': 'Pausados',
                'done': 'Completados'
            }[status] || status;
            report += `${statusEmoji} ${statusName}: *${count}*\n`;
        });

        // Mostrar proyectos activos con detalles y progreso
        if (data.projects.active.length > 0) {
            report += `\n🎯 *Proyectos Activos:*\n`;
            data.projects.active.slice(0, 5).forEach((project: any) => {
                const statusEmoji = {
                    'planned': '📋',
                    'in_progress': '🚀',
                    'paused': '⏸️'
                }[project.status] || '📝';
                
                report += `${statusEmoji} *${project.name}*\n`;
                if (project.description) {
                    report += `   ${project.description.substring(0, 60)}${project.description.length > 60 ? '...' : ''}\n`;
                }
                
                // Mostrar progreso si está disponible
                if (project.progress !== undefined && project.progress !== null) {
                    const barra = generateProgressBar(project.progress);
                    report += `   📊 Progreso: ${barra} ${project.progress}%\n`;
                }
                
                const statusName = {
                    'planned': 'Planificado',
                    'in_progress': 'En Progreso',
                    'paused': 'Pausado'
                }[project.status] || project.status;
                
                report += `   Estado: ${statusName} | Prioridad: ${project.priority || 'media'}\n\n`;
            });
            
            // Mostrar promedio de progreso si hay proyectos con progreso
            if (data.projects.progressAverage > 0) {
                report += `📊 *Progreso promedio:* ${data.projects.progressAverage}%\n`;
            }
        }
    }

    // Sección de TAREAS mejorada
    if (data.tasks && data.tasks.total > 0) {
        report += `\n\n✅ *TAREAS Y ACTIVIDADES*\n\n`;
        report += `📊 *Resumen General*\n`;
        report += `• Total de tareas: *${data.tasks.total}*\n`;
        report += `• Tareas completadas: *${data.tasks.completed}*\n`;
        report += `• Tareas en progreso: *${data.tasks.inProgress.length}*\n`;
        report += `• Progreso promedio: *${data.tasks.progressAverage}%*\n\n`;
        
        report += `📈 *Por Estado*\n`;
        Object.entries(data.tasks.byStatus).forEach(([status, count]) => {
            const statusEmoji = {
                'todo': '📋',
                'doing': '🚀',
                'blocked': '🚫',
                'done': '✅'
            }[status] || '📝';
            const statusName = {
                'todo': 'Pendientes',
                'doing': 'En Progreso',
                'blocked': 'Bloqueadas',
                'done': 'Completadas'
            }[status] || status;
            report += `${statusEmoji} ${statusName}: *${count}*\n`;
        });

        // Mostrar tareas en progreso con progreso
        if (data.tasks.inProgress.length > 0) {
            report += `\n🚀 *Tareas en Progreso:*\n`;
            data.tasks.inProgress.slice(0, 8).forEach((task: any) => {
                const progressBar = generateProgressBar(task.progress || 0);
                const projectName = task.projectId?.name || 'Sin proyecto';
                report += `\n📋 *${task.name}*\n`;
                report += `   Proyecto: ${projectName}\n`;
                report += `   Progreso: ${progressBar} ${task.progress || 0}%\n`;
            });
        }

        // Tareas por proyecto
        if (Object.keys(data.tasks.byProject).length > 0) {
            report += `\n📦 *Tareas por Proyecto:*\n`;
            Object.entries(data.tasks.byProject).slice(0, 5).forEach(([projectName, count]) => {
                report += `• ${projectName}: *${count}* tareas\n`;
            });
        }
    }

    // Lista de tickets si es reporte completo
    if (config.reportType === 'full' && data.tickets.list.length > 0) {
        report += `\n\n📋 *ÚLTIMOS TICKETS*\n`;
        data.tickets.list.slice(0, 8).forEach((ticket: any) => {
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

    // Mensaje de cierre personalizado
    const recipientName = getRecipientName(phoneNumber);
    if (recipientName === 'Salma') {
        report += `\n---\n💼 *Cualquier pregunta o seguimiento que necesites, estoy a tus órdenes.*\n\n🤖 Reporte generado automáticamente por Levi Villarreal\n💻 Desarrollador Full Stack & Analista de IT`;
    } else if (recipientName === 'Francisco') {
        report += `\n---\n💼 *Si necesitas más detalles o seguimiento de algún tema, con gusto te ayudo.*\n\n🤖 Reporte generado automáticamente por Levi Villarreal\n💻 Desarrollador Full Stack & Analista de IT`;
    } else {
        report += `\n---\n🤖 *Reporte generado automáticamente*\n💻 Programado por: Levi Villarreal\n🚀 Desarrollador Full Stack & Analista de IT`;
    }

    return report;
}

/**
 * Generar barra de progreso visual
 */
function generateProgressBar(progress: number): string {
    const filled = Math.round(progress / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

