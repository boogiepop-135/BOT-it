import mongoose, { Document, Schema } from 'mongoose';

export interface IProject extends Document {
    projectNumber: string;
    name: string;
    description: string;
    status: 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'critical';
    startDate: Date;
    endDate?: Date;
    dueDate?: Date;
    progress: number; // 0-100
    assignedTo: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    stakeholders: string[]; // phone numbers
    tasks: Array<{
        id: string;
        title: string;
        description: string;
        status: 'pending' | 'in_progress' | 'completed';
        assignedTo?: string;
        dueDate?: Date;
        completedAt?: Date;
    }>;
    deliverables: string[];
    budget?: number;
    actualCost?: number;
    tags: string[];
    notes: string;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
}

const ProjectSchema = new Schema<IProject>({
    projectNumber: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: { 
        type: String, 
        enum: ['planning', 'in_progress', 'on_hold', 'completed', 'cancelled'], 
        default: 'planning' 
    },
    priority: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'critical'], 
        default: 'medium' 
    },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: Date,
    dueDate: Date,
    progress: { type: Number, default: 0, min: 0, max: 100 },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    stakeholders: [String],
    tasks: [{
        id: { type: String, required: true },
        title: { type: String, required: true },
        description: String,
        status: { 
            type: String, 
            enum: ['pending', 'in_progress', 'completed'], 
            default: 'pending' 
        },
        assignedTo: String,
        dueDate: Date,
        completedAt: Date
    }],
    deliverables: [String],
    budget: Number,
    actualCost: Number,
    tags: [String],
    notes: String,
    completedAt: Date
}, { timestamps: true });

// Generate unique project number
ProjectSchema.pre('save', async function(next) {
    if (!this.projectNumber) {
        const count = await mongoose.model('Project').countDocuments();
        this.projectNumber = `PRJ-${String(count + 1).padStart(6, '0')}`;
    }
    next();
});

export const ProjectModel = mongoose.model<IProject>('Project', ProjectSchema);
