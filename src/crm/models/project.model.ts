import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProject extends Document {
	name: string;
	status: 'planned' | 'in_progress' | 'paused' | 'done';
	priority?: 'low' | 'medium' | 'high';
	ownerId?: Types.ObjectId;
	members?: Types.ObjectId[];
	startDate?: Date;
	endDate?: Date;
	progress?: number; // 0..100
	budget?: number;
	tags?: string[];
	url?: string; // URL del proyecto (Drive, Dropbox, etc.)
	fileUrl?: string; // URL de archivo asociado (PDF, PNG, etc.)
}

const ProjectSchema = new Schema<IProject>({
	name: { type: String, required: true },
	status: { type: String, enum: ['planned','in_progress','paused','done'], default: 'planned' },
	priority: { type: String, enum: ['low','medium','high'], default: 'medium' },
	ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
	members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
	startDate: Date,
	endDate: Date,
	progress: { type: Number, default: 0, min: 0, max: 100 },
	budget: Number,
	tags: [String],
	url: String,
	fileUrl: String
}, { 
	timestamps: true,
	collection: 'projects' // Especificar explícitamente el nombre de la colección
});

export const ProjectModel = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
