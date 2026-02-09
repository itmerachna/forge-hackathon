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


def get_gemini_response(user_profile: dict, context: dict = None) -> str:
    """Call Gemini to get tool recommendations for a user profile."""
    client = genai.Client(api_key=GEMINI_API_KEY)

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

Respond ONLY with a JSON array (no markdown, no explanation):
[{{"name":"...", "category":"...", "difficulty":"...", "pricing":"...", "reason":"..."}}]"""

    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
    )
    return response.text or ""


def parse_recommendations(text: str) -> list:
    """Parse JSON array from Gemini response."""
    import re
    match = re.search(r'\[[\s\S]*\]', text)
    if not match:
        return []
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return []


def evaluation_task(dataset_item: dict) -> dict:
    """Run a single eval: call Gemini, return input/output for scoring."""
    user_profile = dataset_item.get("input", {}).get("userProfile", {})
    context = dataset_item.get("input", {}).get("context", None)

    try:
        response_text = get_gemini_response(user_profile, context)
        recommendations = parse_recommendations(response_text)

        # Rate limit: wait between calls
        time.sleep(1.0)

        return {
            "input": json.dumps(user_profile),
            "output": response_text,
            "recommendations": recommendations,
            "context": {"user_profile": user_profile, "expected": dataset_item.get("expected_output", {})},
        }
    except Exception as e:
        time.sleep(2.0)  # Extra wait on error (likely rate limit)
        return {
            "input": json.dumps(user_profile),
            "output": f"ERROR: {str(e)}",
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
            return score_result.ScoreResult(value=0.0, name=self.name, reason="No recommendations")

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
            return score_result.ScoreResult(value=0.0, name=self.name, reason="No recommendations")

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
            return score_result.ScoreResult(value=0.0, name=self.name, reason="No recommendations")

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
    print(f"Dataset loaded: {len(dataset.get_items())} items")

    metrics = [
        ValidJSON(),
        PricingRespect(),
        SkillMatch(),
        Novelty(),
        ToolVariety(),
    ]

    print(f"Running evaluation with {len(metrics)} metrics...")
    print("This will take a few minutes (45 Gemini API calls with rate limiting)...\n")

    results = evaluate(
        experiment_name="forge-eval-full-run",
        dataset=dataset,
        task=evaluation_task,
        scoring_metrics=metrics,
    )

    print("\n=== Evaluation Complete ===")
    print(f"Results: {results}")
    print("\nCheck the Opik dashboard for detailed scores and traces.")


if __name__ == "__main__":
    main()
