# Show HN draft — `@wildwindow/geoprivacy`

🧑 **Do not post until npm (and optionally the public GitHub repo) are live.**
Replace the placeholder links after publish. Keep the tone factual; no dark
patterns, no “% chance” wildlife claims.

Suggested length: ~1–2 short paragraphs + bullets. HN title max ~80 characters.

---

## Title (pick one)

1. `Show HN: geoprivacy – open-source location protection for wildlife data`
2. `Show HN: No-Pin Promise helpers – H3 tiers so APIs never leak wildlife pins`
3. `Show HN: @wildwindow/geoprivacy – fail-closed geo privacy for conservation apps`

## Body

```text
We built WildWindow (wildlife photo forecasts) around a hard rule: never put a
pin on a wild animal. The enforcement lives in a small MIT TypeScript package —
@wildwindow/geoprivacy — that we're open-sourcing so anyone can audit it.

It only depends on h3-js. No I/O, no hidden clock. Helpers cover:

- Deterministic snap of GPS → H3 res-7 (no random jitter to average out)
- Tiered public resolution (open / protected / highly_protected / no_forecast)
- Per-tier delays, breeding-season lockouts, min-count merge-to-parent
- Quantile map levels 1–5 instead of raw counts
- assertPublicSafe: throws if a JSON payload has coordinate keys or an
  over-fine H3 cell

Species→tier tables stay in app config; the package ships the policy functions
and constants. We use it in production paths so a mistaken API field cannot
leak lat/lng.

npm: https://www.npmjs.com/package/@wildwindow/geoprivacy
Source: https://github.com/arsalan-arshad/geoprivacy
  (or https://github.com/arsalan-arshad/wildwindow/tree/main/packages/geoprivacy
   until the dedicated repo exists)

Happy to answer questions about the threat model or the merge algorithm.
```

## Optional first comment (if asked “why not just fuzz coordinates?”)

```text
Random jitter fails under repeated queries — the average converges on the true
point. We snap deterministically to an H3 cell at the tier's resolution, key
public responses on that display cell, delay recent records, and merge cells
that don't meet minimum record/observer counts. assertPublicSafe is the last
line of defence for serialisation mistakes.
```

## Posting checklist

- [ ] `npm view @wildwindow/geoprivacy` works
- [ ] Links in the body resolve (npm + GitHub)
- [ ] README badges look correct on the package page
- [ ] Posted from an account that can take follow-up questions
- [ ] No exact coordinates, nest sites, or unpublished sensitive locations in
      comments or screenshots
