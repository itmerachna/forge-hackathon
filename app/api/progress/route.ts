import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { ProgressUpdate } from '../../../types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!isSupabaseConfigured()) {
      // Return data from localStorage fallback (client-side handles this)
      return NextResponse.json({ progress: [], message: 'Using local storage' });
    }

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('user_tool_progress')
      .select('*, tools(*)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Progress fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ progress: data || [] });
  } catch (error) {
    console.error('Progress API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ProgressUpdate = await request.json();
    const { user_id, tool_id, status, notes } = body;

    if (!user_id || !tool_id || !status) {
      return NextResponse.json(
        { error: 'user_id, tool_id, and status are required' },
        { status: 400 },
      );
    }

    if (!isSupabaseConfigured()) {
      // Acknowledge the request but indicate local-only mode
      return NextResponse.json({
        message: 'Progress saved locally',
        progress: { user_id, tool_id, status, notes },
      });
    }

    // Upsert progress record
    const { data, error } = await supabase
      .from('user_tool_progress')
      .upsert(
        {
          user_id,
          tool_id,
          status,
          notes,
          started_at: status === 'trying' ? new Date().toISOString() : undefined,
          completed_at: ['tried', 'mastered'].includes(status) ? new Date().toISOString() : undefined,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,tool_id' },
      )
      .select()
      .single();

    if (error) {
      console.error('Progress upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ progress: data });
  } catch (error) {
    console.error('Progress POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
