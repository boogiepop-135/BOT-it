import mongoose, { Document, Schema } from 'mongoose';

export interface IPaymentReminder extends Document {
    title: string;
    description?: string;
    phoneNumber: string; // To whom to send
    amount?: number;
    dueDate: Date; // Payment due date
    reminderDays: number[]; // Days before due date to send reminders (e.g. [7, 3, 1])
    isMonthly: boolean; // If it's a monthly recurring reminder
    isActive: boolean;
    lastSent?: Date;
    nextReminder?: Date; // Calculated next reminder date
    tags: string[];
    
    createdAt: Date;
    updatedAt: Date;
}

const PaymentReminderSchema = new Schema<IPaymentReminder>({
    title: { type: String, required: true },
    description: String,
    phoneNumber: { type: String, required: true },
    amount: Number,
    dueDate: { type: Date, required: true },
    reminderDays: [{ type: Number }], // Days before due date
    isMonthly: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastSent: Date,
    nextReminder: Date,
    tags: [{ type: String }]
}, { timestamps: true });

// Auto-calculate next reminder date
PaymentReminderSchema.pre('save', function(next) {
    if (this.isModified('dueDate') || this.isModified('isActive') || this.isModified('reminderDays')) {
        if (this.isActive && this.reminderDays.length > 0) {
            const now = new Date();
            const dueDate = new Date(this.dueDate);
            const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            // Find the closest reminder that hasn't passed yet
            const sortedDays = [...this.reminderDays].sort((a, b) => b - a);
            let nextReminderDay = -1;
            
            for (const day of sortedDays) {
                if (daysUntilDue >= day) {
                    nextReminderDay = day;
                    break;
                }
            }
            
            if (nextReminderDay > 0) {
                const nextReminderDate = new Date(dueDate);
                nextReminderDate.setDate(dueDate.getDate() - nextReminderDay);
                this.nextReminder = nextReminderDate;
            } else {
                // All reminders passed, set to null
                this.nextReminder = null;
            }
        }
    }
    next();
});

export const PaymentReminderModel = mongoose.model<IPaymentReminder>('PaymentReminder', PaymentReminderSchema);

