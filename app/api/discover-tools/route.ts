import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '../../../lib/supabase';
import { isGeminiConfigured, getGeminiClient } from '../../../lib/gemini';

// Tool categories we care about
const TOOL_CATEGORIES = [
  'AI Design',
  'AI Video Editor',
  'AI Audio',
  'AI Photo Editor',
  'AI Site Builder',
  'Vibe Coding',
  'AI Writing',
  'AI Productivity',
];

// Quality thresholds to filter noise
const QUALITY_THRESHOLDS = {
  github: { minStars: 10 },
  hackernews: { minPoints: 5 },
  reddit: { minScore: 5 },
  producthunt: { minVotes: 0 }, // PH already curates heavily
  devhunt: { minVotes: 0 },
};

// Max tools per Gemini categorization batch
const GEMINI_BATCH_SIZE = 15;

// Fetch timeout in ms
const FETCH_TIMEOUT = 10_000;

// Fetch wrapper with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Product Hunt API integration
async function fetchProductHuntTools(): Promise<DiscoveredTool[]> {
  const token = process.env.PRODUCTHUNT_TOKEN;
  if (!token) {
    console.log('Product Hunt token not configured');
    return [];
  }

  try {
    const response = await fetchWithTimeout('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query {
            posts(first: 20, order: RANKING, postedAfter: "${getLastWeekDate()}") {
              edges {
                node {
                  id
                  name
                  tagline
                  description
                  url
                  website
                  votesCount
                  topics {
                    edges {
                      node {
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        `,
      }),
    });

    if (!response.ok) {
      console.error('Product Hunt API error:', response.status);
      return [];
    }

    const data = await response.json();
    const posts = data?.data?.posts?.edges || [];

    return posts
      .filter((edge: ProductHuntEdge) => {
        const topics = edge.node.topics?.edges?.map((t: TopicEdge) => t.node.name.toLowerCase()) || [];
        return topics.some((t: string) =>
          ['artificial intelligence', 'ai', 'design', 'no-code', 'developer tools', 'creative', 'video', 'audio'].includes(t)
        );
      })
      .filter((edge: ProductHuntEdge) => edge.node.votesCount >= QUALITY_THRESHOLDS.producthunt.minVotes)
      .map((edge: ProductHuntEdge) => ({
        name: edge.node.name,
        description: edge.node.tagline || edge.node.description,
        website: edge.node.website || edge.node.url,
        source: 'producthunt' as const,
        votes: edge.node.votesCount,
        topics: edge.node.topics?.edges?.map((t: TopicEdge) => t.node.name) || [],
      }));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('Product Hunt fetch timed out');
    } else {
      console.error('Product Hunt fetch error:', error);
    }
    return [];
  }
}

// GitHub Trending AI repositories - multiple queries for better coverage
async function fetchGitHubTrending(): Promise<DiscoveredTool[]> {
  const queries = [
    'topic:ai topic:tool',
    'topic:artificial-intelligence topic:design',
    'topic:generative-ai topic:creative',
    'topic:ai topic:developer-tools',
    'topic:llm topic:tool',
  ];

  const allRepos: DiscoveredTool[] = [];
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  for (const query of queries) {
    try {
      const encodedQuery = encodeURIComponent(`${query} created:>${getLastMonthDate()}`);
      const response = await fetchWithTimeout(
        `https://api.github.com/search/repositories?q=${encodedQuery}&sort=stars&order=desc&per_page=10`,
        { headers }
      );

      if (!response.ok) {
        if (response.status === 403) {
          console.warn('GitHub API rate limited. Set GITHUB_TOKEN for higher limits.');
          break;
        }
        console.error('GitHub API error:', response.status);
        continue;
      }

      const data = await response.json();
      const repos = data?.items || [];

      for (const repo of repos) {
        // Quality threshold: skip repos with too few stars
        if (repo.stargazers_count < QUALITY_THRESHOLDS.github.minStars) continue;
        // Skip repos with no description
        if (!repo.description) continue;

        const exists = allRepos.some(r => r.name.toLowerCase() === repo.name.toLowerCase());
        if (!exists) {
          allRepos.push({
            name: repo.name,
            description: repo.description,
            website: repo.homepage || repo.html_url,
            source: 'github' as const,
            votes: repo.stargazers_count,
            topics: repo.topics || [],
          });
        }
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('GitHub fetch timed out for query:', query);
      } else {
        console.error('GitHub fetch error:', error);
      }
      continue;
    }
  }

  return allRepos.slice(0, 20);
}

// Hacker News AI tools (via Algolia API)
async function fetchHackerNewsTools(): Promise<DiscoveredTool[]> {
  // Multiple queries for broader coverage
  const queries = [
    'AI%20tool',
    'AI%20design%20tool',
    'generative%20AI',
  ];

  const allHits: DiscoveredTool[] = [];

  for (const query of queries) {
    try {
      const response = await fetchWithTimeout(
        `https://hn.algolia.com/api/v1/search?query=${query}&tags=show_hn&hitsPerPage=15`
      );

      if (!response.ok) {
        console.error('HN API error:', response.status);
        continue;
      }

      const data = await response.json();
      const hits = data?.hits || [];

      for (const hit of hits as HNHit[]) {
        if (!hit.url) continue;
        // Quality threshold: skip low-engagement posts
        if ((hit.points || 0) < QUALITY_THRESHOLDS.hackernews.minPoints) continue;

        const name = extractToolName(hit.title);
        const exists = allHits.some(t => t.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
          allHits.push({
            name,
            description: hit.title,
            website: hit.url,
            source: 'hackernews' as const,
            votes: hit.points || 0,
            topics: [],
          });
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('HN fetch timed out');
      } else {
        console.error('HN fetch error:', error);
      }
      continue;
    }
  }

  return allHits.slice(0, 20);
}

// Reddit AI tools (via public JSON API) - multiple subreddits for better coverage
async function fetchRedditTools(): Promise<DiscoveredTool[]> {
  const subreddits = [
    { sub: 'ArtificialIntelligence', query: 'AI tool launch' },
    { sub: 'SideProject', query: 'AI tool' },
    { sub: 'webdev', query: 'AI design tool' },
  ];

  const allPosts: DiscoveredTool[] = [];

  for (const { sub, query } of subreddits) {
    try {
      const response = await fetchWithTimeout(
        `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=top&t=week&limit=10`,
        {
          headers: {
            'User-Agent': 'Forge-AI-Coach/1.0',
          },
        }
      );

      if (!response.ok) {
        console.error(`Reddit API error for r/${sub}:`, response.status);
        continue;
      }

      const data = await response.json();
      const posts = data?.data?.children || [];

      for (const post of posts as RedditPost[]) {
        if (!post.data.url || post.data.is_self) continue;
        // Quality threshold: skip low-score posts
        if ((post.data.score || 0) < QUALITY_THRESHOLDS.reddit.minScore) continue;

        const name = extractToolName(post.data.title);
        const exists = allPosts.some(t => t.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
          allPosts.push({
            name,
            description: post.data.title,
            website: post.data.url,
            source: 'reddit' as const,
            votes: post.data.score || 0,
            topics: [],
          });
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.error('Reddit fetch timed out');
      } else {
        console.error('Reddit fetch error:', error);
      }
      continue;
    }
  }

  return allPosts.slice(0, 15);
}

// DevHunt - developer tool launches (uses /api/past-week-tools, no auth required)
// Response format: array of week objects, each with a `products` array
// Product fields: id, email, name, description, logo_url, data_added, launch_date, votes_count, devhunt_link, link
async function fetchDevHuntTools(): Promise<DiscoveredTool[]> {
  try {
    const response = await fetchWithTimeout('https://devhunt.org/api/past-week-tools?limit=3');

    if (!response.ok) {
      console.error('DevHunt API error:', response.status);
      return [];
    }

    const data = await response.json();

    // Debug: log the shape of the response so we can verify the format
    console.log('DevHunt response type:', typeof data, Array.isArray(data) ? `array[${data.length}]` : '');
    if (Array.isArray(data) && data.length > 0) {
      console.log('DevHunt first item keys:', Object.keys(data[0]));
      if (data[0].products) {
        console.log('DevHunt products count:', data[0].products.length);
        if (data[0].products.length > 0) {
          console.log('DevHunt first product keys:', Object.keys(data[0].products[0]));
        }
      }
    } else if (data && typeof data === 'object') {
      console.log('DevHunt response keys:', Object.keys(data));
    }

    // Try multiple response shapes
    let allProducts: DevHuntTool[] = [];

    if (Array.isArray(data)) {
      // Shape 1: array of week objects with products arrays
      for (const item of data) {
        if (item.products && Array.isArray(item.products)) {
          allProducts.push(...item.products);
        } else if (item.name) {
          // Shape 2: direct array of tools
          allProducts.push(item);
        }
      }
    } else if (data?.products && Array.isArray(data.products)) {
      // Shape 3: single object with products array
      allProducts = data.products;
    } else if (data?.tools && Array.isArray(data.tools)) {
      // Shape 4: single object with tools array
      allProducts = data.tools;
    } else if (data?.data && Array.isArray(data.data)) {
      // Shape 5: single object with data array
      allProducts = data.data;
    }

    console.log('DevHunt total products extracted:', allProducts.length);

    // DevHunt is already a curated dev tool site — skip keyword filtering
    // and let Gemini's isRelevant check handle relevance instead.
    // Just truncate long descriptions to keep payloads manageable.
    return allProducts
      .slice(0, 15)
      .map((tool: DevHuntTool) => ({
        name: tool.name || 'Unknown',
        description: (tool.description || '').slice(0, 300),
        website: tool.link || tool.devhunt_link || '',
        source: 'devhunt' as const,
        votes: typeof tool.votes_count === 'number' ? tool.votes_count : 0,
        topics: [],
      }));
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error('DevHunt fetch timed out');
    } else {
      console.error('DevHunt fetch error:', error);
    }
    return [];
  }
}

// Use Gemini to categorize and analyze tools — with batch chunking
async function categorizeWithGemini(tools: DiscoveredTool[]): Promise<CategorizedTool[]> {
  if (!isGeminiConfigured() || tools.length === 0) {
    return tools.map((tool) => ({
      ...tool,
      category: guessCategory(tool),
      difficulty: 'Beginner',
      pricing: 'Unknown',
      isRelevant: true,
    }));
  }

  // Chunk tools into batches for reliability
  const batches: DiscoveredTool[][] = [];
  for (let i = 0; i < tools.length; i += GEMINI_BATCH_SIZE) {
    batches.push(tools.slice(i, i + GEMINI_BATCH_SIZE));
  }

  const allCategorized: CategorizedTool[] = [];

  for (const batch of batches) {
    try {
      const categorized = await categorizeBatch(batch);
      allCategorized.push(...categorized);
    } catch (error) {
      console.error('Batch categorization failed, using fallback:', error);
      // Fallback for this batch
      allCategorized.push(...batch.map((tool) => ({
        ...tool,
        category: guessCategory(tool),
        difficulty: 'Beginner',
        pricing: 'Unknown',
        isRelevant: true,
      })));
    }

    // Small delay between batches to avoid rate limiting
    if (batches.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return allCategorized;
}

// Categorize a single batch of tools with Gemini
async function categorizeBatch(tools: DiscoveredTool[]): Promise<CategorizedTool[]> {
  const ai = getGeminiClient();

  const prompt = `You are an AI tool categorization expert. Analyze each tool below and return structured data.

CATEGORY DEFINITIONS:
- "AI Design" — Image generation, graphic design, UI/UX design, illustration (e.g., Midjourney, Figma AI, DALL-E)
- "AI Video Editor" — Video generation, editing, animation, motion graphics (e.g., Runway, Pika, HeyGen)
- "AI Audio" — Voice synthesis, music generation, audio editing, podcasting (e.g., ElevenLabs, Suno, Descript)
- "AI Photo Editor" — Photo retouching, enhancement, background removal, upscaling (e.g., Remini, PicWish, Photoroom)
- "AI Site Builder" — Website generation, landing page builders, no-code web tools (e.g., Framer AI, Relume, v0)
- "Vibe Coding" — Code generation, developer tools, IDE extensions, programming assistants (e.g., Cursor, GitHub Copilot, Bolt)
- "AI Writing" — Text generation, copywriting, content creation, documentation (e.g., Jasper, Copy.ai, Notion AI)
- "AI Productivity" — Workflow automation, project management, general-purpose AI assistants (e.g., Zapier AI, ChatGPT, Perplexity)

DIFFICULTY LEVELS:
- "Beginner" — No technical skills needed, intuitive UI, drag-and-drop
- "Intermediate" — Some learning curve, may require prompt engineering or basic config
- "Advanced" — Requires coding, API integration, or deep technical knowledge

PRICING:
- "Free" — Completely free, no paid tiers
- "Freemium" — Free tier available with paid upgrades
- "Paid" — Requires payment to use (trial may exist)
- "Unknown" — Can't determine from available info

RELEVANCE:
- true — Useful for creative professionals, designers, or developers learning AI tools
- false — Too niche, enterprise-only, not creative/design related, or appears to be spam/low-quality

Tools to analyze:
${tools.map((t, i) => `${i + 1}. "${t.name}" — ${t.description}${t.topics?.length ? ` [topics: ${t.topics.join(', ')}]` : ''}${t.votes ? ` (${t.votes} votes/stars)` : ''}`).join('\n')}

Respond with ONLY a valid JSON array. No markdown, no backticks, no explanation:
[{"index": 0, "category": "AI Design", "difficulty": "Beginner", "pricing": "Freemium", "isRelevant": true}, ...]`;

  const result = await ai.models.generateContent({
    model: 'gemini-2.5-flash-lite',
    contents: prompt,
  });
  const text = result.text || '';

  // Robust JSON parsing with multiple fallback strategies
  const categories = parseJsonArray(text);

  return tools.map((tool, index) => {
    const cat = categories.find((c) => c.index === index) || {
      category: guessCategory(tool),
      difficulty: 'Beginner',
      pricing: 'Unknown',
      isRelevant: true,
    };
    return {
      ...tool,
      category: TOOL_CATEGORIES.includes(cat.category) ? cat.category : guessCategory(tool),
      difficulty: cat.difficulty || 'Beginner',
      pricing: cat.pricing || 'Unknown',
      isRelevant: cat.isRelevant !== false,
    };
  });
}

// Robust JSON array parser with multiple strategies
function parseJsonArray(text: string): GeminiCategory[] {
  // Strategy 1: Direct parse (if response is clean JSON)
  try {
    const parsed = JSON.parse(text.trim());
    if (Array.isArray(parsed)) return parsed;
  } catch { /* try next strategy */ }

  // Strategy 2: Extract JSON array from markdown or surrounding text
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch { /* try next strategy */ }
  }

  // Strategy 3: Extract from markdown code block
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch { /* try next strategy */ }
  }

  // Strategy 4: Try to fix common JSON issues (trailing commas, single quotes)
  try {
    const cleaned = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/,\s*([}\]])/g, '$1') // trailing commas
      .trim();
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
  } catch { /* give up */ }

  console.error('Failed to parse Gemini JSON response:', text.slice(0, 200));
  return [];
}

// Save new tools to Supabase (with source tracking)
async function saveToSupabase(tools: CategorizedTool[]): Promise<{ saved: number; skipped: number; skipReasons: { name: string; reason: string }[] }> {
  if (!isSupabaseConfigured()) {
    return { saved: 0, skipped: tools.length, skipReasons: [{ name: '*', reason: 'supabase_not_configured' }] };
  }

  let saved = 0;
  let skipped = 0;
  const skipReasons: { name: string; reason: string }[] = [];

  for (const tool of tools) {
    if (!tool.isRelevant) {
      skipped++;
      skipReasons.push({ name: tool.name, reason: 'not_relevant' });
      continue;
    }

    // Basic data validation
    if (!tool.name || tool.name.length < 2 || tool.name.length > 100) {
      skipped++;
      skipReasons.push({ name: tool.name || '(empty)', reason: 'invalid_name' });
      continue;
    }
    if (!tool.description || tool.description.length < 10) {
      skipped++;
      skipReasons.push({ name: tool.name, reason: 'description_too_short' });
      continue;
    }
    if (!tool.website || !isValidUrl(tool.website)) {
      skipped++;
      skipReasons.push({ name: tool.name, reason: 'invalid_url' });
      continue;
    }

    // Check if tool already exists
    const { data: existing } = await supabase
      .from('tools')
      .select('id')
      .ilike('name', tool.name)
      .single();

    if (existing) {
      skipped++;
      skipReasons.push({ name: tool.name, reason: 'already_exists' });
      continue;
    }

    // Insert new tool using admin client to bypass RLS
    const { error } = await supabaseAdmin.from('tools').insert({
      name: tool.name,
      description: tool.description || '',
      category: tool.category,
      pricing: tool.pricing,
      website: tool.website,
      difficulty: tool.difficulty,
      color: getRandomColor(),
      source: tool.source,
    });

    if (error) {
      console.error('Insert error for', tool.name, ':', error.message, error.code, error.details);
      skipped++;
      skipReasons.push({ name: tool.name, reason: `insert_error: ${error.message}` });
    } else {
      saved++;
      console.log('Saved new tool:', tool.name, '| category:', tool.category, '| source:', tool.source);
    }
  }

  return { saved, skipped, skipReasons };
}

// Helper functions
function getLastWeekDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}

function getLastMonthDate(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date.toISOString().split('T')[0];
}

function extractToolName(title: string): string {
  // Extract tool name from titles like "Show HN: ToolName – description"
  const match = title.match(/^(?:Show HN:\s*)?([^–\-:]+)/i);
  return match ? match[1].trim().slice(0, 80) : title.slice(0, 50);
}

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function guessCategory(tool: DiscoveredTool): string {
  const text = `${tool.name} ${tool.description} ${tool.topics?.join(' ')}`.toLowerCase();

  // Use scoring to pick best category rather than first match
  const scores: Record<string, number> = {};

  const patterns: [string, string[]][] = [
    ['AI Video Editor', ['video', 'animation', 'motion', 'clip', 'footage']],
    ['AI Audio', ['audio', 'voice', 'music', 'sound', 'podcast', 'speech', 'tts']],
    ['AI Photo Editor', ['photo', 'image', 'picture', 'retouch', 'upscale', 'background removal']],
    ['AI Site Builder', ['website', 'site builder', 'landing page', 'web app', 'no-code', 'webpage']],
    ['Vibe Coding', ['code', 'developer', 'programming', 'ide', 'github', 'coding', 'api', 'sdk', 'cli']],
    ['AI Writing', ['write', 'text', 'content', 'copy', 'blog', 'document', 'article', 'essay']],
    ['AI Design', ['design', 'ui', 'ux', 'creative', 'graphic', 'illustration', 'figma', 'canvas']],
    ['AI Productivity', ['productivity', 'workflow', 'automation', 'assistant', 'chat', 'search']],
  ];

  for (const [category, keywords] of patterns) {
    scores[category] = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) scores[category]++;
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : 'AI Productivity';
}

function getRandomColor(): string {
  const colors = ['bg-phoenix', 'bg-chartreuse', 'bg-cornflower', 'bg-lavender', 'bg-magnolia'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Types
interface DiscoveredTool {
  name: string;
  description: string;
  website: string;
  source: 'producthunt' | 'github' | 'hackernews' | 'reddit' | 'devhunt';
  votes: number;
  topics: string[];
}

interface CategorizedTool extends DiscoveredTool {
  category: string;
  difficulty: string;
  pricing: string;
  isRelevant: boolean;
}

interface GeminiCategory {
  index: number;
  category: string;
  difficulty: string;
  pricing: string;
  isRelevant: boolean;
}

interface ProductHuntEdge {
  node: {
    id: string;
    name: string;
    tagline: string;
    description: string;
    url: string;
    website: string;
    votesCount: number;
    topics?: { edges: TopicEdge[] };
  };
}

interface TopicEdge {
  node: { name: string };
}

interface HNHit {
  title: string;
  url: string;
  points: number;
}

interface RedditPost {
  data: {
    title: string;
    url: string;
    score: number;
    is_self: boolean;
  };
}

interface DevHuntTool {
  name?: string;
  description?: string;
  link?: string;
  devhunt_link?: string;
  votes_count?: number;
}

// API Route Handler
export async function POST(request: NextRequest) {
  try {
    const { sources = ['producthunt', 'github', 'hackernews', 'reddit', 'devhunt'], debug = false } = await request.json();

    // Fetch from all requested sources in parallel
    const fetchPromises: Promise<DiscoveredTool[]>[] = [];

    if (sources.includes('producthunt')) fetchPromises.push(fetchProductHuntTools());
    if (sources.includes('github')) fetchPromises.push(fetchGitHubTrending());
    if (sources.includes('hackernews')) fetchPromises.push(fetchHackerNewsTools());
    if (sources.includes('reddit')) fetchPromises.push(fetchRedditTools());
    if (sources.includes('devhunt')) fetchPromises.push(fetchDevHuntTools());

    const results = await Promise.all(fetchPromises);
    const allTools = results.flat();

    // Debug mode: return raw per-source counts + any raw data for inspection
    if (debug) {
      const sourceCounts: Record<string, number> = {};
      for (const tool of allTools) {
        sourceCounts[tool.source] = (sourceCounts[tool.source] || 0) + 1;
      }
      return NextResponse.json({
        debug: true,
        sourceCounts,
        totalDiscovered: allTools.length,
        tools: allTools.slice(0, 50),
      });
    }

    // Deduplicate by name within this batch
    const uniqueTools = allTools.reduce((acc: DiscoveredTool[], tool) => {
      if (!acc.find((t) => t.name.toLowerCase() === tool.name.toLowerCase())) {
        acc.push(tool);
      }
      return acc;
    }, []);

    // Pre-filter: remove tools that already exist in Supabase before calling Gemini
    let newTools = uniqueTools;
    if (isSupabaseConfigured()) {
      const checks = await Promise.all(
        uniqueTools.map(async (tool) => {
          const { data } = await supabase
            .from('tools')
            .select('id')
            .ilike('name', tool.name)
            .single();
          return { tool, exists: !!data };
        })
      );
      newTools = checks.filter((c) => !c.exists).map((c) => c.tool);
    }

    // Only call Gemini if there are genuinely new tools to categorize
    if (newTools.length === 0) {
      return NextResponse.json({
        success: true,
        discovered: allTools.length,
        unique: uniqueTools.length,
        new: 0,
        saved: 0,
        skipped: uniqueTools.length,
        tools: [],
        message: 'No new tools found — all already in database',
      });
    }

    // Categorize only new tools with Gemini (batched)
    const categorizedTools = await categorizeWithGemini(newTools);

    // Save to Supabase
    const { saved, skipped, skipReasons } = await saveToSupabase(categorizedTools);

    return NextResponse.json({
      success: true,
      discovered: allTools.length,
      unique: uniqueTools.length,
      new: newTools.length,
      saved,
      skipped,
      skipReasons,
      tools: categorizedTools.filter((t) => t.isRelevant),
    });
  } catch (error) {
    console.error('Discover tools error:', error);
    return NextResponse.json(
      { error: 'Failed to discover tools', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check configuration status
export async function GET() {
  return NextResponse.json({
    configured: {
      producthunt: Boolean(process.env.PRODUCTHUNT_TOKEN),
      github: true, // Works without token, just rate limited
      hackernews: true, // Public API
      reddit: true, // Public API
      devhunt: true, // Public API (past-week-tools endpoint)
      gemini: isGeminiConfigured(),
      supabase: isSupabaseConfigured(),
    },
    qualityThresholds: QUALITY_THRESHOLDS,
    categories: TOOL_CATEGORIES,
    batchSize: GEMINI_BATCH_SIZE,
  });
}
