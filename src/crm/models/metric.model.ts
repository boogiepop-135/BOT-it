import mongoose, { Document, Schema } from 'mongoose';

export interface IMetric extends Document {
    metricType: 'ticket_resolution_time' | 'ticket_count' | 'project_completion' | 'system_uptime' | 'user_satisfaction' | 'backup_success_rate';
    value: number;
    metadata?: {
        [key: string]: any;
    };
    period: {
        start: Date;
        end: Date;
    };
    createdAt: Date;
}

const MetricSchema = new Schema<IMetric>({
    metricType: { 
        type: String, 
        enum: ['ticket_resolution_time', 'ticket_count', 'project_completion', 'system_uptime', 'user_satisfaction', 'backup_success_rate'],
        required: true 
    },
    value: { type: Number, required: true },
    metadata: { type: Schema.Types.Mixed },
    period: {
        start: { type: Date, required: true },
        end: { type: Date, required: true }
    }
}, { timestamps: true });

export const MetricModel = mongoose.model<IMetric>('Metric', MetricSchema);
