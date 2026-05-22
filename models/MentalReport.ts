import mongoose, { Schema, Document } from "mongoose";

export interface IMentalReport extends Document {
  userId: mongoose.Types.ObjectId | string;
  moodScore: number; // 0-100
  stressLevel: number; // 0-100
  sleepHours: number;
  journalEntry?: string;
  detectedEmotions: string[];
  recommendations: string[];
}

const MentalReportSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    moodScore: { type: Number, required: true },
    stressLevel: { type: Number, required: true },
    sleepHours: { type: Number, default: 0 },
    journalEntry: { type: String },
    detectedEmotions: [{ type: String }],
    recommendations: [{ type: String }],
  },
  { timestamps: true }
);

export default mongoose.models.MentalReport ||
  mongoose.model<IMentalReport>("MentalReport", MentalReportSchema);
