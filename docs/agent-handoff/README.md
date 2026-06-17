# AXIOM Agent Handoff — Start Here

**Last updated:** 2026-06-07

This folder is the **continuity package** for any new Cursor agent (or human developer) picking up the AXIOM website repo with no prior chat history. Read this first, then follow the doc index below.

---

## 5-minute quick start

```powershell
cd c:\Users\Orcc_\OneDrive\Desktop\AXIOM\website
npm install
npm run dev:all
```

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://127.0.0.1:5173 |
| Property API (FastAPI) | http://127.0.0.1:8000 |

**Smoke test:**

1. Open `/public-data-command` — confirm hazard feeds load on the map.
2. Open `/property-intelligence` — enter a US address, pick **Property dossier**, **Generate**.
3. Run `npm run check:property-keys` — confirm vendor keys are configured.

Property Intelligence is **always enabled in local dev**. Production requires `VITE_PROPERTY_INTELLIGENCE_ENABLED=true` on Vercel.

---

## What is this repo?

AXIOM is a property & casualty insurance technology company. This monorepo contains:

| Product | Route | Status |
|---------|-------|--------|
| **Home** | `/` | Marketing landing |
| **Public Data Command** | `/public-data-command` | Production-ready |
| **Property Intelligence** | `/property-intelligence` | Active development; feature-gated in production |

Backend: FastAPI service at `services/property-api/` (v0.4.0).

---

## Doc index — read in this order

| # | File | When to read |
|---|------|--------------|
| 1 | [01-product-vision.md](./01-product-vision.md) | Understand products, users, business model |
| 2 | [08-current-state-and-roadmap.md](./08-current-state-and-roadmap.md) | What's shipped vs in-flight right now |
| 3 | [02-repository-map.md](./02-repository-map.md) | Navigate the codebase |
| 4 | [03-frontend-architecture.md](./03-frontend-architecture.md) | React/Vite patterns |
| 5 | [04-backend-architecture.md](./04-backend-architecture.md) | Property API engine and adapters |
| 6 | [05-design-system.md](./05-design-system.md) | Visual language and UI conventions |
| 7 | [06-data-flows.md](./06-data-flows.md) | End-to-end pipelines (with diagrams) |
| 8 | [07-environment-and-deployment.md](./07-environment-and-deployment.md) | Env vars, Vercel, Render |
| 9 | [09-conventions-and-agent-rules.md](./09-conventions-and-agent-rules.md) | **Read before making changes** |
| 10 | [10-known-gaps-and-stubs.md](./10-known-gaps-and-stubs.md) | Incomplete work and limitations |
| 11 | [11-onboarding-checklist.md](./11-onboarding-checklist.md) | First-session step-by-step |

---

## Existing deep-dive docs (cross-reference)

This handoff folder is the **map**. These docs are the **deep dives**:

| Doc | Topic |
|-----|-------|
| [../PROPERTY-INTELLIGENCE.md](../PROPERTY-INTELLIGENCE.md) | PI setup, presets, demo checklist, launch |
| [../PUBLIC-DATA-COMMAND-ARCHITECTURE.md](../PUBLIC-DATA-COMMAND-ARCHITECTURE.md) | PDC feed pipeline, RiskEvent schema |
| [../BILLING-SETUP.md](../BILLING-SETUP.md) | Stripe webhook, Render deploy, local CLI |
| [../GOOGLE-MAPS-SETUP.md](../GOOGLE-MAPS-SETUP.md) | Street View API keys |
| [../../AGENTS.md](../../AGENTS.md) | Cursor agent entry point |

---

## Agent methodology

Non-trivial work should follow **Superpowers** skills in `.cursor/superpowers/`. See [09-conventions-and-agent-rules.md](./09-conventions-and-agent-rules.md).

Install or update: `npm run install:superpowers`

---

## Key rules for agents

1. **Minimal scope** — match existing patterns; no drive-by refactors.
2. **No commits unless asked** — user must explicitly request git commits.
3. **Never commit secrets** — `.env`, API keys, `__pycache__`.
4. **Property Intelligence needs the API** — use `npm run dev:all`, not `npm run dev` alone.
5. **Check in-flight work** — see [08-current-state-and-roadmap.md](./08-current-state-and-roadmap.md) before assuming git is clean.
