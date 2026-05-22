import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
  clerkUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  streak: number;
  lastActive: Date;
  overallWellnessScore: number;
}

const UserSchema: Schema = new Schema(
  {
    clerkUserId: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    firstName: { type: String },
    lastName: { type: String },
    streak: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    overallWellnessScore: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
