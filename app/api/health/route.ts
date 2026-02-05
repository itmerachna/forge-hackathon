import { NextResponse } from 'next/server';
import { isGeminiConfigured } from '../../../lib/gemini';
import { isSupabaseConfigured } from '../../../lib/supabase';

export async function GET() {
  return NextResponse.json({
    gemini: isGeminiConfigured(),
    supabase: isSupabaseConfigured(),
    timestamp: new Date().toISOString(),
  });
}
