import { model, Schema, Types } from "mongoose";

export type TaskDocument = {
  weddingId: Types.ObjectId;
  eventId?: Types.ObjectId;
  title: string;
  description?: string;
  assigneeMembershipId?: Types.ObjectId;
  dueAt?: Date;
  priority: "LOW" | "MEDIUM" | "HIGH";
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
  notes?: string;
  createdByUserId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const taskSchema = new Schema<TaskDocument>({
  weddingId: { type: Schema.Types.ObjectId, required: true, ref: "Wedding", index: true },
  eventId: { type: Schema.Types.ObjectId, ref: "Event" },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, trim: true, maxlength: 2000 },
  assigneeMembershipId: { type: Schema.Types.ObjectId, ref: "WeddingMembership" },
  dueAt: { type: Date },
  priority: { type: String, required: true, enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
  status: { type: String, required: true, enum: ["NOT_STARTED", "IN_PROGRESS", "COMPLETED"], default: "NOT_STARTED" },
  notes: { type: String, trim: true, maxlength: 2000 },
  createdByUserId: { type: Schema.Types.ObjectId, required: true, ref: "User" }
}, { timestamps: true, collection: "tasks" });

taskSchema.index({ weddingId: 1, status: 1, dueAt: 1 });
taskSchema.index({ weddingId: 1, assigneeMembershipId: 1, status: 1 });
taskSchema.index({ weddingId: 1, eventId: 1, status: 1 });

export const Task = model<TaskDocument>("Task", taskSchema);
