import { GoogleGenAI } from '@google/genai';
import { trackGemini } from 'opik-gemini';
import type { ChatMessage, UserPreferences } from '../types';

const MODEL = 'gemini-2.5-flash-lite';

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    const raw = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

    // Wrap with Opik tracking if OPIK_API_KEY is set
    if (process.env.OPIK_API_KEY) {
      _ai = trackGemini(raw, { projectName: 'forge-ai-coach' });
    } else {
      _ai = raw;
    }
  }
  return _ai;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Expose the tracked client for direct use in other files (reflection, recommendations, etc.)
export function getGeminiClient(): GoogleGenAI {
  return getAI();
}

// Gemini requires history to start with a user message and alternate user/model
// Also, the conversationHistory includes the current message we're about to send,
// so we need to exclude it from history
function cleanHistory(conversationHistory: ChatMessage[], currentMessage: string) {
  const filtered = conversationHistory.filter((msg) => msg.content && !msg.isStreaming);

  // Remove the last message if it matches what we're about to send (it's the current message)
  if (filtered.length > 0) {
    const lastMsg = filtered[filtered.length - 1];
    if (lastMsg.role === 'user' && lastMsg.content.trim() === currentMessage.trim()) {
      filtered.pop();
    }
  }

  // Find first user message index (skip leading assistant messages)
  const firstUserIdx = filtered.findIndex((msg) => msg.role === 'user');
  if (firstUserIdx === -1) return []; // No user messages, return empty history

  // Start from first user message
  const trimmed = filtered.slice(firstUserIdx);

  // Map to Gemini format
  return trimmed.map((msg) => ({
    role: msg.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: msg.content }],
  }));
}

function buildSystemPrompt(userProfile?: UserPreferences): string {
  const basePrompt = `You are Forge — an AI learning coach who helps people discover and master AI-powered design and creative tools. Think of yourself as a knowledgeable friend who's tried every tool out there, not a corporate assistant reading from a script.

PERSONALITY & TONE:
- Talk like a real person. Use contractions, casual language, and natural phrasing.
- Be warm but not cheesy. No "Great question!" or "I'd be happy to help!" openers.
- Keep responses SHORT. 2-4 sentences for simple questions. Only go longer if the user is asking for a detailed breakdown or comparison.
- Don't default to bullet-point lists for everything. Have a conversation first. Use lists only when comparing multiple options or giving step-by-step instructions.
- Ask follow-up questions naturally, like a friend would — "What's the project?" not "Could you please provide more details about your requirements?"
- Use bold sparingly for tool names on first mention, not for emphasis on random words.
- Match the user's energy. If they send a one-liner, don't respond with an essay. If they're excited, match it.
- Be opinionated. "I'd go with Gamma for this" is better than "Here are several options you might consider."
- When a user says something vague, make your best guess and suggest something concrete rather than asking 5 clarifying questions.

WHAT YOU KNOW:
- You know AI tools across these categories: AI Design, AI Video Editor, AI Audio, AI Photo Editor, AI Site Builder, Vibe Coding, AI Writing, AI Productivity.
- You know pricing tiers, difficulty levels, what each tool is best at, and who it's for.
- You can suggest project ideas that combine multiple tools into a real workflow.
- You help users build a learning habit — 5 tools per week, try them hands-on, submit proof of what they built.

WHAT YOU DON'T DO:
- Don't make up tools that don't exist.
- Don't give long generic intros. Get to the point.
- Don't repeat the same information the user already has.
- Don't say "As an AI..." or break character.
- Don't use emojis unless the user does first.

PROJECT SUGGESTIONS:
When users ask what to build or seem stuck, suggest a specific mini-project they can finish in 1-2 hours using one of their weekly tools. Make it concrete: "Try making a 30-second intro video for your portfolio with AKOOL" not "You could explore video creation tools."`;

  if (userProfile) {
    return `${basePrompt}

CURRENT USER:
- Focus: ${userProfile.focus || 'Not set yet'}
- Skill level: ${userProfile.skill_level || 'Unknown'}
- Weekly time: ${userProfile.weekly_hours || 'Not specified'}
- Preferences: ${userProfile.preferences || 'None yet'}
- Tools they know: ${userProfile.existing_tools || 'None mentioned'}
- Goal: ${userProfile.goal || 'Not set'}

Adapt your language to their skill level. A beginner needs encouragement and hand-holding. An advanced user wants efficiency and depth. Reference their goal when it's relevant, but don't shoehorn it into every response.`;
  }

  return basePrompt;
}

export async function generateChatResponse(
  message: string,
  conversationHistory: ChatMessage[],
  userProfile?: UserPreferences,
  context?: string,
): Promise<string> {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured');
  }

  const systemPrompt = buildSystemPrompt(userProfile);
  const contextAddition = context ? `\n\nAdditional context: ${context}` : '';
  const fullSystemPrompt = systemPrompt + contextAddition;

  const ai = getAI();
  const history = cleanHistory(conversationHistory, message);

  const chat = ai.chats.create({
    model: MODEL,
    config: { systemInstruction: fullSystemPrompt },
    history,
  });

  const response = await chat.sendMessage({ message });
  return response.text || '';
}

export async function generateChatResponseStream(
  message: string,
  conversationHistory: ChatMessage[],
  userProfile?: UserPreferences,
  context?: string,
): Promise<ReadableStream> {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API key not configured');
  }

  const systemPrompt = buildSystemPrompt(userProfile);
  const contextAddition = context ? `\n\nAdditional context: ${context}` : '';
  const fullSystemPrompt = systemPrompt + contextAddition;

  const ai = getAI();
  const history = cleanHistory(conversationHistory, message);

  const chat = ai.chats.create({
    model: MODEL,
    config: { systemInstruction: fullSystemPrompt },
    history,
  });

  const stream = await chat.sendMessageStream({ message });

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (error) {
        console.error('Gemini stream error:', error);
        controller.error(error);
      }
    },
  });
}
