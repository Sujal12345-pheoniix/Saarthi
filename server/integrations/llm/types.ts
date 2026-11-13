import { z } from "zod";

/** Narrative synthesis produced by a language model. Scores are NEVER requested from the model. */
export const synthesisSchema = z.object({
  insights: z.string().min(1).max(6000),
  risks: z.array(z.string().min(1).max(400)).max(10),
  actionPlan: z.array(z.string().min(1).max(400)).min(1).max(10),
});

export type SynthesisOutput = z.infer<typeof synthesisSchema>;

export interface LlmClient {
  /** e.g. "anthropic:claude-opus-5-5" — stored on CombinedWellnessReport.model. */
  readonly id: string;
  synthesize(input: { system: string; user: string }): Promise<SynthesisOutput>;
}
