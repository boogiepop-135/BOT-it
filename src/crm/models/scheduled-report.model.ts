import mongoose, { Document, Schema } from 'mongoose';

export interface IScheduledReport extends Document {
    name: string; // Nombre del reporte
    description?: string;
    reportType: 'tickets' | 'full' | 'custom'; // Tipo de reporte
    dateRange: {
        startDate: Date; // Fecha de inicio del período a reportar
        endDate: Date; // Fecha de fin del período a reportar
    };
    schedule: {
        enabled: boolean; // Si está activo
        sendDate: Date; // Fecha y hora de envío
        frequency?: 'once' | 'weekly' | 'monthly'; // Frecuencia (una vez, semanal, mensual)
        dayOfWeek?: number; // 0-6 (Domingo-Sábado) para reportes semanales
        dayOfMonth?: number; // 1-31 para reportes mensuales
        time: string; // Hora de envío en formato HH:mm (ej: "09:00")
    };
    recipients: {
        phoneNumbers: string[]; // Números de teléfono de CEOs
        userIds?: mongoose.Types.ObjectId[]; // IDs de usuarios CEO
    };
    filters?: {
        ticketCategories?: string[]; // Filtros de categorías de tickets
        ticketStatuses?: string[]; // Filtros de estados de tickets
        ticketPriorities?: string[]; // Filtros de prioridades
        sucursales?: string[]; // Filtros de sucursales
    };
    includeMetrics?: boolean; // Incluir métricas generales
    createdBy?: mongoose.Types.ObjectId;
    lastSentAt?: Date;
    nextSendAt?: Date;
    lastReportSnapshot?: {
        // Snapshots para detectar cambios
        projectsCount?: number;
        tasksCount?: number;
        completedTasks?: number;
        projectsProgress?: number;
        tasksProgress?: number;
        ticketsCount?: number;
        ticketsResolved?: number;
        snapshotDate?: Date;
    };
    onlySendIfChanges?: boolean; // Solo enviar si hay cambios
    createdAt: Date;
    updatedAt: Date;
}

const ScheduledReportSchema = new Schema<IScheduledReport>({
    name: { type: String, required: true },
    description: String,
    reportType: {
        type: String,
        enum: ['tickets', 'full', 'custom'],
        default: 'full'
    },
    dateRange: {
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true }
    },
    schedule: {
        enabled: { type: Boolean, default: true },
        sendDate: { type: Date, required: true },
        frequency: {
            type: String,
            enum: ['once', 'weekly', 'monthly'],
            default: 'once'
        },
        dayOfWeek: Number, // 0-6
        dayOfMonth: Number, // 1-31
        time: { type: String, required: true, default: '09:00' } // HH:mm format
    },
    recipients: {
        phoneNumbers: [{ type: String, required: true }],
        userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }]
    },
    filters: {
        ticketCategories: [String],
        ticketStatuses: [String],
        ticketPriorities: [String],
        sucursales: [String]
    },
    includeMetrics: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    lastSentAt: Date,
    nextSendAt: Date,
    lastReportSnapshot: {
        projectsCount: Number,
        tasksCount: Number,
        completedTasks: Number,
        projectsProgress: Number,
        tasksProgress: Number,
        ticketsCount: Number,
        ticketsResolved: Number,
        snapshotDate: Date
    },
    onlySendIfChanges: { type: Boolean, default: true } // Por defecto solo enviar si hay cambios
}, { timestamps: true });

// Calcular próxima fecha de envío basada en la frecuencia
ScheduledReportSchema.methods.calculateNextSendDate = function() {
    if (this.schedule.frequency === 'once') {
        return null; // Ya no se enviará
    }

    const now = new Date();
    let nextSend = new Date();

    if (this.schedule.frequency === 'weekly') {
        const dayOfWeek = this.schedule.dayOfWeek ?? 1; // Por defecto Lunes
        const [hours, minutes] = this.schedule.time.split(':').map(Number);
        
        // Calcular días hasta el próximo día de la semana
        const currentDay = now.getDay();
        let daysUntilNext = (dayOfWeek - currentDay + 7) % 7;
        
        // Si es hoy pero ya pasó la hora, programar para la próxima semana
        if (daysUntilNext === 0 && (now.getHours() > hours || (now.getHours() === hours && now.getMinutes() >= minutes))) {
            daysUntilNext = 7;
        }

        nextSend.setDate(now.getDate() + daysUntilNext);
        nextSend.setHours(hours, minutes, 0, 0);
    } else if (this.schedule.frequency === 'monthly') {
        const dayOfMonth = this.schedule.dayOfMonth ?? 1;
        const [hours, minutes] = this.schedule.time.split(':').map(Number);
        
        nextSend.setDate(dayOfMonth);
        nextSend.setHours(hours, minutes, 0, 0);
        
        // Si ya pasó este mes, programar para el siguiente
        if (nextSend < now) {
            nextSend.setMonth(nextSend.getMonth() + 1);
        }
    }

    return nextSend;
};

export const ScheduledReportModel = mongoose.model<IScheduledReport>('ScheduledReport', ScheduledReportSchema);

