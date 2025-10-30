import mongoose, { Schema, Document } from 'mongoose';

export interface IRequest extends Document {
	type: 'alta' | 'baja';
	entityType: 'empleado' | 'proveedor';
	entityName: string;
	reason?: string;
	status: 'open' | 'approved' | 'rejected';
	requestedBy: string; // user id or username
}

const RequestSchema = new Schema<IRequest>({
	type: { type: String, enum: ['alta','baja'], required: true },
	entityType: { type: String, enum: ['empleado','proveedor'], required: true },
	entityName: { type: String, required: true },
	reason: String,
	status: { type: String, enum: ['open','approved','rejected'], default: 'open' },
	requestedBy: { type: String, required: true }
}, { timestamps: true });

export const RequestModel = mongoose.models.Request || mongoose.model<IRequest>('Request', RequestSchema);
