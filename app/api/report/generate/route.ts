import { NextResponse } from 'next/server';
import { enqueueReportGeneration } from '@/lib/queue/reportQueue';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, skinQuestionnaire, imageUrl, moodData, journalEntries, physicalData } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const job = await enqueueReportGeneration({
      userId,
      data: {
        imageUrl,
        skinQuestionnaire,
        moodData,
        journalEntries,
        physicalData,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Comprehensive wellness report generation queued successfully',
    });
  } catch (error: any) {
    console.error('Error in /api/report/generate:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
