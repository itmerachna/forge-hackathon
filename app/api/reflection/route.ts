import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { isGeminiConfigured } from '../../../lib/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { trackLLMCall } from '../../../lib/opik';

interface ReflectionInput {
  user_id: string;
  enjoyed_most: string;
  hardest_tool: string;
  built_anything: string;
  liked_disliked: string;
  next_week_focus: string;
  tools_mastered: number[];
}

// POST: Submit weekly reflection
export async function POST(request: NextRequest) {
  try {
    const body: ReflectionInput = await request.json();

    // Generate AI insights from reflection
    let aiInsights = '';
    if (isGeminiConfigured()) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        const prompt = `As an AI learning coach, analyze this weekly reflection and provide brief, encouraging insights (3-4 sentences).

Reflection:
- Most enjoyed tool: ${body.enjoyed_most}
- Hardest tool: ${body.hardest_tool}
- Built anything: ${body.built_anything}
- Liked/disliked: ${body.liked_disliked}
- Next week focus: ${body.next_week_focus}
- Tools mastered: ${body.tools_mastered.length}

Provide personalized insights about their learning patterns and suggestions for next week.`;

        const result = await model.generateContent(prompt);
        aiInsights = result.response.text();

        await trackLLMCall({
          name: 'weekly-reflection-analysis',
          input: { reflection: body },
          output: aiInsights,
          model: 'gemini-2.5-flash-lite',
          tags: ['reflection', 'analysis'],
        });
      } catch (error) {
        console.error('AI insights error:', error);
        aiInsights = 'Great job reflecting on your week! Keep exploring and building.';
      }
    }

    // Save to Supabase
    if (isSupabaseConfigured()) {
      const weekStart = getWeekStart();

      const { error } = await supabase.from('reflections').upsert({
        user_id: body.user_id,
        week_start: weekStart,
        content: JSON.stringify({
          enjoyed_most: body.enjoyed_most,
          hardest_tool: body.hardest_tool,
          built_anything: body.built_anything,
          liked_disliked: body.liked_disliked,
          next_week_focus: body.next_week_focus,
        }),
        ai_insights: aiInsights,
        tools_mastered: body.tools_mastered,
        goals_met: body.tools_mastered.length >= 3,
      }, { onConflict: 'user_id,week_start' });

      if (error) {
        console.error('Reflection save error:', error);
      }
    }

    // Update UserMemories
    try {
      await fetch(new URL('/api/memories', request.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: body.user_id,
          section: 'Weekly Reflections',
          content: `**Week of ${getWeekStart()}**: Enjoyed ${body.enjoyed_most}. Hardest: ${body.hardest_tool}. Built: ${body.built_anything || 'nothing yet'}. Next week: ${body.next_week_focus}.`,
        }),
      });
    } catch {
      // Silent fail for memory update
    }

    return NextResponse.json({
      success: true,
      insights: aiInsights,
      goals_met: body.tools_mastered.length >= 3,
    });
  } catch (error) {
    console.error('Reflection API error:', error);
    return NextResponse.json({ error: 'Failed to save reflection' }, { status: 500 });
  }
}

// GET: Fetch reflections for a user
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  if (!isSupabaseConfigured() || !userId) {
    return NextResponse.json({ reflections: [] });
  }

  try {
    const { data, error } = await supabase
      .from('reflections')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(10);

    if (error) {
      return NextResponse.json({ reflections: [] });
    }

    return NextResponse.json({ reflections: data || [] });
  } catch {
    return NextResponse.json({ reflections: [] });
  }
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}
