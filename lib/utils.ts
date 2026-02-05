// Get user profile from localStorage
export function getUserProfile(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  const profile = localStorage.getItem('userProfile');
  return profile ? JSON.parse(profile) : null;
}

// Save user profile to localStorage
export function saveUserProfile(profile: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('userProfile', JSON.stringify(profile));
}

// Get greeting based on time of day
export function getGreeting(name?: string): string {
  const hour = new Date().getHours();
  let greeting = 'Good morning';
  if (hour >= 12 && hour < 17) greeting = 'Good afternoon';
  if (hour >= 17) greeting = 'Good evening';
  return name ? `${greeting}, ${name}!` : `${greeting}!`;
}

// Format date for display
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format time for chat messages
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Generate a unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Truncate text with ellipsis
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}
