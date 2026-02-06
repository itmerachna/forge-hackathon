import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const PUBLIC_SKILLS_DIR = path.join(process.cwd(), 'public', 'skills');
const PRIVATE_SKILLS_DIR = path.join(process.cwd(), 'private', 'skills');

// Copy-on-write: private skills shadow public skills
// If a skill exists in private/, it takes precedence over public/
async function getSkillContent(skillName: string): Promise<{ content: string; source: 'private' | 'public' } | null> {
  const filename = skillName.endsWith('.md') ? skillName : `${skillName}.md`;

  // Check private first (copy-on-write shadow)
  try {
    const privatePath = path.join(PRIVATE_SKILLS_DIR, filename);
    const content = await readFile(privatePath, 'utf-8');
    return { content, source: 'private' };
  } catch {
    // Not in private, fall through to public
  }

  // Check public
  try {
    const publicPath = path.join(PUBLIC_SKILLS_DIR, filename);
    const content = await readFile(publicPath, 'utf-8');
    return { content, source: 'public' };
  } catch {
    return null;
  }
}

async function listSkills(): Promise<{ name: string; source: 'private' | 'public' }[]> {
  const skills = new Map<string, 'private' | 'public'>();

  // Load public skills first
  try {
    const publicFiles = await readdir(PUBLIC_SKILLS_DIR);
    for (const file of publicFiles) {
      if (file.endsWith('.md')) {
        skills.set(file.replace('.md', ''), 'public');
      }
    }
  } catch {
    // public/skills may not exist
  }

  // Private skills override public ones
  try {
    const privateFiles = await readdir(PRIVATE_SKILLS_DIR);
    for (const file of privateFiles) {
      if (file.endsWith('.md')) {
        skills.set(file.replace('.md', ''), 'private');
      }
    }
  } catch {
    // private/skills may not exist
  }

  return Array.from(skills.entries()).map(([name, source]) => ({ name, source }));
}

// GET: List all skills or fetch a specific skill
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const skillName = searchParams.get('name');

  if (skillName) {
    const skill = await getSkillContent(skillName);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    return NextResponse.json({
      name: skillName,
      content: skill.content,
      source: skill.source,
    });
  }

  // List all available skills
  const skills = await listSkills();
  return NextResponse.json({ skills });
}

// POST: Save a private skill (copy-on-write)
export async function POST(request: NextRequest) {
  try {
    const { name, content } = await request.json();

    if (!name || !content) {
      return NextResponse.json({ error: 'name and content are required' }, { status: 400 });
    }

    const filename = name.endsWith('.md') ? name : `${name}.md`;

    // Ensure private skills directory exists
    await mkdir(PRIVATE_SKILLS_DIR, { recursive: true });

    const privatePath = path.join(PRIVATE_SKILLS_DIR, filename);
    await writeFile(privatePath, content, 'utf-8');

    return NextResponse.json({
      success: true,
      name: name.replace('.md', ''),
      source: 'private',
      message: 'Skill saved to private directory (shadows public version)',
    });
  } catch (error) {
    console.error('Skills save error:', error);
    return NextResponse.json({ error: 'Failed to save skill' }, { status: 500 });
  }
}
