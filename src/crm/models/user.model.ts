import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
    username: string;
    password: string;
    role: 'ceo' | 'admin' | 'rh_compras' | 'estrategia_desarrollo' | 'finanzas' | 'it' | 'user';
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { 
        type: String, 
        enum: ['ceo', 'admin', 'rh_compras', 'estrategia_desarrollo', 'finanzas', 'it', 'user'], 
        default: 'user' 
    }
}, { timestamps: true });

export const UserModel = mongoose.model<IUser>('User', UserSchema);