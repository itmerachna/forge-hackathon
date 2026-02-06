import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

// POST: Upload proof of tool usage (screenshot, link, or video URL)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const userId = formData.get('user_id') as string;
    const toolId = formData.get('tool_id') as string;
    const proofType = formData.get('proof_type') as string; // 'screenshot' | 'link' | 'video'
    const proofUrl = formData.get('proof_url') as string | null;
    const file = formData.get('file') as File | null;

    if (!userId || !toolId) {
      return NextResponse.json({ error: 'user_id and tool_id are required' }, { status: 400 });
    }

    let finalProofUrl = proofUrl || '';

    // Handle file upload to Supabase Storage
    if (file && isSupabaseConfigured()) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${toolId}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('proof-files')
        .upload(fileName, file, { upsert: true });

      if (error) {
        console.error('File upload error:', error);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
      }

      const { data: urlData } = supabase.storage
        .from('proof-files')
        .getPublicUrl(data.path);

      finalProofUrl = urlData.publicUrl;
    }

    // Update tool progress with proof
    if (isSupabaseConfigured()) {
      // Update or insert progress record
      const { error } = await supabase
        .from('user_tool_progress')
        .upsert({
          user_id: userId,
          tool_id: parseInt(toolId),
          status: 'tried',
          notes: JSON.stringify({
            proof_type: proofType,
            proof_url: finalProofUrl,
            submitted_at: new Date().toISOString(),
          }),
          completed_at: new Date().toISOString(),
        }, { onConflict: 'user_id,tool_id' });

      if (error) {
        console.error('Progress update error:', error);
      }
    }

    return NextResponse.json({
      success: true,
      proof_url: finalProofUrl,
      message: 'Proof submitted successfully',
    });
  } catch (error) {
    console.error('Proof API error:', error);
    return NextResponse.json({ error: 'Failed to submit proof' }, { status: 500 });
  }
}

// GET: Check lock/unlock status for a user's weekly tools
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  if (!userId || !isSupabaseConfigured()) {
    return NextResponse.json({
      locked: false,
      reason: 'No auth or no database',
      days_remaining: 0,
    });
  }

  try {
    // Get current week's progress
    const weekStart = getWeekStart();
    const { data: progress } = await supabase
      .from('user_tool_progress')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', weekStart);

    const triedCount = progress?.filter(p =>
      ['tried', 'mastered'].includes(p.status)
    ).length || 0;

    const proofCount = progress?.filter(p => {
      try {
        const notes = JSON.parse(p.notes || '{}');
        return notes.proof_url;
      } catch {
        return false;
      }
    }).length || 0;

    // Calculate days remaining in week
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysRemaining = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const isLastThreeDays = daysRemaining <= 3;

    // Lock/unlock logic: need at least 2 tools tried with proof to unlock next week
    const goalMet = triedCount >= 3;
    const hasProof = proofCount >= 1;
    const unlocked = goalMet && hasProof;

    let warning = '';
    if (isLastThreeDays && !goalMet) {
      warning = `Only ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left this week! You've tried ${triedCount}/3 tools. Try ${3 - triedCount} more to unlock next week's recommendations.`;
    }
    if (isLastThreeDays && goalMet && !hasProof) {
      warning = `Great progress with ${triedCount} tools tried! Submit proof (screenshot/link) of your work to unlock next week's tools.`;
    }

    return NextResponse.json({
      locked: !unlocked,
      tried_count: triedCount,
      proof_count: proofCount,
      goal_met: goalMet,
      has_proof: hasProof,
      days_remaining: daysRemaining,
      warning,
    });
  } catch (error) {
    console.error('Proof status error:', error);
    return NextResponse.json({ locked: false, days_remaining: 0 });
  }
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}
