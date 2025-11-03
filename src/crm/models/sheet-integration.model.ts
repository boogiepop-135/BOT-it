import mongoose, { Schema, Document } from 'mongoose';

export interface SheetMapping {
    sheetName: string;
    collection: string; // nombre de colección Mongo
    fieldMap: Record<string, string>; // columna -> campo BD
}

export interface SheetIntegrationDocument extends Document {
    spreadsheetId: string;
    url: string;
    title?: string;
    sheets?: string[];
    mappings: SheetMapping[];
    createdAt: Date;
    updatedAt: Date;
}

const SheetIntegrationSchema = new Schema<SheetIntegrationDocument>({
    spreadsheetId: { type: String, required: true, index: true, unique: true },
    url: { type: String, required: true },
    title: { type: String },
    sheets: { type: [String], default: [] },
    mappings: {
        type: [
            new Schema<SheetMapping>({
                sheetName: { type: String, required: true },
                collection: { type: String, required: true },
                fieldMap: { type: Schema.Types.Mixed, default: {} }
            }, { _id: false })
        ],
        default: []
    }
}, { timestamps: true });

export const SheetIntegrationModel = mongoose.models.SheetIntegration || mongoose.model<SheetIntegrationDocument>('SheetIntegration', SheetIntegrationSchema);


