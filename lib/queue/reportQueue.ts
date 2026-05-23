import { Queue } from 'bullmq';
import { connection } from './redis';

export const reportQueue = new Queue('report-generation', { connection });

export async function enqueueReportGeneration(jobData: any) {
  return await reportQueue.add('generate-report', jobData, {
    removeOnComplete: true,
    removeOnFail: false,
  });
}
