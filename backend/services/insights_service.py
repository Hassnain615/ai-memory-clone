import google.generativeai as genai
from services.rag_service import RAGService


class InsightsService:
    def __init__(self, rag: RAGService):
        self.rag = rag
        self.model = genai.GenerativeModel("gemini-2.5-flash-lite")

    async def analyze(self) -> dict:
        count = self.rag.collection.count()
        if count == 0:
            return {
                "error": "No memories found. Upload some notes or PDFs first!",
                "focus_areas": [],
                "patterns": [],
                "suggestions": [],
                "summary": ""
            }

        results = self.rag.collection.get(include=["documents", "metadatas"])
        docs = results.get("documents", [])
        metas = results.get("metadatas", [])

        # Sample docs (avoid token overload)
        sample = docs[:40]
        combined = "\n\n---\n\n".join(sample[:20])

        sources = list(set([m.get("title", "Unknown") for m in metas]))

        prompt = f"""You are analyzing a person's second brain / knowledge base. Based on the content below, provide deep insights.

KNOWLEDGE BASE CONTENT (sample):
{combined}

SOURCES: {', '.join(sources)}
TOTAL MEMORY CHUNKS: {count}

Respond ONLY with valid JSON (no markdown, no backticks) in this exact format:
{{
  "summary": "2-3 sentence overview of what this person's mind is focused on",
  "focus_areas": [
    {{"topic": "Topic Name", "description": "Why this seems important to them", "strength": 85}},
    {{"topic": "Topic Name", "description": "Why this seems important to them", "strength": 70}}
  ],
  "patterns": [
    "Pattern or recurring theme observed",
    "Another behavioral or cognitive pattern"
  ],
  "suggestions": [
    {{"title": "Actionable suggestion title", "detail": "Specific advice based on their knowledge gaps or patterns"}},
    {{"title": "Another suggestion", "detail": "Detail here"}}
  ],
  "personality_insight": "One sentence about what kind of thinker/learner this person seems to be"
}}

Provide 4-6 focus_areas, 4-5 patterns, and 4-5 suggestions. Make insights specific and genuinely useful."""

        response = self.model.generate_content(prompt)
        raw = response.text.strip()

        # Clean up potential markdown fences
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        try:
            import json
            data = json.loads(raw)
            return data
        except Exception:
            return {
                "summary": raw[:500],
                "focus_areas": [],
                "patterns": [],
                "suggestions": [],
                "personality_insight": ""
            }
