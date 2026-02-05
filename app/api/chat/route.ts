import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponseStream, isGeminiConfigured } from '../../../lib/gemini';
import type { ChatRequest } from '../../../types';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, conversationHistory, userProfile, context } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // If Gemini is not configured, fall back to simple responses
    if (!isGeminiConfigured()) {
      const fallbackResponse = generateFallbackResponse(message);
      return NextResponse.json({ message: fallbackResponse });
    }

    // Stream response from Gemini
    const stream = await generateChatResponseStream(
      message,
      conversationHistory || [],
      userProfile,
      context,
    );

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function generateFallbackResponse(message: string): string {
  const lowerMsg = message.toLowerCase();
  if (lowerMsg.includes('video') || lowerMsg.includes('edit')) {
    return "For video work, I'd recommend checking out AKOOL or Descript! AKOOL is great for beginners with its AI avatars and face swap features. Descript is more advanced but offers amazing transcription-based editing. Which one interests you more?";
  }
  if (lowerMsg.includes('design') || lowerMsg.includes('image')) {
    return "For design and image generation, you have some excellent options! KREA AI offers a full creative suite, while PixAI specializes in anime-style art. Gamma is perfect if you need presentation designs. What type of design work are you focusing on?";
  }
  if (lowerMsg.includes('website') || lowerMsg.includes('web') || lowerMsg.includes('site')) {
    return "For website building, Relume is fantastic - it uses AI to design and build sites faster. If you want to go beyond websites into full apps, check out Anything which can turn your ideas into mobile apps and products. Are you building something specific?";
  }
  if (lowerMsg.includes('audio') || lowerMsg.includes('podcast') || lowerMsg.includes('music')) {
    return "RecCloud is your go-to for audio processing! It handles everything from transcription to audio enhancement. If you're doing video podcasts, Descript also has excellent audio editing with voice cloning. What audio project are you working on?";
  }
  if (lowerMsg.includes('beginner') || lowerMsg.includes('start') || lowerMsg.includes('easy')) {
    return "Great starting points for beginners: Gamma for presentations (super intuitive), PicWish for photo editing (instant results), and AKOOL for video creation. All have free tiers! Which area interests you most?";
  }
  if (lowerMsg.includes('free') || lowerMsg.includes('pricing') || lowerMsg.includes('cost')) {
    return "Most tools here offer freemium plans! AKOOL, Gamma, RecCloud, KREA AI, Anything, Relume, PicWish, and Luma AI all have free tiers. PixAI starts at $9.99/mo and Descript at $24/mo for paid features. What's your budget range?";
  }
  return "I'd love to help you find the right tool! Tell me more about your project - are you looking to create videos, designs, websites, or something else? I can match you with the perfect AI tool.";
}
