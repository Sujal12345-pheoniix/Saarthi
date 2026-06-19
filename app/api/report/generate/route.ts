import { NextResponse } from 'next/server';
import { enqueueReportGeneration } from '@/lib/queue/reportQueue';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

async function checkAuth() {
  if (process.env.DEV_ALLOW_ANON === 'true') {
    return 'dev_local_id';
  }
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });
  if (!user) {
    throw new Error('User not found');
  }
  return user.id;
}

export async function POST(req: Request) {
  try {
    const userId = await checkAuth();
    
    // Parse body optionally (if any custom questionnaire details are passed)
    let body: any = {};
    try {
      body = await req.json();
    } catch (e) {
      // Body might be empty
    }
    
    const { skinQuestionnaire, imageUrl, moodData, journalEntries, physicalData } = body;

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
    const status = error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
