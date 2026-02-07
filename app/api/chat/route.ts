import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponseStream, isGeminiConfigured } from '../../../lib/gemini';
import { needsSummarization, summarizeConversation, buildContextFromSummaries } from '../../../lib/summarize';
import { trackLLMCall } from '../../../lib/opik';
import { promises as fs } from 'fs';
import path from 'path';
import type { ChatRequest } from '../../../types';

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
    const { message, conversationHistory, userProfile, context } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!isGeminiConfigured()) {
      console.log('Gemini not configured, using fallback');
      const fallbackResponse = generateFallbackResponse(message, conversationHistory || []);
      return NextResponse.json({ message: fallbackResponse });
    }

    try {
      // Load relevant skill reference based on message intent
      const skillContext = await loadSkillContext(message);

      // Context rot prevention: summarize long conversations
      let enrichedContext = (context || '') + skillContext;
      if (conversationHistory && needsSummarization(conversationHistory)) {
        const summary = await summarizeConversation(conversationHistory.slice(0, -5));
        if (summary) {
          enrichedContext = buildContextFromSummaries([summary]) + (enrichedContext ? '\n\n' + enrichedContext : '');
        }
      }

      const stream = await generateChatResponseStream(
        message,
        conversationHistory || [],
        userProfile,
        enrichedContext || context,
      );

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
