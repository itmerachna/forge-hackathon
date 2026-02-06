import { NextRequest, NextResponse } from 'next/server';
import { generateChatResponseStream, isGeminiConfigured } from '../../../lib/gemini';
import { needsSummarization, summarizeConversation, buildContextFromSummaries } from '../../../lib/summarize';
import { trackLLMCall } from '../../../lib/opik';
import type { ChatRequest } from '../../../types';

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { message, conversationHistory, userProfile, context } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!isGeminiConfigured()) {
      console.log('Gemini not configured, using fallback');
      const fallbackResponse = generateFallbackResponse(message, conversationHistory || []);
      return NextResponse.json({ message: fallbackResponse });
    }

    try {
      // Context rot prevention: summarize long conversations
      let enrichedContext = context || '';
      if (conversationHistory && needsSummarization(conversationHistory)) {
        const summary = await summarizeConversation(conversationHistory.slice(0, -5));
        if (summary) {
          enrichedContext = buildContextFromSummaries([summary]) + (enrichedContext ? '\n\n' + enrichedContext : '');
        }
      }

      const stream = await generateChatResponseStream(
        message,
        conversationHistory || [],
        userProfile,
        enrichedContext || context,
      );

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } catch (geminiError) {
      const errMsg = geminiError instanceof Error ? geminiError.message : String(geminiError);
      console.error('Gemini API error:', errMsg, geminiError);
      const fallbackResponse = generateFallbackResponse(message, conversationHistory || []);
      return NextResponse.json({ message: fallbackResponse, _debug: errMsg });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json({ message: "Sorry, something went wrong. Could you try that again?" });
  }
}

interface ConversationMsg {
  role: string;
  content: string;
}

function generateFallbackResponse(message: string, history: ConversationMsg[]): string {
  const msg = message.toLowerCase().trim();

  // Count how many exchanges we've had (to vary responses)
  const turnCount = history.filter(m => m.role === 'user').length;

  // ── Greetings ──
  if (/^(hi|hello|hey|sup|yo|what'?s up|howdy|hola)\b/.test(msg)) {
    return "Hey! Great to have you here. I'm Forge, your AI tool discovery coach. I help you find the right AI tools for your creative work and guide you through learning them.\n\nWhat are you working on right now? I can suggest some tools that might help.";
  }

  // ── Who are you / what can you do ──
  if (/who are you|what (are|do) you|what can you (do|help)|how does this work|what is forge/.test(msg)) {
    return "I'm Forge — your personal AI learning coach. Here's what I can help with:\n\n• **Discover** AI tools matched to your skill level and interests\n• **Learn** how to use new tools with guided tips and project ideas\n• **Track** your progress as you explore and master tools\n• **Reflect** on what's working and what to try next\n\nTell me what kind of creative work you do, and I'll start recommending tools!";
  }

  // ── Landing page / website building ──
  if (/landing ?page|webpage|homepage/.test(msg)) {
    return "For building landing pages, here are my top picks:\n\n• **Relume** — AI-powered wireframing and site building, great for rapid prototyping\n• **Gamma** — Creates polished pages and presentations from a text prompt\n• **Framer** — If you want more design control with AI-assisted layouts\n\nAre you designing from scratch or do you already have a concept in mind?";
  }

  if (/website|web ?site|web ?app|site/.test(msg)) {
    return "For websites and web apps, you have solid options:\n\n• **Relume** — AI wireframing → full website generation, fast workflow\n• **Anything** — Turn ideas into working apps and products\n• **Gamma** — Best for content-heavy pages and presentations\n\nWhat's the project? I can narrow down which tool fits best.";
  }

  // ── Design / visual ──
  if (/design|graphic|visual|ui|ux|interface|prototype|wireframe|mockup|figma/.test(msg)) {
    return "For design work, it depends on what you're creating:\n\n• **KREA AI** — Full creative suite: image gen, upscaling, real-time design\n• **Relume** — AI wireframes and site layouts specifically\n• **Gamma** — Presentations and visual documents\n• **PixAI** — Anime and illustration-focused generation\n\nWhat kind of design are you working on? UI, illustration, presentations?";
  }

  // ── Image generation ──
  if (/image|photo|picture|illustration|art|draw|generat|midjourney|dall-?e|stable diffusion/.test(msg)) {
    return "For image generation and editing:\n\n• **KREA AI** — Versatile: text-to-image, upscaling, style transfer, real-time canvas\n• **PixAI** — Specializes in anime and character art (free tier available)\n• **PicWish** — Quick photo editing: background removal, enhancement, batch processing\n• **Luma AI** — 3D captures and scene generation from photos\n\nWhat kind of images are you creating?";
  }

  // ── Video ──
  if (/video|film|clip|animate|animation|motion|youtube|tiktok|reel/.test(msg)) {
    return "For video and animation work:\n\n• **AKOOL** — AI avatars, face swap, talking head videos — great for content creators\n• **Descript** — Edit video by editing text, plus screen recording and AI voices\n• **Luma AI** — 3D scene capture and cinematic generation\n• **RecCloud** — AI-powered recording, transcription, and video processing\n\nWhat type of video are you making?";
  }

  // ── Audio / music ──
  if (/audio|music|sound|podcast|voice|transcri|record/.test(msg)) {
    return "For audio work:\n\n• **RecCloud** — Transcription, recording, and AI-enhanced audio processing\n• **Descript** — Podcast editing, voice cloning, and transcript-based editing\n\nBoth have free tiers. Are you doing podcasts, music, or something else?";
  }

  // ── 3D / spatial ──
  if (/3d|three.?d|blender|model|spatial|scene|render/.test(msg)) {
    return "For 3D and spatial work:\n\n• **Luma AI** — Capture real-world 3D scenes from photos/video, plus AI scene generation\n• **KREA AI** — Has some 3D-aware generation features in its creative suite\n\nAre you doing product visualization, game assets, or something else?";
  }

  // ── Presentations ──
  if (/present|slide|deck|pitch|powerpoint|keynote/.test(msg)) {
    return "**Gamma** is perfect for presentations! It generates beautiful slide decks from a text prompt or outline. You can:\n\n• Auto-generate a full deck from a topic\n• Customize each slide's layout and design\n• Export to PowerPoint or share as a web link\n• It's free to start with\n\nWant tips on getting the best results from Gamma?";
  }

  // ── Writing / content ──
  if (/writ|content|copy|blog|article|caption|social media|post/.test(msg)) {
    return "For content creation, it depends on the format:\n\n• **Gamma** — Blog posts, documents, and visual content pages\n• **Descript** — Turn recordings into written content with AI transcription\n• **KREA AI** — Generate visuals to pair with your written content\n\nWhat kind of content are you creating?";
  }

  // ── Pricing / free ──
  if (/free|pric|cost|budget|cheap|afford|plan|tier|pay/.test(msg)) {
    return "Good news — most tools here have free tiers:\n\n**Free to start:**\n• AKOOL, Gamma, RecCloud, KREA AI, Anything, Relume, PicWish, Luma AI\n\n**Paid only:**\n• PixAI ($9.99/mo) • Descript ($24/mo)\n\nI'd recommend starting with free tiers to find what clicks before committing. Which tools are you interested in trying?";
  }

  // ── Beginner / getting started ──
  if (/beginner|start|new to|learn|easy|simple|first|getting started|where (do|should) i/.test(msg)) {
    return "Here's a great beginner path:\n\n1. **Gamma** — Easiest entry point. Type a topic → get a polished presentation. Instant results.\n2. **PicWish** — Upload a photo → instant background removal, enhancement. No learning curve.\n3. **AKOOL** — Create an AI avatar video in minutes.\n\nAll three are free and give you a quick win. Which one sounds most useful for what you do?";
  }

  // ── Recommendations / suggestions ──
  if (/recommend|suggest|which|what (tool|should)|best|pick|choose|help me find/.test(msg)) {
    return "I'd love to find you the right tool! To give you a solid recommendation, tell me:\n\n1. **What are you trying to create?** (video, design, website, presentation, etc.)\n2. **What's your experience level?** (total beginner, some experience, advanced)\n3. **Any budget constraints?** (free only, or open to paid tools)\n\nThe more context you give me, the better I can match you!";
  }

  // ── Thanks / positive ──
  if (/thank|thanks|thx|appreciate|helpful|great|awesome|perfect|nice|cool|love it/.test(msg)) {
    return "Happy to help! Let me know if you want to:\n\n• Explore any of those tools in more depth\n• Get a project idea to try with a specific tool\n• See what else is out there for your workflow\n\nI'm here whenever you need me.";
  }

  // ── Check-in / progress ──
  if (/check.?in|progress|how am i|doing|track|goal|reflect/.test(msg)) {
    return "Let's do a quick check-in!\n\n• What tools did you try recently?\n• Did anything surprise you — good or bad?\n• What's your focus for this week?\n\nYou can also visit the **Tracker** page in the sidebar to log your daily progress and see your stats.";
  }

  // ── Project ideas ──
  if (/project|idea|build|make|create something|what (can|should) i (make|build|create)/.test(msg)) {
    return "Here are some project ideas to learn AI tools hands-on:\n\n• **Portfolio refresh** — Use Gamma for a case study presentation + KREA AI for hero images\n• **Social content kit** — AKOOL for a talking-head intro video + PicWish for thumbnails\n• **Client landing page** — Relume for wireframes → build out a real concept\n• **Podcast launch** — RecCloud to record + Descript to edit and generate clips\n\nWhich one sounds interesting? I can walk you through the steps.";
  }

  // ── Specific tool questions ──
  if (/akool/.test(msg)) {
    return "**AKOOL** is great for video content creation:\n\n• AI avatars and face swap\n• Talking head video generation\n• Background replacement\n• Free tier available\n\nBest for: content creators, marketers, anyone making short-form video. Want to try a first project with it?";
  }
  if (/gamma/.test(msg)) {
    return "**Gamma** is an AI presentation and document tool:\n\n• Generate full decks from a topic or outline\n• Beautiful templates with smart layout\n• Export to PowerPoint or share as web links\n• Free to start\n\nBest for: presentations, pitch decks, visual documents. Want tips on getting the most out of it?";
  }
  if (/relume/.test(msg)) {
    return "**Relume** is AI-powered website design:\n\n• Generate wireframes from a text brief\n• Component library with AI layout suggestions\n• Export to Figma or Webflow\n• Free tier available\n\nBest for: web designers, freelancers building client sites. Want to try wireframing something?";
  }
  if (/krea/.test(msg)) {
    return "**KREA AI** is a full creative suite:\n\n• Text-to-image generation\n• Real-time AI canvas\n• Image upscaling and enhancement\n• Style transfer and variations\n• Free tier available\n\nBest for: designers, artists, anyone who needs custom visuals. What would you use it for?";
  }
  if (/descript/.test(msg)) {
    return "**Descript** is an all-in-one media editor:\n\n• Edit video/audio by editing text (transcript-based)\n• Screen recording with AI features\n• Voice cloning for corrections\n• Auto-remove filler words\n• Starts at $24/mo\n\nBest for: podcasters, video creators, anyone doing content production. Want to know how to get started?";
  }
  if (/luma/.test(msg)) {
    return "**Luma AI** specializes in 3D and spatial:\n\n• Capture 3D scenes from photos or video\n• AI-powered scene generation\n• Photorealistic rendering\n• Free tier available\n\nBest for: 3D artists, product photographers, XR creators. Interested in trying it?";
  }

  // ── Yes / affirmative / continue ──
  if (/^(yes|yeah|yep|sure|ok|okay|yea|definitely|absolutely|let'?s|go ahead|please|do it)/.test(msg)) {
    const lastAssistant = [...history].reverse().find(m => m.role === 'assistant');
    if (lastAssistant?.content) {
      if (lastAssistant.content.includes('Gamma')) {
        return "Here's how to get started with Gamma:\n\n1. Sign up at gamma.app (free)\n2. Click 'Create new' → choose 'Presentation'\n3. Type your topic or paste an outline\n4. Gamma generates a full deck — then you can customize each slide\n\nPro tip: The more specific your prompt, the better the output. Try: \"10-slide pitch deck for a mobile app that helps people discover AI tools\"";
      }
      if (lastAssistant.content.includes('Relume')) {
        return "Here's how to get started with Relume:\n\n1. Go to relume.io and sign up (free tier)\n2. Describe your website in a few sentences\n3. Relume generates a sitemap and wireframe\n4. Customize the sections, then export to Figma or Webflow\n\nTry starting with: \"Portfolio website for a UI designer with case studies, about page, and contact form\"";
      }
      if (lastAssistant.content.includes('AKOOL')) {
        return "Here's how to get started with AKOOL:\n\n1. Sign up at akool.com (free credits to start)\n2. Try 'AI Avatar' — upload a photo or pick a stock avatar\n3. Type or paste your script\n4. Generate a talking head video in minutes\n\nGreat first project: Create a 30-second intro video for your portfolio or social media.";
      }
    }
    return "Let's dive in! Tell me what you'd like to work on, and I'll suggest the best tool and walk you through getting started.";
  }

  // ── No / negative ──
  if (/^(no|nah|not really|nope|don'?t|i'?m good)/.test(msg)) {
    return "No worries! I'm here whenever you want to explore. You can:\n\n• Ask me about any specific tool\n• Tell me what you're working on for personalized suggestions\n• Check the **Weekly Tool Suggestions** accordion above for curated picks\n\nJust say the word!";
  }

  // ── Context-aware default: vary based on turn count ──
  const defaults = [
    `Interesting! Tell me a bit more about what you're working on — are you doing design, development, content creation, or something else? I'll find the right AI tools for you.`,
    `I want to make sure I give you the best recommendation. Could you share:\n\n1. What kind of project is this for?\n2. What's your experience with AI tools so far?\n\nThat way I can point you to something that actually fits.`,
    `Here are some directions we can explore:\n\n• **Video creation** — AKOOL, Descript, Luma AI\n• **Design & images** — KREA AI, PixAI, PicWish\n• **Websites** — Relume, Anything, Gamma\n• **Audio** — RecCloud, Descript\n\nWhich area catches your eye?`,
    `I have 10 AI tools in your weekly suggestions — from video editors to website builders to design suites. Open the **Weekly Tool Suggestions** above to browse them, or just tell me what you need and I'll narrow it down.`,
    `Let me help you find the right fit! Some questions that help:\n\n• What do you want to create?\n• Are you looking for something free to start?\n• Do you prefer simple/guided or powerful/flexible?\n\nOr just describe your project and I'll take it from there.`,
  ];

  return defaults[turnCount % defaults.length];
}
