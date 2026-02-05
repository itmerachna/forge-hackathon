import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { Tool } from '../../../types';

// Fallback tools when Supabase is not configured
const FALLBACK_TOOLS: Tool[] = [
  {
    id: 1, name: "AKOOL",
    description: "AI Video Creation Made Easy \u2013 Avatars, Translation, and Face Swap in One Platform",
    category: "AI Video Editor", pricing: "Freemium",
    website: "https://akool.com", twitter: "https://twitter.com/AKOOLGlobal",
    difficulty: "Beginner", color: "bg-phoenix", created_at: new Date().toISOString(),
  },
  {
    id: 2, name: "PixAI",
    description: "World's No.1 Anime & Character Generation AI",
    category: "AI Design", pricing: "Paid ($9.99/mo+)",
    website: "https://pixai.art/en", twitter: "https://twitter.com/PixAI_Official",
    difficulty: "Beginner", color: "bg-chartreuse", created_at: new Date().toISOString(),
  },
  {
    id: 3, name: "RecCloud",
    description: "AI Audio & Video Processing platform for creators",
    category: "AI Audio", pricing: "Freemium",
    website: "https://reccloud.com", twitter: "https://twitter.com/RecCloud_",
    difficulty: "Beginner", color: "bg-cornflower", created_at: new Date().toISOString(),
  },
  {
    id: 4, name: "KREA AI",
    description: "AI Creative Suite for Images, Video & 3D content generation",
    category: "AI Design", pricing: "Freemium",
    website: "https://www.krea.ai", twitter: "https://twitter.com/kaborea",
    difficulty: "Intermediate", color: "bg-lavender", created_at: new Date().toISOString(),
  },
  {
    id: 5, name: "Gamma",
    description: "Effortless AI design for presentations, websites, and more",
    category: "AI Design", pricing: "Freemium",
    website: "https://gamma.app", twitter: "https://twitter.com/MeetGamma",
    difficulty: "Beginner", color: "bg-magnolia", created_at: new Date().toISOString(),
  },
  {
    id: 6, name: "Anything",
    description: "Turn your words into mobile apps, sites, tools, and products - built with code",
    category: "Vibe Coding", pricing: "Freemium",
    website: "https://www.anything.com", twitter: "https://twitter.com/anything",
    difficulty: "Intermediate", color: "bg-phoenix", created_at: new Date().toISOString(),
  },
  {
    id: 7, name: "Relume",
    description: "Websites designed and built faster with AI",
    category: "AI Site Builder", pricing: "Freemium",
    website: "https://www.relume.io", twitter: "https://twitter.com/reaborea",
    difficulty: "Beginner", color: "bg-chartreuse", created_at: new Date().toISOString(),
  },
  {
    id: 8, name: "Descript",
    description: "AI editing for every kind of video with transcription and voice cloning",
    category: "AI Video Editor", pricing: "Paid ($24/mo+)",
    website: "https://www.descript.com", twitter: "https://twitter.com/DescriptApp",
    difficulty: "Intermediate", color: "bg-cornflower", created_at: new Date().toISOString(),
  },
  {
    id: 9, name: "PicWish",
    description: "All-in-one free AI photo editor - create professional photos effortlessly",
    category: "AI Photo Editor", pricing: "Freemium",
    website: "https://picwish.com", twitter: "https://twitter.com/PicWish",
    difficulty: "Beginner", color: "bg-lavender", created_at: new Date().toISOString(),
  },
  {
    id: 10, name: "Luma AI",
    description: "Production-ready images and videos with precision, speed, and control",
    category: "AI Design", pricing: "Freemium",
    website: "https://lumalabs.ai", twitter: "https://twitter.com/LumaLabsAI",
    difficulty: "Intermediate", color: "bg-magnolia", created_at: new Date().toISOString(),
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const difficulty = searchParams.get('difficulty');

    if (!isSupabaseConfigured()) {
      let tools = FALLBACK_TOOLS;
      if (category) tools = tools.filter(t => t.category === category);
      if (difficulty) tools = tools.filter(t => t.difficulty === difficulty);
      return NextResponse.json({ tools, total: tools.length });
    }

    let query = supabase.from('tools').select('*');
    if (category) query = query.eq('category', category);
    if (difficulty) query = query.eq('difficulty', difficulty);

    const { data, error } = await query.order('id', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ tools: FALLBACK_TOOLS, total: FALLBACK_TOOLS.length });
    }

    return NextResponse.json({ tools: data || [], total: data?.length || 0 });
  } catch (error) {
    console.error('Tools API error:', error);
    return NextResponse.json({ tools: FALLBACK_TOOLS, total: FALLBACK_TOOLS.length });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const tool = await request.json();
    const { data, error } = await supabase.from('tools').insert(tool).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Tools POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
