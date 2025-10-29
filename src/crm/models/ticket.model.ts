import mongoose, { Document, Schema } from 'mongoose';

export interface ITicket extends Document {
    ticketNumber: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
    category: 'hardware' | 'software' | 'network' | 'security' | 'm365' | 'pos' | 'backup' | 'other';
    sucursal: 'lomas' | 'decathlon' | 'centro-sur' | 'ninguna';
    assignedTo?: mongoose.Types.ObjectId;
    createdBy: string; // phone number
    creatorName?: string;
    solution?: string;
    resolutionTime?: number; // in minutes
    comments: Array<{
        user: string;
        message: string;
        createdAt: Date;
    }>;
    attachments?: string[];
    createdAt: Date;
    updatedAt: Date;
    resolvedAt?: Date;
    closedAt?: Date;
}

const TicketSchema = new Schema<ITicket>({
    ticketNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    priority: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'urgent'], 
        default: 'medium' 
    },
    status: { 
        type: String, 
        enum: ['open', 'assigned', 'in_progress', 'resolved', 'closed'], 
        default: 'open' 
    },
    category: { 
        type: String, 
        enum: ['hardware', 'software', 'network', 'security', 'm365', 'pos', 'backup', 'other'], 
        required: true 
    },
    sucursal: {
        type: String,
        enum: ['lomas', 'decathlon', 'centro-sur', 'ninguna'],
        default: 'ninguna'
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    createdBy: { type: String, required: true },
    creatorName: String,
    solution: String,
    resolutionTime: Number,
    comments: [{
        user: String,
        message: String,
        createdAt: { type: Date, default: Date.now }
    }],
    attachments: [String],
    resolvedAt: Date,
    closedAt: Date
}, { timestamps: true });

// Generate unique ticket number (only if not provided)
TicketSchema.pre('save', async function(next) {
    if (!this.ticketNumber) {
        try {
            const count = await TicketModel.countDocuments();
            this.ticketNumber = `TKT-${String(count + 1).padStart(6, '0')}`;
        } catch (error) {
            // Fallback: use timestamp
            this.ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;
        }
    }
    next();
});

export const TicketModel = mongoose.model<ITicket>('Ticket', TicketSchema);
