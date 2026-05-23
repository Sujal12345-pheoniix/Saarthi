import { NextResponse } from 'next/server';
import { enqueueReportGeneration } from '@/lib/queue/reportQueue';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, imageUrl, questionnaire } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Since AI analysis can take time, we enqueue it as a background job
    // and respond immediately to the client that processing has started.
    const job = await enqueueReportGeneration({
      userId,
      data: {
        imageUrl,
        skinQuestionnaire: questionnaire,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Skin analysis queued successfully',
    });
  } catch (error: any) {
    console.error('Error in /api/skin/analyze:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
