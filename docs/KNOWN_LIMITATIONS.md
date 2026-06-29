# Known Limitations

An honest assessment of what News Triangulator does well, what it doesn't, and what tradeoffs were made. Written for engineers evaluating this system and for hackathon judges who ask hard questions.

---

## Curated Outlet Lists

**The limitation**: Each lens is searched against a **fixed, curated list of outlets** (`PERSPECTIVE_DOMAINS` in [src/lib/search.ts](../src/lib/search.ts)) via Tavily's `include_domains`. The triangulation is only as representative as those lists.

**What this means in practice**:
- An outlet not in the list never appears, even if it covered the story well
- The lists encode our judgment of where each outlet leans — a debatable call for some outlets
- Coverage gaps exist — if a story wasn't covered by the outlets on a lens's list (or isn't in Tavily's index), that perspective's column will be thin
- Results are also bounded by Tavily's crawl coverage and the 30-day recency window (both configurable in `search.ts`)

**Why we accept this**: Domain-targeted search is what makes the perspectives genuinely *different* — it guarantees the progressive column shows progressive outlets, etc., rather than one undifferentiated search. The lists are easy to edit in one place, and being explicit about them is more honest than hiding the selection behind a model's opaque query generation.

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

## Free-Tier Limits

**The limitation**: The app runs on the **free tiers of Tavily and Groq**. Each triangulation makes **3 Tavily searches + 1 Groq call**.

**What this means in practice**:
- Tavily's free tier is ~1,000 searches/month → roughly **330 analyses/month** before the search budget is used up
- Groq's free tier has per-minute/day rate limits; bursts of traffic can hit a transient `429`
- Both providers can occasionally return transient `5xx` under load

**Mitigation**: The Groq client retries transient `429`/`5xx` with exponential backoff; rate-limit and upstream failures surface as clear user-facing messages rather than crashes. For more headroom you'd upgrade a provider tier, swap `GROQ_MODEL`, or add caching.

## No Offline / Cached Results

**The limitation**: Every request makes live Tavily + Groq calls. There is no caching layer.

**What this means**:
- The same query entered twice may produce slightly different results (fresh search results, non-zero LLM temperature)
- Results cannot be retrieved after the browser tab is closed
- Each analysis consumes free-tier search/LLM budget (see above)

**Why we accept this**: Caching news analysis would create a stale-data problem. News coverage changes hour by hour — yesterday's spin layer may not match today's. For production you'd want a short TTL cache (maybe 1 hour), but the live-search aspect is a feature, not a bug.

## The LLM's Own Biases

**The limitation**: The synthesis model (Llama via Groq), like all LLMs, has biases baked into its training data. Its judgment of what constitutes "progressive spin" vs. "conservative spin" is influenced by these biases.

**What this means**: The model's categorization of framing and spin reflects its training, not objective ground truth. Two humans analyzing the same coverage might categorize spin differently.

**Mitigation**: The three-way triangulation is the mitigation — and because the *coverage* for each lens is gathered by domain-targeted search (not the model), the model is summarizing real, separated source material rather than inventing it. The consensus layer — facts that survive triangulation — is the most trustworthy output.

## JSON Parsing

**The limitation**: The synthesis depends on the model returning well-formed JSON matching the expected shape.

**Mitigation**: Groq's JSON mode (`response_format: { type: 'json_object' }`) guarantees syntactically valid JSON. The parser in `triangulator.ts` adds defensive fallbacks (strip markdown fences, isolate the outer object, drop trailing commas), and the service coerces any missing/empty fields to sensible defaults. A malformed or thin response degrades gracefully instead of failing.

## Single-Language Support

**The limitation**: All prompts and outlet lists are English / US-Western oriented. The system works best when the query and sources are in English.

**What this means**: Non-English stories may produce worse results because:
- The curated outlet lists are predominantly English-language
- Summaries of non-English articles may lose nuance
- The "tone" classification is calibrated for English-language editorial conventions

## No User Accounts or History

**The limitation**: There is no authentication, no saved analyses, and no history. Every visit is stateless.

**Why**: This is a hackathon demo, not a SaaS product. Adding authentication would require database infrastructure, session management, and privacy considerations that are out of scope for the core concept demonstration.
