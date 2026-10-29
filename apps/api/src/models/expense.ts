import { model, Schema, Types } from "mongoose";

export const expenseCategories = ["VENUE", "CATERING", "DECOR", "PHOTOGRAPHY_VIDEO", "ATTIRE_JEWELLERY", "BEAUTY_MEHENDI", "MUSIC_ENTERTAINMENT", "INVITATIONS", "TRAVEL", "OTHER"] as const;
export type ExpenseCategory = typeof expenseCategories[number];

export type ExpenseDocument = {
  weddingId: Types.ObjectId;
  eventId?: Types.ObjectId;
  description: string;
  amountRupees: number;
  currency: "INR";
  category: ExpenseCategory;
  paymentStatus: "PAID" | "UNPAID";
  paymentDate?: Date;
  payerName?: string;
  notes?: string;
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const expenseSchema = new Schema<ExpenseDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  eventId: { type: Schema.Types.ObjectId, ref: "Event" },
  description: { type: String, required: true, trim: true, maxlength: 200 },
  amountRupees: { type: Number, required: true, min: 1, validate: { validator: Number.isInteger, message: "Expense amounts must be whole INR rupees." } },
  currency: { type: String, required: true, enum: ["INR"], default: "INR" },
  category: { type: String, required: true, enum: expenseCategories },
  paymentStatus: { type: String, required: true, enum: ["PAID", "UNPAID"], default: "UNPAID" },
  paymentDate: { type: Date },
  payerName: { type: String, trim: true, maxlength: 120 },
  notes: { type: String, trim: true, maxlength: 2000 },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" }
}, { timestamps: true, collection: "expenses" });

expenseSchema.index({ weddingId: 1, paymentStatus: 1, paymentDate: -1 });
expenseSchema.index({ weddingId: 1, eventId: 1 });

export const Expense = model<ExpenseDocument>("Expense", expenseSchema);
