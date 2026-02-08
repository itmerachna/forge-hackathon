import { NextRequest, NextResponse } from 'next/server';
import { getOpikClient } from '../../../lib/opik';

export async function POST(request: NextRequest) {
  try {
    const { session_id, message_id, score, message_content } = await request.json();

    if (!session_id || score === undefined) {
      return NextResponse.json({ error: 'session_id and score are required' }, { status: 400 });
    }

    const opik = getOpikClient();
    if (!opik) {
      return NextResponse.json({ success: false, reason: 'Opik not configured' });
    }

    // Create a trace specifically for user feedback, linked to the same thread
    const trace = opik.trace({
      name: 'user-feedback',
      threadId: session_id,
      input: { message_id, message_preview: (message_content || '').slice(0, 200) },
      output: { score: score > 0 ? 'positive' : 'negative' },
      tags: ['feedback', score > 0 ? 'thumbs-up' : 'thumbs-down'],
    });

    trace.score({
      name: 'user_satisfaction',
      value: score > 0 ? 1 : 0,
      reason: score > 0 ? 'User gave thumbs up' : 'User gave thumbs down',
    });

    await opik.flush();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json({ error: 'Failed to log feedback' }, { status: 500 });
  }
}
