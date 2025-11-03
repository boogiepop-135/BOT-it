import mongoose, { Schema, Document, Types } from 'mongoose';

export type UserRequestType = 'alta' | 'baja';
export type UserRoleType = 'cajero' | 'lider_piso' | 'sublider_piso' | 'cocina' | 'gerente' | 'supervisor' | 'otro';
export type RequestStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface IRequest extends Document {
	type: UserRequestType;
	entityType: 'empleado' | 'proveedor' | 'usuario';
	entityName: string;
	// Información específica para solicitudes de usuario
	userRole?: UserRoleType; // Tipo de rol del usuario (cajero, líder, etc.)
	platform?: string; // Plataforma externa (POS, sistema, etc.)
	employeeName?: string; // Nombre del empleado
	employeePhone?: string; // Teléfono del empleado
	employeeEmail?: string; // Email del empleado
	// Información general
	reason?: string; // Razón de la solicitud
	notes?: string; // Notas adicionales
	status: RequestStatus;
	requestedBy: string; // user id or username (RH)
	processedBy?: Types.ObjectId; // IT que procesa la solicitud
	processedAt?: Date;
	completionNotes?: string; // Notas del IT al completar
}

const RequestSchema = new Schema<IRequest>({
	type: { type: String, enum: ['alta','baja'], required: true },
	entityType: { type: String, enum: ['empleado','proveedor','usuario'], default: 'usuario' },
	entityName: { type: String, required: true },
	// Información de usuario
	userRole: { type: String, enum: ['cajero','lider_piso','sublider_piso','cocina','gerente','supervisor','otro'] },
	platform: String, // Ej: "POS Oracle", "Sistema de Ventas", etc.
	employeeName: String,
	employeePhone: String,
	employeeEmail: String,
	// Información general
	reason: String,
	notes: String,
	status: { type: String, enum: ['pending','in_progress','completed','cancelled'], default: 'pending' },
	requestedBy: { type: String, required: true },
	processedBy: { type: Schema.Types.ObjectId, ref: 'User' },
	processedAt: Date,
	completionNotes: String
}, { timestamps: true });

export const RequestModel = mongoose.models.Request || mongoose.model<IRequest>('Request', RequestSchema);
