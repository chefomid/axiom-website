# Conventions and Agent Rules

Read this **before making changes** to the codebase.

---

## Agent methodology (Superpowers)

Non-trivial development should follow [Superpowers](https://github.com/obra/superpowers) skills in `.cursor/superpowers/`.

| When | Skill |
|------|-------|
| Unsure which skill applies | `using-superpowers/SKILL.md` |
| New feature | **brainstorming** before writing code |
| After design approval | **writing-plans** |
| During implementation | **test-driven-development** |
| Bugs | **systematic-debugging** |
| Before claiming done | **verification-before-completion** |

Install or update: `npm run install:superpowers`

Project rules: [`.cursor/rules/superpowers.mdc`](../../.cursor/rules/superpowers.mdc)

---

## Copy and typography

- **No em dashes (—)** in user-facing website copy (`src/`, `api/`), page titles, or UI strings. Use commas, periods, colons, pipes (`|`), or rephrase.
- Use `-` for empty or missing values in tables and compact UI.
- Run `python scripts/remove_em_dashes.py` if em dashes slip back into `src/` or `api/`.

---

## Scope discipline

1. **Minimal diffs** — solve the stated problem only; no drive-by refactors.
2. **Match existing patterns** — read surrounding code before writing; your additions should read as if written by the same author.
3. **No over-engineering** — no abstractions for one-off helpers; no excessive error handling for impossible edges.
4. **Reuse components** — extend existing functions and components rather than reimplementing.
5. **Comments sparingly** — code should be self-explanatory; comment only non-obvious business logic.

---

## Language and stack conventions

| Area | Convention |
|------|------------|
| Frontend | Plain JSX/JS — **no TypeScript** |
| Backend | Python 3.13+ with type hints where existing code uses them |
| HTTP client | Native `fetch` — no axios |
| State | Local React state + sessionStorage/localStorage — no Redux/Zustand |
| Styling | Tailwind utilities + existing tokens — no new component libraries |
| Maps | MapLibre GL via `src/lib/maplibre.js` |

---

## Git and commits

- **Only commit when the user explicitly asks.** Never commit proactively.
- **Never commit secrets:** `.env`, `.env.local`, credentials, API keys.
- **Never commit:** `__pycache__/`, `.pyc`, `node_modules/`, `billing.sqlite`.
- **Never run destructive git commands** (force push, hard reset) unless explicitly requested.
- **Never skip hooks** (`--no-verify`) unless explicitly requested.
- Follow existing commit message style (concise, focus on "why").

---

## Frontend patterns

### Page → View split

Pages are thin shells. Put UI logic in `*View.jsx` components.

### Property Intelligence state

Use `usePropertyReport.js` — do not extend the legacy `usePropertyEnrichment.js`.

### API calls

All Property API calls go through `src/services/propertyApi.js`. Do not scatter fetch calls across components.

### Feature flags

Check `src/config/features.js` before assuming Property Intelligence is available in production builds.

### Lazy loading

Use `lazyWithRetry` for route-level lazy imports that need chunk retry (see Property Intelligence).

### Error handling

- Feed hooks: cache + stale fallback + retry via `useFeedRetry`
- Property API: structured 402 for billing errors
- Route errors: `RouteErrorFallback.jsx`

---

## Backend patterns

### Adding a new data source

1. Create adapter in `adapters/` (follow `hazards/` or `vendors/` pattern)
2. Register in `engine/registry.py`
3. Add entry to `registry/sources.json`
4. Optional: YAML mapping in `registry/mappings/` for vendor JSON → COPE fields
5. Frontend catalog auto-updates via `GET /catalog`

### Adapter structure (hazards/OSINT pattern)

```
adapters/hazard_fetch.py     # Pure async HTTP helpers (shared)
adapters/hazards/fema.py     # Thin adapter: fetch → success_result → observations
```

### COPE field precedence

Defined in `registry/cope_fields.json` — update precedence arrays when adding competing sources.

### Pricing

All pricing in `registry/sources.json`:
- `api_cost_usd` + `service_cost_usd` per source
- Global `margin_multiplier: 2.5`
- `minimum_charge_usd: 0.99`

Do not hardcode prices in adapters except for documented exceptions (e.g. `WEB_SEARCH_API_COST_USD`).

### Caching

In-memory TTL caches in `engine/cache.py` and `source_discovery/cache.py`. Comment in code says "swap for Redis" in production — do not assume cache persists across restarts.

---

## API response conventions

| Code | Meaning |
|------|---------|
| 200 | Success |
| 402 | Payment required (insufficient credits) |
| 422 | Validation error (bad address, missing URL) |
| 500 | Server error |

Frontend handles 402 with user-facing billing notice.

---

## Testing

| Layer | Testing |
|-------|---------|
| Frontend | **No unit/e2e tests** in package.json |
| Backend | Smoke scripts only: `check:property-keys`, `smoke:billing` |

Do not add tests unless requested or they provide meaningful coverage of real behavior.

---

## Documentation

- Do not create markdown files the user did not ask for.
- Update existing docs when changing behavior that docs describe.
- This handoff folder (`docs/agent-handoff/`) is the agent continuity package — update [08-current-state-and-roadmap.md](./08-current-state-and-roadmap.md) when major work completes.

---

## PR and deployment

- Use `gh` CLI for GitHub tasks when user asks for PRs.
- Frontend deploys to Vercel on push.
- Backend deploys to Render via `render.yaml`.
- Property Intelligence is gated in production until `VITE_PROPERTY_INTELLIGENCE_ENABLED=true`.

---

## See also

- [../../AGENTS.md](../../AGENTS.md) — agent entry point
- [05-design-system.md](./05-design-system.md) — UI conventions
- [04-backend-architecture.md](./04-backend-architecture.md) — how to add sources
- [10-known-gaps-and-stubs.md](./10-known-gaps-and-stubs.md) — what not to assume is done
