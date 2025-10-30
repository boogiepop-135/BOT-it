import mongoose, { Schema, Document } from 'mongoose';

export interface IInventoryCost extends Document {
	itemCode: string;
	description?: string;
	quantity: number;
	costPerUnit: number;
	currency: string;
	projectId?: string; // opcional vincular a proyecto
}

const InventoryCostSchema = new Schema<IInventoryCost>({
	itemCode: { type: String, required: true },
	description: { type: String },
	quantity: { type: Number, required: true, min: 0 },
	costPerUnit: { type: Number, required: true, min: 0 },
	currency: { type: String, default: 'USD' },
	projectId: { type: String },
}, { timestamps: true });

export const InventoryCostModel = mongoose.models.InventoryCost || mongoose.model<IInventoryCost>('InventoryCost', InventoryCostSchema);


