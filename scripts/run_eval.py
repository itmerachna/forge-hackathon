"""
Forge Eval Suite — Run via Opik Python SDK
Runs all 45 test cases against Gemini and scores them in Opik.

Usage:
  pip install opik google-genai
  export OPIK_API_KEY="your-opik-key"
  export GEMINI_API_KEY="your-gemini-key"
  python scripts/run_eval.py

Or paste this into Google Colab.
"""

import os
import json
import re
import time
from opik import Opik
from opik.evaluation import evaluate
from opik.evaluation.metrics import base_metric, score_result
from google import genai

# --- Config ---
OPIK_API_KEY = os.environ.get("OPIK_API_KEY", "")
OPIK_WORKSPACE = os.environ.get("OPIK_WORKSPACE", "itmerachna")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = "gemini-2.5-flash-lite"
DATASET_NAME = "forge-eval-suite"

# Rate limit config — Gemini free tier is strict
DELAY_BETWEEN_CALLS = 2.5  # seconds between calls
MAX_RETRIES = 3  # retry on 429/rate limit errors
INITIAL_BACKOFF = 4.0  # first retry wait (doubles each retry)

# --- Tool Catalog (loaded from your Supabase DB — paste updated version if needed) ---
# This is the fallback catalog. The eval will use this to ground Gemini's recommendations.
TOOL_CATALOG = """- AKOOL (AI Video Editor, Freemium, Beginner): AI Video Creation – Avatars, Translation, Face Swap
- PixAI (AI Design, Paid, Beginner): Anime & Character Generation AI
- RecCloud (AI Audio, Freemium, Beginner): AI Audio & Video Processing
- KREA AI (AI Design, Freemium, Intermediate): AI Creative Suite for Images, Video & 3D
- Gamma (AI Design, Freemium, Beginner): AI design for presentations, websites, and more
- Anything (Vibe Coding, Freemium, Intermediate): Turn words into apps, sites, tools
- Relume (AI Site Builder, Freemium, Beginner): Websites designed and built faster with AI
- Descript (AI Video Editor, Paid, Intermediate): AI video editing with transcription and voice cloning
- PicWish (AI Photo Editor, Freemium, Beginner): All-in-one free AI photo editor
- Luma AI (AI Design, Freemium, Intermediate): Images and videos with precision, speed, control
- Midjourney (AI Design, Paid, Intermediate): AI image generation via Discord
- Runway (AI Video Editor, Freemium, Intermediate): AI video generation and editing suite
- Figma (AI Design, Freemium, Intermediate): Collaborative design tool with AI features
- Cursor (Vibe Coding, Freemium, Intermediate): AI-powered code editor
- v0 (Vibe Coding, Freemium, Beginner): AI UI component generator by Vercel
- Bolt (Vibe Coding, Freemium, Beginner): AI full-stack app builder in the browser
- Lovable (Vibe Coding, Freemium, Beginner): AI app builder for non-coders
- Webflow (AI Site Builder, Freemium, Intermediate): Visual web design with AI features
- Framer (AI Site Builder, Freemium, Intermediate): AI-powered website builder
- Canva (AI Design, Freemium, Beginner): Easy graphic design with AI tools
- DALL-E (AI Design, Paid, Beginner): AI image generation by OpenAI
- ElevenLabs (AI Audio, Freemium, Beginner): AI voice cloning and text-to-speech
- Suno (AI Audio, Freemium, Beginner): AI music generation
- Udio (AI Audio, Freemium, Beginner): AI music creation platform
- Claude (AI Writing, Freemium, Beginner): AI assistant for writing and coding
- Notion AI (AI Productivity, Paid, Beginner): AI-powered workspace and notes
- GitHub Copilot (Vibe Coding, Paid, Intermediate): AI code completion in VS Code
- Spline (AI Design, Freemium, Intermediate): 3D design tool with AI features
- Rive (AI Design, Freemium, Advanced): Interactive animations for apps and games
- Vercel (Vibe Coding, Freemium, Intermediate): AI-powered deployment and hosting"""

# Shared Gemini client (created once)
_gemini_client = None


def get_client():
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    return _gemini_client


def get_gemini_response(user_profile: dict, context: dict = None) -> str:
    """Call Gemini with retry + exponential backoff on rate limits."""
    client = get_client()

    prompt = f"""You are Forge, an AI learning coach for design & vibe coding tools. Based on this user's profile, recommend exactly 5 AI tools from the catalog below.

IMPORTANT: You MUST only recommend tools from this catalog. Do NOT make up tools.

TOOL CATALOG:
{TOOL_CATALOG}

User Profile:
- Focus: {user_profile.get('focus', 'Not specified')}
- Skill Level: {user_profile.get('skill_level', 'Not specified')}
- Preferences: {user_profile.get('preferences', 'None')}
- Existing Tools: {user_profile.get('existing_tools', 'None')}
- Goal: {user_profile.get('goal', 'Not specified')}
{f"Context: Tools tried: {context.get('tools_tried', 0)}, Day of week: {context.get('week_day', 1)}" if context else ''}

Pick the 5 most relevant tools for this user. Match their skill level, respect their pricing preferences, and avoid tools they already use.

Respond ONLY with a raw JSON array. No markdown, no code fences, no explanation — just the array:
[{{"name":"...", "category":"...", "difficulty":"...", "pricing":"...", "reason":"..."}}]"""

    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(
                model=MODEL,
                contents=prompt,
            )
            return response.text or ""
        except Exception as e:
            last_error = e
            err_str = str(e).lower()
            is_rate_limit = any(kw in err_str for kw in ['429', 'resource_exhausted', 'rate', 'quota'])
            if is_rate_limit and attempt < MAX_RETRIES:
                wait = INITIAL_BACKOFF * (2 ** attempt)
                print(f"  Rate limited (attempt {attempt + 1}/{MAX_RETRIES + 1}), waiting {wait}s...")
                time.sleep(wait)
                continue
            raise last_error


def parse_recommendations(text: str) -> list:
    """Parse JSON array from Gemini response — handles markdown code fences, extra text, etc."""
    if not text or text.startswith("ERROR:"):
        return []

    # Strip markdown code fences if present (```json ... ``` or ``` ... ```)
    cleaned = re.sub(r'```(?:json)?\s*', '', text)
    cleaned = re.sub(r'```', '', cleaned)
    cleaned = cleaned.strip()

    # Try direct parse first (ideal case: pure JSON)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # Fallback: extract JSON array via regex
    match = re.search(r'\[[\s\S]*\]', cleaned)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    # Last resort: try extracting from original text (before stripping fences)
    match = re.search(r'\[[\s\S]*\]', text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    return []


# Track stats for summary
_stats = {"success": 0, "rate_limited": 0, "errors": 0, "empty_json": 0}


def evaluation_task(dataset_item: dict) -> dict:
    """Run a single eval: call Gemini, return input/output for scoring."""
    global _stats

    user_profile = dataset_item.get("input", {}).get("userProfile", {})
    context = dataset_item.get("input", {}).get("context", None)

    test_name = dataset_item.get("metadata", {}).get("test_name", "unknown")
    test_id = dataset_item.get("metadata", {}).get("test_id", "?")

    try:
        response_text = get_gemini_response(user_profile, context)
        recommendations = parse_recommendations(response_text)

        if recommendations:
            _stats["success"] += 1
            print(f"  [{test_id}] {test_name}: OK ({len(recommendations)} tools)")
        else:
            _stats["empty_json"] += 1
            # Show first 120 chars of response for debugging
            preview = response_text[:120].replace('\n', ' ')
            print(f"  [{test_id}] {test_name}: JSON PARSE FAILED — {preview}...")

        # Rate limit: wait between calls
        time.sleep(DELAY_BETWEEN_CALLS)

        return {
            "input": json.dumps(user_profile),
            "output": response_text,
            "recommendations": recommendations,
            "context": {"user_profile": user_profile, "expected": dataset_item.get("expected_output", {})},
        }
    except Exception as e:
        err_str = str(e)
        if '429' in err_str or 'rate' in err_str.lower():
            _stats["rate_limited"] += 1
            print(f"  [{test_id}] {test_name}: RATE LIMITED (all retries exhausted)")
        else:
            _stats["errors"] += 1
            print(f"  [{test_id}] {test_name}: ERROR — {err_str[:100]}")

        time.sleep(DELAY_BETWEEN_CALLS * 2)  # Extra wait on error
        return {
            "input": json.dumps(user_profile),
            "output": f"ERROR: {err_str}",
            "recommendations": [],
            "context": {"user_profile": user_profile, "expected": dataset_item.get("expected_output", {})},
        }


# --- Custom Metrics ---

class PricingRespect(base_metric.BaseMetric):
    """Checks if free-only users get only free/freemium tools."""
    name = "pricing_respect"

    def score(self, output: str, **kwargs) -> score_result.ScoreResult:
        context = kwargs.get("context", {})
        expected = context.get("expected", {}).get("expectedTraits", {})
        if not expected.get("must_be_free"):
            return score_result.ScoreResult(value=1.0, name=self.name, reason="No pricing constraint")

        recs = parse_recommendations(output)
        if not recs:
            return score_result.ScoreResult(value=0.0, name=self.name, reason="No recommendations parsed")

        all_free = all(
            "free" in (r.get("pricing", "").lower())
            for r in recs
        )
        return score_result.ScoreResult(
            value=1.0 if all_free else 0.0,
            name=self.name,
            reason="All free/freemium" if all_free else "Recommended paid tools to free-only user",
        )


class SkillMatch(base_metric.BaseMetric):
    """Checks if tool difficulty matches user skill level."""
    name = "skill_match"

    def score(self, output: str, **kwargs) -> score_result.ScoreResult:
        context = kwargs.get("context", {})
        expected = context.get("expected", {}).get("expectedTraits", {})
        level = expected.get("skill_level", "")
        if not level:
            return score_result.ScoreResult(value=1.0, name=self.name, reason="No skill constraint")

        recs = parse_recommendations(output)
        if not recs:
            return score_result.ScoreResult(value=0.0, name=self.name, reason="No recommendations parsed")

        match_count = sum(
            1 for r in recs
            if r.get("difficulty", "").lower() == level.lower()
            or (level == "Beginner" and r.get("difficulty", "").lower() != "advanced")
            or (level == "Advanced" and r.get("difficulty", "").lower() != "beginner")
        )
        ratio = match_count / len(recs)
        return score_result.ScoreResult(
            value=ratio,
            name=self.name,
            reason=f"{match_count}/{len(recs)} tools matched {level}",
        )


class Novelty(base_metric.BaseMetric):
    """Checks that known tools aren't recommended."""
    name = "novelty"

    def score(self, output: str, **kwargs) -> score_result.ScoreResult:
        context = kwargs.get("context", {})
        user_profile = context.get("user_profile", {})
        expected = context.get("expected", {}).get("expectedTraits", {})

        if not expected.get("should_not_suggest_known"):
            return score_result.ScoreResult(value=1.0, name=self.name, reason="No novelty constraint")

        existing = user_profile.get("existing_tools", "").lower()
        if not existing:
            return score_result.ScoreResult(value=1.0, name=self.name, reason="No existing tools")

        known = [t.strip() for t in existing.split(",")]
        recs = parse_recommendations(output)

        if not recs:
            return score_result.ScoreResult(value=0.0, name=self.name, reason="No recommendations parsed")

        suggested_known = any(
            any(k in r.get("name", "").lower() for k in known)
            for r in recs
        )
        return score_result.ScoreResult(
            value=0.0 if suggested_known else 1.0,
            name=self.name,
            reason="Suggested known tools" if suggested_known else "All novel recommendations",
        )


class ToolVariety(base_metric.BaseMetric):
    """Checks if recommendations span multiple categories."""
    name = "tool_variety"

    def score(self, output: str, **kwargs) -> score_result.ScoreResult:
        recs = parse_recommendations(output)
        if not recs:
            return score_result.ScoreResult(value=0.0, name=self.name, reason="No recommendations parsed")

        categories = set(r.get("category", "") for r in recs)
        ratio = min(len(categories) / 3, 1.0)  # 3+ categories = perfect score
        return score_result.ScoreResult(
            value=ratio,
            name=self.name,
            reason=f"{len(categories)} unique categories across {len(recs)} tools",
        )


class ValidJSON(base_metric.BaseMetric):
    """Checks if the response is valid JSON with tool recommendations."""
    name = "valid_json"

    def score(self, output: str, **kwargs) -> score_result.ScoreResult:
        recs = parse_recommendations(output)
        if not recs:
            return score_result.ScoreResult(value=0.0, name=self.name, reason="Invalid or empty JSON")
        if len(recs) >= 3:
            return score_result.ScoreResult(value=1.0, name=self.name, reason=f"Valid JSON with {len(recs)} tools")
        return score_result.ScoreResult(value=0.5, name=self.name, reason=f"Only {len(recs)} tools returned")


class CatalogGrounding(base_metric.BaseMetric):
    """Checks that recommended tools come from the catalog (no hallucinated tools)."""
    name = "catalog_grounding"

    # Known tool names from the catalog (lowercased for matching)
    CATALOG_NAMES = {
        "akool", "pixai", "reccloud", "krea ai", "gamma", "anything", "relume",
        "descript", "picwish", "luma ai", "midjourney", "runway", "figma",
        "cursor", "v0", "bolt", "lovable", "webflow", "framer", "canva",
        "dall-e", "dalle", "elevenlabs", "suno", "udio", "claude",
        "notion ai", "github copilot", "spline", "rive", "vercel",
    }

    def score(self, output: str, **kwargs) -> score_result.ScoreResult:
        recs = parse_recommendations(output)
        if not recs:
            return score_result.ScoreResult(value=0.0, name=self.name, reason="No recommendations parsed")

        grounded = 0
        hallucinated = []
        for r in recs:
            name = r.get("name", "").lower().strip()
            if any(cat_name in name or name in cat_name for cat_name in self.CATALOG_NAMES):
                grounded += 1
            else:
                hallucinated.append(r.get("name", "unknown"))

        ratio = grounded / len(recs) if recs else 0
        reason = f"{grounded}/{len(recs)} from catalog"
        if hallucinated:
            reason += f" — hallucinated: {', '.join(hallucinated[:3])}"
        return score_result.ScoreResult(value=ratio, name=self.name, reason=reason)


def main():
    if not OPIK_API_KEY:
        print("ERROR: Set OPIK_API_KEY environment variable")
        return
    if not GEMINI_API_KEY:
        print("ERROR: Set GEMINI_API_KEY environment variable")
        return

    print(f"Connecting to Opik workspace: {OPIK_WORKSPACE}")
    client = Opik(api_key=OPIK_API_KEY, workspace=OPIK_WORKSPACE)

    print(f"Loading dataset: {DATASET_NAME}")
    dataset = client.get_dataset(name=DATASET_NAME)
    items = dataset.get_items()
    print(f"Dataset loaded: {len(items)} items")

    # Quick sanity check: print first item's structure
    if items:
        first = items[0]
        print(f"Sample item keys: {list(first.keys()) if isinstance(first, dict) else dir(first)}")

    metrics = [
        ValidJSON(),
        PricingRespect(),
        SkillMatch(),
        Novelty(),
        ToolVariety(),
        CatalogGrounding(),
    ]

    print(f"\nRunning evaluation with {len(metrics)} metrics...")
    print(f"Config: {DELAY_BETWEEN_CALLS}s delay, {MAX_RETRIES} retries, {INITIAL_BACKOFF}s initial backoff")
    print(f"Estimated time: ~{len(items) * (DELAY_BETWEEN_CALLS + 1.5):.0f}s ({len(items)} API calls)\n")

    results = evaluate(
        experiment_name="forge-eval-v2",
        dataset=dataset,
        task=evaluation_task,
        scoring_metrics=metrics,
    )

    print("\n=== Evaluation Complete ===")
    print(f"Results: {results}")
    print(f"\nStats: {_stats}")
    print(f"  Successful API calls: {_stats['success']}")
    print(f"  JSON parse failures:  {_stats['empty_json']}")
    print(f"  Rate limit errors:    {_stats['rate_limited']}")
    print(f"  Other errors:         {_stats['errors']}")
    print("\nCheck the Opik dashboard for detailed scores and traces.")
    print("Look for experiment: forge-eval-v2")


if __name__ == "__main__":
    main()
