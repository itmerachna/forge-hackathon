# n8n Automation Setup for Forge

## Deployment (Render Free Tier)

1. Create a new Web Service on [Render](https://render.com)
2. Use Docker image: `n8nio/n8n`
3. Set environment variables:
   - `N8N_BASIC_AUTH_ACTIVE=true`
   - `N8N_BASIC_AUTH_USER=admin`
   - `N8N_BASIC_AUTH_PASSWORD=<your-password>`
   - `FORGE_API_URL=https://forge-hackathon.vercel.app`
   - `WEBHOOK_URL=https://<your-render-url>.onrender.com`

## Workflows

### 1. Tool Discovery Pipeline (`tool-discovery-pipeline.json`)
- **Trigger**: Weekly (every Monday)
- **Flow**: Product Hunt API + GitHub API + HackerNews API -> Filter by AI tags -> Categorize with Claude/Gemini -> Insert into Supabase
- **Required credentials**: Product Hunt API token, GitHub token

### 2. GitHub Trending Scrape (`github-trending.json`)
- **Trigger**: Daily
- **Flow**: GitHub Search API (multiple queries) -> Filter by stars (>20) -> Trigger Forge discover-tools endpoint
- **Required credentials**: GitHub token (optional, increases rate limit)

### 3. HackerNews Integration (`hackernews-integration.json`)
- **Trigger**: Daily
- **Flow**: HN Algolia API (Show HN + AI stories) -> Filter quality posts (>10 points) -> Trigger Forge discover-tools endpoint
- **No auth needed**: Uses public Algolia API

## Import Workflows

1. Open n8n dashboard
2. Go to Workflows -> Import from File
3. Import each JSON file from the `workflows/` directory
4. Configure credentials for each node
5. Activate the workflows
