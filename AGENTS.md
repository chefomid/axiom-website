# AXIOM, agent instructions

## New agent? Start here

**Read [`docs/agent-handoff/README.md`](docs/agent-handoff/README.md) first.** That folder is the full continuity package: product vision, architecture, design system, env setup, in-flight work, and onboarding checklist. No prior chat history required.

## Copy style

**Do not use em dashes (—) in website copy, UI strings, page titles, or user-facing API messages.** Use commas, periods, colons, pipes (`|`), or rephrase instead. Use `-` for empty or missing values in tables and compact UI.

## Superpowers

Non-trivial development should follow [Superpowers](https://github.com/obra/superpowers) skills in `.cursor/superpowers/skills/`. See `.cursor/rules/superpowers.mdc`.

Install or update: `npm run install:superpowers`

## Products

| Route | Purpose |
|-------|---------|
| `/public-data-command` | Live government hazard feeds |
| `/property-intelligence` | À la carte property dossiers + live receipt pricing |

Property API lives in `services/property-api/`. See `docs/PROPERTY-INTELLIGENCE.md`.

## Accounts and Git identity

Use **only** the `orcc_omid` / **chefomid** accounts for deploys and commits. Do **not** use `omid.rezaee@oit.edu` or GitHub `omidrezaee1` for Vercel-linked work; those commits trigger blocked GitHub auto-deploys.

| Service | Account |
|---------|---------|
| Vercel CLI / team | `chefomid` (`chefomids-projects`), signed in as `orcc_omid@outlook.com` |
| Git author | `orcc_omid@outlook.com` |
| COI demo UI deploy | `vercel deploy --prod --scope chefomids-projects --archive=tgz` (do not rely on Git auto-deploy for `coi-demo-ui`) |

## Quick start

```powershell
npm install
npm run dev:all
```

See [`docs/agent-handoff/11-onboarding-checklist.md`](docs/agent-handoff/11-onboarding-checklist.md) for the full first-session checklist.
