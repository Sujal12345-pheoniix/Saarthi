import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const userId = await checkAuth();

    const latestReport = await prisma.combinedWellnessReport.findFirst({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      report: latestReport,
    });
  } catch (error: any) {
    console.error('Error in GET /api/report/latest:', error);
    const message = error.message || 'Internal Server Error';
    return NextResponse.json(
      { success: false, error: message },
      { status: message === 'Unauthorized' ? 401 : 500 }
    );
  }
}
