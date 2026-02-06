# Forge Project - Agent Tasks Reference

This file documents repetitive tasks and workflows identified during development that could be automated or delegated to specialized agents.

---

## Git Operations Agent

### Push to Branch
```bash
git add -A && git commit -m "$(cat <<'EOF'
<commit message>

https://claude.ai/code/session_ID
EOF
)" && git push -u origin claude/<branch-name>
```

### Check Status
```bash
git status
git diff <file>
```

### Create PR (Manual)
1. Go to GitHub repo
2. Click "Compare & pull request" banner
3. Add title and description
4. Create and merge PR

---

## TypeScript Validation Agent

### Type Check
```bash
npx tsc --noEmit 2>&1 | head -20
```

**Common fixes:**
- Add type annotations: `(param: string) =>`
- Fix implicit any: `(kw: string) =>`
- Import missing types from `../../types`

---

## Supabase Schema Agent

### Add Columns to Existing Table
```sql
ALTER TABLE <table_name>
ADD COLUMN IF NOT EXISTS <column> <TYPE> <DEFAULT>;
```

### Disable RLS (for development)
```sql
ALTER TABLE <table_name> DISABLE ROW LEVEL SECURITY;
```

### Create New Table Template
```sql
CREATE TABLE IF NOT EXISTS <table_name> (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- columns here
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE <table_name> DISABLE ROW LEVEL SECURITY;
```

### Add Unique Constraint
```sql
ALTER TABLE <table_name>
ADD CONSTRAINT <constraint_name> UNIQUE (<col1>, <col2>);
```

---

## API Testing Agent

### Test GET Endpoint (Browser)
```
https://forge-hackathon.vercel.app/api/<endpoint>
```

### Test POST Endpoint (Console)
```javascript
fetch('/api/<endpoint>', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({/* data */})
}).then(r => r.json()).then(console.log)
```

### Check API Health
```javascript
fetch('/api/health').then(r => r.json()).then(console.log)
```

### Trigger Tool Discovery
```javascript
fetch('/api/discover-tools', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: '{}'
}).then(r => r.json()).then(console.log)
```

---

## Vercel Deployment Agent

### Check Deployment Status
1. Go to Vercel Dashboard → Project
2. Check Deployments tab
3. View Logs for errors

### Environment Variables
1. Vercel Dashboard → Settings → Environment Variables
2. Add/update variable
3. **Redeploy required** for changes to take effect

### Common Env Vars
```
GEMINI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
PRODUCTHUNT_TOKEN=
GITHUB_TOKEN=
```

---

## Package Installation Agent

### Install npm package
```bash
npm install <package-name>
```

### Common packages used
- `react-markdown` - Markdown rendering
- `@tailwindcss/typography` - Prose styling
- `@supabase/supabase-js` - Supabase client
- `@google/generative-ai` - Gemini SDK
- `@phosphor-icons/react` - Icons

---

## File Operations Agent

### Create API Route
Location: `app/api/<name>/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';

export async function GET(request: NextRequest) {
  // Implementation
}

export async function POST(request: NextRequest) {
  // Implementation
}
```

### Create Page
Location: `app/<name>/page.tsx`
```typescript
'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';

export default function PageName() {
  const { user, profile } = useAuth();
  // Implementation
}
```

### Update Imports (common pattern)
```typescript
// Add to existing imports
import { useAuth } from '../../lib/auth';
import ReactMarkdown from 'react-markdown';
```

---

## Debug Agent

### Check Gemini Errors
Look for `_debug` field in API response:
```javascript
fetch('/api/chat', {/*...*/}).then(r => r.json()).then(d => console.log(d._debug))
```

### Check Vercel Logs
1. Vercel Dashboard → Logs
2. Filter by endpoint
3. Look for error messages

### Common Errors
| Error | Cause | Fix |
|-------|-------|-----|
| 401 Unauthorized | Invalid API token | Regenerate token |
| 403 Forbidden | RLS enabled | Disable RLS on table |
| 404 Not Found | Model deprecated | Update model name |
| 429 Too Many Requests | Rate limit | Use different model tier |
| PGRST116 | No rows found | Handle null case |

---

## Code Pattern Agent

### Add Auth to Page
```typescript
const { user, profile } = useAuth();

useEffect(() => {
  if (!user) {
    router.push('/auth/signup');
  }
}, [user]);
```

### Fetch with User ID
```typescript
useEffect(() => {
  if (!user?.id) return;

  async function fetchData() {
    const res = await fetch(`/api/endpoint?user_id=${user?.id}`);
    const data = await res.json();
    // handle data
  }
  fetchData();
}, [user?.id]);
```

### Save to Supabase (Debounced)
```typescript
const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
  saveTimeoutRef.current = setTimeout(() => {
    fetch('/api/endpoint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user?.id, data }),
    }).catch(() => {});
  }, 1000);
}, [data, user?.id]);
```

---

## Todo Management

### Update Progress
Always update TodoWrite when:
- Starting a task → `in_progress`
- Completing a task → `completed`
- Finding new tasks → add as `pending`

### Task Format
```json
{
  "content": "Task description",
  "activeForm": "Present participle form (e.g., 'Fixing bug')",
  "status": "pending | in_progress | completed"
}
```

---

## Workflow: New Feature

1. **Plan** - Update TodoWrite with tasks
2. **Implement** - Write code
3. **Type Check** - `npx tsc --noEmit`
4. **Commit** - Git add, commit with session link
5. **Push** - Push to branch
6. **SQL** - Provide any needed schema changes
7. **Test** - User merges, deploys, tests
8. **Debug** - Check Vercel logs if issues
9. **Iterate** - Fix and repeat

---

## Quick Reference

### Branch Naming
```
claude/<feature-name>-<random-id>
```

### Commit Message Format
```
<Short description>

<Detailed bullet points>

https://claude.ai/code/session_<ID>
```

### File Locations
- Pages: `app/<name>/page.tsx`
- API Routes: `app/api/<name>/route.ts`
- Components: `app/components/<Name>.tsx`
- Libraries: `lib/<name>.ts`
- Types: `types/index.ts`
- Styles: `app/globals.css`
