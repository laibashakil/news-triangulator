# Demo Script — 2-Minute Hackathon Presentation

This script is designed for a live demo at a hackathon. Practice it at least twice before presenting. The key is confidence and knowing exactly where to point.

---

## Setup Before Going On Stage

1. Have the app running locally (`pnpm dev`) or deployed to Cloud Run
2. Have this test query ready to paste (copy it to your clipboard):

```
Pakistan's Supreme Court ruling on reserved seats for PTI - how different countries and political orientations covered the constitutional crisis
```

**Why this query?** It's a story where:
- Pakistani outlets frame it as a constitutional/sovereignty issue
- Western progressive outlets focus on democratic backsliding and Imran Khan
- Western conservative outlets may focus on geopolitical stability concerns
- International outlets (BBC, Al Jazeera) frame it through regional power dynamics
- The factual core (what the court actually ruled) is verifiable and distinct from the framing

**Backup query** (in case the first doesn't produce strong differentiation):
```
US ban on TikTok - national security vs free speech debate
```

---

## The Script

### Opening (15 seconds)

> "Every major news story gets told differently depending on who's telling it. Not because some reporters are lying — but because framing IS the story. News Triangulator takes any news story you give it and shows you what's **fact**, what's **framing**, and what every source actually **agrees on**."

### The Input (10 seconds)

Paste the query. Before hitting submit, say:

> "I'm pasting a real story about [topic]. Watch what happens — it's going to search three different ideological lanes of the internet simultaneously."

### The Loading Sequence (20 seconds)

**Point at the screen** as each stage appears:

> "See the progress indicator? It's not fake. Right now Gemini is running one grounded Google Search pass and pulling coverage through three lenses at once — progressive, conservative, and international. These are real searches happening live against Vertex AI, not cached results."

**This is your biggest credibility moment.** The fact that the loading states correspond to real API calls makes you look like you understand what's happening under the hood.

### The Three Columns (30 seconds)

When results appear:

> "Three columns. Each one shows how that slice of the media covered this exact story."

**Point to the source chips:**
> "These source names? Those are real outlets that Google's AI actually found and cited. Not hardcoded, not hallucinated — these are the actual articles it found."

**Point to the 'What only this version said' section:**
> "This is where it gets interesting. See these callout blocks? These are claims or framings that ONLY appeared in this perspective. This is literally the spin layer — the things each side uniquely emphasizes."

### The Consensus Layer (30 seconds)

**Scroll down to the consensus section. This is the finale.**

> "But here's the real payoff. This section — 'What every source agrees on' — these are the facts that survived triangulation. If a progressive outlet, a conservative outlet, AND an international outlet all report the same thing, it's probably true."

**Point to the stripped truth:**
> "And this paragraph at the bottom? This is the story without any framing. Written like a wire service report. Just the facts, no adjectives, no spin. This is what the story actually IS underneath all the editorial layers."

### Closing Technical Point (15 seconds)

> "Under the hood, this is two calls to Gemini 2.5 Flash on Vertex AI — one grounded Google Search call that pulls all three perspectives in a single research pass, then one synthesis call to extract the truth layer. The whole thing runs on Next.js and can be deployed to Cloud Run with a single command, using service-account auth, no API keys."

---

## Handling Judge Questions

### "What if the AI gets it wrong?"

> "The sources section shows you exactly which outlets the AI found — it's transparent about what it read. And the consensus layer only includes facts that ALL three perspectives agree on, so it's naturally self-correcting. Single-source claims stay in their individual columns."

### "How is this different from just reading multiple news sites?"

> "Time. Reading three different outlets and mentally mapping what's fact vs. framing takes 30-45 minutes per story. This does it in 15 seconds and structures the comparison in a way no human reader naturally would."

### "What doesn't this do well?"

> "Three things we're honest about. First, we can't control exactly which outlets Gemini finds — we guide it, but it searches freely. Second, the ideological categorization is approximate, not scientific — it's a useful lens, not a precise taxonomy. Third, the rate limiter is in-memory, so it resets on server restart. For production, you'd use Redis."

### "How much does it cost to run?"

> "Gemini 2.5 Flash on Vertex AI is inexpensive — the big line item is the grounded Google Search call, which is metered separately from regular generate-content usage. A full triangulation is one grounded call plus one cheap synthesis call, so roughly a couple of cents per analysis. For a hackathon demo, Cloud Run scales to zero when idle, so the only charges are while it's actually running."
