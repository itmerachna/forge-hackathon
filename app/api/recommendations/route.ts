import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { isGeminiConfigured } from '../../../lib/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ recommendations: [], source: 'not_configured' });
    }

    // Fetch user preferences
    let userPrefs = null;
    if (userId) {
      const { data } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
      userPrefs = data;
    }

    // Fetch all tools
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select('*')
      .order('id', { ascending: true });

    if (toolsError || !tools?.length) {
      return NextResponse.json({ recommendations: [], source: 'no_tools' });
    }

    // Fetch user's tried tools to exclude them
    let triedToolIds: number[] = [];
    if (userId) {
      const { data: progress } = await supabase
        .from('user_tool_progress')
        .select('tool_id')
        .eq('user_id', userId)
        .in('status', ['tried', 'mastered']);

      triedToolIds = progress?.map(p => p.tool_id) || [];
    }

    // Filter out already tried tools
    const availableTools = tools.filter(t => !triedToolIds.includes(t.id));

    if (availableTools.length === 0) {
      return NextResponse.json({
        recommendations: tools.slice(0, 5),
        message: "You've tried all available tools! Here are some to revisit.",
        source: 'all_tried'
      });
    }

    // Use Gemini to rank tools if available
    if (isGeminiConfigured() && userPrefs) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

        const prompt = `You are an AI learning coach. Based on the user's preferences, rank these AI tools from most to least relevant.

User Profile:
- Focus area: ${userPrefs.focus || 'General'}
- Skill level: ${userPrefs.skill_level || 'Beginner'}
- Weekly time: ${userPrefs.weekly_hours || 'A few hours'}
- Preferences: ${userPrefs.preferences || 'None specified'}
- Existing tools: ${userPrefs.existing_tools || 'None'}
- Goal: ${userPrefs.goal || 'Learn AI tools'}

Available Tools:
${availableTools.map((t, i) => `${i + 1}. ${t.name} (${t.category}) - ${t.description}`).join('\n')}

Return ONLY a JSON array of tool IDs in order of relevance (most relevant first), max 10 tools:
[1, 5, 3, ...]`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        // Parse the JSON array from response
        const match = text.match(/\[[\d,\s]+\]/);
        if (match) {
          const rankedIds = JSON.parse(match[0]) as number[];
          const rankedTools = rankedIds
            .map(idx => availableTools[idx - 1])
            .filter(Boolean)
            .slice(0, 10);

          if (rankedTools.length > 0) {
            return NextResponse.json({
              recommendations: rankedTools,
              source: 'gemini_ranked'
            });
          }
        }
      } catch (error) {
        console.error('Gemini ranking error:', error);
        // Fall through to default ranking
      }
    }

    // Default: return tools matching user's focus area, or random selection
    let recommendations = availableTools;

    if (userPrefs?.focus) {
      const focusKeywords = userPrefs.focus.toLowerCase().split(' ');
      recommendations = availableTools.filter(t =>
        focusKeywords.some((kw: string) =>
          t.category?.toLowerCase().includes(kw) ||
          t.description?.toLowerCase().includes(kw)
        )
      );
    }

    // If no matches, shuffle and return random selection
    if (recommendations.length === 0) {
      recommendations = [...availableTools].sort(() => Math.random() - 0.5);
    }

    return NextResponse.json({
      recommendations: recommendations.slice(0, 10),
      source: 'default'
    });
  } catch (error) {
    console.error('Recommendations API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
