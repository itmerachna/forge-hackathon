// Database types matching Supabase schema

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  focus: string;
  skill_level: string;
  weekly_hours: string;
  preferences: string;
  existing_tools: string;
  goal: string;
  created_at: string;
  updated_at: string;
}

export interface Tool {
  id: number;
  name: string;
  description: string;
  category: string;
  pricing: string;
  website: string;
  twitter: string;
  difficulty: string;
  color: string;
  logo_url?: string;
  created_at: string;
}

export interface UserToolProgress {
  id: string;
  user_id: string;
  tool_id: number;
  status: 'suggested' | 'trying' | 'tried' | 'mastered';
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyRecommendation {
  id: string;
  user_id: string;
  week_start: string;
  tool_ids: number[];
  reasoning: string;
  created_at: string;
}

export interface CheckIn {
  id: string;
  user_id: string;
  date: string;
  mood: 'great' | 'good' | 'okay' | 'struggling';
  tools_used: number[];
  accomplishments: string;
  blockers: string;
  ai_summary?: string;
  created_at: string;
}

export interface Reflection {
  id: string;
  user_id: string;
  week_start: string;
  content: string;
  ai_insights?: string;
  tools_mastered: number[];
  goals_met: boolean;
  created_at: string;
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  suggestions?: string[];
  timestamp?: string;
}

// API request/response types
export interface ChatRequest {
  message: string;
  conversationHistory: ChatMessage[];
  userProfile?: UserPreferences;
  context?: string;
}

export interface ChatResponse {
  message: string;
  suggestions?: string[];
}

export interface ToolsResponse {
  tools: Tool[];
  total: number;
}

export interface ProgressUpdate {
  user_id: string;
  tool_id: number;
  status: UserToolProgress['status'];
  notes?: string;
}

export interface CheckInRequest {
  user_id: string;
  mood: CheckIn['mood'];
  tools_used: number[];
  accomplishments: string;
  blockers: string;
}
