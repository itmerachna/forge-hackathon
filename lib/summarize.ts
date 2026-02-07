import { GoogleGenerativeAI } from '@google/generative-ai';
import { isGeminiConfigured } from './gemini';
import { trackSummarization } from './opik';
import type { ChatMessage } from '../types';

const SUMMARIZE_THRESHOLD = 10; // Summarize every 10+ messages

interface ConversationSummary {
  summary: string;
  keyTopics: string[];
  toolsMentioned: string[];
  userSentiment: string;
  actionItems: string[];
}

// Check if conversation needs summarization
export function needsSummarization(messages: ChatMessage[]): boolean {
  return messages.length >= SUMMARIZE_THRESHOLD;
}

// Summarize a conversation for context rot prevention
export async function summarizeConversation(
  messages: ChatMessage[],
  userId?: string,
): Promise<ConversationSummary | null> {
  if (!isGeminiConfigured() || messages.length < 3) {
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Forge'}: ${m.content}`)
      .join('\n\n');

    const prompt = `Summarize this conversation between a user and Forge (an AI learning coach for AI tools). Extract key information for memory.

Conversation:
${conversationText}

Respond with ONLY a JSON object:
{
  "summary": "2-3 sentence overview of the conversation",
  "keyTopics": ["topic1", "topic2"],
  "toolsMentioned": ["tool1", "tool2"],
  "userSentiment": "positive/neutral/negative/mixed",
  "actionItems": ["what the user plans to do next"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as ConversationSummary;

    // Track in Opik
    await trackSummarization({
      messageCount: messages.length,
      summary: parsed.summary,
      userId,
    });

    return parsed;
  } catch (error) {
    console.error('Summarization error:', error);
    return null;
  }
}

// Generate a context injection from previous summaries
export function buildContextFromSummaries(summaries: ConversationSummary[]): string {
  if (summaries.length === 0) return '';

  const recentSummary = summaries[summaries.length - 1];
  const allTopics = [...new Set(summaries.flatMap(s => s.keyTopics))];
  const allTools = [...new Set(summaries.flatMap(s => s.toolsMentioned))];

  return `Previous conversation context:
- Recent discussion: ${recentSummary.summary}
- Topics covered: ${allTopics.join(', ')}
- Tools discussed: ${allTools.join(', ')}
- User sentiment: ${recentSummary.userSentiment}
${recentSummary.actionItems.length > 0 ? `- Action items: ${recentSummary.actionItems.join(', ')}` : ''}`;
}

// Format summary for UserMemories.md storage
export function formatSummaryForMemory(summary: ConversationSummary, date: string): string {
  return `### ${date}
${summary.summary}
- Topics: ${summary.keyTopics.join(', ')}
- Tools: ${summary.toolsMentioned.join(', ')}
- Sentiment: ${summary.userSentiment}
${summary.actionItems.length > 0 ? `- Next steps: ${summary.actionItems.join(', ')}` : ''}
`;
}
