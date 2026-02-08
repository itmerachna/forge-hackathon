import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
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

// Product Hunt API integration
async function fetchProductHuntTools(): Promise<DiscoveredTool[]> {
  const token = process.env.PRODUCTHUNT_TOKEN;
  if (!token) {
    console.log('Product Hunt token not configured');
    return [];
  }

  try {
    const response = await fetch('https://api.producthunt.com/v2/api/graphql', {
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
      .map((edge: ProductHuntEdge) => ({
        name: edge.node.name,
        description: edge.node.tagline || edge.node.description,
        website: edge.node.website || edge.node.url,
        source: 'producthunt' as const,
        votes: edge.node.votesCount,
        topics: edge.node.topics?.edges?.map((t: TopicEdge) => t.node.name) || [],
      }));
  } catch (error) {
    console.error('Product Hunt fetch error:', error);
    return [];
  }
}

// GitHub Trending AI repositories - multiple queries for better coverage
async function fetchGitHubTrending(): Promise<DiscoveredTool[]> {
  const queries = [
    'topic:ai topic:tool',
    'topic:artificial-intelligence topic:design',
    'topic:generative-ai topic:creative',
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
      const response = await fetch(
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
        const exists = allRepos.some(r => r.name.toLowerCase() === repo.name.toLowerCase());
        if (!exists) {
          allRepos.push({
            name: repo.name,
            description: repo.description || '',
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
      console.error('GitHub fetch error:', error);
      continue;
    }
  }

  return allRepos.slice(0, 15);
}

// Hacker News AI tools (via Algolia API)
async function fetchHackerNewsTools(): Promise<DiscoveredTool[]> {
  try {
    const response = await fetch(
      'https://hn.algolia.com/api/v1/search?query=AI%20tool&tags=show_hn&hitsPerPage=15'
    );

    if (!response.ok) {
      console.error('HN API error:', response.status);
      return [];
    }

    const data = await response.json();
    const hits = data?.hits || [];

    return hits
      .filter((hit: HNHit) => hit.url)
      .map((hit: HNHit) => ({
        name: extractToolName(hit.title),
        description: hit.title,
        website: hit.url,
        source: 'hackernews' as const,
        votes: hit.points || 0,
        topics: [],
      }));
  } catch (error) {
    console.error('HN fetch error:', error);
    return [];
  }
}

// Reddit AI tools (via public JSON API)
async function fetchRedditTools(): Promise<DiscoveredTool[]> {
  try {
    const response = await fetch(
      'https://www.reddit.com/r/ArtificialIntelligence/search.json?q=tool&restrict_sr=1&sort=top&t=week&limit=15',
      {
        headers: {
          'User-Agent': 'Forge-AI-Coach/1.0',
        },
      }
    );

    if (!response.ok) {
      console.error('Reddit API error:', response.status);
      return [];
    }

    const data = await response.json();
    const posts = data?.data?.children || [];

    return posts
      .filter((post: RedditPost) => post.data.url && !post.data.is_self)
      .map((post: RedditPost) => ({
        name: extractToolName(post.data.title),
        description: post.data.title,
        website: post.data.url,
        source: 'reddit' as const,
        votes: post.data.score || 0,
        topics: [],
      }));
  } catch (error) {
    console.error('Reddit fetch error:', error);
    return [];
  }
}

// Use Gemini to categorize and analyze tools
async function categorizeWithGemini(tools: DiscoveredTool[]): Promise<CategorizedTool[]> {
  if (!isGeminiConfigured() || tools.length === 0) {
    // Basic categorization without AI
    return tools.map((tool) => ({
      ...tool,
      category: guessCategory(tool),
      difficulty: 'Beginner',
      pricing: 'Unknown',
      isRelevant: true,
    }));
  }

  try {
    const ai = getGeminiClient();

    const prompt = `Analyze these AI tools and categorize them. For each tool, determine:
1. category (one of: ${TOOL_CATEGORIES.join(', ')})
2. difficulty (Beginner, Intermediate, Advanced)
3. pricing (Free, Freemium, Paid, Unknown)
4. isRelevant (true if it's useful for creative professionals, designers, or developers learning AI tools)

Tools to analyze:
${tools.map((t, i) => `${i + 1}. ${t.name}: ${t.description}`).join('\n')}

Respond with ONLY a JSON array, no markdown, no explanation:
[{"index": 0, "category": "AI Design", "difficulty": "Beginner", "pricing": "Freemium", "isRelevant": true}, ...]`;

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });
    const text = result.text || '';

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const categories = JSON.parse(jsonMatch[0]) as GeminiCategory[];

    return tools.map((tool, index) => {
      const cat = categories.find((c) => c.index === index) || {
        category: guessCategory(tool),
        difficulty: 'Beginner',
        pricing: 'Unknown',
        isRelevant: true,
      };
      return {
        ...tool,
        category: cat.category || guessCategory(tool),
        difficulty: cat.difficulty || 'Beginner',
        pricing: cat.pricing || 'Unknown',
        isRelevant: cat.isRelevant !== false,
      };
    });
  } catch (error) {
    console.error('Gemini categorization error:', error);
    // Fallback to basic categorization
    return tools.map((tool) => ({
      ...tool,
      category: guessCategory(tool),
      difficulty: 'Beginner',
      pricing: 'Unknown',
      isRelevant: true,
    }));
  }
}

// Save new tools to Supabase
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

    // Insert new tool (only columns that exist in schema)
    const { error } = await supabase.from('tools').insert({
      name: tool.name,
      description: tool.description || '',
      category: tool.category,
      pricing: tool.pricing,
      website: tool.website,
      difficulty: tool.difficulty,
      color: getRandomColor(),
    });

    if (error) {
      console.error('Insert error for', tool.name, ':', error.message, error.code, error.details);
      skipped++;
      skipReasons.push({ name: tool.name, reason: `insert_error: ${error.message}` });
    } else {
      saved++;
      console.log('Saved new tool:', tool.name, '| category:', tool.category);
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
  return match ? match[1].trim() : title.slice(0, 50);
}

function guessCategory(tool: DiscoveredTool): string {
  const text = `${tool.name} ${tool.description} ${tool.topics?.join(' ')}`.toLowerCase();

  if (text.includes('video') || text.includes('animation')) return 'AI Video Editor';
  if (text.includes('audio') || text.includes('voice') || text.includes('music')) return 'AI Audio';
  if (text.includes('photo') || text.includes('image') || text.includes('picture')) return 'AI Photo Editor';
  if (text.includes('website') || text.includes('site builder') || text.includes('landing')) return 'AI Site Builder';
  if (text.includes('code') || text.includes('developer') || text.includes('programming')) return 'Vibe Coding';
  if (text.includes('write') || text.includes('text') || text.includes('content')) return 'AI Writing';
  if (text.includes('design') || text.includes('ui') || text.includes('creative')) return 'AI Design';
  return 'AI Productivity';
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
  source: 'producthunt' | 'github' | 'hackernews' | 'reddit';
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

interface GitHubRepo {
  name: string;
  description: string;
  html_url: string;
  homepage: string;
  stargazers_count: number;
  topics: string[];
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

// API Route Handler
export async function POST(request: NextRequest) {
  try {
    const { sources = ['producthunt', 'github', 'hackernews', 'reddit'] } = await request.json();

    // Fetch from all requested sources in parallel
    const fetchPromises: Promise<DiscoveredTool[]>[] = [];

    if (sources.includes('producthunt')) fetchPromises.push(fetchProductHuntTools());
    if (sources.includes('github')) fetchPromises.push(fetchGitHubTrending());
    if (sources.includes('hackernews')) fetchPromises.push(fetchHackerNewsTools());
    if (sources.includes('reddit')) fetchPromises.push(fetchRedditTools());

    const results = await Promise.all(fetchPromises);
    const allTools = results.flat();

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

    // Categorize only new tools with Gemini
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
      gemini: isGeminiConfigured(),
      supabase: isSupabaseConfigured(),
    },
  });
}
