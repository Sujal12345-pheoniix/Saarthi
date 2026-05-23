import { NextResponse } from 'next/server';
import { enqueueReportGeneration } from '@/lib/queue/reportQueue';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, moodData, journalEntries } = body;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const job = await enqueueReportGeneration({
      userId,
      data: {
        moodData,
        journalEntries,
      },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Mental health analysis queued successfully',
    });
  } catch (error: any) {
    console.error('Error in /api/mental/analyze:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
