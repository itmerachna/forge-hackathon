import { isGeminiConfigured, getGeminiClient } from './gemini';

interface RecommendedTool {
  id?: number;
  name: string;
  category: string;
  difficulty?: string;
  pricing?: string;
  description?: string;
}

interface UserProfile {
  focus?: string;
  skill_level?: string;
  weekly_hours?: string;
  preferences?: string;
  existing_tools?: string;
  goal?: string;
}

interface CritiqueResult {
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  passed: boolean;
}

const QUALITY_THRESHOLD = 60;

// Self-critique: evaluate recommendation quality
export async function critiqueRecommendations(
  recommendations: RecommendedTool[],
  userProfile: UserProfile,
): Promise<CritiqueResult> {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // Check 1: Skill level appropriateness
  if (userProfile.skill_level) {
    const level = userProfile.skill_level.toLowerCase();
    const difficulties = recommendations.map(r => (r.difficulty || '').toLowerCase());

    if (level === 'beginner') {
      const advancedCount = difficulties.filter(d => d === 'advanced').length;
      if (advancedCount > 1) {
        score -= 20;
        issues.push(`Too many advanced tools (${advancedCount}) for a beginner user`);
        suggestions.push('Replace advanced tools with beginner or intermediate options');
      }
    }

    if (level === 'advanced') {
      const beginnerOnlyCount = difficulties.filter(d => d === 'beginner').length;
      if (beginnerOnlyCount > recommendations.length * 0.6) {
        score -= 15;
        issues.push('Too many basic tools for an advanced user');
        suggestions.push('Include more intermediate and advanced tools');
      }
    }
  }

  // Check 2: Pricing respected
  if (userProfile.preferences) {
    const prefs = userProfile.preferences.toLowerCase();
    const wantsFree = prefs.includes('free') && !prefs.includes('not free');

    if (wantsFree) {
      const paidTools = recommendations.filter(
        r => r.pricing && !r.pricing.toLowerCase().includes('free') && !r.pricing.toLowerCase().includes('freemium')
      );
      if (paidTools.length > 0) {
        score -= 25;
        issues.push(`${paidTools.length} paid tools recommended to a free-only user: ${paidTools.map(t => t.name).join(', ')}`);
        suggestions.push('Remove paid tools and replace with free alternatives');
      }
    }
  }

  // Check 3: Good variety (not all same category)
  const categories = new Set(recommendations.map(r => r.category));
  if (recommendations.length > 3 && categories.size === 1) {
    score -= 15;
    issues.push('All tools are in the same category - poor variety');
    suggestions.push('Include tools from at least 2-3 different categories');
  }

  // Check 4: Not suggesting tools user already knows
  if (userProfile.existing_tools) {
    const known = userProfile.existing_tools.toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
    const duplicates = recommendations.filter(r =>
      known.some(k => r.name.toLowerCase().includes(k) || k.includes(r.name.toLowerCase()))
    );
    if (duplicates.length > 0) {
      score -= 10 * duplicates.length;
      issues.push(`Recommended ${duplicates.length} tools the user already knows: ${duplicates.map(t => t.name).join(', ')}`);
      suggestions.push('Exclude tools the user has already listed');
    }
  }

  // Check 5: Goal alignment
  if (userProfile.goal && userProfile.goal.length > 3) {
    const goalKeywords = userProfile.goal.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const descriptions = recommendations.map(r => `${r.name} ${r.category} ${r.description || ''}`).join(' ').toLowerCase();
    const matchCount = goalKeywords.filter(kw => descriptions.includes(kw)).length;
    const matchRatio = goalKeywords.length > 0 ? matchCount / goalKeywords.length : 1;

    if (matchRatio < 0.1 && goalKeywords.length > 2) {
      score -= 10;
      issues.push('Recommendations seem misaligned with user goal');
      suggestions.push('Include at least some tools relevant to the stated goal');
    }
  }

  // Check 6: Reasonable count
  if (recommendations.length < 3) {
    score -= 10;
    issues.push('Too few recommendations');
    suggestions.push('Aim for 5-10 tool recommendations');
  }

  score = Math.max(0, Math.min(100, score));
  const passed = score >= QUALITY_THRESHOLD;

  return { score, issues, suggestions, passed };
}

// Agentic loop: generate, critique, regenerate if needed
export async function generateWithCritique(
  availableTools: RecommendedTool[],
  userProfile: UserProfile,
  maxRetries: number = 2,
): Promise<{
  recommendations: RecommendedTool[];
  critique: CritiqueResult;
  attempts: number;
}> {
  if (!isGeminiConfigured()) {
    // No AI available, return basic filtering
    const filtered = basicFilter(availableTools, userProfile);
    const critique = await critiqueRecommendations(filtered, userProfile);
    return { recommendations: filtered, critique, attempts: 1 };
  }

  let currentRecommendations = availableTools.slice(0, 10);
  let critique: CritiqueResult = { score: 0, issues: [], suggestions: [], passed: false };
  let attempts = 0;

  for (let i = 0; i <= maxRetries; i++) {
    attempts++;

    if (i > 0) {
      // Regenerate with critique feedback
      currentRecommendations = await regenerateWithFeedback(
        availableTools,
        userProfile,
        critique.issues,
        critique.suggestions,
      );
    }

    critique = await critiqueRecommendations(currentRecommendations, userProfile);

    if (critique.passed) {
      break;
    }
  }

  return { recommendations: currentRecommendations, critique, attempts };
}

// Regenerate recommendations incorporating critique feedback
async function regenerateWithFeedback(
  availableTools: RecommendedTool[],
  userProfile: UserProfile,
  issues: string[],
  suggestions: string[],
): Promise<RecommendedTool[]> {
  try {
    const ai = getGeminiClient();

    const prompt = `You are an AI tool recommendation engine. Select the best 10 tools from the list below for this user.

User Profile:
- Focus: ${userProfile.focus || 'General'}
- Skill Level: ${userProfile.skill_level || 'Beginner'}
- Preferences: ${userProfile.preferences || 'None'}
- Existing Tools: ${userProfile.existing_tools || 'None'}
- Goal: ${userProfile.goal || 'Learn AI tools'}

IMPORTANT - Previous recommendations had these issues:
${issues.map(i => `- ${i}`).join('\n')}

Please fix these issues:
${suggestions.map(s => `- ${s}`).join('\n')}

Available Tools:
${availableTools.map((t, i) => `${i + 1}. ${t.name} (${t.category}, ${t.difficulty || 'Unknown'}, ${t.pricing || 'Unknown'})`).join('\n')}

Return ONLY a JSON array of indices (1-based) of the best tools, max 10:
[1, 5, 3, ...]`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });
    const text = result.text || '';

    const match = text.match(/\[[\d,\s]+\]/);
    if (match) {
      const indices = JSON.parse(match[0]) as number[];
      const selected = indices
        .map(idx => availableTools[idx - 1])
        .filter(Boolean)
        .slice(0, 10);

      if (selected.length > 0) return selected;
    }
  } catch (error) {
    console.error('Regeneration error:', error);
  }

  // Fallback to basic filtering
  return basicFilter(availableTools, userProfile);
}

// Basic filtering without AI
function basicFilter(tools: RecommendedTool[], profile: UserProfile): RecommendedTool[] {
  let filtered = [...tools];

  // Filter by pricing preference
  if (profile.preferences?.toLowerCase().includes('free')) {
    filtered = filtered.filter(
      t => !t.pricing || t.pricing.toLowerCase().includes('free') || t.pricing.toLowerCase().includes('freemium')
    );
  }

  // Filter out known tools
  if (profile.existing_tools) {
    const known = profile.existing_tools.toLowerCase().split(',').map(t => t.trim());
    filtered = filtered.filter(t => !known.some(k => t.name.toLowerCase().includes(k)));
  }

  // Sort by difficulty match
  if (profile.skill_level) {
    const level = profile.skill_level.toLowerCase();
    filtered.sort((a, b) => {
      const aMatch = (a.difficulty || '').toLowerCase() === level ? -1 : 0;
      const bMatch = (b.difficulty || '').toLowerCase() === level ? -1 : 0;
      return aMatch - bMatch;
    });
  }

  return filtered.slice(0, 10);
}
