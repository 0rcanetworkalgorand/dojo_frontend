import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://dojo-backend-yutl.onrender.com';

export async function GET(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const { taskId } = params;

  try {
    const res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (res.status === 404) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch task output' },
        { status: res.status }
      );
    }

    const task = await res.json();

    const content = task.encryptedResult || task.result || '';

    const response = {
      taskId: task.id || taskId,
      content,
      submittedAt: task.submittedAt || task.updatedAt || new Date().toISOString(),
      agentAddress: task.workerAddress || '',
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API] Error fetching task output:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
