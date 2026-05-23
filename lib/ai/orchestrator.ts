import { SkinAgent } from './agents/SkinAgent';
import { MentalHealthAgent } from './agents/MentalHealthAgent';
import { PhysicalHealthAgent } from './agents/PhysicalHealthAgent';
import { RecommendationAgent } from './agents/RecommendationAgent';

export class AIOrchestrator {
  static async runFullAnalysis(inputs: {
    imageUrl?: string;
    skinQuestionnaire?: Record<string, any>;
    moodData?: Record<string, any>;
    journalEntries?: string[];
    physicalData?: Record<string, any>;
  }) {
    // 1. Run domain engines in parallel if inputs are provided
    const [skinResult, mentalResult, physicalResult] = await Promise.all([
      inputs.skinQuestionnaire || inputs.imageUrl
        ? SkinAgent.analyze(inputs.imageUrl || '', inputs.skinQuestionnaire || {})
        : Promise.resolve(null),
      inputs.moodData || inputs.journalEntries?.length
        ? MentalHealthAgent.analyze(inputs.moodData || {}, inputs.journalEntries || [])
        : Promise.resolve(null),
      inputs.physicalData
        ? PhysicalHealthAgent.analyze(inputs.physicalData)
        : Promise.resolve(null),
    ]);

    // 2. Generate unified recommendations if we have at least one domain result
    let recommendationResult = null;
    if (skinResult || mentalResult || physicalResult) {
      recommendationResult = await RecommendationAgent.analyze(
        skinResult,
        mentalResult,
        physicalResult
      );
    }

    // 3. Return the final structured output
    return {
      skinAnalysis: skinResult,
      mentalAnalysis: mentalResult,
      physicalAnalysis: physicalResult,
      recommendations: recommendationResult,
    };
  }
}
