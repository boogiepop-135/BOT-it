import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITask extends Document {
	projectId: Types.ObjectId;
	name: string;
	status: 'todo' | 'doing' | 'blocked' | 'done';
	assigneeId?: Types.ObjectId;
	startDate?: Date;
	endDate?: Date;
	progress?: number; // 0..100
	dependencies?: Types.ObjectId[]; // task ids
}

const TaskSchema = new Schema<ITask>({
	projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
	name: { type: String, required: true },
	status: { type: String, enum: ['todo','doing','blocked','done'], default: 'todo' },
	assigneeId: { type: Schema.Types.ObjectId, ref: 'User' },
	startDate: Date,
	endDate: Date,
	progress: { type: Number, default: 0 },
	dependencies: [{ type: Schema.Types.ObjectId, ref: 'Task' }]
}, { timestamps: true });

export const TaskModel = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);
