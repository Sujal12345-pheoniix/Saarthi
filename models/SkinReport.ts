import mongoose, { Schema, Document } from "mongoose";

export interface ISkinReport extends Document {
  userId: mongoose.Types.ObjectId | string;
  imageUrl?: string;
  healthPercentage: number;
  problemsDetected: string[];
  recommendations: string[];
  hydrationLevel: number;
  confidenceScore: number;
}

const SkinReportSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    imageUrl: { type: String },
    healthPercentage: { type: Number, required: true },
    problemsDetected: [{ type: String }],
    recommendations: [{ type: String }],
    hydrationLevel: { type: Number, default: 50 },
    confidenceScore: { type: Number, required: true },
  },
  { timestamps: true }
);

export default mongoose.models.SkinReport ||
  mongoose.model<ISkinReport>("SkinReport", SkinReportSchema);
