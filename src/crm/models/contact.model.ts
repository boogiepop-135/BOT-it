import mongoose, { Document, Schema } from 'mongoose';

export interface IContact extends Document {
    phoneNumber: string;
    name?: string;
    pushName?: string;
    language?: string;
    lastInteraction: Date;
    firstInteraction?: Date;
    interactionsCount: number;
    tags: string[];
    botPaused?: boolean;
    botPausedAt?: Date;
    role?: 'user' | 'boss' | 'ceo'; // Rol del usuario para personalización
}

const ContactSchema = new Schema<IContact>({
    phoneNumber: { type: String, required: true, unique: true },
    name: String,
    pushName: String,
    language: String,
    lastInteraction: { type: Date, default: Date.now },
    interactionsCount: { type: Number, default: 1 },
    tags: [{ type: String }],
    botPaused: { type: Boolean, default: false },
    botPausedAt: Date,
    role: { 
        type: String, 
        enum: ['user', 'boss', 'ceo'], 
        default: 'user' 
    }
}, { timestamps: true });

export const ContactModel = mongoose.model<IContact>('Contact', ContactSchema);