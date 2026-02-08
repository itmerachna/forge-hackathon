import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponseStream, isGeminiConfigured } from '../../../lib/gemini';
import { getOpikClient } from '../../../lib/opik';
import { needsSummarization, summarizeConversation, buildContextFromSummaries } from '../../../lib/summarize';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { promises as fs } from 'fs';
import path from 'path';
import type { ChatRequest } from '../../../types';

// Cached tool catalog — refreshed every 5 minutes
let _toolCatalogCache: string = '';
let _toolCatalogTimestamp = 0;
const TOOL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function loadToolCatalog(): Promise<string> {
  const now = Date.now();
  if (_toolCatalogCache && (now - _toolCatalogTimestamp) < TOOL_CACHE_TTL) {
    return _toolCatalogCache;
  }

  if (!isSupabaseConfigured()) return '';

  try {
    const { data: tools } = await supabase
      .from('tools')
      .select('name, category, description, pricing, difficulty, website')
      .order('category', { ascending: true });

    if (!tools || tools.length === 0) return '';

    const catalog = tools.map((t: { name: string; category: string; description: string; pricing: string; difficulty: string; website: string }) =>
      `- ${t.name} [${t.category}] (${t.pricing}, ${t.difficulty}): ${(t.description || '').slice(0, 120)} → ${t.website}`
    ).join('\n');

    _toolCatalogCache = `\n\nYOUR TOOL CATALOG (${tools.length} tools — ALWAYS recommend from this list first):\n${catalog}\n\nIMPORTANT: When suggesting tools, ALWAYS pick from the catalog above. Only suggest a tool outside this catalog if nothing here fits the user's specific need, and clearly say "This one isn't in our catalog yet, but..." when you do.`;
    _toolCatalogTimestamp = now;
    return _toolCatalogCache;
  } catch (error) {
    console.error('Failed to load tool catalog:', error);
    return '';
  }
}

// Load a skill file as additional context for Gemini
async function loadSkillContext(message: string): Promise<string> {
  const msg = message.toLowerCase();
  let skillFile = '';

  if (/project|idea|build|make|create|what (can|should) i/.test(msg)) {
    skillFile = 'project-ideation.md';
  } else if (/recommend|suggest|which tool|compare|versus|vs|best for|what tool/.test(msg)) {
    skillFile = 'tool-discovery.md';
  } else if (/reflect|week|check.?in|how did|review|looking back/.test(msg)) {
    skillFile = 'weekly-reflection.md';
  }

  if (!skillFile) return '';

  try {
    const filePath = path.join(process.cwd(), 'public', 'skills', skillFile);
    const content = await fs.readFile(filePath, 'utf-8');
    return `\n\nREFERENCE (use this to inform your response, don't quote it directly):\n${content}`;
  } catch {
    return '';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, conversationHistory, userProfile, context, session_id } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!isGeminiConfigured()) {
      console.log('Gemini not configured, using fallback');
      const fallbackResponse = generateFallbackResponse(message, conversationHistory || []);
      return NextResponse.json({ message: fallbackResponse });
    }

    try {
      // Create parent trace for the entire chat request
      const opik = getOpikClient();
      const userId = userProfile?.user_id || 'anonymous';
      const turnCount = (conversationHistory || []).filter(m => m.role === 'user').length + 1;
      const trace = opik && session_id ? opik.trace({
        name: 'chat',
        threadId: session_id,
        input: { message, user_id: userId, turn: turnCount },
        metadata: {
          user_focus: userProfile?.focus || 'unknown',
          user_level: userProfile?.skill_level || 'unknown',
        },
        tags: ['chat', userProfile?.focus || 'no-focus'].filter(Boolean),
      }) : null;

      // Load tool catalog and skill context in parallel
      const skillSpanStart = Date.now();
      const [skillContext, toolCatalog] = await Promise.all([
        loadSkillContext(message),
        loadToolCatalog(),
      ]);
      if (trace) {
        trace.span({
          name: 'load-skill-context',
          type: 'tool',
          input: { message_intent: message.slice(0, 100) },
          output: { loaded: Boolean(skillContext), length: skillContext.length, catalog_loaded: Boolean(toolCatalog) },
          metadata: { duration_ms: Date.now() - skillSpanStart },
        });
      }

      // End-of-week reflection nudge (Thu-Sun)
      const dayOfWeek = new Date().getDay();
      const isEndOfWeek = dayOfWeek === 0 || dayOfWeek >= 4;
      const reflectionNudge = isEndOfWeek ? '\n\nNOTE: It\'s near the end of the week. If the conversation naturally allows it, gently remind the user they can do their weekly reflection in the Tracker page. Don\'t force it — only mention if it fits the flow.' : '';

      // Span: Context rot prevention — summarize long conversations
      let enrichedContext = (context || '') + toolCatalog + skillContext + reflectionNudge;
      if (conversationHistory && needsSummarization(conversationHistory)) {
        const summarizeStart = Date.now();
        const summary = await summarizeConversation(conversationHistory.slice(0, -5));
        if (trace) {
          trace.span({
            name: 'summarize-conversation',
            type: 'llm',
            input: { message_count: conversationHistory.length },
            output: { summarized: Boolean(summary) },
            metadata: { duration_ms: Date.now() - summarizeStart },
          });
        }
        if (summary) {
          enrichedContext = buildContextFromSummaries([summary]) + (enrichedContext ? '\n\n' + enrichedContext : '');

          // Persist summary to Supabase
          try {
            const baseUrl = request.nextUrl.origin;
            await fetch(`${baseUrl}/api/memories`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: userProfile?.user_id || 'anonymous',
                action: 'summarize',
                messages: conversationHistory.slice(0, -5),
              }),
            });
          } catch {
            // Silent fail — persistence is best-effort
          }
        }
      }

      const stream = await generateChatResponseStream(
        message,
        conversationHistory || [],
        userProfile,
        enrichedContext || context,
      );

      // Update trace output
      if (trace) {
        trace.update({
          output: { streaming: true, has_skill_context: Boolean(skillContext), has_enriched_context: Boolean(enrichedContext) },
        });
      }

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (geminiError) {
      const errMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      console.error('Gemini API error:', errMsg, geminiError);
      const fallbackResponse = generateFallbackResponse(message, conversationHistory || []);
      return NextResponse.json({ message: fallbackResponse, _debug: errMsg });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ message: "Sorry, something went wrong. Could you try that again?" });
  }
}

interface ConversationMsg {
  role: string;
  content: string;
}

// Minimal fallback — only used when Gemini API key is missing or errors out.
// When Gemini is configured, all messages go through the AI with the system prompt.
function generateFallbackResponse(message: string, history: ConversationMsg[]): string {
  const msg = message.toLowerCase().trim();
  const turnCount = history.filter(m => m.role === 'user').length;

  if (/^(hi|hello|hey|sup|yo|what'?s up)\b/.test(msg)) {
    return "Hey! I'm Forge — I help you find and learn AI tools for creative work. What are you working on?";
  }

  if (/who are you|what (are|do) you|what is forge/.test(msg)) {
    return "I'm Forge, your AI tool discovery coach. I match you with AI tools based on what you're building, help you learn them, and keep you accountable with weekly goals. Tell me what you're into and I'll find something good.";
  }

  if (/thank|thanks|thx|appreciate/.test(msg)) {
    return "Anytime! Let me know if you want to dig deeper into any of those tools or need a project idea.";
  }

  if (/^(yes|yeah|yep|sure|ok|okay|let'?s|go ahead|please)/.test(msg)) {
    return "Cool, what would you like to explore? Tell me what you're trying to create and I'll point you to the right tool.";
  }

  if (/^(no|nah|nope|i'?m good)/.test(msg)) {
    return "No worries, I'm here when you need me. Check out your weekly tools above or just tell me what you're working on.";
  }

  const defaults = [
    "Tell me what you're working on — design, video, websites, code? I'll find the right AI tool for it.",
    "What's the project? The more specific you are, the better I can match you with something useful.",
    "Check out the 5 tools in your weekly lineup above. You can swap any of them if something doesn't fit. Or tell me what you need and I'll narrow it down.",
    "Want a project idea? Tell me which tool caught your eye and I'll give you something concrete to build with it.",
  ];

  return defaults[turnCount % defaults.length];
}
