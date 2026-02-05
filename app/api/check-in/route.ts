import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { generateChatResponse, isGeminiConfigured } from '../../../lib/gemini';
import type { CheckInRequest } from '../../../types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ checkIns: [], message: 'Using local storage' });
    }

    if (!userId) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('check_ins')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Check-in fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ checkIns: data || [] });
  } catch (error) {
    console.error('Check-in API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckInRequest = await request.json();
    const { user_id, mood, tools_used, accomplishments, blockers } = body;

    if (!mood || !accomplishments) {
      return NextResponse.json(
        { error: 'mood and accomplishments are required' },
        { status: 400 },
      );
    }

    // Generate AI summary if Gemini is configured
    let aiSummary: string | undefined;
    if (isGeminiConfigured()) {
      try {
        aiSummary = await generateChatResponse(
          `The user just completed a daily check-in. Summarize their progress and give one encouraging, actionable suggestion. Keep it to 2-3 sentences.

Mood: ${mood}
Tools used today: ${tools_used?.length || 0} tools
Accomplishments: ${accomplishments}
Blockers: ${blockers || 'None'}`,
          [],
        );
      } catch {
        // AI summary is optional, continue without it
      }
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({
        checkIn: {
          user_id,
          date: new Date().toISOString().split('T')[0],
          mood,
          tools_used,
          accomplishments,
          blockers,
          ai_summary: aiSummary,
        },
        message: 'Check-in saved locally',
      });
    }

    const { data, error } = await supabase
      .from('check_ins')
      .insert({
        user_id,
        date: new Date().toISOString().split('T')[0],
        mood,
        tools_used,
        accomplishments,
        blockers,
        ai_summary: aiSummary,
      })
      .select()
      .single();

    if (error) {
      console.error('Check-in insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ checkIn: data });
  } catch (error) {
    console.error('Check-in POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
