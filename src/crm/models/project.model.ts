import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProject extends Document {
	name: string;
	status: 'planned' | 'in_progress' | 'paused' | 'done';
	priority?: 'low' | 'medium' | 'high';
	ownerId?: Types.ObjectId;
	members?: Types.ObjectId[];
	startDate?: Date;
	endDate?: Date;
	budget?: number;
	tags?: string[];
}

const ProjectSchema = new Schema<IProject>({
	name: { type: String, required: true },
	status: { type: String, enum: ['planned','in_progress','paused','done'], default: 'planned' },
	priority: { type: String, enum: ['low','medium','high'], default: 'medium' },
	ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
	members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
	startDate: Date,
	endDate: Date,
	budget: Number,
	tags: [String]
}, { timestamps: true });

export const ProjectModel = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
