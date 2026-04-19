# Known Limitations

An honest assessment of what News Triangulator does well, what it doesn't, and what tradeoffs were made. Written for engineers evaluating this system and for hackathon judges who ask hard questions.

---

## Search Grounding Source Coverage

**The limitation**: When Gemini searches with Google Search Grounding, we cannot control which specific outlets it finds. We provide prompt guidance ("focus on progressive-leaning sources like...") but Gemini generates its own search queries and processes whatever results Google returns.

**What this means in practice**:
- Sometimes a "progressive" search returns a mainstream outlet instead of an explicitly progressive one
- Sometimes the same outlet appears in multiple perspectives (e.g., BBC appears in both conservative and international columns)
- Coverage gaps exist — if a story wasn't covered by outlets matching a particular orientation, that perspective's column will be thin

**Why we accept this**: Forcing specific outlets would require us to scrape those sites directly, which is legally fraught and technically fragile. The Search Grounding approach is honest — it shows you what Google actually found, not what we curated.

## Ideological Categorization Is Approximate

**The limitation**: Labels like "progressive," "conservative," and "international" are rough lenses, not scientific categories.

- Many outlets don't fit cleanly into one category
- The same outlet can lean different directions on different topics
- "International" is not an ideology — it's a geographic category used as a proxy for "outside the US political binary"
- These categories reflect primarily US/Western political frameworks

**Why we still use them**: Because approximate categories that help users see framing differences are more useful than no categories at all. The alternative — showing all sources in a flat list — makes it nearly impossible to compare how perspectives differ.

## In-Memory Rate Limiting

**The limitation**: The rate limiter uses a simple `Map` stored in server memory. This means:
- It resets every time the server restarts  
- It doesn't work across multiple server instances (horizontal scaling)
- A sufficiently motivated attacker could bypass it

**What production would require**: Redis or Cloud Memorystore for distributed rate limiting. For a hackathon demo, in-memory is fine — you have one instance and you just need to prevent accidental API key hammering during a live presentation.

## No Offline / Cached Results

**The limitation**: Every triangulation request makes 4 live API calls to Gemini with live Google searches. There is no caching layer.

**What this means**:
- The same query entered twice will produce different results (because Gemini may find different sources each time)
- Results cannot be retrieved after the browser tab is closed
- Each analysis costs API quota

**Why we accept this**: Caching news analysis would create a stale-data problem. News coverage changes hour by hour — yesterday's spin layer may not match today's. For a production version, you'd want a TTL-based cache (maybe 1 hour), but for a demo the live-search aspect is actually a feature, not a bug.

## Gemini's Own Biases

**The limitation**: Gemini, like all large language models, has its own biases baked into its training data. Its judgment of what constitutes "progressive spin" vs. "conservative spin" is influenced by these biases.

**What this means**: The model's categorization of framing and spin reflects its training, not an objective ground truth. Two humans analyzing the same coverage might categorize spin differently.

**Mitigation**: The three-way triangulation itself is the mitigation. By forcing the model to analyze from three different starting points and then synthesize, we reduce the impact of any single bias direction. The consensus layer — facts that survive triangulation — is the most trustworthy output.

## JSON Parsing Fragility

**The limitation**: We ask Gemini to return raw JSON with no markdown fencing. It usually complies, but occasionally wraps responses in ` ```json ... ``` ` blocks or adds preamble text.

**Mitigation**: The `GeminiService` class has defensive parsing that strips markdown fences and retries. This handles 99% of formatting issues. The remaining 1% results in a user-facing error message asking them to try again.

## Single-Language Support

**The limitation**: All prompts are in English. The system works best when the query and the searched sources are in English.

**What this means**: Non-English stories may produce worse results because:
- Gemini's English search queries may not find the best non-English coverage
- Summaries of non-English articles may lose nuance in translation
- The "tone" classification is calibrated for English-language editorial conventions

## No User Accounts or History

**The limitation**: There is no authentication, no saved analyses, and no history. Every visit is stateless.

**Why**: This is a hackathon demo, not a SaaS product. Adding authentication would require database infrastructure, session management, and privacy considerations that are out of scope for the core concept demonstration.
