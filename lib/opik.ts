import { Opik } from 'opik';

let _opikClient: Opik | null = null;

export function isOpikConfigured(): boolean {
  return Boolean(process.env.OPIK_API_KEY);
}

export function getOpikClient(): Opik | null {
  if (!isOpikConfigured()) return null;

  if (!_opikClient) {
    _opikClient = new Opik({
      apiKey: process.env.OPIK_API_KEY,
      projectName: 'forge-ai-coach',
    });
  }
  return _opikClient;
}

// Track an LLM call with Opik
export async function trackLLMCall(params: {
  name: string;
  input: Record<string, unknown>;
  output: string;
  model: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}): Promise<void> {
  const client = getOpikClient();
  if (!client) return;

  try {
    const trace = client.trace({
      name: params.name,
      input: params.input,
      output: { response: params.output },
      metadata: {
        model: params.model,
        ...params.metadata,
      },
      tags: params.tags || [],
    });
    await trace;
  } catch (error) {
    console.error('Opik tracking error:', error);
  }
}

// Track a recommendation generation with quality scoring
export async function trackRecommendation(params: {
  userProfile: Record<string, unknown>;
  recommendations: unknown[];
  critiqueResult?: {
    score: number;
    issues: string[];
    passed: boolean;
  };
  source: string;
  regenerated?: boolean;
}): Promise<void> {
  const client = getOpikClient();
  if (!client) return;

  try {
    const trace = client.trace({
      name: 'recommendation-generation',
      input: { userProfile: params.userProfile },
      output: {
        recommendations: params.recommendations,
        source: params.source,
      },
      metadata: {
        critique_score: params.critiqueResult?.score,
        critique_issues: params.critiqueResult?.issues,
        critique_passed: params.critiqueResult?.passed,
        regenerated: params.regenerated || false,
      },
      tags: ['recommendation', params.source],
    });
    await trace;
  } catch (error) {
    console.error('Opik recommendation tracking error:', error);
  }
}

// Track self-critique results
export async function trackCritique(params: {
  recommendations: unknown[];
  userProfile: Record<string, unknown>;
  score: number;
  issues: string[];
  passed: boolean;
}): Promise<void> {
  const client = getOpikClient();
  if (!client) return;

  try {
    const trace = client.trace({
      name: 'self-critique',
      input: {
        recommendations: params.recommendations,
        userProfile: params.userProfile,
      },
      output: {
        score: params.score,
        issues: params.issues,
        passed: params.passed,
      },
      tags: ['critique', params.passed ? 'passed' : 'failed'],
    });
    await trace;
  } catch (error) {
    console.error('Opik critique tracking error:', error);
  }
}

// Track conversation summarization
export async function trackSummarization(params: {
  messageCount: number;
  summary: string;
  userId?: string;
}): Promise<void> {
  const client = getOpikClient();
  if (!client) return;

  try {
    const trace = client.trace({
      name: 'conversation-summarization',
      input: { messageCount: params.messageCount, userId: params.userId },
      output: { summary: params.summary },
      tags: ['summarization', 'context-rot-prevention'],
    });
    await trace;
  } catch (error) {
    console.error('Opik summarization tracking error:', error);
  }
}
