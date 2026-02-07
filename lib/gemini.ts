import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ChatMessage, UserPreferences } from '../types';

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }
  return _genAI;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
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
    role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
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

  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const history = cleanHistory(conversationHistory, message);

  // Prepend system prompt as first exchange (since systemInstruction may not be supported)
  const historyWithSystem = [
    { role: 'user' as const, parts: [{ text: `System: ${fullSystemPrompt}` }] },
    { role: 'model' as const, parts: [{ text: 'Understood! I am Forge, your AI learning coach. I will help you discover and master AI tools. How can I help you today?' }] },
    ...history,
  ];

  const chat = model.startChat({ history: historyWithSystem });

  const result = await chat.sendMessage(message);
  const response = result.response;
  return response.text();
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

  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

  const history = cleanHistory(conversationHistory, message);

  // Prepend system prompt as first exchange (since systemInstruction may not be supported)
  const historyWithSystem = [
    { role: 'user' as const, parts: [{ text: `System: ${fullSystemPrompt}` }] },
    { role: 'model' as const, parts: [{ text: 'Understood! I am Forge, your AI learning coach. I will help you discover and master AI tools. How can I help you today?' }] },
    ...history,
  ];

  const chat = model.startChat({ history: historyWithSystem });

  const result = await chat.sendMessageStream(message);

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
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
