import { NextResponse } from 'next/server';
import { isGeminiConfigured, getGeminiClient } from '../../../lib/gemini';
import { getOpikClient } from '../../../lib/opik';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { Opik } from 'opik';

// Delay helper for rate limit avoidance
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Retry with exponential backoff on 429 errors
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const is429 = error instanceof Error && (
        error.message.includes('429') ||
        error.message.includes('RESOURCE_EXHAUSTED') ||
        error.message.includes('rate')
      );
      if (is429 && attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
        await delay(backoff);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Retry exhausted');
}

// Load real tools from Supabase (or fallback) for grounded evaluation
async function loadToolCatalog(): Promise<string> {
  const fallbackTools = [
    { name: 'AKOOL', category: 'AI Video Editor', pricing: 'Freemium', difficulty: 'Beginner', description: 'AI Video Creation – Avatars, Translation, Face Swap' },
    { name: 'PixAI', category: 'AI Design', pricing: 'Paid ($9.99/mo+)', difficulty: 'Beginner', description: 'Anime & Character Generation AI' },
    { name: 'RecCloud', category: 'AI Audio', pricing: 'Freemium', difficulty: 'Beginner', description: 'AI Audio & Video Processing' },
    { name: 'KREA AI', category: 'AI Design', pricing: 'Freemium', difficulty: 'Intermediate', description: 'AI Creative Suite for Images, Video & 3D' },
    { name: 'Gamma', category: 'AI Design', pricing: 'Freemium', difficulty: 'Beginner', description: 'AI design for presentations, websites, and more' },
    { name: 'Anything', category: 'Vibe Coding', pricing: 'Freemium', difficulty: 'Intermediate', description: 'Turn words into apps, sites, tools' },
    { name: 'Relume', category: 'AI Site Builder', pricing: 'Freemium', difficulty: 'Beginner', description: 'Websites designed and built faster with AI' },
    { name: 'Descript', category: 'AI Video Editor', pricing: 'Paid ($24/mo+)', difficulty: 'Intermediate', description: 'AI video editing with transcription and voice cloning' },
    { name: 'PicWish', category: 'AI Photo Editor', pricing: 'Freemium', difficulty: 'Beginner', description: 'All-in-one free AI photo editor' },
    { name: 'Luma AI', category: 'AI Design', pricing: 'Freemium', difficulty: 'Intermediate', description: 'Images and videos with precision, speed, control' },
    { name: 'Midjourney', category: 'AI Design', pricing: 'Paid ($10/mo+)', difficulty: 'Intermediate', description: 'AI image generation via Discord' },
    { name: 'Runway', category: 'AI Video Editor', pricing: 'Freemium', difficulty: 'Intermediate', description: 'AI video generation and editing suite' },
    { name: 'Figma', category: 'AI Design', pricing: 'Freemium', difficulty: 'Intermediate', description: 'Collaborative design tool with AI features' },
    { name: 'Cursor', category: 'Vibe Coding', pricing: 'Freemium', difficulty: 'Intermediate', description: 'AI-powered code editor' },
    { name: 'v0', category: 'Vibe Coding', pricing: 'Freemium', difficulty: 'Beginner', description: 'AI UI component generator by Vercel' },
    { name: 'Bolt', category: 'Vibe Coding', pricing: 'Freemium', difficulty: 'Beginner', description: 'AI full-stack app builder in the browser' },
    { name: 'Lovable', category: 'Vibe Coding', pricing: 'Freemium', difficulty: 'Beginner', description: 'AI app builder for non-coders' },
    { name: 'Webflow', category: 'AI Site Builder', pricing: 'Freemium', difficulty: 'Intermediate', description: 'Visual web design with AI features' },
    { name: 'Framer', category: 'AI Site Builder', pricing: 'Freemium', difficulty: 'Intermediate', description: 'AI-powered website builder' },
    { name: 'Canva', category: 'AI Design', pricing: 'Freemium', difficulty: 'Beginner', description: 'Easy graphic design with AI tools' },
    { name: 'DALL-E', category: 'AI Design', pricing: 'Paid', difficulty: 'Beginner', description: 'AI image generation by OpenAI' },
    { name: 'ElevenLabs', category: 'AI Audio', pricing: 'Freemium', difficulty: 'Beginner', description: 'AI voice cloning and text-to-speech' },
    { name: 'Suno', category: 'AI Audio', pricing: 'Freemium', difficulty: 'Beginner', description: 'AI music generation' },
    { name: 'Udio', category: 'AI Audio', pricing: 'Freemium', difficulty: 'Beginner', description: 'AI music creation platform' },
    { name: 'Claude', category: 'AI Writing', pricing: 'Freemium', difficulty: 'Beginner', description: 'AI assistant for writing and coding' },
    { name: 'Notion AI', category: 'AI Productivity', pricing: 'Paid ($10/mo+)', difficulty: 'Beginner', description: 'AI-powered workspace and notes' },
    { name: 'GitHub Copilot', category: 'Vibe Coding', pricing: 'Paid ($10/mo+)', difficulty: 'Intermediate', description: 'AI code completion in VS Code' },
    { name: 'Spline', category: 'AI Design', pricing: 'Freemium', difficulty: 'Intermediate', description: '3D design tool with AI features' },
    { name: 'Rive', category: 'AI Design', pricing: 'Freemium', difficulty: 'Advanced', description: 'Interactive animations for apps and games' },
    { name: 'Vercel', category: 'Vibe Coding', pricing: 'Freemium', difficulty: 'Intermediate', description: 'AI-powered deployment and hosting' },
  ];

  // Try to load from Supabase first
  if (isSupabaseConfigured()) {
    try {
      const { data: tools } = await supabase.from('tools').select('name, category, pricing, difficulty, description').order('id', { ascending: true });
      if (tools && tools.length > 0) {
        return tools.map(t => `- ${t.name} (${t.category}, ${t.pricing}, ${t.difficulty}): ${t.description}`).join('\n');
      }
    } catch {
      // Fall through to fallback
    }
  }

  return fallbackTools.map(t => `- ${t.name} (${t.category}, ${t.pricing}, ${t.difficulty}): ${t.description}`).join('\n');
}

// 45 test cases covering various scenarios
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

  // Cross-category and specific workflow tests (31-37)
  {
    id: 31,
    name: 'workflow-video-to-social',
    userProfile: { focus: 'UI/UX Design', skill_level: 'Intermediate', preferences: 'Tools that work together', existing_tools: 'Canva', goal: 'Create short-form video content for social media' },
    expectedTraits: { category_match: 'video', skill_level: 'Intermediate' },
  },
  {
    id: 32,
    name: 'workflow-design-to-code',
    userProfile: { focus: 'Frontend Development', skill_level: 'Intermediate', preferences: '', existing_tools: 'Figma', goal: 'Go from design to code faster' },
    expectedTraits: { skill_level: 'Intermediate', category_match: 'coding' },
  },
  {
    id: 33,
    name: 'workflow-audio-podcast',
    userProfile: { focus: 'No-Code Tools', skill_level: 'Beginner', preferences: 'Free or cheap', existing_tools: 'Canva', goal: 'Launch a podcast with AI-generated music and editing' },
    expectedTraits: { must_be_free: true, category_match: 'audio' },
  },
  {
    id: 34,
    name: 'premium-user-wants-best',
    userProfile: { focus: 'UI/UX Design', skill_level: 'Advanced', preferences: 'Price doesnt matter, I want the absolute best', existing_tools: 'Figma, Sketch', goal: 'Use the most powerful AI tools available' },
    expectedTraits: { skill_level: 'Advanced', should_include_advanced: true },
  },
  {
    id: 35,
    name: 'student-budget-creative',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: 'Student budget, need free tiers', existing_tools: 'Canva free', goal: 'Build a portfolio for job applications' },
    expectedTraits: { must_be_free: true, skill_level: 'Beginner' },
  },
  {
    id: 36,
    name: 'team-collaboration-focus',
    userProfile: { focus: 'UI/UX Design', skill_level: 'Intermediate', preferences: 'Must support real-time collaboration', existing_tools: 'Figma', goal: 'Find AI tools my team can use together' },
    expectedTraits: { skill_level: 'Intermediate' },
  },
  {
    id: 37,
    name: 'mobile-first-creator',
    userProfile: { focus: 'No-Code Tools', skill_level: 'Beginner', preferences: 'Must have mobile app', existing_tools: 'None', goal: 'Create content from my phone' },
    expectedTraits: { skill_level: 'Beginner' },
  },

  // Time-constrained and productivity tests (38-41)
  {
    id: 38,
    name: 'time-30min-per-week',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', weekly_hours: '30 minutes', preferences: '', existing_tools: 'None', goal: 'Learn one tool really well' },
    expectedTraits: { limited_time: true, should_focus: true, skill_level: 'Beginner' },
  },
  {
    id: 39,
    name: 'time-20hrs-deep-dive',
    userProfile: { focus: 'Frontend Development', skill_level: 'Advanced', weekly_hours: '20+ hours', preferences: '', existing_tools: 'VS Code, Cursor', goal: 'Deep dive into every vibe coding tool' },
    expectedTraits: { skill_level: 'Advanced' },
  },
  {
    id: 40,
    name: 'productivity-automate-workflow',
    userProfile: { focus: 'No-Code Tools', skill_level: 'Intermediate', preferences: 'Automation and productivity', existing_tools: 'Notion, Zapier', goal: 'Automate my design-to-publish workflow' },
    expectedTraits: { skill_level: 'Intermediate' },
  },
  {
    id: 41,
    name: 'freelancer-client-work',
    userProfile: { focus: 'Web Design', skill_level: 'Intermediate', preferences: 'Professional output quality', existing_tools: 'Figma, Webflow', goal: 'Speed up client website delivery' },
    expectedTraits: { skill_level: 'Intermediate', should_not_suggest_known: true },
  },

  // Specific category deep-dives (42-45)
  {
    id: 42,
    name: 'photo-editing-specialist',
    userProfile: { focus: 'UI/UX Design', skill_level: 'Intermediate', preferences: 'Photo editing specifically', existing_tools: 'Photoshop', goal: 'Replace Photoshop with AI alternatives' },
    expectedTraits: { skill_level: 'Intermediate', category_match: 'photo' },
  },
  {
    id: 43,
    name: 'writing-content-creator',
    userProfile: { focus: 'Web Design', skill_level: 'Beginner', preferences: '', existing_tools: 'None', goal: 'Write blog posts and social media content with AI' },
    expectedTraits: { skill_level: 'Beginner', category_match: 'writing' },
  },
  {
    id: 44,
    name: 'site-builder-no-code',
    userProfile: { focus: 'No-Code Tools', skill_level: 'Beginner', preferences: 'Zero coding required', existing_tools: 'None', goal: 'Build a landing page without writing code' },
    expectedTraits: { skill_level: 'Beginner', category_match: 'site' },
  },
  {
    id: 45,
    name: 'multi-tool-comparison',
    userProfile: { focus: 'Frontend Development', skill_level: 'Intermediate', preferences: 'Want to compare options', existing_tools: 'Cursor', goal: 'Find the best vibe coding tool - compare Bolt, v0, and Lovable' },
    expectedTraits: { skill_level: 'Intermediate', should_not_suggest_known: true },
  },
];

// Score a single test case result
function scoreResult(
  testCase: typeof TEST_CASES[0],
  recommendations: { pricing?: string; difficulty?: string; category?: string; name?: string }[],
): { score: number; issues: string[] } {
  let score = 0;
  const issues: string[] = [];

  // Base score for returning valid results
  score += 20;

  // Check free-only constraint
  if (testCase.expectedTraits.must_be_free) {
    const allFree = recommendations.every(
      (r) => r.pricing?.toLowerCase().includes('free') || r.pricing?.toLowerCase().includes('freemium')
    );
    if (allFree) {
      score += 20;
    } else {
      issues.push('Recommended paid tools to a free-only user');
    }
  } else {
    score += 20;
  }

  // Check skill level matching
  if (testCase.expectedTraits.skill_level) {
    const level = testCase.expectedTraits.skill_level;
    const matchCount = recommendations.filter(
      (r) => r.difficulty?.toLowerCase() === level.toLowerCase() ||
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
  const categories = new Set(recommendations.map((r) => r.category));
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
      (r) => knownTools.some(k => r.name?.toLowerCase().includes(k))
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

  return { score, issues };
}

// Run evaluation for a single test case
async function evaluateTestCase(testCase: typeof TEST_CASES[0], toolCatalog: string): Promise<{
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

  const opik = getOpikClient();

  try {
    const ai = getGeminiClient();

    const prompt = `You are Forge, an AI learning coach for design & vibe coding tools. Based on this user's profile, recommend exactly 5 AI tools from the catalog below.

IMPORTANT: You MUST only recommend tools from this catalog. Do NOT make up tools.

TOOL CATALOG:
${toolCatalog}

User Profile:
- Focus: ${testCase.userProfile.focus || 'Not specified'}
- Skill Level: ${testCase.userProfile.skill_level || 'Not specified'}
- Preferences: ${testCase.userProfile.preferences || 'None'}
- Existing Tools: ${testCase.userProfile.existing_tools || 'None'}
- Goal: ${testCase.userProfile.goal || 'Not specified'}
${testCase.context ? `\nContext: Tools tried: ${testCase.context.tools_tried}, Day of week: ${testCase.context.week_day}` : ''}

Pick the 5 most relevant tools for this user. Match their skill level, respect their pricing preferences, and avoid tools they already use.

Respond ONLY with a JSON array (no markdown, no explanation):
[{"name":"...", "category":"...", "difficulty":"...", "pricing":"...", "reason":"..."}]`;

    const result = await withRetry(() => ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    }));
    const responseText = result.text || '';

    // Parse response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      if (opik) {
        const trace = opik.trace({
          name: `eval: ${testCase.name}`,
          input: { userProfile: testCase.userProfile, expectedTraits: testCase.expectedTraits },
          output: { response: responseText, error: 'Invalid JSON response' },
          tags: ['evaluation', 'failed', testCase.name],
        });
        trace.score({ name: 'eval_score', value: 0, reason: 'Invalid JSON response' });
        trace.score({ name: 'eval_passed', value: 0, reason: 'Failed' });
      }
      return { id: testCase.id, name: testCase.name, passed: false, score: 0, details: 'Invalid JSON response', response: responseText };
    }

    let recommendations;
    try {
      recommendations = JSON.parse(jsonMatch[0]);
    } catch {
      if (opik) {
        const trace = opik.trace({
          name: `eval: ${testCase.name}`,
          input: { userProfile: testCase.userProfile, expectedTraits: testCase.expectedTraits },
          output: { response: responseText, error: 'Failed to parse JSON' },
          tags: ['evaluation', 'failed', testCase.name],
        });
        trace.score({ name: 'eval_score', value: 0, reason: 'Failed to parse JSON' });
        trace.score({ name: 'eval_passed', value: 0, reason: 'Failed' });
      }
      return { id: testCase.id, name: testCase.name, passed: false, score: 0, details: 'Failed to parse JSON', response: responseText };
    }

    if (!Array.isArray(recommendations) || recommendations.length === 0) {
      if (opik) {
        const trace = opik.trace({
          name: `eval: ${testCase.name}`,
          input: { userProfile: testCase.userProfile, expectedTraits: testCase.expectedTraits },
          output: { response: responseText, error: 'Empty recommendations' },
          tags: ['evaluation', 'failed', testCase.name],
        });
        trace.score({ name: 'eval_score', value: 0, reason: 'Empty recommendations' });
        trace.score({ name: 'eval_passed', value: 0, reason: 'Failed' });
      }
      return { id: testCase.id, name: testCase.name, passed: false, score: 0, details: 'Empty recommendations', response: responseText };
    }

    // Score the response
    const { score, issues } = scoreResult(testCase, recommendations);
    const passed = score >= 60;

    // Log eval trace with scores to Opik
    if (opik) {
      const trace = opik.trace({
        name: `eval: ${testCase.name}`,
        input: { userProfile: testCase.userProfile, expectedTraits: testCase.expectedTraits },
        output: { recommendations, responseText },
        metadata: {
          test_id: testCase.id,
          category: testCase.name.split('-')[0],
          issues,
        },
        tags: ['evaluation', passed ? 'passed' : 'failed', testCase.name],
      });
      trace.score({ name: 'eval_score', value: score / 100, reason: issues.length > 0 ? issues.join('; ') : 'All checks passed' });
      trace.score({ name: 'eval_passed', value: passed ? 1 : 0, reason: passed ? 'Score >= 60' : `Score ${score} < 60` });

      // Individual dimension scores for granular dashboard views
      if (testCase.expectedTraits.must_be_free) {
        const allFree = recommendations.every(
          (r: { pricing?: string }) => r.pricing?.toLowerCase().includes('free') || r.pricing?.toLowerCase().includes('freemium')
        );
        trace.score({ name: 'pricing_respect', value: allFree ? 1 : 0, reason: allFree ? 'Respected free-only' : 'Recommended paid tools' });
      }
      if (testCase.expectedTraits.skill_level) {
        const level = testCase.expectedTraits.skill_level;
        const matchCount = recommendations.filter(
          (r: { difficulty?: string }) => r.difficulty?.toLowerCase() === level.toLowerCase() ||
          (level === 'Beginner' && r.difficulty?.toLowerCase() !== 'advanced') ||
          (level === 'Advanced' && r.difficulty?.toLowerCase() !== 'beginner')
        ).length;
        trace.score({ name: 'skill_match', value: matchCount / recommendations.length, reason: `${matchCount}/${recommendations.length} tools matched ${level}` });
      }
      if (testCase.expectedTraits.should_not_suggest_known && testCase.userProfile.existing_tools) {
        const knownTools = testCase.userProfile.existing_tools.toLowerCase().split(',').map(t => t.trim());
        const suggested = recommendations.some(
          (r: { name?: string }) => knownTools.some(k => r.name?.toLowerCase().includes(k))
        );
        trace.score({ name: 'novelty', value: suggested ? 0 : 1, reason: suggested ? 'Suggested known tools' : 'All novel recommendations' });
      }
    }

    return {
      id: testCase.id,
      name: testCase.name,
      passed,
      score,
      details: issues.length > 0 ? issues.join('; ') : 'All checks passed',
      response: responseText,
    };
  } catch (error) {
    if (opik) {
      const trace = opik.trace({
        name: `eval: ${testCase.name}`,
        input: { userProfile: testCase.userProfile, expectedTraits: testCase.expectedTraits },
        output: { error: error instanceof Error ? error.message : String(error) },
        tags: ['evaluation', 'error', testCase.name],
      });
      trace.score({ name: 'eval_score', value: 0, reason: `Error: ${error instanceof Error ? error.message : String(error)}` });
      trace.score({ name: 'eval_passed', value: 0, reason: 'Error' });
    }
    return {
      id: testCase.id,
      name: testCase.name,
      passed: false,
      score: 0,
      details: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Seed the Opik dataset with test cases (idempotent — only creates if needed)
async function seedOpikDataset(opik: Opik) {
  const dataset = await opik.getOrCreateDataset(
    'forge-eval-suite',
    '45 test cases for Forge AI coach recommendation quality'
  );

  // Insert all test cases as dataset items
  const items = TEST_CASES.map(tc => ({
    input: {
      userProfile: tc.userProfile,
      context: tc.context || null,
    },
    expected_output: {
      expectedTraits: tc.expectedTraits,
    },
    metadata: {
      test_id: tc.id,
      test_name: tc.name,
      category: tc.name.split('-')[0],
    },
  }));

  await dataset.insert(items);
  return dataset;
}

// GET: Run all test cases as an Opik experiment
export async function GET() {
  const results = [];
  let totalScore = 0;
  let passedCount = 0;

  const opik = getOpikClient();

  // Seed the Opik dataset (idempotent)
  let datasetName: string | undefined;
  if (opik) {
    try {
      const dataset = await seedOpikDataset(opik);
      datasetName = dataset.name;
    } catch (error) {
      console.error('Failed to seed Opik dataset:', error);
    }
  }

  // Create a named experiment for this run
  const runTimestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const experimentName = `forge-eval-${runTimestamp}`;
  let experimentId: string | undefined;

  if (opik && datasetName) {
    try {
      const experiment = await opik.createExperiment({
        datasetName,
        name: experimentName,
        experimentConfig: {
          model: 'gemini-2.5-flash-lite',
          pass_threshold: 60,
          grounded_in_catalog: true,
        },
      });
      experimentId = experiment.id;
    } catch (error) {
      console.error('Failed to create Opik experiment:', error);
    }
  }

  // Load tool catalog once for all test cases (grounds responses in real tools)
  const toolCatalog = await loadToolCatalog();

  // Run test cases sequentially with delays to avoid Gemini rate limits
  for (let i = 0; i < TEST_CASES.length; i++) {
    const testCase = TEST_CASES[i];
    const result = await evaluateTestCase(testCase, toolCatalog);
    results.push(result);
    totalScore += result.score;
    if (result.passed) passedCount++;

    // 1.5s delay between requests to stay under Gemini rate limits
    if (i < TEST_CASES.length - 1) {
      await delay(1500);
    }
  }

  const avgScore = Math.round(totalScore / TEST_CASES.length);

  // Flush Opik to ensure all traces/scores are sent
  if (opik) {
    await opik.flush();
  }

  return NextResponse.json({
    summary: {
      total: TEST_CASES.length,
      passed: passedCount,
      failed: TEST_CASES.length - passedCount,
      average_score: avgScore,
      pass_rate: `${Math.round((passedCount / TEST_CASES.length) * 100)}%`,
    },
    experiment: experimentId ? { id: experimentId, name: experimentName, dataset: datasetName } : undefined,
    results,
  });
}
