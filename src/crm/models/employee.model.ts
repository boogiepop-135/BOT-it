import mongoose, { Document, Schema } from 'mongoose';

export interface IEmployee extends Document {
    name: string;
    phoneNumber?: string;
    email?: string;
    position: string; // Cargo o puesto
    department?: string; // Departamento
    status: 'active' | 'inactive' | 'on_leave'; // Estado del empleado
    hireDate: Date; // Fecha de contratación
    terminationDate?: Date; // Fecha de baja
    notes?: string; // Notas adicionales
    createdBy?: mongoose.Types.ObjectId; // Usuario que creó el registro
    updatedBy?: mongoose.Types.ObjectId; // Usuario que actualizó el registro
}

const EmployeeSchema = new Schema<IEmployee>({
    name: { type: String, required: true },
    phoneNumber: String,
    email: String,
    position: { type: String, required: true },
    department: String,
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'on_leave'], 
        default: 'active'
    },
    hireDate: { type: Date, required: true, default: Date.now },
    terminationDate: Date,
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Índices para búsquedas
EmployeeSchema.index({ status: 1 });
EmployeeSchema.index({ phoneNumber: 1 });

export const EmployeeModel = mongoose.model<IEmployee>('Employee', EmployeeSchema);

