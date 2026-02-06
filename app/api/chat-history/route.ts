import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

// GET - Fetch chat history for a user
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ messages: [], source: 'localStorage' });
    }

    const { data, error } = await supabase
      .from('chat_history')
      .select('messages')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Chat history fetch error:', error);
      return NextResponse.json({ messages: [], source: 'error' });
    }

    return NextResponse.json({
      messages: data?.messages || [],
      source: 'supabase'
    });
  } catch (error) {
    console.error('Chat history API error:', error);
    return NextResponse.json({ messages: [], source: 'error' });
  }
}

// POST - Save chat history for a user
export async function POST(request: NextRequest) {
  try {
    const { user_id, messages } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, source: 'localStorage' });
    }

    // Upsert chat history (create or update)
    const { error } = await supabase
      .from('chat_history')
      .upsert(
        {
          user_id,
          messages,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('Chat history save error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, source: 'supabase' });
  } catch (error) {
    console.error('Chat history POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
