import mongoose, { Schema, Document } from "mongoose";

export interface IPhysicalReport extends Document {
  userId: mongoose.Types.ObjectId | string;
  height?: number; // cm
  weight?: number; // kg
  bmi?: number;
  waterIntake: number; // liters
  exerciseMinutes: number;
  fitnessScore: number;
  recommendations: string[];
}

const PhysicalReportSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    height: { type: Number },
    weight: { type: Number },
    bmi: { type: Number },
    waterIntake: { type: Number, default: 0 },
    exerciseMinutes: { type: Number, default: 0 },
    fitnessScore: { type: Number, default: 0 },
    recommendations: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.models.PhysicalReport ||
  mongoose.model<IPhysicalReport>("PhysicalReport", PhysicalReportSchema);
