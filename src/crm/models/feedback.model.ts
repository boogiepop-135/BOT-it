import mongoose, { Document, Schema } from 'mongoose';

export interface IFeedback extends Document {
    title: string;
    description: string;
    period: 'day' | 'week'; // Periodo de retroalimentación: día o semana
    periodDate: Date; // Fecha del día o inicio de la semana
    createdAt: Date;
    updatedAt: Date;
    createdBy?: mongoose.Types.ObjectId; // Usuario que creó la retroalimentación
}

const FeedbackSchema = new Schema<IFeedback>({
    title: { type: String, required: true },
    description: { type: String, required: true },
    period: { 
        type: String, 
        enum: ['day', 'week'], 
        required: true,
        default: 'day'
    },
    periodDate: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Índice para búsquedas por período
FeedbackSchema.index({ period: 1, periodDate: 1 });

export const FeedbackModel = mongoose.model<IFeedback>('Feedback', FeedbackSchema);

