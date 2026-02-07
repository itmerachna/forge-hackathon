# Forge - AI Learning Coach for Design & Vibe Coding Tools

> **Hackathon:** Encode "Commit to Change" AI Agents Hackathon  
> **Track:** Personal Growth & Learning  
> **Status:** In Development (Checkpoint 2 Submitted)

## 🔥 Live Demo

**[Try Forge →](https://forge-hackathon.vercel.app)**

---

## 🎯 The Problem

I have over 300 bookmarked tools in my browser. Every week I save new ones with genuine excitement: "I'll definitely try this later."

Later never comes.

**This isn't a discovery problem. It's an execution problem.** I don't need more tools—I need accountability.

---

## 💡 The Solution

Forge is an AI-powered learning coach that transforms passive bookmarking into active skill-building:

- **AI Curation:** Personalized weekly tool recommendations (5-10, not 500)
- **Daily Accountability:** Gentle check-ins that keep you motivated
- **Progress Tracking:** Visual timeline of tools tried and projects built
- **Proof-Based Progression:** Unlock next week by completing current goals

---

## ✅ What's Built (Checkpoint)

### Working Features

**1. Smart Onboarding**
- 6 conversational questions
- Collects: focus area, skill level, time commitment, preferences, existing tools, goals
- Progress indicator

**2. Personalized Dashboard**
- 10 curated AI/vibe coding tools (AKOOL, PixAI, RecCloud, KREA AI, Gamma, Anything, Relume, Descript, PicWish, Luma AI)
- Category, pricing, difficulty tags
- Direct links to tool websites

**3. Interactive Tracking**
- "Mark as Tried" with toast notifications
- Button state changes (gray → green checkmark)
- Real-time progress counter (0/2 → 1/2 → 2/2)
- Goal achievement celebration
- Persists across sessions

**User Flow:**
```
Onboarding → Personalized Recommendations → Mark as Tried → Progress Updates → Goal Achieved
```

---

## 🚀 Tech Stack

**Current:**
- Next.js 14 (App Router)
- React + TypeScript
- Tailwind CSS
- Vercel (Deployment)
- localStorage (temporary persistence)

**Coming (Week 2-4):**
- Google Gemini API (AI chat)
- Supabase (Auth + Database + Storage)
- n8n (Automation workflows)
- Comet Opik (Evaluation + Observability)

---

## 🎨 UX Vision: Chat-First Interface

### Current (Checkpoint)
Tool cards as main focus—functional but misses the point.

### Coming (Week 2-3)
Reimagining dashboard around conversation:
```
┌─────────────────────────────────────────┐
│ Compact tool table (top 1/3)            │
│ # │ Logo │ Name │ Description │ Links   │
├─────────────────────────────────────────┤
│                                         │
│ AI Chat Interface (bottom 2/3)          │
│                                         │
│ Forge: "I curated some options based    │
│ on your goals. What do you think?"      │
│                                         │
│ You: "Which one should I start with?"   │
│                                         │
│ Forge: "Since you're a beginner..."     │
│                                         │
├─────────────────────────────────────────┤
│ Type your message...            [Send]  │
└─────────────────────────────────────────┘
```

**Why:** Tools become reference material. Conversation becomes the coach. That's where the real value is.

---

## 📋 Roadmap

### Week 2: Core AI & Persistence
- [ ] Supabase integration (user accounts, real persistence)
- [ ] Google Gemini chat interface
- [ ] Dashboard redesign (compact table + chat)
- [ ] Skills system (markdown-based agent behaviors)
- [ ] n8n automation (Product Hunt API, GitHub Trending)

### Week 3: Accountability & Tracking
- [ ] Daily check-in system
- [ ] Tracker page (timeline view)
- [ ] Weekly reflection flow
- [ ] Proof-based progression
- [ ] Real-time streaming UI

### Week 4: Polish & Evaluation
- [ ] Comet Opik integration
- [ ] Test suite (20-30 edge cases)
- [ ] Mobile optimization
- [ ] Performance tuning
- [ ] Final demo video

---

## 🏗️ Architecture

Inspired by [Fintool's AI Agent System](https://x.com/nicbstme/status/2015174818497437834):

**Skills-First Design**
- Agent behaviors as markdown files
- Non-coders can customize logic
- Copy-on-write shadowing (private > shared > public)

**Context Over Complexity**
- User memories in simple markdown
- Loaded on every conversation
- User-readable, user-editable

**Interactive Workflows**
- Agent pauses for user input
- User stays in control
- Collaborative, not autonomous

**Evaluation-Driven**
- Test cases for edge cases
- Opik tracking
- No "ship and pray"

---

## 🎯 Hackathon Alignment

**Theme:** "Commit to Change: AI Agents for New Year's Resolutions"

**Track:** Personal Growth & Learning

**How Forge Fits:**
- ✅ Makes learning engaging (AI coach, not tool dump)
- ✅ Helps users grow (master new design/coding tools)
- ✅ Consistent practice (daily check-ins, weekly cycles)
- ✅ Self-awareness (reflection system learns your preferences)
- ✅ Real outcomes (projects built, not just bookmarks saved)

**Sponsor Integration:**
- Google Gemini (AI reasoning)
- Vercel (deployment)
- Comet Opik (evaluation)

---

## 🧠 Product Philosophy

**The goal isn't information—it's behavior change.**

**What we do:**
- AI curates small batches (5-10 tools/week)
- Personalized to your actual goals
- Conversation when you're stuck
- Celebrates your progress

**What we don't do:**
- Dump 50 new tools on you daily
- Guilt-trip you for missing goals
- Run fully autonomous without your input
- Add to the overwhelm

**Success metric:** Not "tools bookmarked" but "tools actually used" and "projects actually built."

---

## 🏃 Running Locally
```bash
git clone https://github.com/itmerachna/forge-hackathon.git
cd forge-hackathon
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure
```
forge-hackathon/
├── app/
│   ├── page.tsx              # Landing page
│   ├── onboarding/
│   │   └── page.tsx          # Onboarding flow
│   ├── dashboard/
│   │   └── page.tsx          # Main dashboard
│   └── api/
│       └── chat/
│           └── route.ts      # AI chat endpoint (coming)
├── public/
│   └── skills/               # Markdown skills (coming)
├── tailwind.config.js
└── package.json
```

---

## 👤 Team

**Rachna** - Designer & Builder

---

## 🔗 Links

- **Live Demo:** https://forge-hackathon.vercel.app
- **GitHub:** https://github.com/itmerachna/forge-hackathon

---

## 📝 License

MIT

---

**Questions?** Open an issue!
