import mongoose from 'mongoose';

export interface SelfDestructDocument extends mongoose.Document {
    active: boolean;
    scheduledDate: Date;
    activatedAt: Date;
    activatedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const SelfDestructSchema = new mongoose.Schema<SelfDestructDocument>(
    {
        active: {
            type: Boolean,
            default: false,
            required: true
        },
        scheduledDate: {
            type: Date,
            required: false
        },
        activatedAt: {
            type: Date,
            required: false
        },
        activatedBy: {
            type: String,
            required: false
        }
    },
    {
        timestamps: true,
        collection: 'selfdestruct'
    }
);

export const SelfDestructModel = mongoose.model<SelfDestructDocument>('SelfDestruct', SelfDestructSchema);


