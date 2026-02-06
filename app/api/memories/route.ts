import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { summarizeConversation, formatSummaryForMemory } from '../../../lib/summarize';
import type { ChatMessage } from '../../../types';

const MEMORIES_DIR = path.join(process.cwd(), 'private', 'memories');
const MEMORIES_FILE = path.join(MEMORIES_DIR, 'UserMemories.md');

// Read the current UserMemories file
async function readMemories(): Promise<string> {
  try {
    return await readFile(MEMORIES_FILE, 'utf-8');
  } catch {
    return '# User Memories\n\n## Learning Journey\n\n## Tool Preferences\n\n## Conversation Summaries\n\n## Weekly Reflections\n';
  }
}

// Append to a specific section in the memories file
async function appendToSection(section: string, content: string): Promise<void> {
  await mkdir(MEMORIES_DIR, { recursive: true });
  let memories = await readMemories();

  const sectionHeader = `## ${section}`;
  const sectionIdx = memories.indexOf(sectionHeader);

  if (sectionIdx === -1) {
    // Add section at end
    memories += `\n${sectionHeader}\n${content}\n`;
  } else {
    // Find next section or end of file
    const afterHeader = sectionIdx + sectionHeader.length;
    const nextSection = memories.indexOf('\n## ', afterHeader);
    const insertPoint = nextSection === -1 ? memories.length : nextSection;

    memories = memories.slice(0, insertPoint) + '\n' + content + '\n' + memories.slice(insertPoint);
  }

  await writeFile(MEMORIES_FILE, memories, 'utf-8');
}

// GET: Read current memories, optionally from Supabase storage
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  // Try Supabase storage first if configured
  if (isSupabaseConfigured() && userId) {
    try {
      const { data } = await supabase
        .storage
        .from('user-memories')
        .download(`${userId}/UserMemories.md`);

      if (data) {
        const text = await data.text();
        return NextResponse.json({ memories: text, source: 'supabase' });
      }
    } catch {
      // Fall through to local
    }
  }

  // Fall back to local file
  const memories = await readMemories();
  return NextResponse.json({ memories, source: 'local' });
}

// POST: Summarize conversation and update memories
export async function POST(request: NextRequest) {
  try {
    const { messages, user_id, section, content } = await request.json();

    // Direct content update
    if (section && content) {
      await appendToSection(section, content);

      // Also save to Supabase if configured
      if (isSupabaseConfigured() && user_id) {
        const memories = await readMemories();
        await supabase.storage
          .from('user-memories')
          .upload(`${user_id}/UserMemories.md`, new Blob([memories]), { upsert: true });
      }

      return NextResponse.json({ success: true, action: 'section_updated' });
    }

    // Conversation summarization
    if (messages && Array.isArray(messages)) {
      const chatMessages = messages as ChatMessage[];
      const summary = await summarizeConversation(chatMessages, user_id);

      if (!summary) {
        return NextResponse.json({ success: false, reason: 'Could not generate summary' });
      }

      const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const formatted = formatSummaryForMemory(summary, date);

      await appendToSection('Conversation Summaries', formatted);

      // Save to Supabase storage
      if (isSupabaseConfigured() && user_id) {
        const memories = await readMemories();
        await supabase.storage
          .from('user-memories')
          .upload(`${user_id}/UserMemories.md`, new Blob([memories]), { upsert: true });
      }

      return NextResponse.json({
        success: true,
        summary,
        action: 'conversation_summarized',
      });
    }

    return NextResponse.json({ error: 'Provide messages array or section+content' }, { status: 400 });
  } catch (error) {
    console.error('Memories API error:', error);
    return NextResponse.json({ error: 'Failed to update memories' }, { status: 500 });
  }
}
