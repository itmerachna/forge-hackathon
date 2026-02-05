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

function buildSystemPrompt(userProfile?: UserPreferences): string {
  const basePrompt = `You are Forge, a friendly and knowledgeable AI learning coach that helps creative professionals discover, learn, and master AI tools. Your personality is warm but focused — like a mentor who genuinely cares about the user's growth.

Core behaviors:
- Provide personalized tool recommendations based on the user's focus, skill level, and goals
- Give practical, actionable advice on how to get started with new tools
- Track and celebrate progress — acknowledge when users try new tools
- Offer daily check-in conversations to build accountability
- Share tips, shortcuts, and creative workflows
- Keep responses concise and scannable — use bullet points and numbered lists when helpful
- Be encouraging but honest — don't overhype tools that aren't a good fit
- When suggesting tools, explain WHY it's relevant to the user's specific needs`;

  if (userProfile) {
    return `${basePrompt}

User Profile:
- Focus area: ${userProfile.focus || 'Not specified'}
- Skill level: ${userProfile.skill_level || 'Not specified'}
- Weekly time commitment: ${userProfile.weekly_hours || 'Not specified'}
- Preferences: ${userProfile.preferences || 'None specified'}
- Tools they already know: ${userProfile.existing_tools || 'None specified'}
- 4-week goal: ${userProfile.goal || 'Not specified'}

Tailor your responses to match their skill level and interests. Reference their goals when relevant.`;
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

  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' });

  const systemPrompt = buildSystemPrompt(userProfile);
  const contextAddition = context ? `\n\nAdditional context: ${context}` : '';

  const history = conversationHistory
    .filter((msg) => msg.content && !msg.isStreaming)
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }],
    }));

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: `System instructions: ${systemPrompt}${contextAddition}` }] },
      { role: 'model', parts: [{ text: 'Understood! I\'m Forge, your AI learning coach. I\'m here to help you discover and master AI tools. How can I help you today?' }] },
      ...history,
    ],
  });

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

  const model = getGenAI().getGenerativeModel({ model: 'gemini-2.0-flash' });

  const systemPrompt = buildSystemPrompt(userProfile);
  const contextAddition = context ? `\n\nAdditional context: ${context}` : '';

  const history = conversationHistory
    .filter((msg) => msg.content && !msg.isStreaming)
    .map((msg) => ({
      role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: msg.content }],
    }));

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: `System instructions: ${systemPrompt}${contextAddition}` }] },
      { role: 'model', parts: [{ text: 'Understood! I\'m Forge, your AI learning coach. I\'m here to help you discover and master AI tools. How can I help you today?' }] },
      ...history,
    ],
  });

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
        controller.error(error);
      }
    },
  });
}
