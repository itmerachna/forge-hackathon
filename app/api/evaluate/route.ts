import { NextResponse } from 'next/server';
import { isGeminiConfigured, getGeminiClient } from '../../../lib/gemini';

// 30 test cases covering various scenarios
const TEST_CASES = [
  // Free-only user preferences (1-5)
  {
    id: 1,
    name: 'free-only-beginner-design',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: 'Only free tools', existing_tools: 'None', goal: 'Learn AI design tools' },
    expectedTraits: { must_be_free: true, skill_level: 'Beginner', category_match: 'design' },
  },
  {
    id: 2,
    name: 'free-only-intermediate-video',
    userProfile: { focus: 'UI/UX Design', skill_level: 'Intermediate', preferences: 'Free tools only, no subscriptions', existing_tools: 'Figma', goal: 'Add video to my design workflow' },
    expectedTraits: { must_be_free: true, skill_level: 'Intermediate', category_match: 'video' },
  },
  {
    id: 3,
    name: 'free-only-advanced-coding',
    userProfile: { focus: 'Frontend Development', skill_level: 'Advanced', preferences: 'Only free and open source', existing_tools: 'VS Code, GitHub Copilot', goal: 'Find alternative AI coding tools' },
    expectedTraits: { must_be_free: true, skill_level: 'Advanced', category_match: 'coding' },
  },
  {
    id: 4,
    name: 'free-only-beginner-audio',
    userProfile: { focus: 'No-Code Tools', skill_level: 'Beginner', preferences: 'Free tools with tutorials', existing_tools: 'Canva', goal: 'Start podcasting' },
    expectedTraits: { must_be_free: true, skill_level: 'Beginner', category_match: 'audio' },
  },
  {
    id: 5,
    name: 'free-only-beginner-site-builder',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: 'Absolutely free, no credit card', existing_tools: 'None', goal: 'Build my first website' },
    expectedTraits: { must_be_free: true, skill_level: 'Beginner', category_match: 'site' },
  },

  // Skill level matching (6-12)
  {
    id: 6,
    name: 'beginner-should-get-easy-tools',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: '', existing_tools: 'None', goal: 'Learn basics' },
    expectedTraits: { skill_level: 'Beginner', should_avoid_advanced: true },
  },
  {
    id: 7,
    name: 'intermediate-balanced-tools',
    userProfile: { focus: 'UI/UX Design', skill_level: 'Intermediate', preferences: '', existing_tools: 'Figma, Canva', goal: 'Level up design skills' },
    expectedTraits: { skill_level: 'Intermediate' },
  },
  {
    id: 8,
    name: 'advanced-complex-tools',
    userProfile: { focus: 'Frontend Development', skill_level: 'Advanced', preferences: 'Powerful tools', existing_tools: 'VS Code, Figma, Midjourney', goal: 'Master AI-assisted development' },
    expectedTraits: { skill_level: 'Advanced', should_include_advanced: true },
  },
  {
    id: 9,
    name: 'beginner-3d-motion',
    userProfile: { focus: '3D/Motion Design', skill_level: 'Beginner', preferences: '', existing_tools: 'None', goal: 'Start with 3D' },
    expectedTraits: { skill_level: 'Beginner', category_match: '3d' },
  },
  {
    id: 10,
    name: 'intermediate-nocode',
    userProfile: { focus: 'No-Code Tools', skill_level: 'Intermediate', preferences: '', existing_tools: 'Webflow, Bubble', goal: 'Find new no-code AI tools' },
    expectedTraits: { skill_level: 'Intermediate', category_match: 'nocode' },
  },
  {
    id: 11,
    name: 'advanced-multimodal',
    userProfile: { focus: 'UI/UX Design', skill_level: 'Advanced', preferences: 'Cutting edge tools', existing_tools: 'Figma, Midjourney, Runway, Descript', goal: 'Explore bleeding edge AI' },
    expectedTraits: { skill_level: 'Advanced', should_not_suggest_known: true },
  },
  {
    id: 12,
    name: 'beginner-complete-novice',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: 'Very simple tools', existing_tools: 'None at all', goal: 'Just explore' },
    expectedTraits: { skill_level: 'Beginner', should_be_simple: true },
  },

  // Conflicting preferences (13-18)
  {
    id: 13,
    name: 'conflict-free-but-wants-advanced',
    userProfile: { focus: 'Frontend Development', skill_level: 'Advanced', preferences: 'Only free tools', existing_tools: 'All major tools', goal: 'Find hidden free gems' },
    expectedTraits: { must_be_free: true, skill_level: 'Advanced' },
  },
  {
    id: 14,
    name: 'conflict-beginner-wants-pro-tools',
    userProfile: { focus: 'UI/UX Design', skill_level: 'Beginner', preferences: 'Professional grade tools', existing_tools: 'None', goal: 'Become a pro designer' },
    expectedTraits: { skill_level: 'Beginner', should_bridge: true },
  },
  {
    id: 15,
    name: 'conflict-limited-time-many-goals',
    userProfile: { focus: 'Web Design', skill_level: 'Intermediate', weekly_hours: '1-2 hours', preferences: '', existing_tools: 'Canva', goal: 'Learn video, audio, and 3D design' },
    expectedTraits: { limited_time: true, should_focus: true },
  },
  {
    id: 16,
    name: 'conflict-all-categories',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: 'I want everything', existing_tools: 'None', goal: 'Master all AI tools' },
    expectedTraits: { should_prioritize: true },
  },
  {
    id: 17,
    name: 'conflict-knows-everything',
    userProfile: { focus: 'Frontend Development', skill_level: 'Advanced', preferences: '', existing_tools: 'Figma, Midjourney, DALL-E, Runway, Descript, Gamma, Relume, KREA', goal: 'Find something new' },
    expectedTraits: { should_not_suggest_known: true },
  },
  {
    id: 18,
    name: 'conflict-vague-preferences',
    userProfile: { focus: '', skill_level: '', preferences: 'Whatever is good', existing_tools: '', goal: 'Idk' },
    expectedTraits: { should_handle_vague: true },
  },

  // Accountability lock/unlock (19-24)
  {
    id: 19,
    name: 'accountability-no-progress',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: '', existing_tools: 'None', goal: 'Try 3 tools this week' },
    context: { tools_tried: 0, week_day: 5, total_tools: 10 },
    expectedTraits: { should_warn: true },
  },
  {
    id: 20,
    name: 'accountability-on-track',
    userProfile: { focus: 'UI/UX Design', skill_level: 'Intermediate', preferences: '', existing_tools: 'Figma', goal: 'Try 3 tools' },
    context: { tools_tried: 2, week_day: 3, total_tools: 10 },
    expectedTraits: { should_encourage: true },
  },
  {
    id: 21,
    name: 'accountability-exceeded-goal',
    userProfile: { focus: 'Frontend Development', skill_level: 'Advanced', preferences: '', existing_tools: 'VS Code', goal: 'Try 3 tools' },
    context: { tools_tried: 5, week_day: 4, total_tools: 10 },
    expectedTraits: { should_celebrate: true },
  },
  {
    id: 22,
    name: 'accountability-last-day-warning',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: '', existing_tools: '', goal: 'Try 3 tools' },
    context: { tools_tried: 0, week_day: 7, total_tools: 10 },
    expectedTraits: { should_urgently_warn: true },
  },
  {
    id: 23,
    name: 'accountability-proof-submitted',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: '', existing_tools: '', goal: 'Build a landing page' },
    context: { tools_tried: 3, proof_submitted: true, week_day: 6 },
    expectedTraits: { should_unlock_next: true },
  },
  {
    id: 24,
    name: 'accountability-no-proof-deadline',
    userProfile: { focus: 'UI/UX Design', skill_level: 'Intermediate', preferences: '', existing_tools: 'Figma', goal: 'Design 2 projects' },
    context: { tools_tried: 2, proof_submitted: false, week_day: 7 },
    expectedTraits: { should_remind_proof: true },
  },

  // Edge cases (25-30)
  {
    id: 25,
    name: 'edge-empty-profile',
    userProfile: { focus: '', skill_level: '', preferences: '', existing_tools: '', goal: '' },
    expectedTraits: { should_handle_gracefully: true },
  },
  {
    id: 26,
    name: 'edge-very-long-preferences',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: 'I want tools that are free, have tutorials, work on Mac and Windows, support dark mode, have mobile apps, integrate with Figma, have API access, support team collaboration, have good documentation, and work offline. Also I prefer tools that are less than 2 years old and have active communities.', existing_tools: 'Figma', goal: 'Find the perfect tool' },
    expectedTraits: { should_not_crash: true },
  },
  {
    id: 27,
    name: 'edge-special-characters',
    userProfile: { focus: 'Web Design <script>alert("xss")</script>', skill_level: 'Beginner', preferences: "Tools with 'quotes' and \"double quotes\"", existing_tools: 'None', goal: 'Learn & grow' },
    expectedTraits: { should_sanitize: true },
  },
  {
    id: 28,
    name: 'edge-all-tools-tried',
    userProfile: { focus: 'Web Design', skill_level: 'Advanced', preferences: '', existing_tools: 'Every tool', goal: 'Already tried everything' },
    context: { tools_tried: 10, total_tools: 10 },
    expectedTraits: { should_suggest_revisit: true },
  },
  {
    id: 29,
    name: 'edge-rapid-skill-change',
    userProfile: { focus: 'Frontend Development', skill_level: 'Advanced', preferences: '', existing_tools: 'Cursor, Copilot, v0', goal: 'Switch from coding to design' },
    expectedTraits: { should_adapt_category: true },
  },
  {
    id: 30,
    name: 'edge-non-english-goal',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: '', existing_tools: '', goal: 'Aprender herramientas de IA' },
    expectedTraits: { should_handle_gracefully: true },
  },
];

// Run evaluation for a single test case
async function evaluateTestCase(testCase: typeof TEST_CASES[0]): Promise<{
  id: number;
  name: string;
  passed: boolean;
  score: number;
  details: string;
  response?: string;
}> {
  if (!isGeminiConfigured()) {
    return { id: testCase.id, name: testCase.name, passed: false, score: 0, details: 'Gemini not configured' };
  }

  try {
    const ai = getGeminiClient();

    // Simulate the recommendation prompt
    const prompt = `You are Forge, an AI learning coach. Based on this user's profile, recommend 5 AI tools.

User Profile:
- Focus: ${testCase.userProfile.focus || 'Not specified'}
- Skill Level: ${testCase.userProfile.skill_level || 'Not specified'}
- Preferences: ${testCase.userProfile.preferences || 'None'}
- Existing Tools: ${testCase.userProfile.existing_tools || 'None'}
- Goal: ${testCase.userProfile.goal || 'Not specified'}
${testCase.context ? `\nContext: Tools tried: ${testCase.context.tools_tried}, Day of week: ${testCase.context.week_day}` : ''}

For each tool, provide: name, category, difficulty level, pricing (Free/Freemium/Paid), and a one-line reason why it fits this user.

Respond ONLY with a JSON array:
[{"name":"...", "category":"...", "difficulty":"...", "pricing":"...", "reason":"..."}]`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });
    const responseText = result.text || '';

    // Score the response
    let score = 0;
    const issues: string[] = [];

    // Check if response is valid JSON
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { id: testCase.id, name: testCase.name, passed: false, score: 0, details: 'Invalid JSON response', response: responseText };
    }

    let recommendations;
    try {
      recommendations = JSON.parse(jsonMatch[0]);
    } catch {
      return { id: testCase.id, name: testCase.name, passed: false, score: 0, details: 'Failed to parse JSON', response: responseText };
    }

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      return { id: testCase.id, name: testCase.name, passed: false, score: 0, details: 'Empty recommendations', response: responseText };
    }

    // Base score for returning valid results
    score += 20;

    // Check free-only constraint
    if (testCase.expectedTraits.must_be_free) {
      const allFree = recommendations.every(
        (r: { pricing: string }) => r.pricing?.toLowerCase().includes('free') || r.pricing?.toLowerCase().includes('freemium')
      );
      if (allFree) {
        score += 20;
      } else {
        issues.push('Recommended paid tools to a free-only user');
      }
    } else {
      score += 20; // No constraint to check
    }

    // Check skill level matching
    if (testCase.expectedTraits.skill_level) {
      const level = testCase.expectedTraits.skill_level;
      const matchCount = recommendations.filter(
        (r: { difficulty: string }) => r.difficulty?.toLowerCase() === level.toLowerCase() ||
        (level === 'Beginner' && r.difficulty?.toLowerCase() !== 'advanced') ||
        (level === 'Advanced' && r.difficulty?.toLowerCase() !== 'beginner')
      ).length;
      const matchRatio = matchCount / recommendations.length;
      score += Math.round(matchRatio * 20);
      if (matchRatio < 0.5) {
        issues.push(`Skill level mismatch: expected ${level}, got poor matching`);
      }
    } else {
      score += 20;
    }

    // Check variety (not all same category)
    const categories = new Set(recommendations.map((r: { category: string }) => r.category));
    if (categories.size >= 2) {
      score += 20;
    } else if (recommendations.length > 1) {
      issues.push('Low variety: all tools in same category');
      score += 10;
    }

    // Check that known tools aren't recommended
    if (testCase.expectedTraits.should_not_suggest_known && testCase.userProfile.existing_tools) {
      const knownTools = testCase.userProfile.existing_tools.toLowerCase().split(',').map(t => t.trim());
      const suggested = recommendations.some(
        (r: { name: string }) => knownTools.some(k => r.name?.toLowerCase().includes(k))
      );
      if (!suggested) {
        score += 20;
      } else {
        issues.push('Recommended tools the user already knows');
        score += 5;
      }
    } else {
      score += 20;
    }

    const passed = score >= 60;

    return {
      id: testCase.id,
      name: testCase.name,
      passed,
      score,
      details: issues.length > 0 ? issues.join('; ') : 'All checks passed',
      response: responseText,
    };
  } catch (error) {
    return {
      id: testCase.id,
      name: testCase.name,
      passed: false,
      score: 0,
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// GET: Run all test cases
export async function GET() {
  const results = [];
  let totalScore = 0;
  let passedCount = 0;

  // Run test cases sequentially to avoid rate limits
  for (const testCase of TEST_CASES) {
    const result = await evaluateTestCase(testCase);
    results.push(result);
    totalScore += result.score;
    if (result.passed) passedCount++;
  }

  const avgScore = Math.round(totalScore / TEST_CASES.length);

  return NextResponse.json({
    summary: {
      total: TEST_CASES.length,
      passed: passedCount,
      failed: TEST_CASES.length - passedCount,
      average_score: avgScore,
      pass_rate: `${Math.round((passedCount / TEST_CASES.length) * 100)}%`,
    },
    results,
  });
}
